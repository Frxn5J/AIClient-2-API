/**
 * Unit Tests for ToolExecutionService
 * 
 * Tests successful execution flow
 * Tests ToolPermissionError thrown correctly
 * Tests ToolNotFoundError thrown correctly
 * Tests ToolExecutionError on execution failure
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { executeTool, ToolPermissionError, ToolNotFoundError, ToolExecutionError } from '../../src/tools/ToolExecutionService.js';
import * as ToolRegistry from '../../src/tools/ToolRegistry.js';
import PermissionGate from '../../src/tools/PermissionGate.js';

describe('ToolExecutionService', () => {
    beforeEach(() => {
        // Clear registry before each test
        ToolRegistry.clearTools();
    });

    afterEach(() => {
        ToolRegistry.clearTools();
    });

    describe('executeTool - successful execution', () => {
        test('should execute tool successfully when allowed', async () => {
            // Register a test tool
            ToolRegistry.registerTool('test-tool', {
                description: 'A test tool',
                execute: jest.fn().mockResolvedValue({ result: 'success' })
            });

            const config = {
                TOOL_RUNTIME_ENABLED: true,
                TOOL_PERMISSIONS: ['test-tool']
            };

            const result = await executeTool('test-tool', { input: 'test' }, config);

            expect(result.success).toBe(true);
            expect(result.output).toEqual({ result: 'success' });
            expect(result.error).toBeNull();
            expect(result.metadata).toBeDefined();
            expect(result.metadata.toolName).toBe('test-tool');
            expect(result.metadata.duration).toBeGreaterThanOrEqual(0);
        });

        test('should include timestamp in metadata', async () => {
            ToolRegistry.registerTool('test-tool', {
                description: 'A test tool',
                execute: jest.fn().mockResolvedValue({ result: 'success' })
            });

            const config = {
                TOOL_RUNTIME_ENABLED: true,
                TOOL_PERMISSIONS: ['test-tool']
            };

            const before = new Date().toISOString();
            const result = await executeTool('test-tool', {}, config);
            const after = new Date().toISOString();

            expect(result.metadata.timestamp).toBeDefined();
            expect(new Date(result.metadata.timestamp).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
            expect(new Date(result.metadata.timestamp).getTime()).toBeLessThanOrEqual(new Date(after).getTime());
        });
    });

    describe('executeTool - permission errors', () => {
        test('should throw ToolPermissionError when runtime is not enabled', async () => {
            ToolRegistry.registerTool('test-tool', {
                description: 'A test tool',
                execute: jest.fn().mockResolvedValue({ result: 'success' })
            });

            const config = {
                TOOL_RUNTIME_ENABLED: false,
                TOOL_PERMISSIONS: ['test-tool']
            };

            await expect(executeTool('test-tool', {}, config)).rejects.toThrow(ToolPermissionError);
            await expect(executeTool('test-tool', {}, config)).rejects.toThrow('Tool runtime is not enabled');
        });

        test('should throw ToolPermissionError when tool not in allowlist', async () => {
            ToolRegistry.registerTool('unauthorized-tool', {
                description: 'Test tool',
                execute: jest.fn().mockResolvedValue({ result: 'success' })
            });

            const config = {
                TOOL_RUNTIME_ENABLED: true,
                TOOL_PERMISSIONS: ['other-tool'] // Not including 'unauthorized-tool'
            };

            await expect(executeTool('unauthorized-tool', {}, config)).rejects.toThrow(ToolPermissionError);
            await expect(executeTool('unauthorized-tool', {}, config)).rejects.toThrow("Tool 'unauthorized-tool' is not in the allowed tools list");
        });
    });

    describe('executeTool - not found errors', () => {
        test('should throw ToolNotFoundError when tool does not exist', async () => {
            // Don't register any tool
            const config = {
                TOOL_RUNTIME_ENABLED: true,
                TOOL_PERMISSIONS: ['non-existent-tool']
            };

            await expect(executeTool('non-existent-tool', {}, config)).rejects.toThrow(ToolNotFoundError);
            await expect(executeTool('non-existent-tool', {}, config)).rejects.toThrow("Tool 'non-existent-tool' not found in registry");
        });
    });

    describe('executeTool - execution errors', () => {
        test('should throw ToolExecutionError when tool execution fails', async () => {
            // Register a tool that throws an error
            ToolRegistry.registerTool('failing-tool', {
                description: 'A failing tool',
                execute: jest.fn().mockRejectedValue(new Error('Execution failed!'))
            });

            const config = {
                TOOL_RUNTIME_ENABLED: true,
                TOOL_PERMISSIONS: ['failing-tool']
            };

            await expect(executeTool('failing-tool', {}, config)).rejects.toThrow(ToolExecutionError);
            await expect(executeTool('failing-tool', {}, config)).rejects.toThrow("Tool 'failing-tool' execution failed");
        });

        test('should wrap non-custom errors in ToolExecutionError', async () => {
            ToolRegistry.registerTool('error-tool', {
                description: 'An error tool',
                execute: jest.fn().mockRejectedValue(new Error('Something went wrong'))
            });

            const config = {
                TOOL_RUNTIME_ENABLED: true,
                TOOL_PERMISSIONS: ['error-tool']
            };

            try {
                await executeTool('error-tool', {}, config);
                fail('Expected error to be thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(ToolExecutionError);
                expect(error.toolName).toBe('error-tool');
                expect(error.originalError).toBeDefined();
                expect(error.originalError.message).toBe('Something went wrong');
            }
        });

        test('should not re-wrap ToolExecutionError', async () => {
            const originalError = new ToolExecutionError('Already wrapped', 'test-tool', new Error('inner'));
            
            ToolRegistry.registerTool('wrapped-tool', {
                description: 'A tool that throws ToolExecutionError',
                execute: jest.fn().mockRejectedValue(originalError)
            });

            const config = {
                TOOL_RUNTIME_ENABLED: true,
                TOOL_PERMISSIONS: ['wrapped-tool']
            };

            try {
                await executeTool('wrapped-tool', {}, config);
                fail('Expected error');
            } catch (error) {
                // Should be the same error, not re-wrapped
                expect(error).toBeInstanceOf(ToolExecutionError);
                expect(error.message).toBe('Already wrapped');
            }
        });
    });

    describe('executeTool - custom error classes', () => {
        test('should have correct name property for ToolPermissionError', () => {
            const error = new ToolPermissionError('Test error', 'test-tool');
            expect(error.name).toBe('ToolPermissionError');
            expect(error.toolName).toBe('test-tool');
        });

        test('should have correct name property for ToolNotFoundError', () => {
            const error = new ToolNotFoundError('Test error', 'test-tool');
            expect(error.name).toBe('ToolNotFoundError');
            expect(error.toolName).toBe('test-tool');
        });

        test('should have correct name property for ToolExecutionError', () => {
            const originalError = new Error('Original');
            const error = new ToolExecutionError('Test error', 'test-tool', originalError);
            expect(error.name).toBe('ToolExecutionError');
            expect(error.toolName).toBe('test-tool');
            expect(error.originalError).toBe(originalError);
        });
    });
});