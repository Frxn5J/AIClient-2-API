/**
 * ReadTool - Read file contents with path safety enforcement
 * 
 * SECURITY: Enforces path within TOOL_WORKING_DIR to prevent directory traversal
 * 
 * Input schema:
 * {
 *   filePath: string,   // Path to the file to read
 *   limit?: number,     // Optional: Maximum number of lines/bytes to read
 *   offset?: number     // Optional: Number of lines/bytes to skip
 * }
 * 
 * Output schema:
 * {
 *   content: string,
 *   path: string,
 *   encoding: string
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
        throw new Error('ReadTool: filePath is required and must be a string');
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
            `ReadTool: Access denied. Path '${filePath}' is outside the allowed working directory '${workingDir}'`
        );
    }
    
    return normalizedPath;
}

/**
 * Read a file with optional offset and limit
 * @param {Object} toolInput - Input with filePath, limit, offset
 * @param {Object} config - Configuration object with TOOL_WORKING_DIR
 * @returns {Promise<Object>} Result with content, path, encoding
 */
export async function execute(toolInput, config) {
    const { filePath, limit, offset = 0 } = toolInput;
    const workingDir = config.TOOL_WORKING_DIR || process.cwd();
    
    // Validate and resolve path (throws if outside working dir)
    const resolvedPath = resolveAndValidatePath(filePath, workingDir);
    
    // Check if file exists and is readable
    try {
        await fs.access(resolvedPath, fs.constants.R_OK);
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error(`ReadTool: File not found: ${filePath}`);
        }
        if (error.code === 'EACCES') {
            throw new Error(`ReadTool: Permission denied: ${filePath}`);
        }
        throw new Error(`ReadTool: Cannot access file: ${error.message}`);
    }
    
    // Get file stats for size checking
    const stats = await fs.stat(resolvedPath);
    if (stats.isDirectory()) {
        throw new Error(`ReadTool: Cannot read directory: ${filePath}. Use GlobTool instead.`);
    }
    
    // Read the file content
    let content = await fs.readFile(resolvedPath, 'utf-8');
    
    // Apply offset (line-based or byte-based - using line-based here for text files)
    const lines = content.split('\n');
    const offsetLines = offset > 0 ? lines.slice(offset) : lines;
    
    // Apply limit
    const limitedLines = limit !== undefined ? offsetLines.slice(0, limit) : offsetLines;
    
    return {
        content: limitedLines.join('\n'),
        path: resolvedPath,
        encoding: 'utf-8',
        totalLines: lines.length,
        returnedLines: limitedLines.length,
        hasMore: limit !== undefined && offsetLines.length > limit
    };
}

/**
 * Input schema for ReadTool (JSON Schema format)
 */
export const inputSchema = {
    type: 'object',
    properties: {
        filePath: {
            type: 'string',
            description: 'Path to the file to read'
        },
        limit: {
            type: 'number',
            description: 'Maximum number of lines to return'
        },
        offset: {
            type: 'number',
            description: 'Number of lines to skip from the start',
            default: 0
        }
    },
    required: ['filePath']
};

export default {
    name: 'read',
    description: 'Read the contents of a file. Use for examining code, configs, or text files.',
    inputSchema,
    execute
};