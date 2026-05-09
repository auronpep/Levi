---
description: "Engage a named style+thinking preset for a project family (e.g. /portfolio finance, /portfolio off, or /portfolio alone to list)"
---

User typed: /portfolio $ARGUMENTS. The UserPromptSubmit hook has already processed this and updated the active portfolio flag. Your job: confirm the action concisely.

If $ARGUMENTS is empty: list available portfolios by reading skills/portfolios/*.md files. For each, show: name, the style and thinking modes it engages (from frontmatter), and a one-line description.

If $ARGUMENTS is 'off': confirm the portfolio is cleared and individual /style and /think flags are back in effect.

Otherwise ($ARGUMENTS is a portfolio name): confirm the portfolio is now active. Show the user which style and thinking modes it engages (read the frontmatter). Mention that /portfolio overrides individual /style and /think for the session, and /portfolio off restores them. Do not output the full skill rulesets — the hook handles activation.
