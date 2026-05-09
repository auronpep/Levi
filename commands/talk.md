---
description: "Switch voice / persona (e.g. /talk caveman, /talk newscaster, /talk off, or /talk alone to list)"
---

User typed: /talk $ARGUMENTS. The UserPromptSubmit hook has already processed this and updated the active talk-mode flag. Your job: confirm the action concisely.

If $ARGUMENTS is empty: list available talk modes by reading directory names in skills/talk/ — give a one-line description of each from each SKILL.md description field. Do NOT load full skill bodies, just enumerate.

If $ARGUMENTS is 'off': confirm the talk mode is disabled for this session.

Otherwise ($ARGUMENTS is a talk-mode name): confirm the mode is now active. Mention persistence and that /talk off clears it. Note that /talk composes with /style and /think — the active modes from those still apply. Do not output the full skill ruleset — the hook handles activation.
