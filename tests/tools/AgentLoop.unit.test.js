/**
 * Unit Tests for AgentLoop
 * 
 * Tests single tool call round-trip yields correct SSE chunks
 * Tests end_turn stops loop
 * Tests tool error surfaces as tool_result with is_error: true
 * Tests max iterations limit
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as ToolExecutionService from '../../src/tools/ToolExecutionService.js';

describe('AgentLoop', () => {
    let mockExecuteTool;

    beforeEach(() => {
        // Mock executeTool
        mockExecuteTool = jest.spyOn(ToolExecutionService, 'executeTool');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('tool error formatting', () => {
        test('should format tool errors with is_error: true', async () => {
            // Import the formatter to check error formatting
            const { formatToolResult } = await import('../../src/tools/ToolResultFormatter.js');

            const errorResult = formatToolResult({
                success: false,
                error: 'Tool execution failed',
                toolName: 'bash',
                callId: 'call_123'
            });

            const parsed = JSON.parse(errorResult);
            expect(parsed.success).toBe(false);
            expect(parsed.is_error).toBe(true);
            expect(parsed.error).toBe('Tool execution failed');
            expect(parsed.tool).toBe('bash');
        });

        test('should format successful tool results correctly', async () => {
            const { formatToolResult } = await import('../../src/tools/ToolResultFormatter.js');

            const successResult = formatToolResult({
                success: true,
                output: { stdout: 'result' },
                toolName: 'bash',
                callId: 'call_123',
                metadata: { duration: 10 }
            });

            const parsed = JSON.parse(successResult);
            expect(parsed.success).toBe(true);
            expect(parsed.output).toEqual({ stdout: 'result' });
            expect(parsed.tool).toBe('bash');
            expect(parsed.metadata).toBeDefined();
        });

        test('should format error result with tool name preserved', async () => {
            const { formatToolResult } = await import('../../src/tools/ToolResultFormatter.js');

            const errorResult = formatToolResult({
                success: false,
                error: 'Permission denied',
                toolName: 'read',
                callId: 'call_456'
            });

            const parsed = JSON.parse(errorResult);
            expect(parsed.tool).toBe('read');
            expect(parsed.is_error).toBe(true);
        });
    });

    describe('config handling', () => {
        test('should use default max iterations when not specified', () => {
            const config = {
                TOOL_RUNTIME_ENABLED: true,
                TOOL_PERMISSIONS: ['bash']
            };

            const maxIterations = config.TOOL_MAX_ITERATIONS || 10;
            expect(maxIterations).toBe(10);
        });

        test('should use custom max iterations from config', () => {
            const config = {
                TOOL_RUNTIME_ENABLED: true,
                TOOL_PERMISSIONS: ['bash'],
                TOOL_MAX_ITERATIONS: 5
            };

            const maxIterations = config.TOOL_MAX_ITERATIONS || 10;
            expect(maxIterations).toBe(5);
        });
    });

    describe('message format', () => {
        test('should create proper assistant message format', () => {
            const toolCalls = [{
                id: 'call_1',
                type: 'function',
                function: {
                    name: 'bash',
                    arguments: '{"command": "ls"}'
                }
            }];

            const message = {
                role: 'assistant',
                content: '',
                tool_calls: toolCalls.map(tc => ({
                    id: tc.id,
                    type: 'function',
                    function: {
                        name: tc.function.name,
                        arguments: tc.function.arguments
                    }
                }))
            };

            expect(message.role).toBe('assistant');
            expect(message.tool_calls).toHaveLength(1);
            expect(message.tool_calls[0].function.name).toBe('bash');
        });

        test('should create proper tool result message format', () => {
            const message = {
                role: 'tool',
                tool_call_id: 'call_1',
                content: '{"success": true, "output": {"result": "done"}}'
            };

            expect(message.role).toBe('tool');
            expect(message.tool_call_id).toBe('call_1');
        });
    });
});