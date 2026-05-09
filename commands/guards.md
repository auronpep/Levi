---
description: "Toggleable PreToolUse/PostToolUse machine guards (e.g. /guards tdd-gate,plan-gate, /guards off)"
---

User typed: /guards $ARGUMENTS. The hook updated ~/.claude/.reuben-guards (csv).

If $ARGUMENTS is empty: list available toggleable guards (tdd-gate, plan-gate, conventional-commits) + their behavior. Mention always-on guards too (secret_scanner, prevent_direct_push, format_python, command_logger).

If $ARGUMENTS is 'off': confirm — toggleable guards inactive (always-on still run).

Otherwise (csv): confirm guards active. Reminder: each hook's machine-enforced when its name appears here. Always-on guards (secret_scanner, prevent_direct_push, format_python, command_logger) are independent — opt out per-machine via REUBEN_DISABLE_* env vars.
