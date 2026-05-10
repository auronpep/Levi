# Phase 7: `josh` spec-evolver meta-lane Implementation Plan

**Goal:** Spec §10. When an agent's brief degrades (gold-set pass rate drops, or matrix verdicts keep losing) or on manual trigger, queue a "plan-only" Task that proposes a patched brief; josh runs the iteration loop with halt rules; on convergence, drop a PR-style approval. `josh evolve approve` swaps the brief and bumps `manifest.version`. Old verdicts still verify against the v1 brief_hash (Phase 6 already gave us that — `brief_hash` is in the signed payload).

**Architecture:** Josh does not invoke models. It writes a dispatch file `~/.josh/orchestrator/incoming/evolve-<id>.json` that an external runtime processes; the runtime emits candidate briefs to `~/.josh/agents/<id>/evolve/<round>/after.md` along with a per-round `meta.json`. Josh's tick step monitors for new candidates, replays the gold set against each (using Phase 4 `gold-set.js`), checks halt rules, and on convergence assembles the approval drop. For tests + bootstrap, ship a `--simulator` mode that accepts pre-baked candidates.

**Source spec:** §10 (verbatim — 10-archetype catalog, removal test, halt rules, output format, lessons.md).

**v1 scope per master design §1.4:** A01 + E00 + E08 only. Manual + nightly cron triggers only. Disagreement-threshold trigger gated behind `--enable-disagreement-trigger`.

---

## File structure

| File | Purpose | New / modify |
|---|---|---|
| `bin/josh/lib/archetypes.json` | 10-archetype catalog (data file) | New |
| `bin/josh/lib/removal-test.js` | Apply "removal test" rubric to brief lines | New |
| `bin/josh/lib/spec-evolver.js` | `enqueueEvolution`, `processRound`, `checkHaltRules`, `assembleApproval`, `applyApproval`, `archiveRejection` | New |
| `bin/josh/lib/lessons.js` | `appendLesson`, `readLessons` | New |
| `bin/josh/josh.js` | `josh evolve start/status/approve/reject`, `josh lesson add`, tick step | Modify |
| Tests | unit per lib + simulator-mode smoke | New |
| Docs | README + USER-MANUAL §7.20 | Modify |

---

## Task 1: `archetypes.json` + `removal-test.js`

Archetype catalog (verbatim from gonzaloetjo/setup-claude-md):
1. single_atomic_change
2. multi_file_refactor
3. cross_module_breaking
4. data_migration
5. perf_regression
6. security_hardening
7. flaky_test_diagnosis
8. dep_upgrade
9. infra_change
10. spec_drift_repair

`removal-test.js` `applyRemovalTest(brief, goldFailures)` returns lines marked `keep|prune` based on whether removing each line would correlate with any gold-set failure.

- [ ] commit `feat(josh): add archetypes catalog + removal-test`

---

## Task 2: `lessons.js`

Per-agent `~/.josh/agents/<id>/lessons.md` accumulator. Append-only.

`appendLesson(joshRoot, agentId, text, opts)` — appends a markdown bullet with `at` + `actor` + `text`.
`readLessons(joshRoot, agentId)` — returns parsed bullet list.

- [ ] commit `feat(josh): add lessons (per-agent corrections file)`

---

## Task 3: `spec-evolver.js` orchestration

Main lifecycle:

`enqueueEvolution(joshRoot, agentId, opts)`:
- Validate agent is in v1 list (A01/E00/E08) unless `opts.allowAny`.
- Generate `evolve_id = evolve-<agentId>-<ts>`.
- Write `~/.josh/orchestrator/incoming/${evolve_id}.json` with `{schema:1, kind:'evolve', evolve_id, agent_id, brief_hash_v1, gold_count, archetypes, max_rounds, lessons_summary}`.
- Initialize `~/.josh/agents/<id>/evolve/${evolve_id}/state.json` `{round:0, halted:false, halt_reason:null, history:[]}`.
- Return `{evolve_id}`.

