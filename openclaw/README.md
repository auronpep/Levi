# Levi Tool Knowledge — OpenClaw Plugin Pack

Distributes Levi's per-tool skills into OpenClaw and provides a bootstrap-time
tool-trigger guidance file.

## What this pack ships

- **`./skills/`** — symlink target for tool skills. Populated by
  `bin/levi-sync.ps1` (mirrors `<levi-root>/skills/tools/*/SKILL.md` →
  `./skills/tool-*/SKILL.md`). Loaded by OpenClaw at install time via the
  manifest's `skills` field.
- **`TRIGGER.md`** — short instruction telling the agent to scan Bash commands
  for tool triggers and invoke the matching skill. Designed to be injected via
  OpenClaw's bundled `bootstrap-extra-files` hook (see Configure below).

## Install

```powershell
openclaw plugins install C:\Levi\openclaw
openclaw plugins inspect levi-tool-knowledge --json
```

After install, OpenClaw should load the skills from `./skills/`. Verify with:

```powershell
openclaw skills list --json
```

You should see entries with `name: tool-<kebab>`.

## Configure (per-bash-call enforcement)

OpenClaw doesn't currently expose a per-tool-call hook event in its bundled
hook set, so per-Bash enforcement is approximated with `bootstrap-extra-files`
— a bundled hook that injects extra files into Project Context at agent
bootstrap. Configure it to include `TRIGGER.md` from this pack:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "bootstrap-extra-files": {
          "enabled": true,
          "paths": [
            "<openclaw-plugin-root>/levi-tool-knowledge/TRIGGER.md"
          ]
        }
      }
    }
  }
}
```

(Adjust the path to match where OpenClaw resolves the installed plugin's root.
Check with `openclaw plugins inspect levi-tool-knowledge --json` and look for
`rootDir`.)

## Sync

`bin/levi-sync.ps1` (in the Levi repo) keeps `./skills/` in sync with the
canonical `skills/tools/` axis. Run after editing any tool skill.

## Limitations / open work

- **No per-Bash-call enforcement hook.** OpenClaw's bundled hooks fire on
  events like `gateway:startup`, `agent:bootstrap`, `command`, and
  `command:new`/`command:reset`, not on individual tool calls. A custom hook
  targeting a per-tool-call event would require a published OpenClaw plugin
  SDK contract that's not yet documented in this repo. Until that's
  researched, `bootstrap-extra-files` + skill description matching is the
  best available approximation.
- **Skill description quality is critical.** Because per-call enforcement is
  approximated, the model relies on description matching. Authors of tool
  skills must follow the description guidance in
  `docs/builders/tool-skill-builder.md`.
