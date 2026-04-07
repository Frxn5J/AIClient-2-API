# Verification Report

**Change**: tool-runtime  
**Date**: 2026-04-07  
**Verifier**: sdd-verify agent

---

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 23 |
| Tasks complete (files exist) | 23 |
| Tasks complete (checklist marked) | 0 |

> ⚠️ All 23 tasks in `.atl/changes/tool-runtime/tasks.md` are marked `[ ]` (unchecked). The implementation exists but the checklist was never updated after sdd-apply. This is a process violation — tasks must be ticked on completion.

---

## Build & Tests Execution

**Build**: ➖ Not configured (no build step — runtime Node.js project)

**Tests**: ✅ 99 passed / ❌ 0 failed / ⚠️ 0 skipped  
```
PASS tests/tools/AgentLoop.unit.test.js
PASS tests/tools/PermissionGate.unit.test.js
PASS tests/tools/ToolRegistry.unit.test.js
PASS tests/tools/ToolExecutionService.unit.test.js
PASS tests/tools/implementations/FilesystemTools.unit.test.js
PASS tests/tools/implementations/BashTool.unit.test.js

Test Suites: 6 passed, 6 total
Tests: 99 passed, 99 total
Time: 4.102 s
```

**Coverage**: ➖ Not configured

---

## Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| REQ-01: AgentLoop orchestration | Detects tool_use, executes, appends result, continues | `AgentLoop.unit.test.js` — no direct test of `runAgentLoop` | ❌ UNTESTED |
| REQ-01: AgentLoop orchestration | stop_reason=end_turn exits loop | `AgentLoop.unit.test.js` — not tested | ❌ UNTESTED |
| REQ-01: AgentLoop orchestration | Tool error surfaces as is_error:true | `AgentLoop.unit.test.js > tool error formatting` | ✅ COMPLIANT (formatter tested, not loop behavior) |
| REQ-02: ToolExecutionService | Validates permissions, throws ToolPermissionError | `ToolExecutionService.unit.test.js > permission errors` | ✅ COMPLIANT |
| REQ-02: ToolExecutionService | Throws ToolNotFoundError for unknown tool | `ToolExecutionService.unit.test.js > not found errors` | ✅ COMPLIANT |
| REQ-02: ToolExecutionService | Wraps failures in ToolExecutionError | `ToolExecutionService.unit.test.js > execution errors` | ✅ COMPLIANT |
| REQ-03: PermissionGate security | Default deny when permissions empty | `PermissionGate.unit.test.js > empty allowlist denies all` | ✅ COMPLIANT |
| REQ-03: PermissionGate security | Allowed tool passes | `PermissionGate.unit.test.js > tool in TOOL_PERMISSIONS` | ✅ COMPLIANT |
| REQ-04: ToolRegistry definitions | register/get/list/duplicate overwrite | `ToolRegistry.unit.test.js` (all scenarios) | ✅ COMPLIANT |
| REQ-04: ToolRegistry definitions | 7 tools registered (bash,read,write,edit,glob,grep,webfetch) | `register-tools.js` — auto-registers all 7 | ✅ COMPLIANT |
| REQ-05: BashTool | execFile used (no shell injection) | `BashTool.unit.test.js > shell injection prevention` | ✅ COMPLIANT |
| REQ-05: BashTool | Timeout from TOOL_BASH_TIMEOUT_MS | `BashTool.unit.test.js > timeout handling` | ✅ COMPLIANT |
| REQ-05: ReadTool | Path traversal blocked | `FilesystemTools.unit.test.js > CRITICAL: path traversal` | ✅ COMPLIANT |
| REQ-05: WriteTool | Creates parent dirs, path guard | `FilesystemTools.unit.test.js > WriteTool` | ✅ COMPLIANT |
| REQ-05: EditTool | Errors if oldString not found | `FilesystemTools.unit.test.js > EditTool > not found` | ✅ COMPLIANT |
| REQ-05: GlobTool | Returns string[] for pattern | `FilesystemTools.unit.test.js > GlobTool > *.txt` | ✅ COMPLIANT |
| REQ-05: GlobTool | Globstar (**) traversal works | `FilesystemTools.unit.test.js > globstar` — assertion too weak (only checks Array.isArray) | ❌ FAILING (runtime: **/*.js returns 0 results) |
| REQ-05: GrepTool | Returns {path, line, text}[] | `FilesystemTools.unit.test.js > GrepTool` | ✅ COMPLIANT |
| REQ-06: ToolResultFormatter | Returns Responses API tool_result format | `AgentLoop.unit.test.js > tool error formatting` | ⚠️ PARTIAL (custom JSON format, not native Anthropic tool_result block) |

**Compliance summary**: 14/19 scenarios compliant, 2 untested, 1 failing, 2 partial/weak.

---

## Correctness (Static — Structural Evidence)

| Requirement | Status | Notes |
|-------------|--------|-------|
| ToolRegistry uses Map | ✅ Implemented | `src/tools/ToolRegistry.js:10` — `const toolRegistry = new Map()` |
| PermissionGate default-deny | ✅ Implemented | `PermissionGate.js:30-35` — returns `{allowed:false}` if array empty/absent |
| BashTool uses execFile (not exec) | ✅ Implemented | `BashTool.js:58` — `execFile(command, args, ...)` |
| Path guard in Read/Write/Edit/Grep | ✅ Implemented | All 4 call `resolveAndValidatePath` with `normalizedPath.startsWith(normalizedWorkingDir)` check |
| Config defaults for TOOL_RUNTIME_ENABLED | ✅ Implemented | `config-manager.js` — `TOOL_RUNTIME_ENABLED: false, TOOL_PERMISSIONS: []` |
| Config validation (TOOL_PERMISSIONS must be array) | ✅ Implemented | `config-manager.js` — validated and defaulted at end of `initializeConfig` |
| register-tools.js called at startup | ✅ Implemented | `request-handler.js:19` — `registerAllTools()` called at module load time |
| TOOL_RUNTIME_ENABLED gate in api-manager | ✅ Implemented | `api-manager.js` — checks `currentConfig.TOOL_RUNTIME_ENABLED === true` before routing |
| AgentLoop streaming path | ✅ Implemented | Yields SSE chunks via `for await (const chunk of stream)` in api-manager |
| AgentLoop non-streaming path | ❌ BROKEN | `api-manager.js:64` — `const result = await runAgentLoop(...)` but `runAgentLoop` is `async function*`; await returns AsyncGenerator object, JSON.stringify gives `{}` |
| GlobTool globstar (**) | ❌ BROKEN | `GlobTool.js:17` — `globToRegex` converts `**` to `(:.*/)?` (literal `:` in pattern); `**/*.js` returns 0 matches |
| WebFetchTool TOOL_WEBFETCH_ENABLED guard | ⚠️ Missing | Spec says guard on `config.TOOL_WEBFETCH_ENABLED`; only PermissionGate allowlist used |
| EditTool replaces first occurrence | ✅ Implemented | Finds and replaces using `content.indexOf(oldString)` |
| EditTool case-sensitive counting | ⚠️ Partial | Occurrence COUNT uses `toLowerCase()` (case-insensitive) but REPLACEMENT uses exact-case. Mixed-case variants cause false "Multiple occurrences" errors |
| Task 3.3: ClaudeApiServiceAdapter tools passthrough | ⚠️ Not documented | Task required "document finding" — not done |

---

## Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| ToolRegistry uses Map (mirrors adapterRegistry) | ✅ Yes | `new Map()` used |
| PermissionGate reads TOOL_PERMISSIONS allowlist, default-deny | ✅ Yes | |
| BashTool uses execFile with args array | ✅ Yes | |
| Path guard constrained to TOOL_WORKING_DIR | ✅ Yes | All filesystem tools implement `resolveAndValidatePath` |
| AgentLoop integrates at api-manager.js level | ✅ Yes | `handleToolRuntimeRequest` in `api-manager.js` |
| Tools registered at startup in request-handler.js via register-tools.js | ✅ Yes | Module-level registration on import |
| GlobTool wraps fast-glob | ❌ Deviated | Custom native fs walker used instead of `fast-glob` package; globstar behavior is broken as a result |

---

## Issues Found

### CRITICAL (must fix before archive)

**[C-1] Non-streaming AgentLoop path returns `{}`**  
`api-manager.js:64` — `const result = await runAgentLoop(...)` on an `async function*`. Awaiting an AsyncGenerator returns the generator object itself (not a Promise). `JSON.stringify(generatorObject)` = `{}`. Every non-streaming tool call returns an empty response body.  
**Fix**: Collect generator output: `const chunks = []; for await (const c of runAgentLoop(...)) chunks.push(c);` then return the last meaningful chunk, or refactor `runAgentLoop` to separate the generator from a final-result promise.

**[C-2] GlobTool globstar (`**`) produces zero results**  
`GlobTool.js:17` — `globToRegex` converts `**` to `(:.*/)?` which inserts a literal `:` into the regex. `**/*.js` matches nothing. Verified: `execute({pattern:'**/*.js'}, {TOOL_WORKING_DIR:process.cwd()})` returns `[]`.  
**Fix**: Replace `(:.*/)?` with `(?:.*/)?` (non-capturing group without literal colon) or use the `fast-glob` package as originally specified.

