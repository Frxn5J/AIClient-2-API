/**
 * Permission Gate - Controls access to tools based on configuration
 * 
 * Implements allowlist-based permission checking with default deny.
 */

/**
 * PermissionGate class for checking tool execution permissions
 */
export class PermissionGate {
    /**
     * Check if a tool is allowed to be executed
     * @param {string} toolName - Name of the tool to check
     * @param {Object} config - Configuration object
     * @param {string[]} [config.TOOL_PERMISSIONS] - Array of allowed tool names
     * @returns {{ allowed: boolean, reason: string }} Result object with allowed status and denial reason
     */
    static isAllowed(toolName, config) {
        if (!toolName || typeof toolName !== 'string') {
            return {
                allowed: false,
                reason: 'Invalid tool name provided'
            };
        }

        if (!config || typeof config !== 'object') {
            return {
                allowed: false,
                reason: 'Invalid configuration object provided'
            };
        }

        // Default deny if TOOL_PERMISSIONS is not defined or is not an array
        if (!Array.isArray(config.TOOL_PERMISSIONS) || config.TOOL_PERMISSIONS.length === 0) {
            return {
                allowed: false,
                reason: 'Tool permissions not configured - access denied by default'
            };
        }

        // Check if tool is in the allowlist
        if (config.TOOL_PERMISSIONS.includes(toolName)) {
            return {
                allowed: true,
                reason: ''
            };
        }

        return {
            allowed: false,
            reason: `Tool '${toolName}' is not in the allowed tools list`
        };
    }

    /**
     * Check if tool runtime is enabled in config
     * @param {Object} config - Configuration object
     * @returns {boolean} True if tool runtime is enabled
     */
    static isRuntimeEnabled(config) {
        return config.TOOL_RUNTIME_ENABLED === true;
    }
}

export default PermissionGate;