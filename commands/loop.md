---
description: "Engage iteration mode (e.g. /loop simple, /loop reviewed, /loop until, /loop off, or /loop alone to list)"
---

User typed: /loop $ARGUMENTS. The hook has updated the active loop flag.

If $ARGUMENTS is empty: list available modes by reading skills/loop/*/SKILL.md (skip README). Show name + description.

If $ARGUMENTS is 'off': confirm loop disabled. Existing TodoWrite list is preserved; you just stop auto-advancing.

Otherwise ($ARGUMENTS is mode name): confirm the mode is active. Brief reminder of pattern (simple = sequential, reviewed = with reviewer gate, adversarial = with red-team, council = with full /team, until = iterate single artifact). The TodoWrite tool tracks tasks; this axis just shapes how you advance through them.
