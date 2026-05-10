# Master Rollout Log

Append-only journal of the autonomous Phase 3 → Phase 10 rollout. One section per phase, recording: when started, decisions revisited mid-flight, surprises, what shipped vs deferred.

---

## Phase 3 — Enforcement layer

- **Started:** (pending — about to begin)
- **Branch:** `claude/josh-phase3-enforcement`
- **Plan doc:** `2026-05-10-josh-enforcement-phase3.md`

(entries appended as work proceeds)
- **Status:** SHIPPED → PR #3
- **Commits:** 9 (1c275ef..10ba288)
- **Tests:** 104 pass / 0 fail / 1 skipped (full suite)
- **Shipped:** dependency-checker, backpressure (global+phase+agent), doom-loop, heartbeat CLI
- **Deferred to Phase 3B:** worktree isolation per claim, chat-mode APPROVE: guard hook, evidence-strict handoff
- **Surprises:** None. Plan executed verbatim. Existing test helpers (`runCli`, `setupRoot`, `JOSH_BIN`) made appending CLI tests cleaner than the plan template suggested — adapted on the fly.

---

## Phase 4 — Verdict matrix + calibration

- **Started:** (now)
- **Branch:** `claude/josh-phase4-verdict-matrix` (off Phase 3 HEAD)
- **Plan doc:** `2026-05-10-josh-verdict-matrix-phase4.md`
- **Status:** SHIPPED → PR (pending push)
- **Commits:** 10
- **Tests:** 152 pass / 0 fail / 1 skipped
- **Shipped:** verdict-envelope, cost-math, matrix-router, trigger-tokens, adjudicator, gold-set, trust, `josh verdict` CLI, `josh matrix` CLI, tick lifecycle (queue + winner + auto-accept).
- **Deferred to Phase 4B:** trust-weighted candidate selection (needs ≥50 matrix runs), per-dimension trust updates beyond single agreement signal, drift-alert auto-trigger of spec-evolver.
- **Surprises:** Auto-accept fast path required short-circuit logic in tick BEFORE the N-envelopes check, otherwise a single high-confidence envelope wouldn't fire until the second envelope arrived. Caught it from the smoke test.

---

## Phase 5 — Speculative parallel execution

- **Started:** (next)
- **Branch:** `claude/josh-phase5-speculative` (off Phase 4 HEAD)
- **Plan doc:** `2026-05-10-josh-speculative-phase5.md`
- **Status:** SHIPPED → PR (pending push)
- **Commits:** 2
- **Tests:** 159 pass / 0 fail / 1 skipped
- **Shipped:** worktree.js (create/remove/list/sweep), `josh claim --speculative N`, tick worktree sweep, speculative smoke test, docs.
- **Surprises:** First smoke run failed because git's worktree registry breaks when the parent folder is renamed (claimed/ → done/). Fix: use `runtime.json.worktrees` for branch metadata + `git worktree prune` to clean stale registry entries before `git branch -D`.
- **Deferred to Phase 5B:** auto-trigger speculative on cost-data threshold; hard-kill mid-flight at 2× predicted budget (needs Phase 9 cost telemetry).

---

## Phase 6 — Cryptographic audit

- **Started:** (next)
- **Branch:** `claude/josh-phase6-crypto` (off Phase 5 HEAD)
- **Plan doc:** `2026-05-10-josh-crypto-phase6.md`
