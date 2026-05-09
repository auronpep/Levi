---
description: "Track predictions with Brier-score calibration (e.g. /forecast log <claim>, /forecast check, /forecast brief)"
---

User typed: /forecast $ARGUMENTS.

If $ARGUMENTS is empty: show recent forecasts (resolved last 30 days) + open forecasts (still pending). Read ~/.claude/.reuben-forecasts.jsonl.

Sub-commands:

- 'log <claim text>': record a forecast in ~/.claude/.reuben-forecasts.jsonl. Required fields: claim (falsifiable), confidence (labeled or numeric), falsification (what would prove wrong), deadline (ISO date). If any missing, ASK before logging. Generate id = 'fc-' + ISO timestamp. Capture context: session_id, active /dossier, active modes. Set status to 'open'.

- 'check': read ~/.claude/.reuben-forecasts.jsonl, find entries where deadline has passed AND status is 'open'. For each: state the original claim and ask the user what actually happened. Record resolution (at, outcome, verdict: correct/wrong/partial, notes). Update entry in JSONL.

- 'brief': read all resolved forecasts. Compute hit-rate per confidence band (or Brier score if numeric). Output calibration snapshot — see skills/forecast/README.md format. Highlight systematic biases (overconfidence/underconfidence patterns).

- 'list open' / 'list all': dump entries in human-readable form.

For JSONL operations, use bash with appropriate file ops. Schema in skills/forecast/README.md.
