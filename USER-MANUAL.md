# Levi & josh — User Manual

Operator reference for the Levi plugin and the `josh` CLI.
Covers everything currently shipped: every slash command in Claude Code and Codex, every subcommand of the `josh` CLI, every flag, every artifact, every directory, every config file, every exit code.

> Companion docs:
> - **[README.md](README.md)** — what Levi is and why
> - **[MANUAL.md](MANUAL.md)** — developer reference for adding axes
> - **[bin/josh/README.md](bin/josh/README.md)** — josh CLI quick reference
> - **[~/.josh/README.md](.)** — runtime spec (directory layout, JSON schemas)

---

## Table of contents

1. [What this is](#1-what-this-is)
2. [Quick start (5 minutes)](#2-quick-start-5-minutes)
3. [Architecture overview](#3-architecture-overview)
4. [Installation](#4-installation)
5. [Levi plugin reference](#5-levi-plugin-reference)
6. [Codex slash commands](#6-codex-slash-commands)
7. [josh CLI — complete reference](#7-josh-cli--complete-reference)
8. [The `~/.josh/` runtime](#8-the-josh-runtime)
9. [The orchestrator](#9-the-orchestrator)
10. [Common workflows](#10-common-workflows)
11. [Configuration reference](#11-configuration-reference)
12. [Audit & observability](#12-audit--observability)
13. [Troubleshooting](#13-troubleshooting)
14. [Adding a new agent](#14-adding-a-new-agent)
15. [Limits & not-yet-shipped](#15-limits--not-yet-shipped)
16. [Appendix: quick-reference card](#16-appendix-quick-reference-card)

---

## 1. What this is

Two cooperating things that together let multiple AI coding agents (Claude Code, Codex, OpenClaw) and a human work from the same shared queue on one machine.

| Component | What it is | Where it lives |
|---|---|---|
| **Levi** | A Claude Code plugin. Ships ~47 dispatcher slash commands, 2 talk-mode skills (caveman, caveman-ultra), 1 `UserPromptSubmit` hook, and a `/levi:josh` wrapper. | `C:\Levi\` (cloned), `~/.claude/plugins/cache/levi-marketplace/levi/<v>/` (installed) |
| **josh CLI** | A standalone Node.js CLI implementing the cross-agent runtime contract. Independent of Claude Code; runs from any shell or invoked by Codex / OpenClaw / Task Scheduler. | `C:\Levi\bin\josh\josh.js`, globally linked as `josh` via `npm link` |
| **`~/.josh/` runtime** | The shared filesystem-as-API workspace. Per-user, per-machine. Holds todos, handoffs, approvals, reviews, locks, audit, status. | `C:\Users\<you>\.josh\` |

You interact with the system through:
- **Claude Code slash commands**: `/levi:josh ...`, `/levi:talk ...`
- **Codex slash commands**: `/josh ...`
- **Raw shell**: `josh ...` (PowerShell, Bash, cmd — all work)

A long-running orchestrator (Windows Task Scheduler + OpenClaw cron) processes the queue in the background.

---

## 2. Quick start (5 minutes)

Assuming Levi and josh are already installed (see [Installation](#4-installation)):

```powershell
# 1. From any shell — drop a todo
josh push todo "Refactor users.ts to use Result<T,E>" --priority p1 --agent codex --label backend

# 2. See it in the queue (orchestrator triages within 5 min, or fire manually)
josh status
josh list todo
josh tick                      # manually triggers triage; otherwise wait

# 3. From a Claude Code session
/levi:josh list todo
/levi:josh claim ABC123 --as "claude-code:my-session"
/levi:josh complete ABC123 --note "shipped in commit XYZ"

# 4. From a Codex session, send a question to Claude
/josh push handoff --to claude --title "Type sig?" --body "What should X return?" --as "codex:my-session"

# 5. Approve something risky
josh push approval --summary "Push to main?" --default-after 2h --default-choice deny
josh approve <id> --note "ok, looks clean"
```

That's the full loop: drop work, observe it move, claim it, finish it, ask questions, get approval. The next sections cover each piece in detail.

---

## 3. Architecture overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        ~/.josh/ runtime                          │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  status.json                  (cross-agent dashboard)    │    │
│  │  todo/{incoming, triaged, in_progress, done, ...}        │    │
│  │  claude/{incoming, processed, outgoing}    handoffs      │    │
│  │  codex/{incoming, processed, outgoing}     handoffs      │    │
│  │  approvals/{pending, done}                 human-gated   │    │
│  │  reviews/{pending, done}                   peer review   │    │
│  │  locks/                                    resources     │    │
│  │  audit/<YYYY-MM-DD>.jsonl                  append-only   │    │
│  │  shared/<project>/                         knowledge     │    │
│  │  orchestrator/{incoming, .paused, lock}    control       │    │
│  └──────────────────────────────────────────────────────────┘    │
└────────────────────▲──────────────────────────▲──────────────────┘
                     │                          │
        Producer / Consumer                Orchestrator
                     │                          │
   ┌─────────────────┼──────────────┐    ┌──────┴───────────────────┐
   │                 │              │    │                          │
┌──┴───┐       ┌─────┴────┐    ┌────┴─┐  │  Windows Task Scheduler  │
│Claude│       │  Codex   │    │ Bash │  │  → josh tick (every 5m)  │
│ Code │       │          │    │ shell│  │                          │
│      │       │          │    │      │  │  OpenClaw cron oversight │
│/levi:│       │  /josh   │    │ josh │  │  → status + alert (1h)   │
│ josh │       │          │    │      │  │                          │
└──────┘       └──────────┘    └──────┘  └──────────────────────────┘
```

**Three agent surfaces**, **one CLI**, **one shared filesystem**, **two-layer scheduler**.

---

## 4. Installation

### 4.1 Prerequisites

| | Min | Why |
|---|---|---|
| Node.js | 18.0.0+ (24 recommended) | `josh` CLI runtime; uses `util.parseArgs` (18+) and BigInt (10+) |
| Windows | 10/11 with PowerShell 5.1+ or PowerShell 7 | Task Scheduler heartbeat; `pwsh` for register script |
| Claude Code | v2.x | Slash command + plugin format |
| OpenClaw | 2026.4+ (optional) | Hourly oversight pass |
| Git | any | Clone the repo |

### 4.2 Clone the repo

```powershell
git clone https://github.com/VoteWood/Levi.git C:\Levi
```

The repo is the source of truth for both the Levi plugin and the `josh` CLI.

### 4.3 Install the `josh` CLI globally

```powershell
cd C:\Levi\bin\josh
npm link
```

`npm link` registers `josh` as a system-wide command pointing at the working copy. Edits to `josh.js` take effect immediately — no rebuild step.

Verify:
```powershell
josh version          # → @levi/josh 0.9.0  (or current)
josh --help
```

To uninstall: `npm unlink -g @levi/josh`

### 4.4 Initialise the runtime

```powershell
josh init
```

Idempotent — creates `~/.josh/` plus all required subdirectories, plus an empty `status.json` and per-agent stubs.

Verify:
```powershell
josh status
```

### 4.5 Install Levi as a Claude Code plugin

```
/plugin marketplace add C:/Levi              (in any Claude Code session)
/plugin install levi@levi-marketplace
```

Restart the Claude Code session. Verify:
```
/plugin list                                 (should show "levi" enabled)
/levi:josh status                            (should print the runtime dashboard)
/levi:talk caveman                           (should activate caveman mode)
```

Future updates: edit/push to `C:\Levi`, then `/plugin update levi@levi-marketplace`. Bump `.claude-plugin/plugin.json` version to ensure the cache refreshes.

### 4.6 Install the Codex slash command

The Codex command is already in `~/.codex/commands/josh.md`. Codex auto-detects it on session start. Verify:
```
/josh status                                 (in any Codex session)
```

Multi-PC: copy `~/.codex/commands/josh.md` to each Codex install. (Or symlink if you sync `~/.codex/`.)

### 4.7 Register the heartbeat (Task Scheduler)

```powershell
pwsh -NoProfile -File C:\Levi\bin\josh\scripts\register-task-scheduler.ps1
```

Creates a hidden scheduled task `josh-tick` that runs `josh tick` every 5 minutes. Re-running with `-Force` is safe (idempotent).

Verify:
```powershell
Get-ScheduledTask -TaskName 'josh-tick' | Format-List
josh status      # last_tick should refresh within 5 min
```

To remove: `Unregister-ScheduledTask -TaskName 'josh-tick' -Confirm:$false`

### 4.8 Register OpenClaw oversight (optional)

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

Skip if you don't run OpenClaw or don't want intelligent oversight. The Task Scheduler heartbeat alone is fully functional.

---

## 5. Levi plugin reference

Levi is a **dispatcher** — it provides a wide surface of slash commands, most of which are placeholders waiting for content. Two axes are actually wired and shipping behaviour: **talk** (caveman, caveman-ultra) and **josh** (the CLI wrapper).

### 5.1 The 47 axis commands

All 47 are listed in `commands/*.md`. Most are dispatcher-only — typing them returns "no modes available" until you drop a SKILL into the matching `skills/<axis>/<name>/` folder. See [MANUAL.md](MANUAL.md) for the full axis map and how to add modes.

The **wired** commands are below.

### 5.2 `/levi:talk` — voice / persona modes

Switches Claude's voice for the rest of the session (or until cleared).

```
/levi:talk caveman              activate caveman mode (compressed, fragments OK)
/levi:talk caveman-ultra        even more compressed (drop prepositions, single-clause)
/levi:talk off                  clear active talk mode
/levi:talk                      list available modes
```

Natural-language disable also works: "stop caveman", "talk normally", "normal mode", "stop talking like a X". Natural activation: "talk like a caveman".

**Behaviour:** the `UserPromptSubmit` hook (`hooks/prompt-tracker.js`) writes a flag to `~/.claude/.levi-talk` and injects the matching `skills/talk/<name>/SKILL.md` body into every turn's context. Survives session restarts.

**Auto-clarity rules** (built into both SKILLs): the voice drops automatically for security warnings, irreversible action confirmations, multi-step sequences where order matters, code blocks, commit messages, and PR descriptions.

| Mode | Drops | Best for |
|---|---|---|
| `caveman` | articles, filler, pleasantries, hedges, closers | general token compression |
| `caveman-ultra` | everything caveman drops + prepositions, transitional phrases, multi-word verbs; forces single-clause sentences | skim-heavy work, status checks |

### 5.3 `/levi:josh` — josh CLI wrapper

Passes `$ARGUMENTS` to the `josh` CLI via Bash and returns stdout verbatim.

```
/levi:josh status
/levi:josh push todo "..." --priority p1 --agent codex
/levi:josh list todo --state in_progress
/levi:josh show <id>
/levi:josh claim <id> --as "claude-code:my-session"
/levi:josh complete <id> --note "..."
/levi:josh push handoff --to codex --title "..." --body "..."
/levi:josh approve <id>
/levi:josh control pause
... (every josh subcommand)
```

Restricted to `Bash(josh:*)` and `Bash(josh.cmd:*)` so the slash command can only call `josh`, nothing else.

**Quirk:** Claude Code v2 prefixes plugin slash commands with the plugin name. Use `/levi:josh`, not `/josh`. If you type `/josh` you'll get "Unknown command".

### 5.4 The `UserPromptSubmit` hook

`hooks/prompt-tracker.js` runs on every prompt. Responsibilities:

1. Parse `/talk <name>`, `/talk off`, and natural-language toggles. Update `~/.claude/.levi-talk` flag.
2. If a talk flag is active, read `skills/talk/<name>/SKILL.md` and emit it as `additionalContext` for this turn.

Silent-fails on every error (never blocks the user's prompt). Uses `~/.claude/.levi-talk` (Levi-prefixed to avoid colliding with Reuben's `.reuben-talk` if both plugins are installed).

### 5.5 Plugin manifest

`.claude-plugin/plugin.json` declares the hook wiring:
```json
{
  "name": "levi",
  "version": "0.3.0",
  "hooks": {
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/prompt-tracker.js\"", "timeout": 5 }] }]
  }
}
```

To add more hooks (e.g., guards, reporters, SessionStart), extend this block — see Reuben's plugin.json for a reference.

---

## 6. Codex slash commands

### 6.1 `/josh`

Same wrapper as `/levi:josh` but native to Codex (no `levi:` prefix). Lives at `~/.codex/commands/josh.md`.

```
/josh status
/josh push todo "..." --priority p1 --agent claude
/josh claim <id> --as "codex:my-session"
... (every josh subcommand)
```

Restricted to `Bash` tool. Codex auto-detects the file on session start; no install step.

### 6.2 Adding more Codex commands

Drop a `.md` file with YAML frontmatter into `~/.codex/commands/`. Format:
```yaml
---
description: One line describing the command
argument-hint: '[--flag] <positional>'
allowed-tools: [Bash, Read]
---

The instructions Codex follows when /<command> is invoked.
Use $ARGUMENTS for the slash-command arguments.
```

---

## 7. josh CLI — complete reference

### 7.1 Invocation

```
josh <command> [args...]
```

All subcommands return an integer exit code (see [§7.13](#713-exit-codes)). Most produce structured stdout; errors and warnings go to stderr.

### 7.2 `init`

Create the `~/.josh/` directory tree. Idempotent — safe to re-run.

```
josh init
```

Creates: `claude/{incoming,outgoing,processed}`, `codex/{incoming,outgoing,processed}`, `orchestrator/{incoming,processed}`, `todo/{incoming,triaged,in_progress,done,blocked,failed,cancelled}`, `approvals/{pending,done}`, `reviews/{pending,done}`, `locks/`, `audit/`, `shared/`. Plus initial `status.json` and per-agent `<agent>/status.json` stubs.

### 7.3 `status`

Pretty-print the cross-agent dashboard. Refreshes queue counts on read.

```
josh status
```

Output:
```
josh status — C:\Users\JesusLovesMe\.josh
updated: 2026-05-09T20:33:29.730Z

agents:
  claude_code     idle   —
  codex           idle   —
  orchestrator    alive  2026-05-09T20:33:29.730Z

queue:
  incoming           0
  triaged            2
  in_progress        1
  blocked            0
  failed             0
  approvals_pending  1
  reviews_pending    0
```

### 7.4 Todo lifecycle

#### `push todo "title" [flags]` — create

| Flag | Default | Notes |
|---|---|---|
| `--priority p0\|p1\|p2\|p3` | `p2` | p0=immediate, p3=backlog |
| `--agent auto\|claude\|codex\|<session-id>` | `auto` | `auto` lets the orchestrator route |
| `--label foo,bar` | `[]` | comma-separated, used by routing rules |
| `--due YYYY-MM-DD` | `null` | freeform — orchestrator doesn't enforce |
| `--verify "<cmd>"` | `null` | shell command; exit 0 = pass on `complete` |
| `--description "..."` | `""` | longer body |
| `--repo <path>` | `null` | freeform context |
| `--branch <name>` | `null` | freeform context |
| `--depends-on id1,id2` | `[]` | block when prerequisites exist |
| `--created-by "<actor>"` | `cli:<username>` | overrides default actor |

Returns the new todo's ULID on stdout. Drops `~/.josh/todo/incoming/<id>.json`.

#### `list todo [flags]` — view

| Flag | Default | Notes |
|---|---|---|
| `--state <state>\|all` | live states (`incoming`, `triaged`, `in_progress`, `blocked`) | Single state name or `all` |
| `--agent <name>` | (no filter) | Match exact agent value |
| `--priority pX` | (no filter) | Match exact priority |
| `--json` | text table | Emit raw JSON array |

Output sorted by priority (p0→p3), then by `created_at`.

#### `show <id>`

Print any artifact by ID. Accepts full ULID or last-6-char suffix. Walks the entire tree to find the matching `<id>.json|md`; warns on suffix collision.

```
josh show 01KR62MXQ5B3MNCNB2643YWY8J
josh show 3YWY8J                       # last-6 suffix
```

#### `claim <id> [flags]` — `triaged → in_progress`

| Flag | Default | Notes |
|---|---|---|
| `--as <actor>` or `--actor <actor>` | `cli:<username>` | Recorded in `claim.by` and history |
| `--ttl <seconds>` | `3600` (1 hour) | After this, orchestrator sweeps back to `triaged/` |

Atomic: the move IS the lock. Race losers exit with code 3.

#### `complete <id> [flags]` — `in_progress → done`

| Flag | Default | Notes |
|---|---|---|
| `--as`/`--actor <actor>` | `cli:<username>` | Recorded in `completed_by` |
| `--note "..."` | none | Stored in `completion_note` |
| `--skip-verify` | false | Skip the `verify` command if defined |

If todo has `verify: { type: command, value: "...", expect: "exit_zero" }`, runs it before moving. On non-zero exit, refuses to complete (exit 1) unless `--skip-verify`.

#### `fail <id> --reason "..." [flags]` — `in_progress|triaged → failed`

| Flag | Required | Notes |
|---|---|---|
| `--reason "<text>"` | yes | Stored in `failure_reason` |
| `--as`/`--actor <actor>` | optional | Default: cli:<user> |

#### `block <id> --depends-on <ids> [flags]` — `in_progress|triaged → blocked`

| Flag | Required | Notes |
|---|---|---|
| `--depends-on id1,id2` | yes | Appended to existing `depends_on` |
| `--reason "..."` | optional | Stored in `block_reason` |
| `--as`/`--actor` | optional | |

Clears `claim` field.

#### `unblock <id> [flags]` — `blocked → triaged`

| Flag | Notes |
|---|---|
| `--note "..."` | optional history note |
| `--as`/`--actor` | optional |

Clears `depends_on`. Caller is responsible for confirming dependencies are actually satisfied.

#### `cancel <id> [flags]` — any live state → `cancelled`

| Flag | Notes |
|---|---|
| `--reason "..."` | optional, stored in `cancel_reason` |
| `--as`/`--actor` | optional |

Allowed source states: `incoming`, `triaged`, `in_progress`, `blocked`. Clears `claim`.

### 7.5 Cross-agent handoffs

#### `push handoff [flags]` — send a message

| Flag | Required | Notes |
|---|---|---|
| `--to claude\|codex\|orchestrator` | yes | Recipient — the other agent's `incoming/` |
| `--title "..."` | yes | Short subject line |
| `--body "..."` | yes | Markdown OK |
| `--kind request\|answer\|note` | default: `request` | `note` = FYI, no reply expected |
| `--priority pX` | default: `p2` | Same scale as todos |
| `--reply-to <id>` | optional | Inherits thread_id from parent |
| `--from <actor>` | default: cli:<user> | Sender identity |
| `--context-files a,b` | optional | Comma-separated paths |
| `--expects-reply-by <ISO>` | optional | freeform deadline |

Drops `~/.josh/<recipient>/incoming/<id>.json`. Returns the handoff ULID.

#### `list handoffs [flags]`

| Flag | Default | Notes |
|---|---|---|
| `--for claude\|codex\|orchestrator` | all | Filter by recipient |
| `--state incoming\|processed\|all` | `incoming` | |
| `--json` | text table | |

#### `reply <id> --body "..." [flags]`

| Flag | Required | Notes |
|---|---|---|
| `--body "..."` | yes | The reply text |
| `--kind answer\|note` | default: `answer` | |
| `--as`/`--actor` | optional | |

Routes the reply to the original sender's `incoming/`. Atomically moves the original from receiver's `incoming/` → `processed/`. Preserves `thread_id`.

#### `ack <id> [flags]` — mark seen, no reply

| Flag | Notes |
|---|---|
| `--note "..."` | optional history note |
| `--as`/`--actor` | optional |

Atomic move `incoming/` → `processed/` for the agent currently holding it.

### 7.6 Approvals (human-gated decisions)

#### `push approval [flags]`

| Flag | Required | Notes |
|---|---|---|
| `--summary "..."` (or positional) | yes | One-line description of the decision |
| `--details "..."` | optional | Longer markdown body |
| `--options approve,deny,...` | default: `approve,deny` | Comma-separated choice list |
| `--default-after <duration>` | optional | `30s`, `30m`, `2h`, `1d` — orchestrator auto-applies after |
| `--default-choice <opt>` | default: `deny` | Must be in `--options` |
| `--requester <actor>` | default: cli:<user> | |

Drops `~/.josh/approvals/pending/<id>.json`. Returns ULID.

#### `list approvals [flags]`

| Flag | Default | Notes |
|---|---|---|
| `--state pending\|done\|all` | `pending` | |
| `--json` | text table | |

#### `approve <id> [flags]` / `deny <id> [flags]`

| Flag | Notes |
|---|---|
| `--note "..."` | for approve |
| `--reason "..."` | for deny |
| `--as`/`--actor` | overrides default actor |

Atomic move `pending/` → `done/` with `decision`, `decided_at`, `decided_by` recorded.

### 7.7 Reviews (cross-agent code/design review)

#### `push review [flags]`

| Flag | Required | Notes |
|---|---|---|
| `--subject-ref <url\|path\|id>` | yes | What is being reviewed |
| `--reviewer <agent>` | yes | Who should review (claude, codex, etc.) |
| `--subject-type pr\|file\|approach\|todo` | default: `pr` | |
| `--framing regular\|adversarial` | default: `regular` | adversarial = challenge mode |
| `--deadline <ISO>` | optional | |
| `--priority pX` | default: `p2` | |
| `--notes "..."` | optional | What to focus on |
| `--requested-by <actor>` | default: cli:<user> | |

Drops `~/.josh/reviews/pending/<id>.json`. Returns ULID.

#### `list reviews [flags]`

| Flag | Default | Notes |
|---|---|---|
| `--state pending\|done\|all` | `pending` | |
| `--reviewer <name>` | (no filter) | |
| `--verdict approve\|request_changes\|block` | (no filter) | |
| `--json` | text table | |

#### `review <id> --verdict X --reasoning "..." [flags]`

| Flag | Required | Notes |
|---|---|---|
| `--verdict approve\|request_changes\|block` | yes | Outcome |
| `--reasoning "..."` | yes | Markdown explanation |
| `--as`/`--actor` | optional | |

Atomic move `pending/` → `done/` with `verdict`, `reasoning`, `completed_at`, `completed_by`.

### 7.8 Resource locks

For coordinating mutual exclusion across agents (e.g., "I'm running migrations, no one else touch the DB").

#### `lock acquire <resource> [flags]`

| Flag | Default | Notes |
|---|---|---|
| `--ttl <duration>` | 1h | Auto-expires after this; supports `30s`, `30m`, `2h` |
| `--reason "..."` | optional | What you're protecting against |
| `--as`/`--actor` | default | Recorded as `holder` |

Returns the resource name on success. Exits non-zero if already held by someone else.

#### `lock release <resource>`

Removes the lock file. Idempotent — silent if already gone.

#### `lock list [--json]` (also: `josh list locks`)

Shows currently-held locks, with expiration status.

### 7.9 Orchestrator commands

#### `tick [flags]` — one heartbeat

| Flag | Notes |
|---|---|
| `--verbose` | Multi-line breakdown instead of one-line summary |
| `--force` | Ignore the orchestrator lock (debug only) |

Performs:
1. Process control commands in `orchestrator/incoming/`
2. Read pause/drain state
3. Triage `todo/incoming/` → `triaged/` (apply routing if `agent: auto`)
4. Sweep stale `in_progress/` claims back to `triaged/`
5. Auto-resolve expired approvals
6. Update `status.json`
7. Emit `orchestrator.tick` to audit

Lock primitive at `~/.josh/orchestrator/orchestrator.lock` prevents double-fire.

#### `control <action> [args]` — send commands to the orchestrator

| Action | Args | Effect |
|---|---|---|
| `pause` | — | Triage of new incoming todos pauses; in-progress work continues |
| `resume` | — | Lifts pause |
| `drain` | — | Finish current, take no new |
| `undrain` | — | Lifts drain |
| `sweep-now` | — | Trigger stale-claim sweep on next tick (just an audit hint; sweeps run every tick anyway) |
| `set-interval <seconds>` | 10–86400 | Updates `agents.orchestrator.interval_sec` in status.json |
| `reorder <todo-id> --priority pX` | required | Change priority of a live todo (incoming/triaged/blocked) |

Drops a control file in `orchestrator/incoming/<id>.json`. Processed on the next tick.

### 7.10 Maintenance

#### `validate [flags]`

Walk `~/.josh/` and verify every JSON file matches its schema for that path.

| Flag | Notes |
|---|---|
| `--json` | Structured output |
| `--verbose` | (currently same as default) |
| `--strict` | Exit 1 if any errors found (CI-friendly) |

Validates against in-code rules (no JSON Schema lib needed). Reports per-kind counts plus per-file errors. Skips unknown / non-validatable files.

### 7.11 Help & version

```
josh help            (also: --help, -h)
josh version         (also: --version, -v)
```

### 7.12 Environment variables

| Var | Default | Purpose |
|---|---|---|
| `JOSH_ROOT` | `~/.josh` | Override the runtime root (useful for tests) |
| `JOSH_ACTOR` | `cli:<username>` | Override the default actor across all mutate ops |
| `JOSH_DEBUG` | unset | When set, print stack traces on error |

### 7.13 Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Validation error (bad flag, missing required, invalid value) |
| `2` | Not found (no matching artifact) |
| `3` | Lock conflict (race-loss on atomic move; another agent got there first) |
| `4` | Filesystem error (rename/write failed; usually surfaces a Node `e.code`) |

---

## 8. The `~/.josh/` runtime

### 8.1 Directory layout

```
~/.josh/
├── README.md                 (the runtime spec — canonical schemas)
├── status.json               (cross-agent dashboard)
│
├── claude/
│   ├── incoming/             (handoffs Claude hasn't acted on)
│   ├── processed/            (handoffs Claude has replied to or acked)
│   ├── outgoing/             (optional log of what Claude emitted)
│   └── status.json           (Claude's per-agent status)
│
├── codex/                    (same shape as claude/)
├── orchestrator/
│   ├── incoming/             (control commands queued for the orchestrator)
│   ├── processed/            (rare; usually deleted after processing)
│   ├── status.json
│   ├── routing.json          (optional — label-based agent routing rules)
│   ├── orchestrator.lock     (heartbeat lock — PID + timestamp)
│   ├── .paused               (presence file: orchestrator paused)
│   └── .draining             (presence file: orchestrator draining)
│
├── todo/
│   ├── incoming/             (newly created)
│   ├── triaged/              (orchestrator has classified)
│   ├── in_progress/          (claimed by an agent)
│   ├── done/
│   ├── blocked/              (waiting on dependency)
│   ├── failed/
│   └── cancelled/
│
├── approvals/{pending, done}
├── reviews/{pending, done}
├── locks/<resource>.json     (currently-held locks)
├── audit/<YYYY-MM-DD>.jsonl  (append-only event log)
└── shared/<project>/         (per-project knowledge)
    ├── dossier.md
    ├── lessons.md
    └── brainstorm/
```

### 8.2 Conventions

**IDs.** Every artifact has a 26-char [ULID](https://github.com/ulid/spec) (Crockford base32). Time-sortable: `ls ~/.josh/todo/incoming/` is chronological.

**Filenames.** `<id>.json` for JSON artifacts, `<id>.md` for markdown. Optionally append `__<slug>` for human readability: `<id>__short-slug.json`.

**Atomic moves are the lock.** Every state transition uses `fs.renameSync(from, to)`. The rename IS the lock acquisition — only one caller succeeds. Read-modify-write happens AFTER the rename, when the agent exclusively owns the file at the new path.

**Schema versioning.** Every JSON has `"schema": <int>`. Current is `1`. New required fields → bump to `2`; readers handle both for one major version.

**Append-only audit.** `audit/<YYYY-MM-DD>.jsonl` is one JSON event per line, never edited or deleted. Daily rotation.

### 8.3 JSON schemas (current shape)

Concise summary; full schemas in [`~/.josh/README.md`](~/.josh/README.md).

#### Todo (`todo/<state>/<id>.json`)
```json
{
  "schema": 1,
  "id": "01H...",
  "title": "...",
  "description": "...",
  "created_at": "ISO-8601",
  "created_by": "cli:josh",
  "priority": "p0|p1|p2|p3",
  "due": "YYYY-MM-DD|null",
  "labels": ["..."],
  "agent": "auto|claude|codex|<session-id>",
  "context": {"repo": null, "branch": null, "files": []},
  "depends_on": ["..."],
  "verify": {"type": "command", "value": "...", "expect": "exit_zero"} | null,
  "claim": {"by": "...", "at": "ISO", "ttl_sec": 3600} | null,
  "completed_at": "...",        (when in done/)
  "completed_by": "...",
  "completion_note": "...",
  "failed_at": "...",           (when in failed/)
  "failed_by": "...",
  "failure_reason": "...",
  "block_reason": "...",        (when in blocked/)
  "cancelled_at": "...",        (when in cancelled/)
  "cancelled_by": "...",
  "cancel_reason": "...",
  "history": [{"at", "actor", "event", "details"}]
}
```

#### Handoff (`<agent>/{incoming,processed}/<id>.json`)
```json
{
  "schema": 1,
  "id": "01H...",
  "thread_id": "01H...",         (== id for first message in thread)
  "reply_to": "01H..." | null,
  "from": "claude-code:session-x",
  "to": "codex",
  "kind": "request|answer|note",
  "title": "...",
  "body": "...",
  "context_files": ["..."],
  "created_at": "ISO",
  "expects_reply_by": "ISO|null",
  "priority": "pX",
  "processed_at": "...",         (when in processed/)
  "processed_by": "...",
  "history": [{...}]
}
```

#### Approval (`approvals/{pending,done}/<id>.json`)
```json
{
  "schema": 1,
  "id": "01H...",
  "created_at": "ISO",
  "requester": "...",
  "summary": "...",
  "details": "...",
  "options": ["approve", "deny"],
  "default_after_sec": 7200 | null,
  "default_choice": "deny",
  "decision": "approve|deny",      (when in done/)
  "decided_at": "...",
  "decided_by": "...",
  "decision_note": "...",
  "decision_reason": "...",
  "expired": true | false,         (set when orchestrator auto-applied)
  "history": [{...}]
}
```

#### Review (`reviews/{pending,done}/<id>.json`)
```json
{
  "schema": 1,
  "id": "01H...",
  "created_at": "ISO",
  "requested_by": "...",
  "subject_type": "pr|file|approach|todo",
  "subject_ref": "...",
  "framing": "regular|adversarial",
  "reviewer": "claude|codex|...",
  "deadline": "ISO|null",
  "priority": "pX",
  "notes": "...",
  "verdict": "approve|request_changes|block",   (when in done/)
  "reasoning": "...",
  "completed_at": "...",
  "completed_by": "...",
  "history": [{...}]
}
```

#### Lock (`locks/<resource>.json`)
```json
{
  "schema": 1,
  "resource": "db-prod",
  "holder": "cli:josh",
  "acquired_at": "ISO",
  "expires_at": "ISO",
  "reason": "running migration"
}
```

#### Status board (`status.json`)
```json
{
  "schema": 1,
  "updated_at": "ISO",
  "agents": {
    "claude_code":  {"alive": false, "last_seen": null, "current_task": null},
    "codex":        {"alive": false, "last_seen": null, "current_task": null},
    "orchestrator": {"alive": true, "last_tick": "ISO", "tick_count": N, "interval_sec": 300, "paused": false, "draining": false}
  },
  "queue": {
    "incoming": 0, "triaged": 0, "in_progress": 0, "blocked": 0, "failed": 0,
    "approvals_pending": 0, "reviews_pending": 0
  }
}
```

#### Control command (`orchestrator/incoming/<id>.json`)
```json
{"schema": 1, "id": "01H...", "action": "pause|resume|drain|undrain|sweep_now|set_interval|reorder", "todo_id": "...", "new_priority": "...", "interval_sec": 60}
```

#### Audit line (`audit/YYYY-MM-DD.jsonl`)
```jsonl
{"at": "ISO", "actor": "...", "action": "<entity>.<verb>", "id": "...", "details": {...}}
```

Standard actions: `todo.created`, `todo.triaged`, `todo.claimed`, `todo.completed`, `todo.failed`, `todo.blocked`, `todo.unblocked`, `todo.cancelled`, `todo.claim_expired`, `todo.reordered`, `todo.malformed`, `handoff.sent`, `handoff.replied`, `handoff.acked`, `approval.requested`, `approval.decided`, `approval.expired`, `review.requested`, `review.completed`, `lock.acquired`, `lock.released`, `control.queued`, `control.paused`, `control.resumed`, `control.draining`, `control.undrained`, `control.sweep_now`, `control.set_interval`, `control.invalid`, `control.unknown`, `orchestrator.tick`.

---

## 9. The orchestrator

### 9.1 Two-layer architecture

| Layer | What runs | When | Cost | Reliability |
|---|---|---|---|---|
| **Heartbeat** | Windows Task Scheduler → `node josh.js tick` | every 5 min | ~50ms, $0 | OS-native, runs even if OpenClaw / network is down |
| **Oversight** | OpenClaw cron → agent reads `josh status` + `josh validate` | every 1 hour | ~3.5K tokens × 24/day | Conditional on OpenClaw being up |

The heartbeat is mechanical: triage, sweep, expire approvals, update status. The oversight is intelligent: detect anomalies and alert.

### 9.2 What `josh tick` does (each heartbeat)

In order:

1. **Lock acquisition.** Atomic write `~/.josh/orchestrator/orchestrator.lock` (`fs.writeFile` with `flag: 'wx'`). On lock-held, exits cleanly (no work). Stale locks (older than 2 × interval) are recovered.
2. **Process control commands.** Read every `orchestrator/incoming/<id>.json`, apply the action (pause / resume / drain / set-interval / reorder), delete the file.
3. **Read pause/drain state.** Presence of `.paused` or `.draining` flag files.
4. **Load routing config.** Read `orchestrator/routing.json` if present.
5. **Triage incoming todos** (skipped if paused). For each `todo/incoming/<id>.json`:
   - If `agent: auto` and a routing rule matches a label, set the agent.
   - Append `triaged` history entry.
   - Atomic mv → `todo/triaged/<id>.json`.
   - Audit `todo.triaged`.
6. **Sweep stale claims.** For each `todo/in_progress/<id>.json` whose `claim.at + claim.ttl_sec` is in the past:
   - Clear `claim`.
   - Append `claim_expired` history entry.
   - Atomic mv → `todo/triaged/<id>.json`.
   - Audit `todo.claim_expired`.
7. **Auto-resolve expired approvals.** For each `approvals/pending/<id>.json` whose `default_after_sec` has elapsed past `created_at`:
   - Set `decision = default_choice`, `decided_by = orchestrator:auto-expired`, `expired = true`.
   - Atomic mv → `approvals/done/`.
   - Audit `approval.expired`.
8. **Update `status.json`.** Refresh queue counts, set `orchestrator.last_tick`, increment `tick_count`, write `paused`/`draining` flags.
9. **Audit the tick.** One `orchestrator.tick` line with all counters.
10. **Release lock.**

Output: one-line summary by default, multi-line with `--verbose`.

### 9.3 OpenClaw oversight responsibilities

The cron-fired agent is told:
1. Run `josh status` and `josh validate` via the `exec` tool.
2. Stay silent unless any of these anomalies appear:
   - `queue.failed > 0`
   - `queue.in_progress > 5`
   - any approval older than 4h still pending
   - any review older than 24h still pending
   - `orchestrator.last_tick` older than 15 min (heartbeat may be down)
   - `josh validate` reports errors
3. On anomaly, deliver one short alert (1-3 sentences) describing the most urgent issue, the affected ID/file, and one suggested next step.

Configured via `--announce` + `--best-effort-deliver` so alert text routes to the configured channel. If the channel can't deliver, the job still succeeds.

### 9.4 Smart triage routing

`~/.josh/orchestrator/routing.json` (optional):
```json
{
  "schema": 1,
  "rules": [
    {"if_labels": ["test", "tests"], "agent": "codex"},
    {"if_labels": ["docs"], "agent": "claude"},
    {"if_labels": ["security"], "agent": "claude"}
  ],
  "default_agent": "auto"
}
```

When the orchestrator triages a todo with `agent: auto`, it walks the rules in order. First rule whose `if_labels` intersects with the todo's `labels` wins; the todo's `agent` is set to that rule's `agent`. Logged in audit as `routed_from`/`matched_rule`.

If no rule matches, the todo stays as `auto`. If the file doesn't exist, no auto-routing happens (todos stay `auto`).

### 9.5 Lock semantics

- **Per-tick lock**: `~/.josh/orchestrator/orchestrator.lock`. Prevents Task Scheduler and OpenClaw from double-firing the orchestrator. Atomic create-if-not-exists. Stale recovery on next tick.
- **Per-todo lock**: implicit via `fs.renameSync` between state directories. The rename IS the lock; race losers fail with `ENOENT` (exit 3).
- **General resource locks**: explicit via `josh lock acquire <resource>`. Stored at `~/.josh/locks/<resource>.json`. TTL-bounded; orchestrator can sweep expired locks (currently manual via `lock release`).

---

## 10. Common workflows

### 10.1 Drop a todo from a Claude Code session

```
/levi:josh push todo "Fix flaky users test" --priority p1 --agent codex --label test --verify "pnpm test users"
```

The orchestrator triages within 5 minutes. If the routing config maps `test → codex`, the todo's agent stays codex. Otherwise the agent is preserved as you set it.

### 10.2 Codex picks up your work

In a Codex session:
```
/josh list todo --agent codex
/josh claim <id> --as "codex:my-session"
... (codex does the work)
/josh complete <id> --note "shipped in commit ABC"
```

If `verify` was set, `complete` runs it. On non-zero exit, completion is refused. Use `--skip-verify` to override or `josh fail <id> --reason "..."` to mark failed.

### 10.3 Ask another agent a question

From Claude Code:
```
/levi:josh push handoff --to codex --kind request --title "Type sig?" --body "What should parseConfig return?" --as "claude-code:my-session"
```

Codex sees it next session via `/josh list handoffs --for codex`, replies with `/josh reply <id> --body "..."`. The reply lands in `claude/incoming/`; the original moves to `codex/processed/`.

### 10.4 Gate a deploy on your approval

From any session:
```
josh push approval --summary "Push v0.5 to main?" --details "..." --default-after 2h --default-choice deny
```

Bot or human deciding:
```
josh approve <id> --note "tests pass, ship it"
```

If 2h elapses without a decision, the orchestrator applies the default (deny) automatically. Audit logs the auto-expiry.

### 10.5 Request a code review

```
josh push review --subject-ref "https://github.com/me/repo/pull/42" --reviewer codex --framing adversarial --priority p1 --notes "focus on lock semantics"
```

Reviewer:
```
josh list reviews --reviewer codex
josh review <id> --verdict request_changes --reasoning "Lock TTL is in seconds but help says hours" --as "codex:reviewer-session"
```

### 10.6 Lock a shared resource

Before starting a risky operation (db migration, deploy, etc.):
```
josh lock acquire db-prod --ttl 30m --reason "running migration 0042"
```

Other agents check for the lock file before touching the resource (currently no built-in enforcement; convention only). When done:
```
josh lock release db-prod
```

Expired locks (`expires_at` in the past) auto-clean on `josh lock list` and via orchestrator awareness.

### 10.7 Set up label-based routing

Create `~/.josh/orchestrator/routing.json`:
```json
{
  "schema": 1,
  "rules": [
    {"if_labels": ["test", "tests"], "agent": "codex"},
    {"if_labels": ["docs"], "agent": "claude"}
  ],
  "default_agent": "auto"
}
```

Next tick, todos with `agent: auto` and matching labels route automatically. Original audit shows `routed_from: auto`, `matched_rule: "test,tests"`.

### 10.8 Pause the orchestrator

```
josh control pause
```

Triage of new incoming todos halts. In-progress work continues. To resume:
```
josh control resume
```

For drain mode (finish current, take no new):
```
josh control drain
josh control undrain          # lifts drain
```

### 10.9 Debug a stuck todo

```
josh show <id>                # full JSON, including history
josh tick --verbose --force   # force a tick ignoring lock
josh validate                 # check for malformed files
tail -50 ~/.josh/audit/$(date +%Y-%m-%d).jsonl
```

### 10.10 Reorder priority of a live todo

```
josh control reorder <todo-id> --priority p0
```

Applies on next tick. Targets `incoming`, `triaged`, or `blocked` (not `in_progress` — change priority before claiming).

---

## 11. Configuration reference

### 11.1 `~/.josh/orchestrator/routing.json` (optional)

Label → agent mapping for the orchestrator's triage step. See [§9.4](#94-smart-triage-routing).

### 11.2 `~/.josh/orchestrator/.paused` and `.draining`

Presence files. Created by `josh control pause` / `drain`, removed by `resume` / `undrain`. Empty contents — only the file's existence matters. You can also `touch` / `rm` them directly if `josh control` is unavailable.

### 11.3 `~/.josh/orchestrator/orchestrator.lock`

Heartbeat lock — written by `josh tick`, deleted on tick completion. Format:
```json
{"pid": 12345, "acquired_at": "ISO", "host": "PRAISEJESUS"}
```

Stale lock (older than `2 × interval_sec`) is auto-recovered on next tick. Manual recovery: `rm ~/.josh/orchestrator/orchestrator.lock`.

### 11.4 `~/.josh/status.json`

Cross-agent dashboard. Refreshed on every `josh status` read and on every `josh tick`. The `agents.orchestrator.interval_sec` field is the source of truth for the orchestrator's tick interval (changeable via `josh control set-interval`).

### 11.5 `~/.claude/.levi-talk`

Plain text flag file written by Levi's `UserPromptSubmit` hook when `/levi:talk <name>` is invoked. Contents = current talk mode name (e.g., `caveman-ultra`). Removed when `/levi:talk off` runs. You can also write directly: `echo caveman > ~/.claude/.levi-talk`.

### 11.6 Environment variables

| Var | Default | Used by |
|---|---|---|
| `JOSH_ROOT` | `~/.josh` | every `josh` subcommand |
| `JOSH_ACTOR` | `cli:<username>` | every mutate op (override default actor) |
| `JOSH_DEBUG` | unset | `josh` errors print stack traces when set |
| `CLAUDE_CONFIG_DIR` | `~/.claude` | Levi `prompt-tracker.js` flag location |
| `CLAUDE_PLUGIN_ROOT` | (set by Claude Code) | Resolves hook script paths in `plugin.json` |

---

## 12. Audit & observability

### 12.1 The audit log

`~/.josh/audit/<YYYY-MM-DD>.jsonl`. Append-only, daily-rotated. One JSON event per line:

```jsonl
{"at":"2026-05-09T20:33:29.730Z","actor":"orchestrator","action":"orchestrator.tick","id":null,"details":{"controls":0,"triaged":2,"routed":1,"swept":0,"expired_approvals":0,"paused":false,"draining":false,"duration_ms":47}}
```

Common queries (from any shell):

```powershell
# Tail today's events
Get-Content "$env:USERPROFILE\.josh\audit\$(Get-Date -Format yyyy-MM-dd).jsonl" -Tail 50

# All events for a given todo ID
Select-String -Pattern "01KR62MXX9DMD2E06ACEP47B9K" -Path "$env:USERPROFILE\.josh\audit\*.jsonl"

# Count of each action type today
Get-Content "$env:USERPROFILE\.josh\audit\$(Get-Date -Format yyyy-MM-dd).jsonl" | ForEach-Object { ($_ | ConvertFrom-Json).action } | Group-Object | Sort-Object Count -Descending
```

Bash equivalents:
```bash
tail -50 ~/.josh/audit/$(date +%Y-%m-%d).jsonl
grep "01KR62..." ~/.josh/audit/*.jsonl
jq -r '.action' ~/.josh/audit/$(date +%Y-%m-%d).jsonl | sort | uniq -c
```

### 12.2 The status board

`josh status` is the top-level dashboard. Fields:

- `agents.<name>.alive` — true if the agent has updated its slot recently
- `agents.<name>.last_seen` / `last_tick` — ISO timestamp
- `agents.<name>.current_task` — freeform string (agents can write what they're doing)
- `queue.*` — counts per directory; refreshed on read

Stale = `agents.<name>.last_seen` older than `2 × interval_sec`.

### 12.3 OpenClaw cron run history

```powershell
openclaw --profile <profile> cron runs --id <oversight-cron-id> --limit 20
```

Returns the last N tick attempts: status, duration, summary, model, usage tokens, delivery status.

### 12.4 Task Scheduler info

```powershell
Get-ScheduledTaskInfo -TaskName 'josh-tick' | Format-List
Get-WinEvent -LogName "Microsoft-Windows-TaskScheduler/Operational" -MaxEvents 20 | Where-Object { $_.Message -match 'josh-tick' }
```

---

## 13. Troubleshooting

### `josh status` shows `last_tick` more than 10 minutes old

Heartbeat is down. Check:
```powershell
Get-ScheduledTask -TaskName 'josh-tick'
Get-ScheduledTaskInfo -TaskName 'josh-tick'
```

Common causes:
- Task disabled (right-click → Enable in Task Scheduler UI, or `Enable-ScheduledTask -TaskName 'josh-tick'`)
- User not logged in and task set to interactive logon (re-register with different `LogonType` if you need it to run when logged out)
- `node.exe` path changed (re-run `register-task-scheduler.ps1`)
- Lock file stuck (`rm ~/.josh/orchestrator/orchestrator.lock`)

Manual recovery: `josh tick` from any shell. The next scheduled fire should resume normal cadence.

### `Unknown command: /josh` in Claude Code

Use `/levi:josh` — Claude Code v2 namespaces plugin commands. Codex uses `/josh` (no prefix).

### Multiple `/levi:josh` lines in one message all become one mangled call

Slash commands fire on the FIRST `/` only. Subsequent `/levi:josh` lines become text in `$ARGUMENTS`. Run them as separate messages, or use raw bash via `!josh ...`.

### `josh complete` records the wrong actor

Either pass `--as <actor>` / `--actor <actor>` explicitly, or set `JOSH_ACTOR` in the agent's environment before invoking.

### `josh validate` reports errors I can't track down

```
josh validate --json | jq '.errors'
```

Each entry has the file path and the specific schema rule that failed. Edit the file or delete it and re-create.

### Two agents both claimed the same todo

Shouldn't be possible — the atomic `rename` between `triaged/` and `in_progress/` is the lock. If you see this, check the audit log:
```bash
grep "todo.claimed" ~/.josh/audit/*.jsonl | grep "<todo-id>"
```

If two `claimed` events exist for the same id, that's a bug — file an issue with the audit lines.

### Approval auto-expired before I saw it

`--default-after` was set too short. To prevent: omit `--default-after` for high-stakes approvals (no auto-expiry; pending forever). Or set `--default-choice approve` if the safe default is yes.

### OpenClaw oversight runs but no Discord alert

Check delivery target:
```powershell
openclaw --profile <profile> cron show <oversight-cron-id> --json | jq '.delivery'
```

If `channel: "last"` and `to: null`, the agent doesn't know where to send. Configure:
```powershell
openclaw --profile <profile> cron edit <id> --channel "discord:<channel-id>"
```

Or change to a different channel/target via `--to`.

### `josh tick` hangs

Should never happen — tick is bounded by file I/O (no network, no LLM). If hung:
```bash
ls ~/.josh/orchestrator/orchestrator.lock     # check the lock file
kill <pid-from-lock-file>                     # force-stop
rm ~/.josh/orchestrator/orchestrator.lock
josh tick --force                             # try again
```

---

## 14. Adding a new agent

The runtime is designed to scale to more than just claude/codex/orchestrator. To add (e.g., "alex"):

1. **Create the directory tree** for the new agent:
   ```bash
   mkdir -p ~/.josh/alex/{incoming,outgoing,processed}
   ```

2. **Add to `josh.js`'s `KNOWN_AGENTS`** constant (line ~30 of `bin/josh/josh.js`):
   ```js
   const KNOWN_AGENTS = ['claude', 'codex', 'orchestrator', 'alex'];
   ```

3. **Add to `SUBDIRS`** so `josh init` creates the dirs on fresh installs:
   ```js
   const SUBDIRS = [
     ...,
     'alex/incoming', 'alex/outgoing', 'alex/processed',
   ];
   ```

4. **Update reply routing** in `cmdReply` if the new agent's `from` field uses a non-standard prefix (e.g., `alex-prime:session-X`):
   ```js
   if (/^alex/i.test(origFrom)) recipientDir = 'alex';
   ```

5. **Add an agent slot** to the status board (optional — `josh status` will just not show the new agent if not pre-registered, but you can add to `emptyStatus()`):
   ```js
   alex: { alive: false, last_seen: null, current_task: null }
   ```

6. **Add validation**: the validators in `validatorFor()` already handle any `<agent>/<state>/<id>.json` path matching `^(claude|codex|orchestrator)/...`. Update the regex to include the new agent.

7. **Drop a slash command** in the new agent's tool config (mirror `~/.codex/commands/josh.md`).

For a one-off transient agent (e.g., a short-lived script), no code changes needed — handoffs to/from `cli:<username>` work without registration.

---

## 15. Limits & not-yet-shipped

What's deliberately not in scope for v0.9:

- **No multi-machine sync.** `~/.josh/` is per-machine. The schema is sync-friendly (UTC timestamps, ULIDs, no machine paths in JSON), but no sync layer is built. Drop the directory in Dropbox/OneDrive at your own risk (concurrent-write conflicts).
- **No real-time push.** Polling only — orchestrator runs every 5 min, `josh list` is on-demand. No file watchers, no long-poll. Fine for non-real-time work.
- **No JSON Schema migration tooling.** When you bump `schema: 1 → 2`, you handle the readers yourself.
- **No reviewer auto-routing.** When a `push review` arrives, the reviewer is whoever the requester named. No load-balancing or skill-based routing.
- **No dossier helpers in CLI.** `shared/<project>/dossier.md` is freeform — no `josh dossier append` command yet.
- **No real lock enforcement.** `josh lock acquire` writes a file; agents must voluntarily check before acting. There's no kernel-level locking on the protected resource.
- **Orchestrator doesn't sweep expired resource locks automatically.** `lock list` warns about expired locks; cleanup is manual via `lock release`.
- **No web UI / dashboard.** Everything is text. `josh status` is the dashboard.
- **No metrics / telemetry export.** Audit log is the only persistent record; you can grep it.

---

## 16. Appendix: quick-reference card

```
─── Setup ──────────────────────────────────────────────────────────
josh init                                    create directory tree
josh status                                  print dashboard
josh validate [--strict]                     check every JSON

─── Todos ──────────────────────────────────────────────────────────
josh push todo "title" [flags]               create
josh list todo [--state X --agent Y --json]  view
josh show <id>                               full JSON
josh claim <id> --as ACTOR --ttl 3600        triaged → in_progress
josh complete <id> [--note ...] [--skip-verify]
josh fail <id> --reason "..."
josh block <id> --depends-on <ids>
josh unblock <id>
josh cancel <id> [--reason "..."]

─── Cross-agent messaging ──────────────────────────────────────────
josh push handoff --to AGENT --title "..." --body "..."
                  [--kind request|answer|note] [--reply-to ID]
josh list handoffs [--for AGENT --state incoming|processed|all]
josh reply <id> --body "..." [--kind answer|note]
josh ack <id> [--note "..."]

─── Approvals ──────────────────────────────────────────────────────
josh push approval --summary "..." [--default-after 2h --default-choice deny]
josh list approvals [--state pending|done|all]
josh approve <id> [--note "..."]
josh deny <id> [--reason "..."]

─── Reviews ────────────────────────────────────────────────────────
josh push review --subject-ref X --reviewer Y [--framing adversarial]
josh list reviews [--state X --reviewer Y --verdict V]
josh review <id> --verdict approve|request_changes|block --reasoning "..."

─── Locks ──────────────────────────────────────────────────────────
josh lock acquire <resource> [--ttl 1h --reason "..."]
josh lock release <resource>
josh lock list

─── Orchestrator ───────────────────────────────────────────────────
josh tick [--verbose --force]                one heartbeat
josh control pause | resume | drain | undrain | sweep-now
josh control set-interval <seconds>
josh control reorder <todo-id> --priority pX

─── Help ───────────────────────────────────────────────────────────
josh help                                    full usage
josh version

─── Talk modes (Claude Code only) ──────────────────────────────────
/levi:talk caveman                           compressed
/levi:talk caveman-ultra                     extreme
/levi:talk off                               normal
"talk like a caveman" / "stop caveman"       natural toggles

─── Slash command surfaces ─────────────────────────────────────────
Claude Code:    /levi:josh ...
Codex:          /josh ...
Shell:          josh ...
                !josh ...                    (in Claude Code, raw bash)
```
