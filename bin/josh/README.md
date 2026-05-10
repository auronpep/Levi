# `josh` CLI

Thin command-line wrapper for the `~/.josh/` shared agent runtime. Implements the spec at `~/.josh/README.md`.

Goal: any participant (Claude Code, Codex, OpenClaw, human) can run the same command surface and get consistent reads/writes against the cross-agent state.

## Install

From this directory:

```powershell
cd C:\Levi\bin\josh
npm link
```

`npm link` registers `josh` as a global command pointing at this checkout. Edits to `josh.js` take effect immediately — no rebuild.

To uninstall: `npm unlink -g @levi/josh`.

## Quick start

```powershell
josh init        # create the ~/.josh/ directory tree (idempotent)
josh status      # print the cross-agent status board
josh help        # list commands
```

## Environment

| Var | Default | Purpose |
|---|---|---|
| `JOSH_ROOT` | `~/.josh` | Override the runtime root. Useful for tests. |
| `JOSH_DEBUG` | unset | When set, print stack traces on error. |

## v0.7 scope

Five artifact types covered end-to-end:

- `init` / `status` / `help` / `version`
- **Todo**: `push todo`, `list todo`, `show <id>`, `claim`, `complete`, `fail`, `block`, `unblock`, `cancel`
- **Orchestrator**: `tick`, `control <action>`
- **Handoffs** (cross-agent messaging): `push handoff`, `list handoffs`, `reply`, `ack`
- **Approvals** (human-gated decisions): `push approval`, `list approvals`, `approve`, `deny`
- **Locks** (general resource locks): `lock acquire`, `lock release`, `lock list` (also `list locks`)
- **Reviews** (cross-agent code/design review): `push review`, `list reviews`, `review` (submit verdict)

Future (v0.8+): `validate` (JSON schema check), orchestrator smarts (auto-resolve expired approvals, label-based triage routing), shared dossier helpers.

## Examples

```powershell
# Producer side
josh push todo "Fix flaky test in users.test.ts" --priority p1 --agent codex --label test,users
josh push todo "Triage CI failures" --priority p0 --verify "pnpm test"
josh list todo
josh list todo --state in_progress --priority p0
josh list todo --state all --json
josh show 01HXXXX                  # full ID
josh show ABC123                   # last-6 suffix; warns on collision

# Agent side (Claude Code, Codex, or any client picks up triaged work)
josh claim ABC123 --as "codex:session-42" --ttl 3600
josh complete ABC123 --note "passed users.test.ts after refactor"
josh fail ABC123 --reason "external dependency unreachable"
josh block ABC123 --depends-on XYZ789 --reason "wait for migration"
josh unblock ABC123 --note "migration landed"
josh cancel ABC123 --reason "duplicate of DEF456"

# Orchestrator side (typically called by OpenClaw cron)
josh tick                          # one heartbeat: triage incoming + sweep stale claims
josh tick --verbose --force        # debug: ignore lock, multi-line output
josh control pause
josh control reorder ABC123 --priority p0
josh control set-interval 60

# Cross-agent handoffs (Claude Code ↔ Codex ↔ Orchestrator)
josh push handoff --to codex --title "What's the right type sig?" \
  --body "..." --kind request --priority p1
josh list handoffs --for codex                    # codex's incoming
josh list handoffs --for codex --state processed  # things codex already handled
josh reply <handoff-id> --body "Use Result<T, E>" --kind answer
josh ack <handoff-id> --note "applied the suggestion"

# Approvals (human-gated)
josh push approval --summary "Push 3 commits to main?" \
  --details "feat(...), fix(...), fix(...). Tests passed locally." \
  --default-after 2h --default-choice deny
josh list approvals
josh approve <approval-id> --note "ok"
josh deny <approval-id> --reason "wait for review on PR #12"

# Reviews (cross-agent code/design review)
josh push review --subject-ref "https://github.com/me/repo/pull/12" \
  --reviewer codex --framing adversarial --priority p1 \
  --notes "focus on lock TTL handling"
josh list reviews
josh review <review-id> --verdict request_changes \
  --reasoning "Lock TTL is in seconds but help says hours. Pick one." \
  --as "codex:reviewer-session"
```

## Project import

Reflect a Markdown corpus (project + agents + tasks) into `~/.josh/`:

