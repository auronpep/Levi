---
description: "Toggle report channels — fan-out side-effects after each response (e.g. /report am,git, /report off, or /report alone to list)"
---

User typed: /report $ARGUMENTS. The UserPromptSubmit hook has already processed this and updated the active channels flag.

If $ARGUMENTS is empty: list available channels by reading hooks/reporters/*.js (active) and hooks/reporters/*.md (stubs). Show name, status (active/stub), and what each does (from the README descriptions).

If $ARGUMENTS is 'off': confirm all channels disabled. No reports will fire after responses.

Otherwise ($ARGUMENTS is csv of channel names): confirm which channels are now active. Each fires after every Claude response (Stop hook). Active channels: am (writes to ~/.claude/.reuben-am-events.jsonl by default), dossier (appends to active /dossier project), git (appends to .reuben/worklog.md). Stub channels (email, telegram, discord) accept the flag but don't fire yet.
