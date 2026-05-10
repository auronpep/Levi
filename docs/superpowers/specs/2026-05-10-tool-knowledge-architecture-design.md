# Cross-Runtime Tool Knowledge Architecture

**Date:** 2026-05-10
**Status:** Design — pending implementation plan

## Goal

Maintain one growing body of knowledge per CLI tool, library, or system that
Levi-driven agents touch — full capability surface, setup/auth, common
workflows, error handling, traps, and lessons — and have the right knowledge
auto-load whenever an agent reaches for that tool, across Claude Code,
OpenClaw, and Codex.

### Requirements (from operator)

1. Comprehensive capability coverage per tool ("literally everything it can
   do, prune later")
2. Dedicated sections for error handling and lessons
3. Common traps recorded so the same mistake never happens twice
4. Works in Claude Code, OpenClaw, and Codex
5. Long-term: every special tool gets one of these
6. Initial scope (10 tools): pyicloud, icloudpd, keyring, paddleocr,
   faster-whisper, ffmpeg, pyheif, exiftool, pydantic, tomli
7. Hosted in `C:\Levi` (Levi plugin)
8. OpenClaw enforcement via installable hook plugin pack
9. Codex enforcement via user-scope `~/.codex/hooks.json`
10. Isaac and other agents do NOT get dedicated agent-instruction lines yet —
    the hook layer handles all enforcement until per-agent domain routing is
    embedded in agent core files later

## Architecture: 3 layers

| Layer | Role | Primitive per runtime |
|---|---|---|
| **Hook** | Auto-load enforcement on tool invocation | Claude Code PreToolUse, OpenClaw hooks (plugin pack), Codex hooks (user-scope) |
| **Skill** | The knowledge body — capability surface, auth, workflows, errors, traps, lessons | `SKILL.md` per runtime skill location |
| **Plugin** | Distribution / packaging | Levi (Claude Code plugin), OpenClaw plugin pack shipped from Levi, Codex hook config shipped from Levi |

**Hook = trigger. Skill = content.** The hook injects a one-line nudge ("Load
skill `tool-icloudpd`"). The model loads the skill once. The skill body sits
in session context for the rest of the session — subsequent calls cost
nothing.

## Layout in Levi

```
C:\Levi\
├── .claude-plugin/
│   └── plugin.json                          ← add hooks block (PreToolUse on Bash)
├── skills/
│   └── tools/                               ← new axis: per-tool knowledge
│       ├── icloudpd/SKILL.md
│       ├── pyicloud/SKILL.md
│       ├── keyring/SKILL.md
│       ├── paddleocr/SKILL.md
│       ├── faster-whisper/SKILL.md
│       ├── ffmpeg/SKILL.md
│       ├── pyheif/SKILL.md
│       ├── exiftool/SKILL.md
│       ├── pydantic/SKILL.md
│       └── tomli/SKILL.md
├── hooks/
│   ├── guards/
│   │   └── tool-context-loader.js           ← Claude Code PreToolUse hook
│   └── lib/
│       ├── trigger-registry.js              ← discovers triggers from SKILL.md frontmatter
│       └── frontmatter.js                   ← lightweight YAML reader (no deps)
├── openclaw/
│   ├── plugin.json                          ← OpenClaw plugin manifest
│   ├── hooks/
│   │   └── tool-context-loader.json         ← OpenClaw hook definition
│   └── README.md
├── codex/
│   ├── hooks.json                           ← Codex hook config (user-scope target)
│   └── config-fragment.toml                 ← `[features] codex_hooks = true`
├── bin/
│   └── levi-sync.ps1                        ← installs hooks/skills into all three runtimes
├── commands/
│   └── lesson.md                            ← `/lesson` slash command
└── docs/superpowers/specs/
    └── 2026-05-10-tool-knowledge-architecture-design.md   ← this file
```

## Skill format

`skills/tools/<name>/SKILL.md` — one file per tool. Frontmatter is the
trigger contract; body is the canonical knowledge.

```yaml
---
name: tool-<name>
description: Load when working with <name>, <related concepts>, <auth/error scenarios>. Covers full <name> surface, error handling, and lessons.
triggers:
  bash:
    - <name>            # word-match in command
    - python -m <name>  # multi-word match
---

# <name>

## What it is
One paragraph. Problem it solves. When to reach for it.

## Capability surface
Full CLI flag inventory or API surface. Verbatim from `--help` / docs at
first. Prune later, only after real-world usage shows what's actually used.

## Setup & auth
Install path on AM. Credentials/secrets reference (point at keyring entries;
do NOT inline secrets). Where state lives.

## Common workflows
The 3-5 invocations actually used, copy-pasteable.

## Error handling
Symptom → cause → fix. One row per known failure mode.

## Traps
Append-only. Date-stamped. Never make the same mistake twice.
- 2026-MM-DD: <what happened, why it surprised, how to avoid>

## Lessons
Append-only. Date-stamped. Behaviors learned that aren't in upstream docs.
- 2026-MM-DD: <lesson>
```

`triggers.bash` is the substring word-match list the hook scans. Start with
plain substrings (word-bounded). Add regex syntax if real usage needs it.

## Hook: Claude Code

`hooks/guards/tool-context-loader.js`. PreToolUse hook with
`matcher: "Bash"`. Reads `tool_input.command`, scans the trigger registry,
emits JSON for any matches:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": "Tool `icloudpd` detected in command. Load skill `tool-icloudpd` before running if not already loaded."
  }
}
```

Multiple matches → list all skills in the message. No match → silent
fast-return. The hook MUST be cheap on miss because it fires on every Bash
call.

Trigger registry is built lazily on first call per session and cached. The
`trigger-registry.js` lib reads every `skills/tools/*/SKILL.md` frontmatter,
parses `triggers.bash`, and builds an array of `{ pattern, skillName }`
entries.

Wired in `.claude-plugin/plugin.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/guards/tool-context-loader.js\"",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

## Hook: OpenClaw

Distributed as an installable OpenClaw plugin pack. The pack lives at
`C:\Levi\openclaw\` and is installed with:

```powershell
openclaw plugins install C:\Levi\openclaw
```

After install, verify with:

```powershell
openclaw hooks list --json
openclaw hooks info tool-context-loader --json
openclaw hooks check --json
```

The OpenClaw hook fires on the equivalent pre-tool-execution event (exact
event name + JSON schema must be confirmed against
`https://docs.openclaw.ai/cli/hooks` and `openclaw hooks info` of an existing
pack — call this out as a verify-before-implementing item).

The OpenClaw hook reads tool skills from `~/.openclaw/skills/tool-*/SKILL.md`
(populated by the sync script) and runs the same trigger logic as the Claude
Code hook.

## Hook: Codex

User-scope: `~/.codex/hooks.json`. Requires `codex_hooks = true` in
`~/.codex/config.toml`. Reference:
https://developers.openai.com/codex/hooks

`codex/hooks.json` is the canonical version shipped from Levi.
`bin/levi-sync.ps1` copies it to `~/.codex/hooks.json` (with a
merge-don't-overwrite policy if the user has existing hooks).

`codex/config-fragment.toml`:

```toml
[features]
codex_hooks = true
```

The sync script merges this fragment into `~/.codex/config.toml`
idempotently — adds the key if missing, leaves alone if already present.

The Codex hook script reads tool skills from the Codex skill directory
(exact path TBD per Codex docs at sync-script implementation time) and
applies the same trigger logic.

## Sync script

`bin/levi-sync.ps1`. Idempotent. Safe to re-run after editing any tool
SKILL.md.

Flow:

1. **Validate** — required Levi dirs exist, `plugin.json` valid, all
   `skills/tools/*/SKILL.md` parse cleanly.
2. **Claude Code** — no action; Levi IS the Claude Code plugin. The user
   installs Levi normally.
3. **OpenClaw**:
   - Run `openclaw plugins install C:\Levi\openclaw` (or update if already
     installed).
   - Copy `skills/tools/<name>/SKILL.md` → `~/.openclaw/skills/tool-<name>/SKILL.md`
     for each tool.
   - Verify with `openclaw hooks check --json`.
4. **Codex**:
   - Merge `codex/hooks.json` into `~/.codex/hooks.json`.
   - Merge `codex/config-fragment.toml` into `~/.codex/config.toml`.
   - Copy tool SKILL.md files into Codex's skill directory.
5. Print summary: what was synced, what was skipped, any warnings.

Supports `-WhatIf` for dry-run.

## `/lesson` slash command

`commands/lesson.md`. Append-only entries to a tool's SKILL.md from inside a
session.

Usage:

```
/lesson tool=icloudpd trap "Login session cookie expires after 60 days; --keep-2fa doesn't extend it"
/lesson tool=ffmpeg lesson "audio extraction with -vn keeps the original codec — re-encoding is the slow path"
```

Behavior:

- Resolves `skills/tools/<tool>/SKILL.md` (errors if not found).
- Appends a date-stamped line to the matching `## Traps` or `## Lessons`
  section.
- Entry format: `- 2026-05-10: <text>`
- Confirms with file path + the appended line.
- Reminds the user to run `bin/levi-sync.ps1` (or runs it automatically — pick
  during implementation).

## Append-only protocol

`Traps` and `Lessons` sections are append-only by convention. Each entry
dated. Pruning happens deliberately — quarterly review or when an upstream
fix obsoletes a trap. The `/lesson` command never reorders or deletes.

## Initial tool seeding

All 10 tools created with frontmatter + section skeleton + empty bodies.
Filling capability surfaces happens in subsequent sessions per tool — that's
where the agent (or operator) does the actual research and writes the
`Capability surface` section verbatim from `--help` or upstream docs.

Initial frontmatter `description` and `triggers.bash` per tool need to be
written carefully — that's what the hook keys on. Triggers per tool (first
pass):

| Tool | bash triggers |
|---|---|
| icloudpd | `icloudpd`, `python -m icloudpd` |
| pyicloud | `pyicloud`, `from pyicloud` (via Python invocations) |
| keyring | `keyring` |
| paddleocr | `paddleocr`, `python -m paddleocr` |
| faster-whisper | `faster-whisper`, `whisper-ctranslate2` |
| ffmpeg | `ffmpeg`, `ffprobe` |
| pyheif | `pyheif` (mostly Python-only — may need a Python-import trigger later) |
| exiftool | `exiftool` |
| pydantic | (Python-only — likely no Bash trigger; rely on import-time discovery later) |
| tomli | (Python-only — same) |

For Python-only libraries (pydantic, tomli, pyheif), the bash-trigger
approach is weak. Note this as a known gap; revisit when adding a "load on
Python import" trigger mechanism is justified by real usage.

## Testing

- **Unit (trigger registry)** — given fixture SKILL.md files and a fake
  Bash command, assert the right skill names come back.
- **Hook integration (Claude Code)** — in a session, `bash -c "echo
  icloudpd --help"` should emit the nudge.
- **OpenClaw** — `openclaw hooks check --json` after `plugins install`
  shows the hook enabled.
- **Codex** — session smoke test (TBD per Codex docs).
- **Sync script** — `-WhatIf` prints actions without writing; second invocation
  is a no-op (idempotent).

## Open items / future

- **Verify OpenClaw hook event schema** against
  `https://docs.openclaw.ai/cli/hooks` before implementing the hook config.
- **Verify Codex skill directory path** before implementing sync.
- **Python-import trigger** — for pydantic/tomli/pyheif. Defer until real
  usage demands it.
- **Per-agent domain routing** — once Isaac and other agents have settled
  domains, embed `Always invoke skill X` lines in their core files. Until
  then, hooks handle all enforcement.
- **Cross-PC sync** — Levi lives on each of the 4 PCs. Skill content edits
  propagate via git; sync script must run on each PC after a pull. Could
  trigger sync via a SessionStart hook later.
- **Lesson hygiene** — quarterly Traps/Lessons review. Could be a `/lesson
  review tool=<name>` command later.
- **Beyond the initial 10 tools** — adding a new tool = create a new
  `skills/tools/<name>/SKILL.md` with frontmatter triggers; the next sync
  pass picks it up automatically. No hook script changes needed.

## Why this shape (vs alternatives considered)

- **Always-loaded rules per tool**: rejected. ~10 tools × hundreds of lines
  each = 50-200KB of dead context per session. Skill lazy-load via hook
  trigger keeps idle cost zero.
- **Custom rules system in OpenClaw/Codex**: rejected. Reinvents skills with
  a different filename. Skills are natively supported across all three
  runtimes; CLAUDE.md/AGENTS.md/agent-instruction surfaces are not portable.
- **Separate canonical doc + thin SKILL.md wrappers**: rejected. Two files
  per tool to keep in sync. Combining frontmatter + body in one SKILL.md
  matches existing Levi convention (`skills/talk/caveman/SKILL.md`).
- **Per-tool hook scripts**: rejected. Adding a tool would require editing
  hook code. Universal hook + frontmatter-discovered triggers means new
  tools are pure data, no code changes.
