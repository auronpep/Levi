---
description: "Running calibration tracker (e.g. /calibrate on, /calibrate brief, /calibrate off)"
---

User typed: /calibrate $ARGUMENTS.

If empty: show calibration status — read ~/.claude/.reuben-calibrate flag + ~/.claude/.reuben-calibration.md if present.

Sub-cmds:
- 'on': enable persistent tracking. Hook will recompute periodically.
- 'off': disable.
- 'brief': read ~/.claude/.reuben-forecasts.jsonl, compute current snapshot (hit rate per confidence band, Brier score, drift), output as table. Save to ~/.claude/.reuben-calibration.md.
- 'band <name>': detail on one confidence band (which forecasts hit, which missed, patterns).
