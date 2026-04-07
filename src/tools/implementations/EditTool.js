/**
 * EditTool - Edit file contents by replacing oldString with newString
 * 
 * SECURITY: Enforces path within TOOL_WORKING_DIR to prevent directory traversal
 * Error if oldString not found or multiple matches
 * 
 * Input schema:
 * {
 *   filePath: string,   // Path to the file to edit
 *   oldString: string,  // String to find and replace
 *   newString: string   // String to replace it with
 * }
 * 
 * Output schema:
 * {
 *   path: string,
 *   oldString: string,
 *   newString: string,
 *   occurrences: number
 * }
 */

import { promises as fs } from 'fs';
import path from 'path';

/**
 * Resolve and validate that a path is within TOOL_WORKING_DIR
 * @param {string} filePath - The requested file path
 * @param {string} workingDir - The allowed working directory
 * @returns {string} The resolved absolute path
 * @throws {Error} If path would escape working directory
 */
function resolveAndValidatePath(filePath, workingDir) {
    if (!filePath || typeof filePath !== 'string') {
        throw new Error('EditTool: filePath is required and must be a string');
    }

    // Resolve to absolute path
    const absolutePath = path.isAbsolute(filePath) 
        ? filePath 
        : path.resolve(workingDir, filePath);
    
    // Normalize and check it stays within working directory
    const normalizedPath = path.normalize(absolutePath);
    const normalizedWorkingDir = path.normalize(path.resolve(workingDir));
    
    // Ensure the path starts with the working directory
    if (!normalizedPath.startsWith(normalizedWorkingDir + path.sep) && 
        normalizedPath !== normalizedWorkingDir) {
        throw new Error(
            `EditTool: Access denied. Path '${filePath}' is outside the allowed working directory '${workingDir}'`
        );
    }
    
    return normalizedPath;
}

/**
 * Edit a file by replacing oldString with newString
 * @param {Object} toolInput - Input with filePath, oldString, newString
 * @param {Object} config - Configuration object with TOOL_WORKING_DIR
 * @returns {Promise<Object>} Result with path, oldString, newString, occurrences
 */
export async function execute(toolInput, config) {
    const { filePath, oldString, newString } = toolInput;
    const workingDir = config.TOOL_WORKING_DIR || process.cwd();
    
    if (!oldString || typeof oldString !== 'string') {
        throw new Error('EditTool: oldString is required and must be a string');
    }
    
    if (newString === undefined || newString === null) {
        throw new Error('EditTool: newString is required');
    }
    
    // Validate and resolve path (throws if outside working dir)
    const resolvedPath = resolveAndValidatePath(filePath, workingDir);
    
    // Read the file
    let content;
    try {
        content = await fs.readFile(resolvedPath, 'utf-8');
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error(`EditTool: File not found: ${filePath}`);
        }
        throw new Error(`EditTool: Cannot read file: ${error.message}`);
    }
    
    // Count occurrences of oldString
    // Use a simple string search to avoid regex complexity
    let occurrences = 0;
    let searchIndex = 0;
    const lowerContent = content.toLowerCase();
    const lowerOldString = oldString.toLowerCase();
    
    while (true) {
        const index = lowerContent.indexOf(lowerOldString, searchIndex);
        if (index === -1) break;
        occurrences++;
        searchIndex = index + 1;
        
        // Safety limit to prevent infinite loops
        if (searchIndex >= content.length) break;
    }
    
    // Error if no occurrences found
    if (occurrences === 0) {
        throw new Error(`EditTool: oldString not found in file: ${filePath}`);
    }
    
    // Error if multiple occurrences (to prevent unintended edits)
    if (occurrences > 1) {
        throw new Error(
            `EditTool: Multiple occurrences (${occurrences}) of oldString found. ` +
            `Please provide a more specific oldString to match only one occurrence.`
        );
    }
    
    // Perform the replacement
    // Use indexOf with case sensitivity to get exact position
    const exactIndex = content.indexOf(oldString);
    if (exactIndex === -1) {
        // This shouldn't happen given our count, but just in case
        throw new Error('EditTool: Could not find exact match for oldString');
    }
    
    const newContent = content.substring(0, exactIndex) + newString + content.substring(exactIndex + oldString.length);
    
    // Write the modified content back
    await fs.writeFile(resolvedPath, newContent, 'utf-8');
    
    return {
        path: resolvedPath,
        oldString,
        newString,
        occurrences
    };
}

/**
 * Input schema for EditTool (JSON Schema format)
 */
export const inputSchema = {
    type: 'object',
    properties: {
        filePath: {
            type: 'string',
            description: 'Path to the file to edit'
        },
        oldString: {
            type: 'string',
            description: 'The string to find and replace'
        },
        newString: {
            type: 'string',
            description: 'The string to replace it with'
        }
    },
    required: ['filePath', 'oldString', 'newString']
};

export default {
    name: 'edit',
    description: 'Edit a file by replacing a specific string. Use for targeted code modifications.',
    inputSchema,
    execute
};