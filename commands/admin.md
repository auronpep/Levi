---
description: "Reuben meta-ops (e.g. /admin lint, /admin list, /admin install style my-style, /admin snapshot)"
---

User typed: /admin $ARGUMENTS.

If empty: show current Reuben version (.claude-plugin/plugin.json), axis count, summary of active flags, recent snapshots if any.

Sub-cmds (see skills/admin/README.md):
- 'install <kind> <name>': scaffold a new mode (kind = style/talk/think/role/family/rule/portfolio/combo/template/format/canon/channel/depth/etc.). Create skills/<kind>/<name>/SKILL.md with starter frontmatter + body template.
- 'upgrade': run `git pull` and report. If any migration scripts in tools/migrations/, list them.
- 'lint': run `node ${CLAUDE_PLUGIN_ROOT}/tools/admin/lint.js` and report its output verbatim. Validates SKILL.md frontmatter, plugin.json/marketplace.json JSON, command TOML files, cross-references in combos/portfolios/families. Exit 0 = clean, 1 = errors.
- 'which <name>': search across all skill axes for a name. Report which axis + file.
- 'list': enumerate every mode across every axis. Group by axis. One line per mode.
- 'clean': flag unused modes for review (heuristic: not referenced in any combo/portfolio + no usage signal). Require user confirm before delete.
- 'preview': resolve active flags, show what SessionStart hook WOULD emit (without re-emitting). Useful for debugging.
- 'diff': read latest ~/.claude/.reuben-snapshots/*.json and current state; report differences.
- 'snapshot': save current state to ~/.claude/.reuben-snapshots/<timestamp>.json (all flags + Reuben version).
- 'swap <a> <b>': read both combo files, save current as a temporary snapshot, apply combo a or toggle to b.
- 'inspect <axis>': show resolved skill file path(s) for current value of <axis> flag.
- 'graph': render a relationship graph of skills, modes, dossier links.
