---
description: "Set agent delegation disposition (e.g. /agent solo, /agent parallel, /agent off, or /agent alone to list)"
---

User typed: /agent $ARGUMENTS. The UserPromptSubmit hook has updated the active agent flag.

If $ARGUMENTS is empty: list available agent modes by reading skills/agent/*/SKILL.md (skip README). Show name + description.

If $ARGUMENTS is 'off': confirm agent mode disabled (defaults to solo behavior).

Otherwise ($ARGUMENTS is mode name): confirm the mode is active. Mention the mode shapes when you delegate via the Agent tool — solo (default, do work yourself), spawn (always delegate), specialist (pick best-fit subagent from agents/), parallel (fan out independent sub-tasks), autoresearch (full explore→plan→execute→review pipeline).