`processRound(joshRoot, agentId, evolveId, candidate, opts)`:
- Round dir: `~/.josh/agents/<id>/evolve/${evolveId}/round-<N>/`.
- `candidate` shape: `{round_num, after_md, no_new_gaps_found_emitted, frustration_log, gap_categories}`.
- Replay gold set against candidate brief (Phase 4 `gold-set.replayGold`).
- Update state: `history[round_num] = {pass_rate, regression_count, brief_lines, no_new_gaps_found}`.
- Apply halt rules.

`checkHaltRules(state, opts)` returns `{halt: bool, reason}`. Per §10.3:
1. `pass_rate >= 0.95` AND `<NO_NEW_GAPS_FOUND>` two rounds in a row → `converged`
2. brief > 250 lines after pruning → `bloating`
3. regression detected (`pass_rate < prev_round.pass_rate`) → `regression` (revert to prev)
4. N=8 hard ceiling → `max_rounds`

`assembleApproval(joshRoot, agentId, evolveId)` (called when halted with success):
- Path: `~/.josh/approvals/${evolveId}/`
- Files: `before.md` (current brief), `after.md` (winning round's candidate), `diff.patch` (unified diff), `iteration-logs/round-N.md`, `gold-replay.json`, `approval.md` (one-line summary).

`applyApproval(joshRoot, evolveId)`:
- Read approval folder.
- Atomically swap agent's source brief: write `after.md` over `manifest.source_path`.
- Bump `manifest.version`.
- Move approval folder to `~/.josh/approvals/done/${evolveId}/`.
- Append a `lessons.md` entry recording the swap.
- Audit event `agent.evolved` with old/new brief_hash + version.

`archiveRejection(joshRoot, evolveId, reason)`:
- Move approval folder to `~/.josh/approvals/done/${evolveId}/` with `rejection.json`.
- Audit event `agent.evolve_rejected`.

- [ ] commit `feat(josh): add spec-evolver orchestration (rounds + halt + approval drop)`

---

## Task 4: `josh evolve` + `josh lesson` CLI

```
josh evolve start <agent-id> [--max-rounds 5] [--simulator <dir>] [--allow-any]
josh evolve status [<evolve-id>]
josh evolve approve <evolve-id> [--as actor]
josh evolve reject <evolve-id> --reason "..." [--as actor]
josh evolve list [--state pending|done|all]

josh lesson add <agent-id> "text" [--as actor]
josh lesson list <agent-id>
```

In `--simulator <dir>` mode (test harness): instead of dispatching to an external runtime, the simulator dir holds pre-baked `round-N/` folders. The CLI reads them sequentially through the round loop, exercising the full halt-rule + approval drop logic without needing a model.

- [ ] commit `feat(josh): add 'josh evolve' + 'josh lesson' subcommands`

---

## Task 5: Tick step

`cmdTick` gains a step that scans `~/.josh/agents/*/evolve/*/state.json` for any active (`halted:false`) evolve job, looks for new round candidates in `round-*/after.md`, processes each via `processRound`, and on halt assembles the approval drop. Reported as `evolved=N` in tick summary when nonzero (N = approval drops assembled this tick).

- [ ] commit `feat(josh): tick processes spec-evolver candidate rounds`

---

## Task 6: End-to-end simulator smoke

`bin/josh/test/spec-evolver-smoke.test.js`:
1. Setup A01 with brief + gold set + Ed25519 identity.
2. `josh evolve start A01 --simulator <fixture-dir>` — fixture has 3 rounds: round-1 (pass=0.6), round-2 (pass=0.92, NO_NEW_GAPS), round-3 (pass=0.96, NO_NEW_GAPS) → halt at converged after round-3.
3. Assert approval folder dropped at `~/.josh/approvals/${evolveId}/` with all expected files.
4. `josh evolve approve <evolve-id>` → brief swapped, version bumped, lesson appended.
5. Verify a verdict signed against v1 brief still verifies (brief_hash binding).
6. Test rejection path: another evolve where round-1 regresses → halt+reason recorded → `josh evolve reject` archives with reason.

- [ ] commit `test(josh): end-to-end spec-evolver simulator smoke`

---

## Task 7: Docs

`bin/josh/README.md` "Spec-evolver (Phase 7)"; `USER-MANUAL.md` §7.20.

- [ ] commit `docs(josh): document Phase 7 spec-evolver meta-lane`
