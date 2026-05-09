---
description: "Invoke a named task template (e.g. /task draft-dossier, /task fit-assessment, or /task alone to list)"
---

User invoked: /task $ARGUMENTS.

If $ARGUMENTS is empty: list available tasks by reading filenames in skills/tasks/*.md (skip README.md). For each, read the '## Goal' section and show the goal as the description. Render as a table with name + goal.

Otherwise ($ARGUMENTS is a task name): read skills/tasks/$ARGUMENTS.md and execute the task described in it. The file contains: a goal, required inputs, sequence of steps, expected outputs, confirmations.

Execution rules:
1. ASK for any 'Inputs (ask before starting)' the user hasn't provided.
2. Follow the steps precisely and in order. Don't skip steps.
3. Honor the 'Confirmations' section — gate any irreversible action on explicit user yes.
4. Don't change the task template itself; if the template is missing something, note it and propose an update at the end.
5. Tasks run UNDER whatever modes are active (style, talk, thinking, portfolio). Don't override them; let them shape the output.

If the task file doesn't exist, list available tasks and ask the user which they meant.
