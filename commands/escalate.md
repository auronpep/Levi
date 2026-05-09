---
description: "Flag for human attention (e.g. /escalate \\\"security issue found\\\", /escalate --priority=high \\\"...\\\")"
---

User typed: /escalate $ARGUMENTS.

If empty: list recent escalations from ~/.escalations/.

Otherwise (the message): write JSON file to ~/.escalations/esc-<timestamp>-<hash>.json with priority (default high), message, session_id, cwd, active modes summary, and a last-1-2-turns summary as context. Confirm escalation logged. If /report email active, also fire an email immediately (don't wait for Stop hook). If /relay broadcast configured, send broadcast relay too. Mark as one-shot — does NOT need a flag-state change.
