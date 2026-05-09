---
description: "Load project dossier (e.g. /dossier mev, /dossier off, /dossier append <category> <text>, or /dossier alone to list)"
---

User typed: /dossier $ARGUMENTS. The UserPromptSubmit hook has processed this.

If $ARGUMENTS is empty: list recent dossiers by reading the directory at $REUBEN_DOSSIERS_DIR (default ~/aly/knowledge/projects/). Show project IDs and one-line descriptions if frontmatter present.

If $ARGUMENTS is 'off': confirm active dossier cleared.

If $ARGUMENTS starts with 'append ': route to /task update-dossier with the active dossier ID and the parsed category + content.

If $ARGUMENTS is 'sync': check whether the active dossier is stale vs. recent git activity in any matching repo. Report findings.

Otherwise ($ARGUMENTS is a dossier ID): confirm the dossier is now active. SessionStart hook will load the file from $REUBEN_DOSSIERS_DIR/$ARGUMENTS.md into context. If the file is missing, say so and direct user to /task draft-dossier.
