---
description: "Output format target (e.g. /format json, /format csv, /format html, /format off, /format alone to list)"
---

User typed: /format $ARGUMENTS. Hook updated the active format flag.

If $ARGUMENTS is empty: list available formats by reading skills/format/*/SKILL.md (skip README). Show name + description.

If $ARGUMENTS is 'off': confirm format disabled (defaults back to markdown).

Otherwise ($ARGUMENTS is a format name): confirm the format is active. Note that other axes (style, talk, thinking) still apply within the chosen format.
