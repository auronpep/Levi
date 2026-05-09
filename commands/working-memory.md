---
description: "Persistent markdown scratch state (e.g. /working-memory create <path>, /working-memory load <path>, /working-memory clear)"
---

User typed: /working-memory $ARGUMENTS.

If $ARGUMENTS is empty: read ~/.claude/.reuben-working-memory to find active path. If set, read that file and show: file path, last modified, first 30 lines. If unset, show 'No working memory active.' + brief usage.

Sub-commands:

- 'create <path>': create new working memory file at the given path (validated within allowed roots — home directory by default, configurable via REUBEN_WORKING_MEMORY_ROOTS env var). Write a starter template (see skills/working-memory/README.md format). Set ~/.claude/.reuben-working-memory to the absolute path.

- 'load <path>': validate path, set as active. SessionStart will load this file as context next session. Confirm what's loaded.

- 'clear': remove ~/.claude/.reuben-working-memory flag. The file on disk is preserved — only the 'active' state is cleared.

This axis enables multi-turn / cross-session continuity. The active file gets injected as SessionStart context, and you (Claude) can read/write it during work via normal Read/Edit/Write tools.