```
josh project import <corpus-path>          # one-shot import
josh project status [--project <id>]       # render the daily-review template
josh project sync   [--project <id>] [--dry-run]   # refresh entities from source
```

### Layout

`josh project import` creates:
- `~/.josh/projects/<ulid>/charter.json` — the project charter (one per import)
- `~/.josh/agents/<id>/manifest.json` — one per agent (A01..A10, E00..E08)
- `~/.josh/todo/triaged/<ulid>/` — one folder per dispatch task, containing
  `meta.json` (the task record), `state` (one-line state mirror), and
  per-todo siblings written as the lifecycle progresses (`events.ndjson`,
  `runtime.json`, `plan.md`, `plan-review.json`, `approval`, `handoff.md`).
  See "Agent dispatch (Phase 2A)" below for the full sibling layout.

The Markdown source is **not copied**. `manifest.json` and the todo files reference source paths and store SHA-256 hashes so `josh project sync` can detect changes.

### Source-of-truth conflict order

When a task or agent reference points to a path that no longer exists, `josh project sync` reports it as `missing` rather than auto-deleting. Removal is deliberate; no orphan cleanup unless explicitly requested.

## Atomic state transitions

Each mutate op uses `fs.renameSync` between state directories as the lock primitive. The rename **is** the lock acquisition — only one agent succeeds, the other gets `ENOENT` and exits cleanly with code 3 (lock-conflict). Read-modify-write happens AFTER the rename, when the agent exclusively owns the file at the new path.

## Agent dispatch (Phase 2A)

The plan/approve/execute lifecycle. Each todo lives in its own folder:

```
~/.josh/todo/<state>/<ulid>/
├── meta.json
├── state                  one-line, mirrors parent dir
├── plan.md                added in 'planning' state, persists into later states
├── plan-review.json       added when plan submitted
├── approval               absent | "pending" | "approved" | "rejected"
├── handoff.md             written when state → done
├── events.ndjson          append-only, 14-event taxonomy
└── runtime.json           {harness, session_id, claimed_by, started_at}
```

States: `incoming → triaged → claimed → planning → awaiting_approval → approved → in_progress → done`.
Side branches: `awaiting_approval → rejected`, any state → `blocked`/`failed`/`cancelled`, `awaiting_approval → revised → planning` (reserved for Phase 2B).

### Lifecycle commands

```
josh claim <id> --agent A01 [--as actor]            triaged → claimed
josh plan submit <id> --plan plan.md [--as actor]   claimed → awaiting_approval
josh plan approve <id> [--as actor]                 awaiting_approval → approved
josh plan reject  <id> --reason "..." [--as actor]  awaiting_approval → rejected
josh tick                                            auto-promotes approved → in_progress
josh complete <id> [--note "..."]                   in_progress → done (validates handoff.md)
```

### Plan template (8 sections, kesslerio)

Required YAML frontmatter: `id`, `status` (PENDING|APPROVED|REVISED), `claimed_by`, `plan_hash`.
Required H2 sections in this exact order: `Fast-Path`, `Problem statement`, `Current state evidence`,
`Proposed approach`, `Step-by-step change list`, `Risks + rollback`, `Test plan`, `Approval prompt`.

### Handoff template (9 fields)

Required H2s in any order: `Task ID`, `Files changed`, `Decision`, `Open blockers`, `Risks`,
`Downstream unblocked`, `Downstream blocked`, `Verification`, `Human review`. Each non-empty.

### Approval signal

`~/.josh/todo/<state>/<id>/approval` is the atomic-mv signal. `josh plan approve` writes `approved\n`;
`josh tick` reads it from the `approved` directory and promotes the todo to `in_progress`. No model
self-promotes a plan to execution.

## Enforcement layer (Phase 3)

`josh claim` and `josh tick` enforce four guardrails so a multi-task corpus can run unattended.

### 1. Hard-dependency enforcement

`josh claim <id>` (with or without `--agent`) refuses with exit code **3** when any todo in `meta.depends_on` (`kind: hard`) is not yet in `done/`. Error message lists the blocking display IDs and their current states.

Soft deps (`kind: soft`) are advisory and are not checked.

### 2. Backpressure caps

Optional config at `~/.josh/orchestrator/backpressure.json`:

