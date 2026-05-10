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
