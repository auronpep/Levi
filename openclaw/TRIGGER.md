# Tool Skill Trigger Guidance

Before running any Bash command, scan the command text for substrings that
match a tool with a corresponding skill. Tool skills live under
`skills/tool-*/SKILL.md` (resolved through the OpenClaw skills directory).

Each tool skill's frontmatter declares its trigger substrings under
`triggers.bash`. When you see a match, invoke the matching skill before
continuing. The skill body has the canonical capability surface, auth, error
handling, traps, and lessons for that tool.

If you've already loaded the matching skill earlier in this session, you do
not need to re-load it.

This guidance is loaded once at agent bootstrap. The tool-trigger semantics
are operator-defined; do not invent matchers that aren't declared in skill
frontmatter.
