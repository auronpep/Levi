---
description: "Persistent todo queue (e.g. /todo add \\\"text\\\" --priority=low --label=am, /todo list, /todo done <id>, /todo from-conversation)"
---

User typed: /todo $ARGUMENTS. The hook has already processed any state-changing sub-commands (add, bulk, done, cancel, block, update) by writing JSON files under <REUBEN_TODO_ROOT>/<status>/ (default ~/.todo/).

If $ARGUMENTS is empty: list incoming todos. Read all .json files in ~/.todo/incoming/ (or $REUBEN_TODO_ROOT/incoming/), parse each, render as a table: id (short), priority emoji, text, labels, due, assign_agent.type. Sort by priority (high>medium>low), then by due, then by created_at.

Sub-commands handled by hook (just confirm what happened):
- 'add "text" [flags]': confirm one todo created. Mention the assigned id and which folder it lives in. Note any auto-applied labels (from /dossier, /family, /portfolio, current repo).
- 'bulk' followed by markdown bullet list: confirm N todos created, list their ids.
- 'done <id>': confirm move from incoming/ (or wherever) to done/.
- 'cancel <id>': confirm move to cancelled/.
- 'block <id> --by=<other>': confirm move to blocked/ + blocked_by set.
- 'update <id> [flags]': confirm fields changed.

Sub-commands handled by you (Claude):

- 'list [filters]': read across status folders per filters. Filter flags: --status=incoming|in-progress|done|cancelled|blocked|all (default incoming), --label=<tag>, --priority=<p>, --agent=<a>, --due-before=<date>, --related=<dossier-or-family>. Render filtered list as a table.

- 'show <id>': search all status folders for the file matching <id>, cat its JSON contents pretty-printed. Highlight: text, status, priority, labels, due, assign_agent, history.

- 'from-conversation' (NEW): scan the recent conversation history (last ~50 turns, or whatever is in your context). Extract candidate todos by looking for these phrases:
    "skip X for now" / "come back to Y later" / "remind me to Z"
    "todo:" / "TODO" / "FIXME" mentions in user messages
    "we should also..." / "don't forget to..."
    Things the user explicitly deferred or flagged for later.
  Output as a numbered candidate list with proposed text + suggested label/priority. Then ASK the user 'Keep [all/1,2,5/none/edit]?' and on response, fire /todo add for each kept candidate (one Bash call per — let the existing hook write each JSON file). Skip the ones not selected. If 'edit' chosen, walk through each candidate one at a time for refinement.
  Quality bar: only surface SPECIFIC actionable candidates. Skip vague utterances ("should be cleaner"). Skip things the user clearly already did. Skip things resolved within the conversation.

Do NOT re-execute add/done/cancel/block/update — those are state changes the hook handled. Just confirm and render.

Schema: see skills/todo/README.md and skills/todo/orchestrator-contract.md.
