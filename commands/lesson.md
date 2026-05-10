---
description: Append a date-stamped trap or lesson entry to a tool skill (skills/tools/<name>/SKILL.md). Usage `/lesson tool=<name> section=<trap|lesson> "<text>"`.
argument-hint: tool=<name> section=<trap|lesson> "<text>"
allowed-tools: Bash
---

Run the lesson append script with the provided arguments and report the result.

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/levi-lesson.js" $ARGUMENTS
```

If the script reports success, confirm the path and the line that was added.
If it reports an error, show the error verbatim and stop — do not attempt to
fix or guess.
