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

## v0.6 scope

Full producer/observer/orchestrator/agent surface plus cross-agent handoffs, approvals, and resource locks:

- `init` / `status` / `help` / `version`
- **Todo**: `push todo`, `list todo`, `show <id>`, `claim`, `complete`, `fail`, `block`, `unblock`, `cancel`
- **Orchestrator**: `tick`, `control <action>`
- **Handoffs** (cross-agent messaging): `push handoff`, `list handoffs`, `reply`, `ack`
- **Approvals** (human-gated decisions): `push approval`, `list approvals`, `approve`, `deny`
- **Locks** (general resource locks): `lock acquire`, `lock release`, `lock list` (also `list locks`)

Future (v0.7+): `push review` + reviewer flow, `validate` (schema check), shared dossier helpers.

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
```

## Atomic state transitions

Each mutate op uses `fs.renameSync` between state directories as the lock primitive. The rename **is** the lock acquisition — only one agent succeeds, the other gets `ENOENT` and exits cleanly with code 3 (lock-conflict). Read-modify-write happens AFTER the rename, when the agent exclusively owns the file at the new path.

## Exit codes

Per spec: `0` success, `1` validation, `2` not-found, `3` lock-conflict, `4` filesystem error.

## See also

- `~/.josh/README.md` — full spec for the runtime.
- `C:\Levi\` — the parent plugin coordinating the cross-agent contract.
