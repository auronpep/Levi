---
description: "Markdown discipline (e.g. /canon obsidian, /canon markdown, /canon obsidian-base, /canon off, or /canon alone to list)"
---

User typed: /canon $ARGUMENTS. The hook has updated the active canon flag.

If $ARGUMENTS is empty: list available canon modes by reading skills/canon/*/SKILL.md (skip README). Show name + description.

If $ARGUMENTS is 'off': confirm canon disabled (no markdown flavor enforced).

Otherwise ($ARGUMENTS is a canon mode): confirm the mode is active. Brief reminder: obsidian = wikilinks/frontmatter/tags for AM Brain notes; markdown = standard CommonMark+GFM for GitHub/external; obsidian-base = obsidian + structured Base tables for project tracking. The mode shapes how you author markdown going forward.
