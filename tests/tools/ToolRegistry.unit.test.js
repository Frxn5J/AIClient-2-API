/**
 * Unit Tests for ToolRegistry
 * 
 * Tests registerTool, getTool, listTools, hasTool
 * Tests duplicate registration overwrites
 * Tests unknown tool returns undefined
 * Tests hasTool returns correct boolean
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { ToolRegistry, registerTool, getTool, listTools, hasTool, unregisterTool, clearTools } from '../../src/tools/ToolRegistry.js';

describe('ToolRegistry', () => {
    beforeEach(() => {
        // Clear registry before each test to ensure isolation
        clearTools();
    });

    afterEach(() => {
        // Clean up after each test
        clearTools();
    });

    describe('registerTool', () => {
        test('should register a valid tool', () => {
            const toolDef = {
                name: 'test-tool',
                description: 'A test tool',
                inputSchema: { type: 'object' },
                execute: async () => 'result'
            };

            registerTool('test-tool', toolDef);

            const tool = getTool('test-tool');
            expect(tool).toBeDefined();
            expect(tool.name).toBe('test-tool');
            expect(tool.description).toBe('A test tool');
        });

        test('should reject registration without tool name', () => {
            const toolDef = {
                description: 'A test tool',
                execute: async () => 'result'
            };

            expect(() => registerTool('', toolDef)).toThrow('Tool name must be a non-empty string');
            expect(() => registerTool(null, toolDef)).toThrow('Tool name must be a non-empty string');
            expect(() => registerTool(undefined, toolDef)).toThrow('Tool name must be a non-empty string');
        });

        test('should reject registration without valid definition', () => {
            expect(() => registerTool('test-tool', null)).toThrow('Tool definition must be an object');
            expect(() => registerTool('test-tool', 'not an object')).toThrow('Tool definition must be an object');
            expect(() => registerTool('test-tool', {})).toThrow('Tool definition must include a description string');
        });

        test('should reject registration without description', () => {
            const toolDef = {
                execute: async () => 'result'
            };

            expect(() => registerTool('test-tool', toolDef)).toThrow('Tool definition must include a description string');
        });

        test('should reject registration without execute function', () => {
            const toolDef = {
                description: 'A test tool'
            };

            expect(() => registerTool('test-tool', toolDef)).toThrow('Tool definition must include an execute function');
        });
    });

    describe('getTool', () => {
        test('should retrieve a registered tool', () => {
            const toolDef = {
                description: 'A test tool',
                inputSchema: { type: 'object' },
                execute: async () => 'result'
            };

            registerTool('my-tool', toolDef);
            const tool = getTool('my-tool');

            expect(tool).toBeDefined();
            expect(tool.name).toBe('my-tool');
            expect(typeof tool.execute).toBe('function');
        });

        test('should return undefined for unknown tool', () => {
            const tool = getTool('non-existent-tool');
            expect(tool).toBeUndefined();
        });

        test('should return undefined for empty string tool name', () => {
            const tool = getTool('');
            expect(tool).toBeUndefined();
        });
    });

    describe('listTools', () => {
        test('should list all registered tools', () => {
            registerTool('tool-1', {
                description: 'Tool 1',
                execute: async () => 'result1'
            });
            registerTool('tool-2', {
                description: 'Tool 2',
                execute: async () => 'result2'
            });

            const tools = listTools();
            expect(tools).toHaveLength(2);
            expect(tools.map(t => t.name)).toContain('tool-1');
            expect(tools.map(t => t.name)).toContain('tool-2');
        });

        test('should return empty array when no tools registered', () => {
            const tools = listTools();
            expect(tools).toHaveLength(0);
            expect(Array.isArray(tools)).toBe(true);
        });
    });

    describe('hasTool', () => {
        test('should return true for registered tool', () => {
            registerTool('existing-tool', {
                description: 'Existing tool',
                execute: async () => 'result'
            });

            expect(hasTool('existing-tool')).toBe(true);
        });

        test('should return false for unknown tool', () => {
            expect(hasTool('unknown-tool')).toBe(false);
        });

        test('should return false for empty string', () => {
            expect(hasTool('')).toBe(false);
        });
    });

    describe('duplicate registration', () => {
        test('should overwrite existing tool with same name', () => {
            registerTool('duplicate-tool', {
                description: 'Original description',
                execute: async () => 'original'
            });

            registerTool('duplicate-tool', {
                description: 'Updated description',
                execute: async () => 'updated'
            });

            const tool = getTool('duplicate-tool');
            expect(tool.description).toBe('Updated description');

            // Should still be only one tool
            const tools = listTools();
            expect(tools).toHaveLength(1);
        });
    });

    describe('unregisterTool', () => {
        test('should remove a registered tool', () => {
            registerTool('removable-tool', {
                description: 'Removable tool',
                execute: async () => 'result'
            });

            expect(hasTool('removable-tool')).toBe(true);

            const removed = unregisterTool('removable-tool');
            expect(removed).toBe(true);
            expect(hasTool('removable-tool')).toBe(false);
        });

        test('should return false when unregistering non-existent tool', () => {
            const removed = unregisterTool('non-existent');
            expect(removed).toBe(false);
        });
    });
});