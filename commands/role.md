---
description: "Adopt a role's perspective (e.g. /role pm, /role sre, /role off, or /role alone to list)"
---

User typed: /role $ARGUMENTS. The UserPromptSubmit hook has updated the active role flag.

If $ARGUMENTS is empty: list available roles by reading skills/role/*/SKILL.md (skip README). Show name + description.

If $ARGUMENTS is 'off': confirm role disabled.

Otherwise ($ARGUMENTS is a role name): confirm the role is active. From this point, respond from that role's first-person perspective with their concerns, vocabulary, and standard outputs. Mention that /role composes with /talk (vocabulary), /style (output structure), /think (reasoning approach). Different from /team — /team spawns multiple critics in parallel; /role IS one perspective.
