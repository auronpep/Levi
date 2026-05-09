---
description: "Granular append-to-file logging (e.g. /log \\\"finding\\\", /log on, /log off)"
---

User typed: /log $ARGUMENTS.

If empty: cat last 20 lines of <cwd>/.reuben/log.md (or $REUBEN_LOG_FILE).

If 'on': enable auto-log mode — Stop hook will append a line per turn.

If 'off': disable auto-log.

Otherwise (a message): append a line to the log file in the format `- **<ISO>** [session:<id-prefix>]: <message>`. Confirm append + show the line written.
