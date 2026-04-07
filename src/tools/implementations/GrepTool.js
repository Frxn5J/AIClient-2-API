/**
 * GrepTool - Search for patterns in files using fs + readline + regex
 * 
 * Input schema:
 * {
 *   pattern: string,    // Regex pattern to search for
 *   path: string,        // Path to file or directory to search
 *   include?: string     // Optional: Glob pattern for files to include
 * }
 * 
 * Output schema:
 * {
 *   matches: [
 *     {
 *       path: string,
 *       line: number,
 *       text: string
 *     }
 *   ]
 * }
 */

import { promises as fs } from 'fs';
import path from 'path';
import readline from 'readline';

/**
 * Resolve and validate that a path is within TOOL_WORKING_DIR
 * @param {string} filePath - The requested file path
 * @param {string} workingDir - The allowed working directory
 * @returns {string} The resolved absolute path
 * @throws {Error} If path would escape working directory
 */
function resolveAndValidatePath(filePath, workingDir) {
    if (!filePath || typeof filePath !== 'string') {
        throw new Error('GrepTool: path is required and must be a string');
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
            `GrepTool: Access denied. Path '${filePath}' is outside the allowed working directory '${workingDir}'`
        );
    }
    
    return normalizedPath;
}

/**
 * Convert simple glob to regex for file filtering
 * @param {string} pattern - Simple glob pattern
 * @returns {RegExp} Compiled regex
 */
function simpleGlobToRegex(pattern) {
    if (!pattern) return null;
    
    let regexStr = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '(:.*/)?')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]');
    
    return new RegExp(`^${regexStr}$`, 'i');
}

/**
 * Search a single file for pattern matches
 * @param {string} filePath - Path to the file
 * @param {RegExp} patternRegex - Compiled regex to search for
 * @returns {Promise<Array<{path: string, line: number, text: string}>>} Array of matches
 */
async function searchFile(filePath, patternRegex) {
    const matches = [];
    
    try {
        const fileStream = await fs.open(filePath, 'r');
        const rl = readline.createInterface({
            input: fileStream.createReadStream(),
            crlfDelay: Infinity
        });
        
        let lineNumber = 0;
        for await (const line of rl) {
            lineNumber++;
            if (patternRegex.test(line)) {
                matches.push({
                    path: filePath,
                    line: lineNumber,
                    text: line
                });
                // Reset regex lastIndex for global patterns
                patternRegex.lastIndex = 0;
            }
        }
        
        await fileStream.close();
    } catch (error) {
        // Skip files that can't be read (binary, permission, etc.)
    }
    
    return matches;
}

/**
 * Recursively search files in a directory
 * @param {string} dirPath - Directory to search
 * @param {RegExp} patternRegex - Pattern to search for
 * @param {RegExp} includeRegex - Optional file filter pattern
 * @param {string} basePath - Base path for relative paths
 * @param {number} depth - Current recursion depth
 * @returns {Promise<Array>} All matches found
 */
async function searchDirectory(dirPath, patternRegex, includeRegex, basePath, depth = 0) {
    const maxDepth = 20;
    const matches = [];
    
    if (depth > maxDepth) return matches;
    
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            
            if (entry.isDirectory()) {
                const subMatches = await searchDirectory(
                    fullPath, patternRegex, includeRegex, basePath, depth + 1
                );
                matches.push(...subMatches);
            } else if (entry.isFile()) {
                // Check if file matches include pattern (if specified)
                if (includeRegex && !includeRegex.test(entry.name)) {
                    continue;
                }
                
                const fileMatches = await searchFile(fullPath, patternRegex);
                matches.push(...fileMatches);
            }
        }
    } catch (error) {
        // Skip directories we can't read
    }
    
    return matches;
}

/**
 * Search for a pattern in files
 * @param {Object} toolInput - Input with pattern, path, and optional include
 * @param {Object} config - Configuration object with TOOL_WORKING_DIR
 * @returns {Promise<Object>} Result with matches array
 */
export async function execute(toolInput, config) {
    const { pattern, path: searchPath, include } = toolInput;
    const workingDir = config.TOOL_WORKING_DIR || process.cwd();
    
    if (!pattern || typeof pattern !== 'string') {
        throw new Error('GrepTool: pattern is required and must be a string');
    }
    
    if (!searchPath) {
        throw new Error('GrepTool: path is required');
    }
    
    // Resolve and validate the search path
    const resolvedPath = resolveAndValidatePath(searchPath, workingDir);
    
    // Compile the search pattern as regex
    let patternRegex;
    try {
        patternRegex = new RegExp(pattern, 'g');
    } catch (error) {
        throw new Error(`GrepTool: Invalid regex pattern: ${error.message}`);
    }
    
    // Compile include pattern if specified
    const includeRegex = include ? simpleGlobToRegex(include) : null;
    
    // Check if path is a file or directory
    const stats = await fs.stat(resolvedPath);
    
    let matches = [];
    
    if (stats.isFile()) {
        // Search a single file
        matches = await searchFile(resolvedPath, patternRegex);
    } else if (stats.isDirectory()) {
        // Search a directory
        matches = await searchDirectory(resolvedPath, patternRegex, includeRegex, resolvedPath);
    } else {
        throw new Error(`GrepTool: Path is neither a file nor a directory: ${searchPath}`);
    }
    
    return {
        matches
    };
}

/**
 * Input schema for GrepTool (JSON Schema format)
 */
export const inputSchema = {
    type: 'object',
    properties: {
        pattern: {
            type: 'string',
            description: 'Regex pattern to search for'
        },
        path: {
            type: 'string',
            description: 'File path or directory to search in'
        },
        include: {
            type: 'string',
            description: 'Optional glob pattern to filter files (e.g., "*.js", "*.ts")'
        }
    },
    required: ['pattern', 'path']
};

export default {
    name: 'grep',
    description: 'Search for patterns in files using regex. Use for finding code or text across multiple files.',
    inputSchema,
    execute
};