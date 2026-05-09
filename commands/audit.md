---
description: "Paranoid evidence-trail mode (e.g. /audit full, /audit paranoid, /audit off, alone to list)"
---

User typed: /audit $ARGUMENTS. Hook updated active flag.

If empty: show modes (light, full, paranoid) — see skills/audit/README.md.

If 'off': confirm — no audit discipline active.

Otherwise: confirm audit mode engaged. Until PostToolUse hook is shipped, this is discipline-only — Claude states justification before substantive actions, echoes file:line + brief diff after edits, calls out irreversible ops explicitly. The hook upgrade for machine-enforced logging is a future Phase.
