---
description: "Clear modes (/reset all), load saved combo (/reset <name>), or save current state as combo (/reset save <name>)"
---

User invoked: /reset $ARGUMENTS. The hook has already processed this and updated flag files accordingly.

If $ARGUMENTS is empty: list available combos by reading skills/combos/*.md (skip README.md). For each, parse frontmatter (name, style, talk, thinking) and show as a table.

If $ARGUMENTS is 'all': confirm that all four flag files (style, talk, thinking, portfolio) have been cleared. Active modes are now reset.

If $ARGUMENTS starts with 'save ': the hook should have read current flag values and written them to skills/combos/<name>.md. Confirm what was saved (style, talk, thinking values) and the file path. Note that the user should commit the new combo file if they want it to sync across PCs.

Otherwise ($ARGUMENTS is a combo name): the hook should have cleared the portfolio flag and set the individual flags from skills/combos/$ARGUMENTS.md. Confirm which axes were set (style, talk, thinking) by reading the combo's frontmatter. Note that future /style /talk /think edits will compose on top of this combo state.

If the named combo doesn't exist, list available combos and ask the user which they meant.
