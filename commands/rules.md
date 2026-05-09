---
description: "Engage stackable guardrails (e.g. /rules clarify,test-first, /rules off, or /rules alone to list)"
---

User typed: /rules $ARGUMENTS. The UserPromptSubmit hook has updated the active rules flag.

If $ARGUMENTS is empty: list available rules by reading skills/rules/*/SKILL.md (skip README). Show name + description.

If $ARGUMENTS is 'off': confirm all rules disabled.

Otherwise ($ARGUMENTS is a single name or csv): confirm the listed rules are active. They stack — multiple rules' bodies concatenate. Mention persistence and that they take precedence over output-shape preferences when conflict arises (e.g. no-secrets wins over any style).
