/**
 * Tool Execution Service - Main entry point for executing local tools
 * 
 * Flow: PermissionGate.isAllowed() → registry.getTool() → execute()
 */

// Import built-in modules
import { execFile } from 'child_process';

// Import local modules
import { getTool } from './ToolRegistry.js';
import PermissionGate from './PermissionGate.js';

/**
 * Custom error classes for tool execution
 */
export class ToolPermissionError extends Error {
    constructor(message, toolName) {
        super(message);
        this.name = 'ToolPermissionError';
        this.toolName = toolName;
    }
}

export class ToolNotFoundError extends Error {
    constructor(message, toolName) {
        super(message);
        this.name = 'ToolNotFoundError';
        this.toolName = toolName;
    }
}

export class ToolExecutionError extends Error {
    constructor(message, toolName, originalError) {
        super(message);
        this.name = 'ToolExecutionError';
        this.toolName = toolName;
        this.originalError = originalError;
    }
}

/**
 * Execute a tool by name with input and configuration
 * @param {string} toolName - Name of the tool to execute
 * @param {Object} toolInput - Input data for the tool
 * @param {Object} config - Configuration object with TOOL_PERMISSIONS, TOOL_WORKING_DIR, etc.
 * @returns {Promise<Object>} Normalized result: { success, output, error, metadata }
 */
export async function executeTool(toolName, toolInput, config) {
    const startTime = Date.now();
    
    // Step 1: Check if tool runtime is enabled
    if (!PermissionGate.isRuntimeEnabled(config)) {
        throw new ToolPermissionError(
            'Tool runtime is not enabled. Set TOOL_RUNTIME_ENABLED to true in config.',
            toolName
        );
    }

    // Step 2: Check permission using PermissionGate
    const permission = PermissionGate.isAllowed(toolName, config);
    if (!permission.allowed) {
        throw new ToolPermissionError(permission.reason, toolName);
    }

    // Step 3: Get the tool from registry
    const tool = getTool(toolName);
    if (!tool) {
        throw new ToolNotFoundError(
            `Tool '${toolName}' not found in registry. Make sure it's registered.`,
            toolName
        );
    }

    // Step 4: Execute the tool with error handling
    try {
        const output = await tool.execute(toolInput, config);
        
        return {
            success: true,
            output,
            error: null,
            metadata: {
                toolName,
                duration: Date.now() - startTime,
                timestamp: new Date().toISOString()
            }
        };
    } catch (error) {
        // Check if it's already one of our custom errors
        if (error instanceof ToolPermissionError || 
            error instanceof ToolNotFoundError ||
            error instanceof ToolExecutionError) {
            throw error;
        }
        
        throw new ToolExecutionError(
            `Tool '${toolName}' execution failed: ${error.message}`,
            toolName,
            error
        );
    }
}

export default {
    executeTool,
    ToolPermissionError,
    ToolNotFoundError,
    ToolExecutionError
};