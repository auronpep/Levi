---
description: "Suppress /report channels mid-session (e.g. /silence email,telegram, /silence off)"
---

User typed: /silence $ARGUMENTS. Hook updated ~/.claude/.reuben-silence (csv).

If $ARGUMENTS is empty: read ~/.claude/.reuben-silence and show currently silenced channels.

If $ARGUMENTS is 'off': confirm — all /report channels fire normally.

Otherwise (csv): confirm channels silenced. Reminder: silence WINS over /report. The channel stays configured (creds, paths) — just doesn't fire until silence cleared. Useful for: keeping channels enabled globally while quiet-mode for one session.
