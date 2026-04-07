/**
 * Tool Result Formatter - Format tool results for Responses API function_call_output
 * 
 * Handles:
 * - Success results with output
 * - Error results with is_error: true
 * - Preserves call_id linking
 */

/**
 * Format a tool result for the Responses API function_call_output format
 * 
 * @param {Object} params - Parameters for formatting
 * @param {boolean} params.success - Whether the tool execution succeeded
 * @param {Object|string} params.output - The tool output (if success)
 * @param {string} params.error - Error message (if failure)
 * @param {string} params.toolName - Name of the tool that was executed
 * @param {string} params.callId - The call_id from the tool call
 * @param {Object} params.metadata - Optional metadata (duration, etc.)
 * @returns {string} Formatted result as JSON string for function_call_output
 */
export function formatToolResult({ success, output, error, toolName, callId, metadata }) {
    let result;
    
    if (success) {
        // Format successful result
        result = {
            success: true,
            output: output,
            tool: toolName,
            ...(metadata && { metadata })
        };
    } else {
        // Format error result
        result = {
            success: false,
            is_error: true,
            error: error,
            tool: toolName
        };
    }
    
    // Return as JSON string (Responses API expects string content for tool results)
    return JSON.stringify(result, null, 2);
}

/**
 * Parse a tool result from JSON string back to object
 * @param {string} resultString - JSON string from function_call_output
 * @returns {Object} Parsed tool result
 */
export function parseToolResult(resultString) {
    try {
        return JSON.parse(resultString);
    } catch (error) {
        return {
            success: false,
            is_error: true,
            error: `Failed to parse tool result: ${error.message}`,
            raw: resultString
        };
    }
}

/**
 * Format multiple tool results (for parallel execution)
 * @param {Array<Object>} results - Array of tool results
 * @returns {Array<string>} Array of formatted result strings
 */
export function formatToolResults(results) {
    return results.map(result => formatToolResult(result));
}

/**
 * Create a formatted error result
 * @param {string} message - Error message
 * @param {string} toolName - Tool name for context
 * @param {string} callId - The call_id from the tool call
 * @returns {string} Formatted error result
 */
export function formatErrorResult(message, toolName, callId) {
    return formatToolResult({
        success: false,
        error: message,
        toolName,
        callId
    });
}

/**
 * Create a formatted success result
 * @param {Object} output - Tool output
 * @param {string} toolName - Tool name for context
 * @param {string} callId - The call_id from the tool call
 * @param {Object} metadata - Optional metadata
 * @returns {string} Formatted success result
 */
export function formatSuccessResult(output, toolName, callId, metadata) {
    return formatToolResult({
        success: true,
        output,
        toolName,
        callId,
        metadata
    });
}

export default {
    formatToolResult,
    parseToolResult,
    formatToolResults,
    formatErrorResult,
    formatSuccessResult
};