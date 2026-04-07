/**
 * Tool Registry - Manages registration and retrieval of local tools
 * 
 * Pattern follows the adapterRegistry in src/providers/adapter.js
 */

// Internal registry using Map pattern
const toolRegistry = new Map();

/**
 * Tool definition shape:
 * {
 *   name: string,           // Unique tool identifier
 *   description: string,    // Human-readable description
 *   inputSchema: object,    // JSON Schema for tool input validation
 *   execute: function       // Async function that executes the tool
 * }
 */

/**
 * Register a tool with the registry
 * @param {string} name - Unique tool identifier
 * @param {Object} def - Tool definition object
 * @param {string} def.name - Tool name
 * @param {string} def.description - Tool description
 * @param {Object} def.inputSchema - JSON Schema for input validation
 * @param {Function} def.execute - Async function to execute the tool
 */
export function registerTool(name, def) {
    if (!name || typeof name !== 'string') {
        throw new Error('Tool name must be a non-empty string');
    }
    if (!def || typeof def !== 'object') {
        throw new Error('Tool definition must be an object');
    }
    if (!def.description || typeof def.description !== 'string') {
        throw new Error('Tool definition must include a description string');
    }
    if (!def.execute || typeof def.execute !== 'function') {
        throw new Error('Tool definition must include an execute function');
    }
    
    toolRegistry.set(name, {
        name,
        description: def.description,
        inputSchema: def.inputSchema || {},
        execute: def.execute
    });
}

/**
 * Get a tool by name
 * @param {string} name - Tool name to retrieve
 * @returns {Object|undefined} Tool definition or undefined if not found
 */
export function getTool(name) {
    return toolRegistry.get(name);
}

/**
 * List all registered tools
 * @returns {Array} Array of tool definition objects
 */
export function listTools() {
    return Array.from(toolRegistry.values());
}

/**
 * Check if a tool is registered
 * @param {string} name - Tool name to check
 * @returns {boolean} True if tool is registered
 */
export function hasTool(name) {
    return toolRegistry.has(name);
}

/**
 * Unregister a tool (primarily for testing)
 * @param {string} name - Tool name to unregister
 * @returns {boolean} True if tool was removed
 */
export function unregisterTool(name) {
    return toolRegistry.delete(name);
}

/**
 * Clear all registered tools (primarily for testing)
 */
export function clearTools() {
    toolRegistry.clear();
}

export { toolRegistry };