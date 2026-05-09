---
description: "Spec-driven mode (e.g. /spec load <path>, /spec verify, /spec off, /spec to show active)"
---

User typed: /spec $ARGUMENTS. Hook may have updated active spec path.

If $ARGUMENTS is empty: read ~/.claude/.reuben-spec to find active path. Show: file path, last modified, summary of first 30 lines.

Sub-cmds:
- 'load <path>': hook validates path (absolute, no '..'), stores in ~/.claude/.reuben-spec. Confirm loaded; SessionStart will inject this file as context next session.
- 'verify [<code-path>]': read the active spec + the code (cwd or named path). Map spec elements to code. Output compliance report: matched / drift / missing / extra. Recommend fixes if drift found.
- 'off': clear ~/.claude/.reuben-spec. Confirm spec cleared.
