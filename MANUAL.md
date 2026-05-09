# Levi — Axis Map

Every axis Levi ships, the command that fires it, and the folder where its items live. Right now every items column is empty — that's the point. This is your map for filling them in.

## The 47 axis commands

| Command | Items folder | Item type |
|---|---|---|
| `/acceptance` | `skills/acceptance/<mode>/` | Mode |
| `/admin` | `skills/admin/` | Subcommand recipes |
| `/adr` | `skills/tasks/adr.md` | One-shot task (`/task` shortcut) |
| `/agent` | `skills/agent/<mode>/` | Mode |
| `/audit` | `skills/audit/<mode>/` | Mode |
| `/branch` | `skills/branch/` | Inline behavior (no submodes) |
| `/calibrate` | `skills/calibrate/` | Inline behavior |
| `/canon` | `skills/canon/<mode>/` | Mode |
| `/channel` | `skills/channel/<mode>/` | Mode |
| `/cohort` | `skills/cohort/` + `agents/cohort/<persona>.md` | Personas |
| `/critique` | `skills/critique/` + `agents/critics/<name>.md` | Critics |
| `/debug` | (convenience for `/think debug`) | — |
| `/depth` | `skills/depth/<mode>/` | Mode |
| `/dossier` | `skills/dossier/` | Inline + external dossier files |
| `/escalate` | `skills/escalate/` | Inline behavior |
| `/eval` | `skills/eval/` | Inline + subcommands |
| `/family` | `skills/family/<name>.md` | Family files |
| `/forecast` | `skills/forecast/` | Inline + subcommands |
| `/format` | `skills/format/<mode>/` | Mode |
| `/granularity` | `skills/granularity/<mode>/` | Mode |
| `/guards` | `skills/guards/` + `hooks/guards/<name>.py` | Guard scripts |
| `/heuristic` | `skills/heuristic/<mode>/` | Mode |
| `/log` | `skills/log/` | Inline behavior |
| `/loop` | `skills/loop/<mode>/` | Mode |
| `/migrate` | `skills/migrate/` | Inline + subcommands |
| `/plan` | (convenience for `/think planning`) | — |
| `/portfolio` | `skills/portfolios/<name>.md` | Portfolio files |
| `/postmortem` | `skills/tasks/postmortem.md` | One-shot task (`/task` shortcut) |
| `/queue` | `skills/queue/` | Inline behavior |
| `/recon` | `skills/recon/` | Inline behavior |
| `/reflect` | `skills/reflect/<kind>/` | Mode |
| `/relay` | `skills/relay/` | Inline behavior |
| `/report` | `skills/report/` + `hooks/reporters/<name>.js` | Reporter channels |
| `/reset` | (utility — clears flag files) | — |
| `/role` | `skills/role/<name>/` | Mode |
| `/rules` | `skills/rules/<name>/` | Mode |
| `/silence` | `skills/silence/` | Inline behavior |
| `/spec` | `skills/spec/<subcmd>/` | Subcommand mode |
| `/style` | `skills/styles/<name>/` | Mode |
| `/talk` | `skills/talk/<name>/` | Mode |
| `/task` | `skills/tasks/<name>.md` | Task templates |
| `/team` | `skills/team/` + `agents/critics/<name>.md` | Critics |
| `/template` | `skills/template/<name>/` | Output templates |
| `/think` | `skills/thinking/<mode>/` | Mode |
| `/todo` | `skills/todo/` | Inline + subcommands |
| `/josh` | `bin/josh/` (CLI) + `~/.josh/` (runtime) | Cross-agent shared runtime — todos, handoffs, approvals, audit. See `~/.josh/README.md`. |
| `/triage` | `skills/triage/` | Inline behavior |
| `/working-memory` | `skills/working-memory/` | Inline behavior |

## Item shapes

### A `/skills/<axis>/<mode>/SKILL.md` (mode skill)

```markdown
---
name: planning
description: Decompose a task into ordered steps before executing. Use when the user asks for a plan or when a task has 3+ subtasks. Skip for one-line tweaks.
---

# Planning mode

When this mode is active, before doing any work:
1. Restate the goal in one sentence.
2. List the subtasks in execution order.
3. Note any dependencies or risks.
4. Confirm before proceeding.
```

### A `/agents/critics/<name>.md` (critic)

```markdown
---
name: skeptic
description: Adversarial reviewer that challenges assumptions and asks "what if this is wrong?"
---

You are the skeptic. For the artifact you're shown:
- Identify the strongest assumption being made.
- Ask what evidence would falsify it.
- Note one concrete failure mode the author hasn't accounted for.
```

### A `/agents/specialists/<name>.md` (specialist)

```markdown
---
name: backend
description: Backend implementation specialist. Use for API handlers, database access, server-side logic.
---

You are the backend specialist. ...
```

### A `/skills/tasks/<name>.md` (task template)

```markdown
# Task: <name>

## Goal
<one-sentence description of success>

## Inputs (ask before starting)
1. ...
2. ...

## Steps
1. ...
2. ...

## Outputs
- ...

## Anti-patterns to refuse
- ...

## Compose-with
- /role <x>
- /rules <y>
```

### A `/hooks/reporters/<name>.js` (reporter channel)

```javascript
// Auto-discovered by your Stop hook when you add one
module.exports = function report(payload) {
  // payload: { transcript, dossier, gitState, ... }
  // do the side-effect
};
```

### A `/skills/family/<name>.md` (family file)

```markdown
---
name: agent-platforms
dossiers: [skill-orchestrator, evaluator-evolution]
---

# Agent platforms family

Conventions: ...
Active dossiers: ...
```

### A `/skills/portfolios/<name>.md` (portfolio preset)

```markdown
---
name: finance
style: ledger
talk: newscaster
think: compliance,evidence-required
---

# Finance portfolio

When active, override style/talk/think to the values above.
```

## Growing Levi

Recommended order — start narrow, add only what you'll actually use:

1. **One thinking mode** (`skills/thinking/planning/SKILL.md`) — proves the axis works.
2. **One style** (`skills/styles/plain-english/SKILL.md`) — adds visible behavior.
3. **One critic** (`agents/critics/skeptic.md`) + wire `/team` and `/critique` to it.
4. **One task template** (`skills/tasks/postmortem.md`) — proves `/task` works.
5. **One reporter** (`hooks/reporters/git.js`) + your first `hooks/stop.js` to fire it.
6. **One guard** (`hooks/guards/secret_scanner.py`) + add the PreToolUse block to `plugin.json`.

After that you have the working primitives in every layer. Add more only when a real session demands it.
