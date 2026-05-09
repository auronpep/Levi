# CLAUDE.md — Levi

This is **Levi** — a minimal Claude Code plugin shell. Same axis layout as Reuben, zero items inside.

## What this repo is

A skeleton plugin where the dispatcher surface (47 slash commands) exists but nothing is wired behind it yet. The user grows it one item at a time.

## Working in this repo

### Where things go

| Adding | Path |
|---|---|
| New mode for an existing axis | `skills/<axis>/<name>/SKILL.md` |
| New critic | `agents/critics/<name>.md` |
| New specialist | `agents/specialists/<name>.md` |
| New cohort persona | `agents/cohort/<name>.md` |
| New reporter | `hooks/reporters/<name>.js` |
| New guard | `hooks/guards/<name>.py` |
| New task template | `skills/tasks/<name>.md` |
| Lib helpers | `hooks/lib/<name>.js` |

### Conventions

- **Skills:** SKILL.md with frontmatter. `description` field is the trigger — be specific about WHEN to load and when NOT.
- **Slash commands:** TOML for simple cases (description + prompt only); markdown with frontmatter when you need tool restriction or model choice.
- **Hooks:** Node 14+ baseline (CommonJS). Always `process.exit(0)` cleanly even on error. Cross-platform paths via `path.join`, `os.homedir()`. Honour `CLAUDE_CONFIG_DIR`. Silent-fail on filesystem errors.
- **No secrets in this repo**, even in gitignored files.

### Hooks block in plugin.json

Currently empty. When you ship your first hook, add it to `.claude-plugin/plugin.json`:

```json
"hooks": {
  "SessionStart": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/session-start.js\"",
          "timeout": 5
        }
      ]
    }
  ]
}
```

Reuben's `plugin.json` is the reference for guard wiring (PreToolUse / PostToolUse) when you get to that stage.

### Flag file naming

If you implement Reuben-style state via flag files in `~/.claude/`, use the `.levi-<axis>` prefix to avoid collision with Reuben on the same machine.

## Style

- Don't bring in everything from Reuben at once. The point of Levi is to grow lean.
- One axis at a time. One mode at a time.
- Keep skill bodies focused — one skill = one concept.
