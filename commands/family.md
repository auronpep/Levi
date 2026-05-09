---
description: "Load family-level context (e.g. /family finance, /family off, or /family alone to list)"
---

User typed: /family $ARGUMENTS. The UserPromptSubmit hook has updated the active family flag.

If $ARGUMENTS is empty: list available families by reading skills/family/*.md (skip README). For each, show name + description from frontmatter.

If $ARGUMENTS is 'off': confirm family context is cleared.

Otherwise ($ARGUMENTS is family name): confirm the family is active. The SessionStart hook now loads skills/family/$ARGUMENTS.md content into context. Mention what's loaded (family conventions, dossier list, common workflows). Note that /family composes with /dossier (project-specific memory), /portfolio (channeled mindset), and other axes.