```json
{
  "schema": 1,
  "max_concurrent": 10,
  "max_concurrent_per_phase": 5,
  "max_concurrent_per_agent": 2
}
```

Defaults apply when the file is absent. Caps are checked in two places:

- `josh claim` (legacy and `--agent` paths) — exit **3** if any cap would be exceeded.
- `josh tick`'s `approved → in_progress` promotion — throttled todos stay in `approved/` until the cap clears. Reported as `throttled=N` in the tick summary.

### 3. Doom-loop detector

A todo whose history contains ≥ 3 events of `event: failed` is considered doom-looped. `josh tick` scans `failed/` and `triaged/` for these and atomically renames them into `blocked/`, stamping `meta.blocked_reason = "doom-loop-detected:N"` and emitting a `failed` lifecycle event into `events.ndjson`. Reported as `doom_looped=N` in the tick summary when nonzero.

### 4. Heartbeat

```
josh heartbeat <id> [--as <actor>]
```

Resets `meta.claim.at` to now (extending TTL by another full `claim.ttl_sec`) and appends both a history entry and a `kind: heartbeat` line to `events.ndjson`. Allowed source states: `claimed`, `planning`, `awaiting_approval`, `in_progress`. Anywhere else returns exit **1**.

## Verdict matrix (Phase 4)

When a todo carries `verdict_mode: matrix` (or `risk: high`), `josh tick` orchestrates a multi-specialist verdict cycle without invoking models itself — runtimes write verdict envelopes to disk; `josh` does file-contract orchestration.

### Envelope shape (per spec §6.4)

```
~/.josh/todo/<id>/verdicts/<agent>.json
```

Required fields: `schema:1`, `id` (ULID), `todo_id`, `agent_id`, `agent_version`, `brief_hash` (sha256), `produced_at`, `payload {claim_text, status (approve|hold|rewrite|reject), evidence_basis, risk_if_accepted, risk_if_rejected, verification_required, human_review_needed, blockers, trust_dimensions}`, `confidence` ∈ [0,1], `cost`. Optional: `sentinel` (`auto_accept` / `requires_e08`), `sig` (Phase 6).

### CLI

```
josh verdict submit <todo-id> --envelope <path>
josh verdict list <todo-id>
josh verdict show <todo-id> [<agent-id>|winner]
josh matrix status [--todo <id>]
josh matrix pending
```

### Lifecycle (driven by `josh tick`)

1. **Candidate selection** (`bin/josh/lib/matrix-router.js`) reads `~/.josh/orchestrator/routing.json` → `matrix_rules`. Applies `cost-math` ceiling pruning (`MAX_TOKENS_PER_VERDICT = 50000`).
2. **Submission**: each candidate's runtime writes `verdicts/<agent>.json` (validated by `bin/josh/lib/verdict-envelope.js`).
3. **Auto-accept fast path**: any envelope with `sentinel: auto_accept` AND `confidence ≥ 0.9` AND `todo.risk ≠ high` → tick materializes that envelope as the winner; matrix dispatch is skipped. Reported as `matrix_auto_accepted=N` in tick output.
4. **Adjudication**: when N envelopes are present, tick writes `~/.josh/E08/incoming/adj-<ulid>.json` with candidate envelope paths + per-agent trust scores. E08 is the **designated evaluator, never voting** (spec §8.3).
5. **Winner picking**: E08's session writes `~/.josh/todo/<id>/verdicts/winner.json` with `{winner_id, synthesis_notes, confidence}`. Tick detects the file, copies winner envelope, archives runners-up to `verdicts/dissent/<agent>.md`, and updates `agents/<id>/trust.json` for every candidate.
6. **Trigger tokens** (spec §8.5): specialists may end output with `⚠️ JOSH_VERDICT_REQUIRES_E08` (force matrix even at high confidence) or `✅ JOSH_VERDICT_AUTO_ACCEPT` (qualify for fast path).

### Calibration

`~/.josh/agents/<id>/gold/*.json` — gold items shape `{schema:1, id, todo_minimal, expected_verdict {status, claim_text}, rubric}`. Use `bin/josh/lib/gold-set.js` `replayGold()` to score candidate briefs (`{pass, fail, regression_count}`).

`~/.josh/agents/<id>/trust.json` — rolling per-dimension agreement rate, updated every matrix run. Used by Phase 7 spec-evolver as a degradation signal.

