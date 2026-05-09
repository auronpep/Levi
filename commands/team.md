---
description: "Engage council of critics for parallel review (e.g. /team evaluator,customer,closer or /team alone to list)"
---

User typed: /team $ARGUMENTS. The UserPromptSubmit hook has updated the active critics flag.

If $ARGUMENTS is empty: list the 10 available critics by reading agents/critics/*.md. Show name + the question each one always asks.

If $ARGUMENTS is 'off': confirm team disabled. No parallel critic review on subsequent responses.

Otherwise ($ARGUMENTS is csv of critic names): confirm critics engaged. After your next response (or when /team review is invoked on a specific artifact), the dispatcher spawns each named critic as a parallel subagent (Agent tool with subagent_type: critic-<name>). Each returns their critique. You reconcile into 'What everyone agrees on / Disagreements / Recommended fixes'.

Note on cost: each critic is a subagent invocation. /team with 10 critics = 10 parallel API calls. Use sparingly for high-stakes review, not every response. Recommended starter sets: core (evaluator,customer,skeptic), compliance (regulator,auditor,future-self), engineering (operator,skeptic,evaluator), launch (customer,regulator,future-self,closer).
