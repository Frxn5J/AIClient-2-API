/**
 * Agent Loop - Manages the iterative agent-tool execution cycle
 * 
 * Implements an async generator that:
 * 1. Calls the API with current messages
 * 2. Collects tool_calls from the response
 * 3. Executes each tool
 * 4. Formats results
 * 5. Appends to messages and repeats
 * 
 * Yields SSE chunks compatible with the Responses API
 */

import { executeTool, ToolExecutionError, ToolNotFoundError, ToolPermissionError } from './ToolExecutionService.js';
import { formatToolResult } from './ToolResultFormatter.js';

/**
 * Run the agent loop - async generator that handles tool execution cycles
 * 
 * @param {Object} apiService - The API service adapter to use for calls
 * @param {Object} request - Initial request with messages, model, etc.
 * @param {Object} config - Configuration object with tool settings
 * @yields {Object} SSE chunks for streaming response
 * @returns {Promise<Object>} Final response when loop completes
 */
export async function* runAgentLoop(apiService, request, config) {
    // Default configuration
    const maxIterations = config.TOOL_MAX_ITERATIONS || 10;
    const toolChoice = request.tool_choice || 'auto';
    
    // Clone messages to avoid mutating the original request
    const messages = [...(request.messages || [])];
    
    // Build the API call payload
    const apiPayload = {
        model: request.model,
        messages: messages,
        tools: request.tools,
        tool_choice: toolChoice,
        temperature: request.temperature,
        max_tokens: request.max_tokens,
        stream: true // We want streaming for SSE
    };
    
    let iteration = 0;
    let stopReason = null;
    let finalResponse = null;
    
    while (iteration < maxIterations) {
        iteration++;
        
        // Make API call
        let response;
        try {
            response = await apiService(apiPayload);
        } catch (error) {
            yield createSSEChunk({
                type: 'error',
                error: {
                    message: `API call failed: ${error.message}`,
                    type: 'api_error'
                }
            });
            break;
        }
        
        // Handle streaming response
        if (response && response[Symbol.asyncIterator]) {
            let toolCalls = [];
            let content = '';
            
            for await (const chunk of response) {
                // Yield the chunk for streaming
                yield chunk;
                
                // Parse chunk for tool calls and content
                const parsed = parseChunk(chunk);
                if (parsed.toolCalls) {
                    toolCalls.push(...parsed.toolCalls);
                }
                if (parsed.content) {
                    content += parsed.content;
                }
                if (parsed.stopReason) {
                    stopReason = parsed.stopReason;
                }
            }
            
            // If there are tool calls, execute them
            if (toolCalls.length > 0 && stopReason !== 'end_turn') {
                // Add the assistant's response to messages
                messages.push({
                    role: 'assistant',
                    content: content,
                    tool_calls: toolCalls.map(tc => ({
                        id: tc.id,
                        type: 'function',
                        function: {
                            name: tc.function.name,
                            arguments: typeof tc.function.arguments === 'string' 
                                ? tc.function.arguments 
                                : JSON.stringify(tc.function.arguments)
                        }
                    }))
                });
                
                // Execute each tool call
                for (const toolCall of toolCalls) {
                    const toolResult = await executeToolCall(toolCall, config);
                    
                    // Add tool result to messages
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: toolResult
                    });
                    
                    // Yield the formatted tool result as SSE
                    yield createSSEChunk({
                        type: 'function_call_output',
                        output: toolResult,
                        tool_call_id: toolCall.id
                    });
                }
                
                // Continue the loop with updated messages
                apiPayload.messages = messages;
                continue;
            } else {
                // No more tool calls - we're done
                finalResponse = content;
                break;
            }
        } else {
            // Non-streaming response
            if (response?.output?.tool_calls?.length > 0) {
                const toolCalls = response.output.tool_calls;
                
                // Add assistant message
                messages.push({
                    role: 'assistant',
                    content: response.output.content?.[0]?.text || '',
                    tool_calls: toolCalls
                });
                
                // Execute tool calls
                for (const toolCall of toolCalls) {
                    const toolResult = await executeToolCall(
                        convertToolCall(toolCall),
                        config
                    );
                    
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: toolResult
                    });
                }
                
                apiPayload.messages = messages;
                continue;
            } else {
                finalResponse = response?.output?.content?.[0]?.text || '';
                stopReason = response?.stop_reason || 'end_turn';
                break;
            }
        }
    }
    
    if (iteration >= maxIterations) {
        stopReason = 'max_iterations';
    }
    
    // Return final result
    return {
        messages,
        stopReason,
        iterations: iteration,
        content: finalResponse
    };
}

