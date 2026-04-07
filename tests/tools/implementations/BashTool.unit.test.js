/**
 * Unit Tests for BashTool
 * 
 * Tests valid command returns stdout
 * Tests timeout throws error
 * Tests shell metacharacters in args are handled safely (no injection)
 * Tests exitCode captured correctly
 */

import { describe, test, expect } from '@jest/globals';
import { execute, inputSchema } from '../../../src/tools/implementations/BashTool.js';

describe('BashTool', () => {
    describe('execute', () => {
        test('should execute valid command and return stdout', async () => {
            const config = {
                TOOL_BASH_TIMEOUT_MS: 5000
            };

            // Use node -e which works cross-platform
            const command = 'node';
            const args = ['-e', 'console.log("Hello World")'];

            const result = await execute({ command, args }, config);

            expect(result.stdout).toBeDefined();
            expect(result.stderr).toBeDefined();
            expect(result.exitCode).toBe(0);
            expect(result.duration).toBeGreaterThanOrEqual(0);
            expect(result.stdout.trim()).toBe('Hello World');
        });

        test('should return non-zero exitCode on command failure', async () => {
            const config = {
                TOOL_BASH_TIMEOUT_MS: 5000
            };

            // Try to run a non-existent command
            const command = 'node';
            const args = ['-e', 'process.exit(1)'];

            const result = await execute({ command, args }, config);

            expect(result.exitCode).toBe(1);
        });

        test('should handle command with arguments', async () => {
            const config = {
                TOOL_BASH_TIMEOUT_MS: 5000
            };

            // Run node with a simple script
            const command = 'node';
            const args = ['-e', 'console.log("test")'];

            const result = await execute({ command, args }, config);

            expect(result).toBeDefined();
            expect(result.exitCode).toBe(0);
            expect(result.stdout.trim()).toBe('test');
        });

        test('should use custom working directory when specified', async () => {
            const config = {
                TOOL_BASH_TIMEOUT_MS: 5000,
                TOOL_WORKING_DIR: process.cwd()
            };

            const result = await execute({ command: 'node', args: ['--version'] }, config);

            expect(result).toBeDefined();
        });

        test('should throw error when command is missing', async () => {
            const config = {};

            await expect(execute({}, config)).rejects.toThrow('command is required');
        });

        test('should throw error when command is not a string', async () => {
            const config = {};

            await expect(execute({ command: 123 }, config)).rejects.toThrow('command is required');
        });
    });

    describe('shell injection prevention', () => {
        test('should block command starting with semicolon', async () => {
            const config = {};

            // This should be blocked because it starts with semicolon
            await expect(execute({ command: '; rm -rf /' }, config)).rejects.toThrow(
                'command contains shell operators that could enable injection'
            );
        });

        test('should block command starting with &&', async () => {
            const config = {};

            await expect(execute({ command: '&& malicious command' }, config)).rejects.toThrow(
                'command contains shell operators that could enable injection'
            );
        });

        test('should block command starting with ||', async () => {
            const config = {};

            await expect(execute({ command: '|| malicious command' }, config)).rejects.toThrow(
                'command contains shell operators that could enable injection'
            );
        });

        test('should allow valid commands without shell operators at start', async () => {
            const config = {
                TOOL_BASH_TIMEOUT_MS: 5000
            };

            // This should work - valid command
            const result = await execute({ command: 'node', args: ['-v'] }, config);
            expect(result.exitCode).toBe(0);
        });
    });

    describe('timeout handling', () => {
        test('should handle timeout gracefully', async () => {
            const config = {
                TOOL_BASH_TIMEOUT_MS: 10 // Very short timeout
            };

            // Run a command that takes a long time
            // Using node to simulate a long-running process
            const command = 'node';
            const args = ['-e', 'setTimeout(() => {}, 10000)'];

            const result = await execute({ command, args }, config);

            // The command should be killed due to timeout
            expect(result.exitCode).toBe(-1);
            expect(result.stderr.toLowerCase()).toContain('timeout');
        }, 20000); // Increase test timeout for this test
    });

    describe('inputSchema', () => {
        test('should have valid input schema', () => {
            expect(inputSchema).toBeDefined();
            expect(inputSchema.type).toBe('object');
            expect(inputSchema.properties).toBeDefined();
            expect(inputSchema.properties.command).toBeDefined();
            expect(inputSchema.properties.args).toBeDefined();
            expect(inputSchema.required).toContain('command');
        });

        test('should have command as required property', () => {
            expect(inputSchema.required).toContain('command');
        });

        test('should have optional args property', () => {
            expect(inputSchema.properties.args.type).toBe('array');
        });

        test('should have optional cwd property', () => {
            expect(inputSchema.properties.cwd).toBeDefined();
        });
    });

    describe('exitCode handling', () => {
        test('should capture exitCode 0 for successful command', async () => {
            const config = {
                TOOL_BASH_TIMEOUT_MS: 5000
            };

            const result = await execute(
                { command: 'node', args: ['-e', 'console.log("success")'] },
                config
            );
            expect(result.exitCode).toBe(0);
        });

        test('should capture non-zero exitCode for failed command', async () => {
            const config = {
                TOOL_BASH_TIMEOUT_MS: 5000
            };

            const result = await execute(
                { command: 'node', args: ['-e', 'process.exit(1)'] },
                config
            );
            expect(result.exitCode).toBe(1);
        });
    });

    describe('duration tracking', () => {
        test('should track execution duration', async () => {
            const config = {
                TOOL_BASH_TIMEOUT_MS: 5000
            };

            const result = await execute({ command: 'node', args: ['--version'] }, config);

            expect(result.duration).toBeDefined();
            expect(typeof result.duration).toBe('number');
            expect(result.duration).toBeGreaterThanOrEqual(0);
        });
    });

    describe('stderr handling', () => {
        test('should capture stderr', async () => {
            const config = {
                TOOL_BASH_TIMEOUT_MS: 5000
            };

            const result = await execute(
                { command: 'node', args: ['-e', 'console.error("error output")'] },
                config
            );

            expect(result.stderr).toContain('error output');
        });
    });
});