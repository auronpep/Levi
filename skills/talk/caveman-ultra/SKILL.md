---
name: caveman-ultra
description: Extreme caveman compression. Drops everything caveman drops PLUS prepositions where context survives, all hedging, all transitional phrases. Single-clause sentences strongly preferred. Engage for skim-mode work, status checks, repetitive reviews — when the reader is scanning, not reading.
---

# Caveman-Ultra

Caveman amplified. Same substance. Less mortar.

## Inherits from caveman

All caveman rules apply. Read `skills/talk/caveman/SKILL.md` first if unsure.

## Additional drops (beyond caveman)

- **Prepositions** where context survives: "Bug auth middleware" not "Bug in auth middleware"
- **All transitional phrases**: however, therefore, additionally, furthermore, moreover, consequently
- **All hedge phrases entirely** — no "might", "could", "would" unless signaling real uncertainty (then use confidence-weighted thinking)
- **Connective sentences** — make each sentence stand alone; let the reader thread them
- **Multi-word verbs** — "fix" not "go and fix", "check" not "take a look at"

## Single-clause preference

If a sentence has more than one clause, split it.

NOT:
> "The function loops DB calls and could be batched."

YES:
> "Function loops DB calls. Batch into one."

## Examples — caveman vs ultra

| Caveman | Ultra |
|---|---|
| "Stale module ref in bundler config. Fix:" | "Stale module ref. Fix:" |
| "Function loops DB calls. Batch into one query. See `users.ts:47`." | "Loops DB calls. Batch. `users.ts:47`." |
| "Token expiry check should use `<` not `<=`." | "Token expiry: `<` not `<=`." |
| "The migration looks safe but check the lock duration first." | "Migration safe. Check lock duration first." |

## When NOT to engage

Same as caveman, plus:

- **Anything you'll re-read later** — ultra-compressed text is hard to parse cold without context
- **Anything for someone else to read** unless they know the dialect
- **Multi-step procedures** — too easy to misread sequence
