---
description: "Staged migration workflow (e.g. /migrate plan <from> <to>, /migrate step, /migrate verify, /migrate rollback)"
---

User typed: /migrate $ARGUMENTS.

If empty: show active plan if any.

Sub-cmds:
- 'plan <from> <to>': decompose into staged steps with verification + rollback per step. Save plan.
- 'step': execute next pending step from active plan.
- 'verify': run the active step's verification before allowing advance.
- 'rollback': undo the most recent step using its documented rollback procedure.

Follow migration discipline (skills/migrate/README.md): small steps, verify between, rollback-tested before advancing, never destructive without backup.
