# Levi

Minimal Claude Code plugin shell. Same dispatcher skeleton as [Reuben](https://github.com/VoteWood/Reuben), zero items inside. Add modes, agents, hooks, and reporters one at a time as you need them.

## What's in the box

- **47 axis commands** in `commands/*.md` — the full dispatcher surface, copied verbatim from Reuben. Typing `/think`, `/style`, `/role`, etc. is wired up at the command level.
- **43 empty axis folders** in `skills/<axis>/` — one per axis, ready for you to drop modes into.
- **Empty agent groups** in `agents/{critics,specialists,cohort}/`.
- **Empty hook groups** in `hooks/{guards,reporters,lib}/`.
- **Plugin manifest** at `.claude-plugin/plugin.json` (no hooks block — add it when you ship hooks).

## What's NOT in the box

- Zero modes (no `/think planning`, no `/talk caveman`, no `/style ledger`)
- Zero critics, specialists, cohort personas
- Zero reporters, guards, lib helpers
- Zero tasks, families, portfolios, combos, rules
- No sync scripts, no learning library, no dossiers

This is intentional. Levi is a **shell** — type any command and you'll get an empty list. Add one item at a time and grow it.

## Why Levi exists

Reuben is a fully-stocked dispatcher (~150 items across 9 layers). Levi is the same skeleton with nothing in it — useful when:

- You want to start fresh on a focused, lean dispatcher
- You want to test one feature in isolation without Reuben's full surface
- You want to grow a parallel plugin with a different philosophy

## Install

```
/plugin marketplace add C:/Levi
/plugin install levi@levi-marketplace
```

## Adding items

| Adding | Drop it at | What you'll need |
|---|---|---|
| New mode for an axis | `skills/<axis>/<name>/SKILL.md` | YAML frontmatter with `description` field |
| New critic | `agents/critics/<name>.md` | Markdown with frontmatter |
| New specialist | `agents/specialists/<name>.md` | Markdown with frontmatter |
| New cohort persona | `agents/cohort/<name>.md` | Markdown with frontmatter |
| New reporter | `hooks/reporters/<name>.js` | Auto-discovered by your Stop hook (when you add one) |
| New guard | `hooks/guards/<name>.py` | Reference from `plugin.json` `hooks` block |
| New task template | `skills/tasks/<name>.md` | Plain markdown recipe |
| New family / portfolio / combo | `skills/<family\|portfolios\|combos>/<name>.md` | Markdown with frontmatter |

See [MANUAL.md](MANUAL.md) for the axis-by-axis list and folder map.

For everyday operator use — slash command reference, `josh` CLI surface, `~/.josh/` runtime, schemas, scheduler setup, recipes, troubleshooting — see **[USER-MANUAL.md](USER-MANUAL.md)**.

## How the commands work without modes

The Markdown commands in `commands/` reference skills (e.g. "list directories in `skills/thinking/`"). With zero modes installed, the response will be "no modes available." That's the expected shell behavior — typing `/think foo` will note that `foo` doesn't exist because nothing is installed yet.

When you add `skills/thinking/planning/SKILL.md`, `/think planning` will start working.

## Hooks

The plugin manifest ships **without a hooks block** because no hook files exist. When you write your first hook (e.g. `hooks/session-start.js`), add it to `.claude-plugin/plugin.json` under `"hooks"` — see Reuben's manifest for the wiring pattern.

## Layout

```
C:\Levi\
├── .claude-plugin\
│   ├── plugin.json
│   └── marketplace.json
├── commands\           # 47 axis commands (.md)
├── skills\             # 43 empty axis folders
│   ├── thinking\
│   ├── talk\
│   ├── styles\
│   └── ... (40 more)
├── agents\
│   ├── critics\
│   ├── specialists\
│   └── cohort\
├── hooks\
│   ├── guards\
│   ├── reporters\
│   └── lib\
├── README.md
├── MANUAL.md
└── CLAUDE.md
```

## Maintainers

- VoteWood (owner)
- erewhonsgroup (admin)
- auronpep (admin)
- JWoodMedia (admin)