**[C-3] Task checklist not updated**  
All 23 tasks in `.atl/changes/tool-runtime/tasks.md` remain `[ ]`. Must be updated to `[x]` for completed tasks as part of the SDD process.

---

### WARNING (should fix)

**[W-1] AgentLoop only parses OpenAI streaming format**  
`AgentLoop.js:parseChunk` handles `choices[0].delta.tool_calls` (OpenAI format) and `output.tool_calls`. The Anthropic Messages API (`/v1/messages`) streams `content_block_start` events with `type: "tool_use"` — this format is not handled. Tool calls from native Anthropic responses will be missed.

**[W-2] EditTool case-insensitive count vs case-sensitive replacement mismatch**  
`EditTool.js:60-80` — occurrence count uses `lowerContent.indexOf(lowerOldString)` but replacement uses `content.indexOf(oldString)`. If a file has "hello" and "Hello" and `oldString="Hello"`, count=2 (false multiple-match error) even though only one exact-case match exists.

**[W-3] WebFetchTool missing `TOOL_WEBFETCH_ENABLED` guard**  
Spec requires `config.TOOL_WEBFETCH_ENABLED` check inside WebFetchTool. Implementation only relies on PermissionGate allowlist. No `TOOL_WEBFETCH_ENABLED` key in config defaults either.

