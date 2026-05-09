---
description: "Engage a fully-structured output template (e.g. /template pr-description, /template off, alone to list)"
---

User typed: /template $ARGUMENTS. Hook updated active flag.

If empty: list templates from skills/template/*/SKILL.md.

If 'off': confirm — no template active.

Otherwise: confirm template engaged. Future responses fit the template shape. If a request can't fit, break out for that turn with [switching to prose] then resume.