/**
 * Execute a single tool call with error handling
 * @param {Object} toolCall - The tool call from the API
 * @param {Object} config - Configuration object
 * @returns {Promise<string>} Formatted tool result
 */
async function executeToolCall(toolCall, config) {
    const { id, function: fn } = toolCall;
    const toolName = fn.name;
    let toolInput;
    
    // Parse arguments
    try {
        toolInput = typeof fn.arguments === 'string' 
            ? JSON.parse(fn.arguments) 
            : fn.arguments;
    } catch (error) {
        return formatToolResult({
            success: false,
            error: `Failed to parse tool arguments: ${error.message}`,
            toolName,
            callId: id
        });
    }
    
    try {
        const result = await executeTool(toolName, toolInput, config);
        
        return formatToolResult({
            success: true,
            output: result.output,
            toolName,
            callId: id,
            metadata: result.metadata
        });
    } catch (error) {
        let errorMessage;
        
        if (error instanceof ToolPermissionError) {
            errorMessage = `Permission denied: ${error.message}`;
        } else if (error instanceof ToolNotFoundError) {
            errorMessage = `Tool not found: ${error.message}`;
        } else if (error instanceof ToolExecutionError) {
            errorMessage = `Execution failed: ${error.message}`;
        } else {
            errorMessage = `Unexpected error: ${error.message}`;
        }
        
        return formatToolResult({
            success: false,
            error: errorMessage,
            toolName,
            callId: id
        });
    }
}

/**
 * Parse an SSE chunk from the API response
 * @param {Object} chunk - Raw chunk from API
 * @returns {Object} Parsed content with toolCalls, content, stopReason
 */
function parseChunk(chunk) {
    const result = {
        toolCalls: [],
        content: '',
        stopReason: null
    };
    
    try {
        // Handle different API response formats
        if (chunk.choices?.[0]?.delta) {
            const delta = chunk.choices[0].delta;
            
            if (delta.tool_calls) {
                result.toolCalls = delta.tool_calls;
            }
            
            if (delta.content) {
                result.content = delta.content;
            }
            
            if (chunk.choices[0].finish_reason) {
                result.stopReason = chunk.choices[0].finish_reason;
            }
        } else if (chunk.output?.tool_calls) {
            result.toolCalls = chunk.output.tool_calls;
        } else if (chunk.output?.content) {
            result.content = typeof chunk.output.content === 'string' 
                ? chunk.output.content 
                : chunk.output.content[0]?.text || '';
        }
    } catch (error) {
        // Ignore parse errors for individual chunks
    }
    
    return result;
}

/**
 * Convert API-specific tool call format to standard format
 * @param {Object} toolCall - Tool call from API
 * @returns {Object} Standardized tool call
 */
function convertToolCall(toolCall) {
    return {
        id: toolCall.id,
        function: {
            name: toolCall.function?.name || toolCall.name,
            arguments: toolCall.function?.arguments || toolCall.arguments || '{}'
        }
    };
}

/**
 * Create an SSE chunk for streaming response
 * @param {Object} data - Data to include in the chunk
 * @returns {Object} Formatted SSE chunk
 */
function createSSEChunk(data) {
    return {
        type: 'message_delta' in data ? 'message_delta' : 'function_call_output',
        ...data
    };
}

export default {
    runAgentLoop
};