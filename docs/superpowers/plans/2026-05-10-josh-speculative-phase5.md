# Phase 5: `josh` speculative parallel execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Per spec §12 row 5: enable a single matrix-mode todo to fan out to N parallel git worktrees, each running a candidate verdict cycle in isolation. Cost cap respected via Phase 4 `cost-math.enforceCeiling`. Branch hygiene clean — every worktree gets removed when its parent todo lands in `done/`, `failed/`, or `cancelled/`. End state: a smoke test creates a fixture repo, runs `josh claim --speculative 3`, three worktrees materialize on branches `agent/<short-todo>-1..3`, three envelopes get produced (test fixtures simulate the agents), winner is picked, all three worktrees + branches are cleaned.

**Architecture:** New `bin/josh/lib/worktree.js` wraps `git worktree add/remove/list` via `child_process.execSync`. New `--speculative N` flag on `josh claim`. Tick gains a sweep step that calls `removeWorktree` for any todo now in a terminal state. The verdict matrix layer (Phase 4) handles N-envelope adjudication; Phase 5 just fans out the worktree creation.

**Tech Stack:** Node ≥18, CommonJS, `node:test`, `child_process` for `git`. No new deps.

**Source spec:** §4.4 (worktree slot in todo folder layout), §8.1-8.2 (matrix triggers + N=3 default), §12 row 5.

**Phase 5B (deferred):** auto-trigger speculative on cost-data threshold (>100 verdicts), worktree-shared cache for cold-start cost.

---

## File structure

| File | Purpose | New / modify |
|---|---|---|
| `bin/josh/lib/worktree.js` | `createWorktree`, `removeWorktree`, `listWorktrees`, `sweepWorktrees` | New |
| `bin/josh/josh.js` | `claim --speculative N` extension; tick step calls `sweepWorktrees` | Modify |
| `bin/josh/test/worktree.test.js` | Unit tests against fixture repo | New |
| `bin/josh/test/speculative-smoke.test.js` | End-to-end claim → worktrees → verdicts → winner → cleanup | New |
| `bin/josh/README.md` | Document `--speculative` and worktree layout | Modify |
| `USER-MANUAL.md` | §7.18 speculative parallel execution | Modify |

---

## Task 1: `worktree.js` — git worktree wrapper

`createWorktree(joshRoot, todoId, opts)`:
- `opts = { baseRepo, baseBranch, suffix }`. Returns `{ path, branch }`.
- Creates `~/.josh/todo/<state>/<todoId>/worktree[-<suffix>]/` via `git -C <baseRepo> worktree add -b agent/<short>-<suffix> <path> <baseBranch>`.

`removeWorktree(joshRoot, todoId, opts)`:
- `opts = { suffix, force }`. Default removes all worktrees of the todo.
- Walks `~/.josh/todo/*/<todoId>/worktree*/`, runs `git -C <worktree-path> rev-parse --git-dir` to find the actual repo, then `git -C <baseRepo> worktree remove --force <path>` and `git -C <baseRepo> branch -D <branch>`.
- Returns `{ removed: count }`.

`listWorktrees(joshRoot, todoId)`: returns `[{ path, branch, suffix }]`.

`sweepWorktrees(joshRoot)`: for every todo in `done/`, `failed/`, `cancelled/` that has a `worktree*/` sibling, call `removeWorktree`. Returns `{ swept: count }`.

- [ ] write tests (against a fixture repo created via `git init` in tmpdir)
- [ ] implement
- [ ] tests pass
- [ ] commit `feat(josh): add worktree (git worktree wrapper + sweep)`

---

## Task 2: `josh claim --speculative N` extension

In `cmdClaim`, when `--speculative N` is passed AND `--agent` is also passed AND `verdict_mode === 'matrix'` (or `--force-speculative`):
- Locate todo, run dependency + backpressure checks (Phase 3) as normal.
- Resolve `meta.context.repo` (or `--base-repo` flag) and `meta.context.branch || 'main'` (or `--base-branch`).
- For i in 1..N: `createWorktree(JOSH_ROOT, todoId, { baseRepo, baseBranch, suffix: i })`.
- Transition `triaged → claimed` (single transition, single meta.json — N is recorded as `meta.speculative_n`).
- Write `runtime.json` with `worktrees: [paths]`.
- Print one line per worktree.

If `--speculative` without `--agent`, fail with usage error.

- [ ] CLI tests appended to `josh-cli-folder-layout.test.js`
- [ ] implement
- [ ] commit `feat(josh): claim --speculative N forks worktrees per candidate`

---

## Task 3: Tick wiring — sweep worktrees of terminal todos

In `cmdTick`, after the matrix sweep, call `sweepWorktrees(JOSH_ROOT)`. Surface count as `worktrees_swept=N` in tick summary.

- [ ] CLI test
- [ ] implement
- [ ] commit `feat(josh): tick sweeps worktrees of terminal todos`

---

## Task 4: End-to-end smoke test

`bin/josh/test/speculative-smoke.test.js`:
1. Create fixture git repo in tmpdir (`git init`, commit one file).
2. `josh init`, seed agent A03, seed todo with `verdict_mode: matrix`, `meta.context.repo = <fixture>`, `matrix_candidates: ['A03']`.
3. `josh claim --speculative 3 <todo> --agent A03 --as A03`.
4. Assert 3 worktrees exist on branches `agent/<short>-1..3`, each is a valid working copy.
5. Simulate 3 candidate envelopes via `josh verdict submit` (different agent IDs in test).
6. Run tick → matrix queues, simulate winner.json, run tick again → winner materialized.
7. `josh complete` the todo (with handoff).
8. Run tick → `sweepWorktrees` removes all three worktrees + branches.
9. Assert no leftover branches.

- [ ] commit `test(josh): end-to-end speculative smoke (fixture repo + 3 worktrees + cleanup)`

---

## Task 5: Documentation

- `bin/josh/README.md` "Speculative parallel execution (Phase 5)" section.
- `USER-MANUAL.md` §7.18.

- [ ] commit `docs(josh): document Phase 5 speculative parallel execution`

---

## Self-review

- §4.4 worktree slot — `~/.josh/todo/<id>/worktree[-N]/` ✓
- §8.1 trigger #1 (verdict_mode=matrix) — claim flag respects it ✓
- §8.2 N=3 default + ceiling — flag picks N, matrix-router prunes ✓
- §8.2 hard kill 2× budget — deferred (needs runtime cost telemetry; Phase 9)
- "Branch hygiene clean" — `sweepWorktrees` runs every tick ✓

## Phase 5B (deferred)

- Auto-trigger speculative when verdict cost-data threshold reached (>100 runs).
- Hard-kill mid-flight when single candidate exceeds 2× predicted budget (needs Phase 9 cost telemetry).
- Worktree-shared MCP cache for cold-start cost.
