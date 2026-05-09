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

## v0.2 scope

- `init` — create the directory tree (idempotent)
- `status` — pretty-print the status board
- `push todo "title" [flags]` — drop a todo into `incoming/`
- `list todo [--state STATE]` — list todos with filtering
- `show <id>` — print any artifact by full ID or last-6-char suffix
- `help`, `version`

Everything else in the spec (`push handoff/approval/review`, `claim`, `complete`, `fail`, `block`, `cancel`, `approve`, `deny`, `reply`, `control …`, `lock …`, `validate`, `sweep`) ships incrementally.

## Examples

```powershell
josh push todo "Fix flaky test in users.test.ts" --priority p1 --agent codex --label test,users
josh push todo "Triage CI failures" --priority p0 --verify "pnpm test"
josh list todo
josh list todo --state in_progress --priority p0
josh list todo --state all --json
josh show 01HXXXX                  # full ID
josh show ABC123                   # last-6 suffix; warns on collision
```

## Exit codes

Per spec: `0` success, `1` validation, `2` not-found, `3` lock-conflict, `4` filesystem error.

## See also

- `~/.josh/README.md` — full spec for the runtime.
- `C:\Levi\` — the parent plugin coordinating the cross-agent contract.
