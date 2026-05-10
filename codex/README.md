# Levi Tool Knowledge — Codex Hook Pack

Distributes Levi's per-tool skills into Codex (`~/.codex/skills/tool-*`) and
provides a tool-context-loader hook script you can wire into
`~/.codex/config.toml`.

## What this pack ships

- **`./skills/`** — destination layout for tool skills. Populated by
  `bin/levi-sync.ps1`, mirroring `<levi-root>/skills/tools/*/SKILL.md` →
  `~/.codex/skills/tool-*/SKILL.md`.
- **`runtime/tool-context-loader.js`** — Codex hook handler. Reads a hook
  event on stdin, scans `~/.codex/skills/tool-*` for `triggers.bash`
  matches, and writes a JSON nudge with `additionalContext`. Cross-platform,
  no external deps.
- **`config-fragment.toml`** — sample `[hooks]` entries. NOT auto-merged
  because Codex `[hooks]` keys are unique per event name and your config
  may already define handlers (e.g. JP `session_start`).

## Install (manual, recommended)

The sync script (`bin/levi-sync.ps1`) handles skill distribution and copies
the runtime script. The `[hooks]` integration is left to you because of
key-conflict risk. Steps:

1. Run `bin/levi-sync.ps1` from the Levi root. It copies skills and the
   handler into `~/.codex/`.
2. Verify the `codex_hooks` feature flag is enabled:
   ```powershell
   codex features list | Select-String codex_hooks
   ```
   If not stable+true, enable it:
   ```powershell
   codex features enable codex_hooks
   ```
3. Open `~/.codex/config.toml`. Find the `[hooks]` section (or create one).
4. Add an entry pointing at the installed runtime script. Example:
   ```toml
   [hooks]
   pre_tool_use = 'node "C:\\Users\\JesusLovesMe\\.codex\\runtime\\levi\\tool-context-loader.js"'
   ```
   The exact event name for "before a Bash tool call" is per Codex docs:
   https://developers.openai.com/codex/hooks. Verify before activating.
5. Smoke test by piping a sample event JSON into the script directly:
   ```powershell
   '{"command":"icloudpd --help"}' | node "$env:USERPROFILE\.codex\runtime\levi\tool-context-loader.js"
   ```
   You should see a JSON object with `additionalContext` mentioning
   `tool-icloudpd` (assuming the icloudpd skill is installed).

## Limitations / open work

- **Exact event name for per-call enforcement is not verified locally.** The
  runtime script handles both forms (events with a `command` field for
  per-call events, and events without for `session_start`). Once you
  identify the right event from the Codex docs, wire it in `config.toml`.
- **No automatic config merge.** Codex `[hooks]` keys are unique per event;
  if you already have a handler for the same event, the sync script would
  overwrite it. Manual integration prevents that.
