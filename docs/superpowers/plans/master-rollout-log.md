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
- **Status:** SHIPPED → PR (pending push)
- **Commits:** 8 (6 lib + 1 wiring/docs/smoke + 1 log)
- **Tests:** 195 pass / 0 fail / 1 skipped
- **Shipped:** canonical-json, identity, jws, audit-key, audit-chain, delegation; Phase 4 envelope writer auto-signs; CLI: agent mint/show, audit verify/rotate-key/list-keys, verdict verify; crypto-smoke covering tamper, rotation, forgery, delegation.
- **Deferred to Phase 6.5:** OS-keychain wrap (DPAPI on Windows). Key files at 0o600 are the v1 baseline.
- **Surprises:** 1) Initial smoke test used `replace(/"T2"/, ...)` to tamper a line, but `"T24"` doesn't contain `"T2"` — fixed by tampering an `"i":N` numeric field instead. 2) `verifyJws` initially threw on malformed JWS; refactored to return `{valid:false, reason}` for stable verifier semantics.

---

## Phase 7 — Spec-evolver meta-lane

- **Started:** (next)
- **Branch:** `claude/josh-phase7-spec-evolver` (off Phase 6 HEAD)
- **Plan doc:** `2026-05-10-josh-spec-evolver-phase7.md`
- **Status:** SHIPPED → PR (pending push)
- **Commits:** 2 (1 big feature + 1 log)
- **Tests:** 200 pass / 0 fail / 1 skipped
- **Shipped:** archetypes.json catalog, removal-test, lessons, spec-evolver (rounds + halt + approval drop + apply/reject), `josh evolve` + `josh lesson` CLI, --simulator mode for tests, full smoke covering converged path, approve flow, regression+reject path, v1 agent allowlist enforcement.
- **Surprises:** First Edit-tool injection of cmdEvolve/cmdLesson into josh.js silently failed to take effect (success message but functions missing on disk). Re-applied; second edit landed correctly. Cause likely a transient tool race; the master design's "verify-by-grep after major edits" practice would have caught it earlier — promoting that to standard procedure for the remaining phases.
- **Deferred to 7B:** real-runtime dispatch loop (we ship simulator mode + the file contract; the actual model-side iteration is the runtime's job per master design §1.3).

---

## Phase 8 — Cross-runtime gateway

- **Started:** (next)
- **Branch:** `claude/josh-phase8-cross-runtime` (off Phase 7 HEAD)
- **Plan doc:** `2026-05-10-josh-cross-runtime-phase8.md`
