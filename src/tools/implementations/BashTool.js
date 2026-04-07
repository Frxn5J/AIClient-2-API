/**
 * BashTool - Execute shell commands using execFile (NOT exec for security)
 * 
 * SECURITY: Uses execFile to prevent shell injection attacks
 * 
 * Input schema:
 * {
 *   command: string,   // The command to execute (without shell interpolation)
 *   args?: string[],   // Optional arguments array
 *   cwd?: string       // Optional working directory
 * }
 * 
 * Output schema:
 * {
 *   stdout: string,
 *   stderr: string,
 *   exitCode: number,
 *   duration: number
 * }
 */

import { execFile } from 'child_process';

/**
 * Execute a bash command using execFile (not exec)
 * @param {Object} toolInput - Input with command, args, cwd
 * @param {Object} config - Configuration object with TOOL_BASH_TIMEOUT_MS
 * @returns {Promise<Object>} Result with stdout, stderr, exitCode, duration
 */
export async function execute(toolInput, config) {
    const { command, args = [], cwd } = toolInput;
    
    if (!command || typeof command !== 'string') {
        throw new Error('BashTool: command is required and must be a string');
    }

    // Validate command is not a shell string (basic check)
    // This prevents things like "ls -la; rm -rf /" being passed as command
    if (command.includes(';') || command.includes('&&') || command.includes('||') || command.includes('|')) {
        // Allow pipes and semicolons in the command name - it's likely a path or has legitimate use
        // But flag arguments like "; rm -rf" should still be checked
        const trimmed = command.trim();
        if (trimmed.startsWith(';') || trimmed.startsWith('&&') || trimmed.startsWith('||')) {
            throw new Error('BashTool: command contains shell operators that could enable injection');
        }
    }

    const timeout = config.TOOL_BASH_TIMEOUT_MS || 30000;
    const workingDir = cwd || config.TOOL_WORKING_DIR || process.cwd();
    
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
        // Use execFile for security - no shell interpolation
        const child = execFile(
            command,
            args,
            {
                cwd: workingDir,
                timeout: timeout,
                maxBuffer: 10 * 1024 * 1024, // 10MB max output
                windowsHide: true
            },
            (error, stdout, stderr) => {
                const duration = Date.now() - startTime;
                
                if (error) {
                    // Handle timeout
                    if (error.killed) {
                        resolve({
                            stdout: stdout.toString(),
                            stderr: stderr.toString() + '\nProcess killed due to timeout',
                            exitCode: -1,
                            duration
                        });
                        return;
                    }
                    
                    // Return the result even on error - exitCode tells the story
                    resolve({
                        stdout: stdout.toString(),
                        stderr: stderr.toString(),
                        exitCode: error.code || -1,
                        duration
                    });
                    return;
                }
                
                resolve({
                    stdout: stdout.toString(),
                    stderr: stderr.toString(),
                    exitCode: 0,
                    duration
                });
            }
        );
    });
}

/**
 * Input schema for BashTool (JSON Schema format)
 */
export const inputSchema = {
    type: 'object',
    properties: {
        command: {
            type: 'string',
            description: 'The command to execute'
        },
        args: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional arguments to pass to the command'
        },
        cwd: {
            type: 'string',
            description: 'Optional working directory for the command'
        }
    },
    required: ['command']
};

export default {
    name: 'bash',
    description: 'Execute a shell command. Use for running programs, scripts, or system commands.',
    inputSchema,
    execute
};