## Speculative parallel execution (Phase 5)

For matrix-mode todos, fan out N parallel claims into git worktrees so candidate verdicts can run in isolation against the same source.

```
josh claim <todo-id> --agent A03 --speculative 3 \
  [--base-repo /path/to/repo] [--base-branch main] --as A03
```

- Requires `--agent`. Refuses without it.
- `--speculative N` must be in `[2, 10]`.
- Resolves `meta.context.repo` (or `--base-repo`) and `meta.context.branch` (or `--base-branch`, default `main`).
- For i in 1..N: creates `~/.josh/todo/claimed/<todoId>/worktree-<i>/` on a fresh branch `agent/<short-todoId>-<i>`.
- Records the worktree paths + branches in `runtime.json.worktrees`.

Each speculative worktree is a real `git worktree`. Agents run in their own checkout; only the verdict envelopes (written to `~/.josh/todo/<id>/verdicts/<agent>.json`) come back into the main filesystem for the matrix layer to adjudicate.

### Branch hygiene

Every `josh tick` calls `sweepWorktrees` against `done/`, `failed/`, `cancelled/`. For each todo with one or more `worktree-*/` siblings, it tries `git worktree remove --force`, runs `git worktree prune` (clears stale registry entries from folder renames), deletes the agent branch, and removes the worktree directory. Reported as `worktrees_swept=N` in tick summary.

## Ops dashboard + cost telemetry (Phase 9)

Per spec §12 row 9: text-mode dashboard, cost ledger, drift alerts. **No web UI in v1** — surfaces are CLI commands. Web UI deferred to Phase 9B.

### Cost ledger

Append-only JSONL at `~/.josh/cost/<YYYY-MM>.jsonl`. Each line: `{at, todo_id, agent_id, model, tokens_in, tokens_out, wall_seconds, usd, phase, sentinel}`.

```
josh cost log --todo <id> --agent <id> --model <m> --tokens-in N --tokens-out N --wall N --usd N [--phase N]
josh cost summary [--month YYYY-MM] [--since ISO] [--by agent|phase|model]
josh cost list-months
```

### Drift alerts

`bin/josh/lib/drift-alerts.js` `computeDriftAlerts(joshRoot, {window, threshold})`. Default window=10, threshold=3. An alert fires when the same agent disagrees with E08 ≥ 3 times in the last 10 matrix runs (per archetype). Below threshold = noise; not surfaced.

### Dashboard

```
josh dashboard [--project <id>] [--since ISO] [--drift-window N] [--drift-threshold N]
```

Sections: queue snapshot, in-flight by phase, in-flight by agent, cost summary (USD/hour rolling), drift alerts. Per-project view via `--project <id>` reuses the Phase 1 `renderDailyReview`.

## Cross-runtime gateway (Phase 8)

Per spec §11. Three pieces: an MCP server registry, per-agent tool scoping, and an A2A HTTP bridge for external (non–Claude-Code/Codex/OpenClaw) agents.

### MCP registry

```
~/.josh/mcp/registry.json
{
  "schema": 1,
  "servers": [
    { "id": "mcp:duckdb", "command": "duckdb-mcp", "args": [], "capabilities": ["query", "export"] }
  ]
}
```

CLI: `josh tool register/unregister/list/show`.

### Per-agent tool scoping

Each `agents/<id>/manifest.json` may carry `allowed_tools: ["mcp:duckdb", "fs:read"]`. Wildcards: `"mcp:*"` matches any `mcp:` tool. Empty array OR missing field = full access (v1 backward-compat). `["*"]` = explicit full access.

`josh claim --agent <id>` writes the resolved scope into `runtime.json.allowed_tools` for the runtime to honor. Out-of-scope use is logged via:

```
josh tool violation log --todo <id> --agent <id> --tool <tool-id> [--reason "..."]
```

This appends to `~/.josh/audit/violations-<date>.jsonl` and emits a `failed` lifecycle event (`reason: tool_scope_violation`) into the todo's `events.ndjson`.

### A2A HTTP bridge

```
josh a2a serve [--port N]              Foreground daemon (default port 7843, env JOSH_A2A_PORT)
josh a2a stop                          Signal stop via flag file
josh a2a health [--port N]             Hit /healthz
```

