/**
 * Register Tools - Register all local tools with the ToolRegistry
 * 
 * This module imports all tool implementations and registers them
 */

import { registerTool } from './ToolRegistry.js';

// Import all tool implementations
import BashTool from './implementations/BashTool.js';
import ReadTool from './implementations/ReadTool.js';
import WriteTool from './implementations/WriteTool.js';
import EditTool from './implementations/EditTool.js';
import GlobTool from './implementations/GlobTool.js';
import GrepTool from './implementations/GrepTool.js';
import WebFetchTool from './implementations/WebFetchTool.js';

/**
 * Register all available tools with the registry
 */
export function registerAllTools() {
    const tools = [
        BashTool,
        ReadTool,
        WriteTool,
        EditTool,
        GlobTool,
        GrepTool,
        WebFetchTool
    ];
    
    for (const tool of tools) {
        registerTool(tool.name, {
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            execute: tool.execute
        });
    }
    
    return tools.length;
}

/**
 * Get a summary of all registered tools
 * @returns {Array} Array of tool info objects
 */
export function getToolSummary() {
    return [
        {
            name: 'bash',
            description: 'Execute a shell command',
            inputSchema: BashTool.inputSchema
        },
        {
            name: 'read',
            description: 'Read file contents',
            inputSchema: ReadTool.inputSchema
        },
        {
            name: 'write',
            description: 'Write content to a file',
            inputSchema: WriteTool.inputSchema
        },
        {
            name: 'edit',
            description: 'Edit file by replacing string',
            inputSchema: EditTool.inputSchema
        },
        {
            name: 'glob',
            description: 'Find files matching a pattern',
            inputSchema: GlobTool.inputSchema
        },
        {
            name: 'grep',
            description: 'Search for patterns in files',
            inputSchema: GrepTool.inputSchema
        },
        {
            name: 'webfetch',
            description: 'Fetch content from a URL',
            inputSchema: WebFetchTool.inputSchema
        }
    ];
}

// Auto-register on import
export const registeredCount = registerAllTools();

export default {
    registerAllTools,
    getToolSummary,
    registeredCount
};