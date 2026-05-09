---
description: "Operational evaluator (e.g. /eval define <artifact>, /eval baseline, /eval run, /eval promote, /eval off)"
---

User typed: /eval $ARGUMENTS. The hook has updated the active eval flag if applicable.

If $ARGUMENTS is empty: list defined evaluators by reading <cwd>/.reuben/evaluators/*.md (skip subdirs). For each, show: name, type (rubric/test/benchmark/judge/metric), current baseline score, last run timestamp.

If $ARGUMENTS is 'off': confirm eval mode disabled.

Sub-commands:
- 'define <artifact>': run /task evaluator-draft for the named artifact (file path), save to <cwd>/.reuben/evaluators/<artifact-basename>.md
- 'baseline': run the active evaluator on its artifact, record baseline in the eval file's score history
- 'propose <hypothesis>': record predicted score change in the eval log; user makes the change next
- 'run': re-run the active evaluator, compute new score, compare to baseline
- 'promote': if score improved beyond threshold, record promotion + update baseline; if not, record no-promotion with reasoning
- 'set <name>': set <name> as the active evaluator for auto-scoring on /report channels

Follow the lifecycle in skills/eval/README.md. All evaluator state files live in <cwd>/.reuben/. Each eval run appends to <cwd>/.reuben/eval-runs.jsonl for history.
