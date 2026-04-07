# Tasks: Local Tool Runtime

## Phase 1: Infrastructure

- [ ] 1.1 Create `src/tools/ToolRegistry.js` — export `registerTool(name, def)`, `getTool(name)`, `listTools()` using a `Map`; tool def shape: `{ name, description, inputSchema, execute }`.
- [ ] 1.2 Create `src/tools/PermissionGate.js` — export `PermissionGate` class with `isAllowed(toolName, config)` that reads `config.TOOL_PERMISSIONS` allowlist; default deny if key absent.
- [ ] 1.3 Extend `src/core/config-manager.js` — add `TOOL_RUNTIME_ENABLED` (bool, default `false`) and `TOOL_PERMISSIONS` (string array, default `[]`) to the config schema and validation.

## Phase 2: Implementation

- [ ] 2.1 Create `src/tools/ToolExecutionService.js` — export `executeTool(toolName, toolInput, config)` that calls `PermissionGate.isAllowed()` then `registry.getTool().execute()`; throws `ToolPermissionError` or `ToolNotFoundError` on failure.
- [ ] 2.2 Create `src/tools/implementations/BashTool.js` — executes shell command via `child_process.execFile`; timeout from `config.TOOL_BASH_TIMEOUT_MS` (default 30000); never shell-interpolate input (use args array).
- [ ] 2.3 Create `src/tools/implementations/ReadTool.js` — reads a file with `fs.readFile`; enforces path within `config.TOOL_WORKING_DIR`; returns `{ content, encoding }`.
- [ ] 2.4 Create `src/tools/implementations/WriteTool.js` — writes file via `fs.writeFile`; creates parent dirs; same path guard as ReadTool.
- [ ] 2.5 Create `src/tools/implementations/EditTool.js` — reads file, replaces first occurrence of `oldString` with `newString`, writes back; errors if `oldString` not found.
- [ ] 2.6 Create `src/tools/implementations/GlobTool.js` — wraps `fast-glob` with `cwd` and `pattern` inputs; returns `string[]`.
- [ ] 2.7 Create `src/tools/implementations/GrepTool.js` — uses Node `readline` + regex to search files matching `include` glob; returns `{ path, line, text }[]`.
- [ ] 2.8 Create `src/tools/implementations/WebFetchTool.js` — fetches URL via native `fetch`; strips HTML to text; `config.TOOL_WEBFETCH_ENABLED` guard.
- [ ] 2.9 Create `src/tools/register-tools.js` — imports all implementations, calls `registerTool()` for each with name, description, and JSON Schema `inputSchema`.
- [ ] 2.10 Create `src/tools/AgentLoop.js` — export `runAgentLoop(apiService, request, config)` as an async generator; loop: call `apiService.generateContentStream()`, collect `tool_use` blocks, execute via `ToolExecutionService`, inject `tool_result` into messages, repeat; yield SSE chunks to caller; stop when no tool calls or `stop_reason === 'end_turn'`.
- [ ] 2.11 Create `src/tools/ToolResultFormatter.js` — export `formatToolResult(toolName, result, isError)` returning Anthropic-compatible `tool_result` content block.

## Phase 3: Integration

- [ ] 3.1 Modify `src/services/api-manager.js` — in `handleAPIRequests`, after routing `/v1/messages` POST, check `config.TOOL_RUNTIME_ENABLED`; if true and request has `tools`, delegate to `AgentLoop.runAgentLoop()` instead of `handleContentGenerationRequest`.
- [ ] 3.2 Modify `src/handlers/request-handler.js` — call `register-tools.js` once at startup so the registry is populated before any request arrives.
- [ ] 3.3 Verify `ClaudeApiServiceAdapter` in `src/providers/adapter.js` passes `tools` field through to the upstream API unchanged — no changes needed if already transparent, document finding.

## Phase 4: Testing

- [ ] 4.1 Create `tests/tools/ToolRegistry.unit.test.js` — register/get/list tool, duplicate registration overwrites, unknown tool returns null.
- [ ] 4.2 Create `tests/tools/PermissionGate.unit.test.js` — allowed tool passes, denied tool throws, empty allowlist denies all.
- [ ] 4.3 Create `tests/tools/ToolExecutionService.unit.test.js` — mocks registry and gate; asserts `ToolPermissionError` and `ToolNotFoundError` thrown correctly.
- [ ] 4.4 Create `tests/tools/implementations/BashTool.unit.test.js` — valid command returns stdout, timeout throws, shell metacharacter in arg is safe (no injection).
- [ ] 4.5 Create `tests/tools/implementations/FilesystemTools.unit.test.js` — covers Read/Write/Edit/Glob/Grep; uses `tmp` dir; path traversal attempt (`../../etc/passwd`) throws.
- [ ] 4.6 Create `tests/tools/AgentLoop.unit.test.js` — mocks `apiService`; single tool call round-trip yields correct SSE chunks; `end_turn` exits loop; tool error is surfaced as `tool_result` with `is_error: true`.
