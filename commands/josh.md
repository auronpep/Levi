---
description: "Interact with the josh CLI (~/.josh/ shared agent runtime). Examples: /josh status, /josh push todo \"fix CI\" --priority p1, /josh list todo, /josh show <id>, /josh control pause"
allowed-tools: Bash(josh:*), Bash(josh.cmd:*)
---

The user invoked: /josh $ARGUMENTS

Action: run `josh $ARGUMENTS` via the Bash tool. Pass the arguments verbatim — do not modify, paraphrase, or split them. Quoted strings stay quoted.

If $ARGUMENTS is empty, run `josh help` instead.

Show the command's stdout in a code block exactly as returned. If the exit code is non-zero, include stderr and add one short line explaining what went wrong (e.g., "invalid priority — allowed: p0, p1, p2, p3").

Do not interpret JSON output unless the user asks for analysis. Do not chain other commands. Do not edit any files. The josh CLI is the only tool to use here.

Reference:
- Runtime spec: `~/.josh/README.md` (directory layout, JSON schemas, conventions)
- CLI docs: `C:/Levi/bin/josh/README.md` (full command surface, exit codes)
