---
description: "Single-critic review (e.g. /critique evaluator, /critique customer, alone to list)"
---

User typed: /critique $ARGUMENTS.

If $ARGUMENTS is empty: list available critics from agents/critics/*.md. Show name + the question each asks.

Otherwise (first word is critic name): spawn the critic subagent (subagent_type: critic-<name>) using the Agent tool. Input is the latest substantive Claude response (or, if a path is given as second arg, the contents of that file). Return the critic's critique verbatim. Brief 1-line meta after: 'Single-critic review complete. For multi-perspective, use /team <names>.'