Endpoints:
- `GET /healthz` — `{ ok, version, mcp_servers }`.
- `POST /agents/register` — `{id, did, pubkey_jwk, allowed_tools, source_path}` → mints/updates `agents/<id>/manifest.json` (and writes `pubkey.jwk` if provided).
- `POST /tasks/sendSubscribe` — `{todo_id, agent_id}` → atomic `triaged → claimed`, writes `runtime.json.allowed_tools` from the agent manifest.
- `GET /tasks/<todo_id>` — current state + meta.

Bind is `127.0.0.1` only. Production hardening (TLS, auth, rate limits) deferred to Phase 8B.

### Phase 8B (deferred)

- Tool-scoping enforcement at the runtime boundary (today's check is declarative — runtime is expected to honor `runtime.json.allowed_tools`).
- TLS + bearer-token auth on the A2A bridge.
- agentgateway (binary) integration — not adopted; we build scoping primitives directly in josh per master design §1.5.

## Spec-evolver meta-lane (Phase 7)

Per spec §10. When an agent's brief degrades or on manual trigger, queue a "plan-only" iteration that proposes a patched brief; josh runs the rounds, applies halt rules, and drops a PR-style approval. **`josh evolve approve`** swaps the brief and bumps `manifest.version`. Old verdicts still verify against the v1 `brief_hash` (Phase 6's signed-payload binding handles this automatically).

### v1 scope

- Agents in v1: **A01, E00, E08** only. Pass `--allow-any` to override.
- Triggers: manual + nightly cron only. Disagreement-threshold trigger is gated until ≥50 matrix runs of data accumulate.

### Halt rules (verbatim §10.3)

1. `pass_rate ≥ 0.95` AND `<NO_NEW_GAPS_FOUND>` two rounds in a row → **converged**
2. brief > 250 lines after pruning → **bloating**
3. regression detected (`pass_rate < prev_round.pass_rate`) → **regression** (revert to prev round, halt)
4. N=8 hard ceiling → **max_rounds**

### CLI

```
josh evolve start <agent-id> [--max-rounds 5] [--simulator <dir>] [--allow-any]
josh evolve status [<evolve-id>]
josh evolve list [--state active|pending_approval|done]
josh evolve approve <evolve-id> [--as actor]
josh evolve reject <evolve-id> --reason "..." [--as actor]

josh lesson add <agent-id> "text" [--as actor]
josh lesson list <agent-id>
```

Per-agent corrections accumulate at `~/.josh/agents/<id>/lessons.md` and are inherited as session context.

### Approval drop layout

```
~/.josh/approvals/evolve-<agent>-<ulid>/
├── before.md
├── after.md
├── diff.patch
├── iteration-logs/round-N.md
├── gold-replay.json
└── approval.md
```

After `josh evolve approve`, the folder moves to `~/.josh/approvals/done/<evolve-id>/`. Rejections write a `rejection.json` and follow the same archive path.

## Cryptographic audit (Phase 6)

Two layered cryptographic guarantees, both required at read time.

### Layer 1: HMAC chain on the audit log

Each line of `~/.josh/audit/<YYYY-MM-DD>.jsonl` is computed as:

```
canonical = canonicalJson(event_minus_hmac)        # see lib/canonical-json.js (locked v1)
hmac_i    = HMAC_SHA256(audit_key_<key_id>, prev_hmac_bytes || canonical_bytes)
```

- `audit_key` is 32 random bytes at `~/.josh/keys/audit-<key_id>.key` (mode `0o600`).
- Genesis: `prev_hmac = 32 zero bytes`.
- Key rotation: `josh audit rotate-key [--id YYYY-MM]` mints a new key and appends a literal `audit.key_rotated` event.
- Verify: `josh audit verify <YYYY-MM-DD>` walks the chain forward. Returns `{valid, chain_length, errors[{position, message}]}`.

### Layer 2: Ed25519-signed verdicts

Every Phase 4 verdict envelope is signed by the issuing agent's Ed25519 key.

