/**
 * WriteTool - Write content to a file with path safety enforcement
 * 
 * SECURITY: Enforces path within TOOL_WORKING_DIR to prevent directory traversal
 * Creates parent directories as needed
 * 
 * Input schema:
 * {
 *   filePath: string,   // Path to the file to write
 *   content: string     // Content to write to the file
 * }
 * 
 * Output schema:
 * {
 *   path: string,
 *   bytesWritten: number,
 *   createdDirs: string[]
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
        throw new Error('WriteTool: filePath is required and must be a string');
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
            `WriteTool: Access denied. Path '${filePath}' is outside the allowed working directory '${workingDir}'`
        );
    }
    
    return normalizedPath;
}

/**
 * Write content to a file, creating parent directories as needed
 * @param {Object} toolInput - Input with filePath and content
 * @param {Object} config - Configuration object with TOOL_WORKING_DIR
 * @returns {Promise<Object>} Result with path, bytesWritten, createdDirs
 */
export async function execute(toolInput, config) {
    const { filePath, content } = toolInput;
    const workingDir = config.TOOL_WORKING_DIR || process.cwd();
    
    if (content === undefined || content === null) {
        throw new Error('WriteTool: content is required');
    }
    
    // Validate and resolve path (throws if outside working dir)
    const resolvedPath = resolveAndValidatePath(filePath, workingDir);
    
    // Get the directory part and create parent directories
    const dir = path.dirname(resolvedPath);
    const createdDirs = [];
    
    // Check which directories need to be created
    try {
        await fs.access(dir);
    } catch {
        // Directory doesn't exist, we need to create it
        await fs.mkdir(dir, { recursive: true });
        createdDirs.push(dir);
    }
    
    // Write the file
    const bytesWritten = await fs.writeFile(resolvedPath, content, 'utf-8');
    
    return {
        path: resolvedPath,
        bytesWritten: Buffer.byteLength(content, 'utf-8'),
        createdDirs
    };
}

/**
 * Input schema for WriteTool (JSON Schema format)
 */
export const inputSchema = {
    type: 'object',
    properties: {
        filePath: {
            type: 'string',
            description: 'Path to the file to write'
        },
        content: {
            type: 'string',
            description: 'Content to write to the file'
        }
    },
    required: ['filePath', 'content']
};

export default {
    name: 'write',
    description: 'Write content to a file. Creates parent directories if they do not exist.',
    inputSchema,
    execute
};