# Tool Knowledge Skills

One SKILL.md per CLI tool, library, or system that Levi-driven agents touch.

The hook layer (`hooks/guards/tool-context-loader.js`) auto-loads the matching
skill when an agent's Bash command matches a `triggers.bash` substring in the
skill's frontmatter.

## Adding a new tool skill

See `docs/builders/tool-skill-builder.md` for the authoring manual. Quickest
path:

1. Hand the builder manual + the architecture spec
   (`docs/superpowers/specs/2026-05-10-tool-knowledge-architecture-design.md`)
   + the tool name to a fresh AI session.
2. Drop the resulting `skills/tools/<name>/SKILL.md` into this directory.
3. Run `bin/levi-sync.ps1` to distribute to OpenClaw and Codex.

## Skill format

See the architecture spec section "Skill format". Frontmatter must include
`name`, `description`, and `triggers.bash` (a list, possibly empty).