- Per-agent identity at `~/.josh/agents/<id>/identity.key` (raw 32B seed, mode `0o600`) and `~/.josh/agents/<id>/pubkey.jwk` (public).
- DID = `did:key:z<base64url(pubkey_32B)>`.
- Signature = JWS-compact with `alg:EdDSA`, `kid:<did>`. Payload binds `aud:"josh:audit"`, `iat`, `nbf`, `brief_hash` (sha256 of source brief), `verdict_id`, `agent_id`, `status`, `confidence`.
- Verify: `josh verdict verify <todo-id> [<agent-id>]` re-loads the agent's pubkey, runs JWS verify, asserts `brief_hash` in the signed payload matches `envelope.brief_hash`. Tampered envelopes → INVALID.

### Delegation chain (sub-agents)

When a parent agent (e.g. A01) spawns an ephemeral sub-agent for verdict gathering, the parent issues a JWS-compact VC with `{sub, act, delegate_to, scope, expires_at}`. Verifier walks: ephemeral signature against ephemeral pubkey → VC against parent pubkey → check `expires_at` and required scope. See `bin/josh/lib/delegation.js`.

### CLI

```
josh agent mint <agent-id> [--rotate]    Mint Ed25519 keypair + DID; patch manifest
josh agent show <agent-id>               Show DID + pubkey path + brief_hash
josh audit verify <YYYY-MM-DD>           Verify HMAC chain
josh audit rotate-key [--id YYYY-MM]     Mint a new audit key
josh audit list-keys                     List audit keys present
josh verdict verify <todo-id> [<agent>]  Verify Ed25519 signatures on envelopes
```

### Phase 6.5 (deferred)

OS-keychain wrap for key files (Windows DPAPI / macOS Keychain). v1 ships with file-perm isolation only.

## Operations: hybrid scheduler

The orchestrator runs as **two cooperating schedulers**:

| Layer | What | When | Why |
|---|---|---|---|
| **Heartbeat** | Windows Task Scheduler runs `node C:\Levi\bin\josh\josh.js tick` | every 5 min | Mechanical, fast (~50ms), free, independent of any LLM runtime |
| **Oversight** | OpenClaw cron `levi-orchestrator-oversight` runs an agent that reads `josh status` + `josh validate` and alerts on anomalies | every 1 hour | Intelligent, can react and notify when something looks wrong |

The `tick` lock primitive (`~/.josh/orchestrator/orchestrator.lock`) prevents double-fire if both happen to overlap.

### Heartbeat setup (one PC at a time)

```powershell
pwsh -NoProfile -File C:\Levi\bin\josh\scripts\register-task-scheduler.ps1
```

Hidden, interactive logon, 5-minute interval, 1-minute exec timeout. Re-running the script with `-Force` is safe.

To remove: `Unregister-ScheduledTask -TaskName 'josh-tick' -Confirm:$false`

### Oversight setup (one OpenClaw profile)

```powershell
openclaw --profile <profile> cron add `
  --name "levi-orchestrator-oversight" `
  --description "josh runtime oversight - reads status + validate, alerts on anomalies" `
  --every 1h `
  --message "Oversight pass for ~/.josh/ runtime. The heartbeat is handled by Windows Task Scheduler — DO NOT run josh tick yourself. Read 'josh status' and 'josh validate' via the exec tool. Stay silent unless: queue.failed > 0, queue.in_progress > 5, any approval older than 4h, any review older than 24h, orchestrator.last_tick older than 15 minutes, or josh validate reports errors. If an anomaly is present, emit ONE short alert (1-3 sentences) describing the most urgent problem, the affected ID or file, and one suggested next step." `
  --session isolated `
  --tools exec `
  --thinking off `
  --announce `
  --best-effort-deliver `
  --light-context `
  --timeout-seconds 60
```

The agent uses `--announce` to deliver alert text to the configured channel only when there's an anomaly to report. On clean ticks it stays silent (no LLM cost beyond the `josh status` parse).

### Verification

```powershell
# Heartbeat fresh?
josh status                    # last_tick should be within ~5 min

# Last oversight pass?
openclaw --profile <profile> cron runs --id <oversight-cron-id> --limit 1

# Manual oversight fire (debug)
openclaw --profile <profile> cron run <oversight-cron-id>
```

## Exit codes

Per spec: `0` success, `1` validation, `2` not-found, `3` lock-conflict, `4` filesystem error.

## See also

- `~/.josh/README.md` — full spec for the runtime.
- `C:\Levi\` — the parent plugin coordinating the cross-agent contract.