**[W-4] AgentLoop behavioral scenarios untested**  
`AgentLoop.unit.test.js` does not test `runAgentLoop` itself. It only tests `ToolResultFormatter` in isolation. Three spec-required scenarios are untested with real execution:  
- Single tool call round-trip yields correct SSE chunks  
- `stop_reason=end_turn` exits loop  
- Tool error surfaces as `tool_result` with `is_error: true` in loop context

**[W-5] Unused `execFile` import in ToolExecutionService.js**  
`ToolExecutionService.js:5` — `import { execFile } from 'child_process'` is imported but never used. `execFile` is only used in `BashTool.js`.

---

### SUGGESTION (nice to have)

**[S-1] `ToolResultFormatter` ignores `callId`**  
`callId` parameter is accepted but not emitted in the JSON output. Including `tool_use_id` in the result string would aid debugging and response tracing.

**[S-2] Task 3.3 finding never documented**  
Task 3.3 required documenting whether `ClaudeApiServiceAdapter` passes `tools` through unchanged. No documentation found in tasks, design notes, or comments.

**[S-3] Weak globstar test assertion**  
`FilesystemTools.unit.test.js:195` — the globstar test only checks `Array.isArray(result)`, not that files were actually found. This allowed the broken globstar implementation to pass tests undetected.

---

## Verdict

**FAIL**

2 runtime bugs block production use: the non-streaming path returns `{}` for all tool calls, and globstar patterns (`**`) return no results making multi-level file discovery broken. 4 additional warnings should be addressed before archive. Tasks checklist must be updated.

| Category | Count |
|----------|-------|
| CRITICAL | 3 |
| WARNING | 5 |
| SUGGESTION | 3 |
| Tests passing | 99/99 ✅ |
| Overall status | ❌ FAIL |
