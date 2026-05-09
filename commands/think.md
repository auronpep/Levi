---
description: "Engage thinking mode(s) (e.g. /think compliance,confidence-weighted, /think off, or /think alone to list)"
---

User typed: /think $ARGUMENTS. The UserPromptSubmit hook has already processed this and updated the active thinking-mode flag. Your job: confirm the action concisely.

If $ARGUMENTS is empty: list available thinking modes by reading directory names in skills/thinking/ — one-line description of each from each SKILL.md description field. Do NOT load full skill bodies, just enumerate.

If $ARGUMENTS is 'off': confirm thinking modes are disabled for this session.

Otherwise ($ARGUMENTS is a single mode or comma-separated list): confirm the listed mode(s) are now active. Modes compose — multiple modes stack their rule sets. Mention persistence and that /think off clears them. Do not output the full skill rulesets — the hook handles activation.
