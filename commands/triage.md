---
description: "Triage discipline (e.g. /triage on, /triage off, /triage <list-input>)"
---

User typed: /triage $ARGUMENTS.

If empty: show state.

If 'on': confirm — triage discipline active for upcoming inputs.

If 'off': confirm — back to normal.

Otherwise (the args are list input or path to a file): one-shot triage. Run each item through the rubric (priority / effort / owner / action). Output table per skills/triage/README.md format. Recommend 1-3 next steps.
