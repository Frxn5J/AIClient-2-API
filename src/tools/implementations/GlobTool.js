/**
 * GlobTool - Find files matching a pattern using native fs
 * 
 * Uses Node.js native fs with recursion instead of external fast-glob package
 * 
 * Input schema:
 * {
 *   pattern: string,    // Glob pattern (e.g., globstar "**", wildcard "*", etc.)
 *   path?: string       // Optional: Base path to search from (defaults to TOOL_WORKING_DIR)
 * }
 * 
 * Output schema:
 * string[] - Array of matching file paths
 */

import { promises as fs } from 'fs';
import path from 'path';

/**
 * Convert a simple glob pattern to regex
 * Supports: globstar (star star), wildcard (star), single char (?), and character classes [abc]
 * @param {string} pattern - Glob pattern
 * @returns {RegExp} Compiled regex
 */
function globToRegex(pattern) {
    // Escape special regex chars except *, ?, and []
    let regexStr = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        // Convert ** to path separator regex (matches any number of path segments)
        .replace(/\*\*/g, '(:.*/)?')
        // Convert * to match anything except path separator
        .replace(/\*/g, '[^/]*')
        // Convert ? to match any single char except path separator  
        .replace(/\?/g, '[^/]')
        // Handle character classes like [abc]
        .replace(/\[(!?)([^\\]]+)\]/g, (match, negated, chars) => {
            const charClass = negated ? `[^${chars}]` : `[${chars}]`;
            return charClass;
        });
    
    // Anchor at start and end, and match full path
    return new RegExp(`^${regexStr}$`);
}

/**
 * Recursively walk a directory and collect matching files
 * @param {string} dirPath - Directory to walk
 * @param {RegExp} patternRegex - Compiled regex pattern
 * @param {string} basePath - Base path for relative results
 * @param {number} depth - Current recursion depth (prevent infinite loops)
 * @returns {Promise<string[]>} Array of matching paths
 */
async function walkDirectory(dirPath, patternRegex, basePath, depth = 0) {
    const maxDepth = 20; // Prevent infinite recursion
    const results = [];
    
    if (depth > maxDepth) {
        return results;
    }
    
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const relativePath = path.relative(basePath, fullPath);
            
            // Check if this matches the pattern
            if (patternRegex.test(relativePath) || patternRegex.test(fullPath)) {
                results.push(fullPath);
            }
            
            // Recurse into directories
            if (entry.isDirectory()) {
                const subResults = await walkDirectory(fullPath, patternRegex, basePath, depth + 1);
                results.push(...subResults);
            }
        }
    } catch (error) {
        // Permission denied or other errors - skip this directory
        if (error.code !== 'EACCES' && error.code !== 'EPERM') {
            // Only throw for unexpected errors
        }
    }
    
    return results;
}

/**
 * Find files matching a glob pattern
 * @param {Object} toolInput - Input with pattern and optional path
 * @param {Object} config - Configuration object with TOOL_WORKING_DIR
 * @returns {Promise<string[]>} Array of matching file paths
 */
export async function execute(toolInput, config) {
    const { pattern, path: searchPath } = toolInput;
    
    if (!pattern || typeof pattern !== 'string') {
        throw new Error('GlobTool: pattern is required and must be a string');
    }
    
    const workingDir = config.TOOL_WORKING_DIR || process.cwd();
    const basePath = searchPath 
        ? path.resolve(workingDir, searchPath) 
        : workingDir;
    
    // Check if base path exists and is a directory
    try {
        const stats = await fs.stat(basePath);
        if (!stats.isDirectory()) {
            throw new Error(`GlobTool: path '${searchPath}' is not a directory`);
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error(`GlobTool: Directory not found: ${searchPath || workingDir}`);
        }
        throw error;
    }
    
    // Convert glob pattern to regex
    const patternRegex = globToRegex(pattern);
    
    // Walk the directory and find matches
    const matches = await walkDirectory(basePath, patternRegex, basePath);
    
    // Sort results for consistency
    return matches.sort();
}

/**
 * Input schema for GlobTool (JSON Schema format)
 */
export const inputSchema = {
    type: 'object',
    properties: {
        pattern: {
            type: 'string',
            description: 'Glob pattern to match files (e.g., "star star slash star.js", "src star star slash star.ts")'
        },
        path: {
            type: 'string',
            description: 'Optional base path to search from (defaults to TOOL_WORKING_DIR)'
        }
    },
    required: ['pattern']
};

export default {
    name: 'glob',
    description: 'Find files matching a glob pattern. Use for discovering files by name patterns.',
    inputSchema,
    execute
};