# Phase 8: `josh` cross-runtime gateway Implementation Plan

**Goal:** Spec §11. MCP server registry + per-agent tool scoping + A2A HTTP bridge so external (non-Claude-Code/Codex) agents can claim and complete todos as if local. End state: A03 with `allowed_tools: ["fs:read"]` produces a `runtime.json.allowed_tools` reflecting the scope; an out-of-scope tool use surfaces as a `tool_violation` audit event; an A2A agent registers via HTTP, claims a todo, completes it.

**Architecture:** Three new lib modules + one daemon-style HTTP server (Node `http`). All zero-dep.

**Files:**
| File | Purpose | New / modify |
|---|---|---|
| `bin/josh/lib/mcp-registry.js` | Read/write `~/.josh/mcp/registry.json` | New |
| `bin/josh/lib/tool-scoping.js` | Resolve agent's allowed_tools, check scope, record violations | New |
| `bin/josh/lib/a2a-bridge.js` | HTTP server with `/agents/register`, `/tasks/sendSubscribe`, `/tasks/<id>`, `/healthz` | New |
| `bin/josh/josh.js` | `josh tool register/list/show/scope-add/scope-remove`, `josh a2a serve/stop`, `josh tool violation log` | Modify |
| Tests + smoke | New |
| Docs | Modify |

## Tasks

1. `mcp-registry.js` — JSON I/O at `~/.josh/mcp/registry.json` shape `{schema:1, servers:[{id, command, args[], env, capabilities[], scopes[]}]}`.
2. `tool-scoping.js` — `resolveAllowedTools(joshRoot, agentId)`, `checkScope(allowed, toolId)`, `recordViolation(joshRoot, todoId, agentId, toolId)`.
3. `josh tool` CLI — register/list/show/scope-add/scope-remove subcommands.
4. `josh claim --agent` writes `runtime.json.allowed_tools` from manifest.
5. `josh tool violation log <todo-id> <agent-id> <tool-id>` — append to `~/.josh/audit/violations-<date>.jsonl` + emit a `failed` event in todo's `events.ndjson`.
6. `a2a-bridge.js` — HTTP server (Node built-in) listening on `127.0.0.1:<JOSH_A2A_PORT>` (default 7843). Endpoints:
   - `GET /healthz` → `{ok, version}`
   - `POST /agents/register` `{id, did, pubkey_jwk, allowed_tools}` → mints/updates manifest
   - `POST /tasks/sendSubscribe` `{todo_id, agent_id}` → equivalent of `josh claim --agent`
   - `GET /tasks/<id>` → meta + state
7. `josh a2a serve [--port N]` — foreground daemon. `josh a2a stop` writes `~/.josh/a2a/.stop` flag + a running server polls it.
8. End-to-end smoke: register A03 with `allowed_tools: ["fs:read"]`; claim writes runtime.json.allowed_tools; violation log records audit; a2a bridge serves a claim → complete cycle over HTTP.
9. Docs.
