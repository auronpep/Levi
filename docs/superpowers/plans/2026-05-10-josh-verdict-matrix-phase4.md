# Phase 4: `josh` verdict matrix + calibration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the multi-specialist verdict-matrix layer per spec §8: N=3 candidate dispatch, E08 adjudication (never voting), winner+dissent persistence, gold-set replay, rolling trust scores, trigger tokens (`JOSH_VERDICT_REQUIRES_E08` / `JOSH_VERDICT_AUTO_ACCEPT`), token-budget cost math. End state: a 3-agent verdict scenario with seeded envelopes runs end-to-end through `josh tick`, picks a winner via E08, archives dissent, and updates trust scores.

**Architecture:** Pure-function lib modules accept `joshRoot` as a parameter. `josh.js` gains a verdict CLI surface (`josh verdict submit/list/show`, `josh matrix status`) and a tick step that drives the matrix lifecycle: detect N candidate envelopes → enqueue E08 dispatch → on `winner.json` present → mark winner + archive dissent + update trust. **No model invocation** — josh orchestrates the file contract; specialist runtimes write the envelopes.

**Tech Stack:** Node ≥18, CommonJS, `node:test`, `node:assert/strict`. Reuses Phase 1-3 helpers (`readJson`, `writeJsonAtomic`, `appendAudit`, `transitionTodo`, `defaultActor`, `parseArgs`).

**Source spec:** `docs/superpowers/specs/2026-05-09-josh-orchestration-design.md` §6.4 (envelope), §8 (matrix), §13 row 4 (Pydantic-AI as schema-pattern source).

**Phase 4B (deferred):** trust-weighted candidate selection (need 50+ matrix runs of data), promptfoo-style declarative eval suites (replaced by our gold-set replay for v1), drift-alert auto-trigger of spec-evolver.

---

## File structure

| File | Purpose | New / modify |
|---|---|---|
| `bin/josh/lib/verdict-envelope.js` | `validateEnvelope(env)`, `readEnvelope`, `writeEnvelope`, `listVerdicts(joshRoot, todoId)` | New |
| `bin/josh/lib/matrix-router.js` | `selectCandidates(joshRoot, todo, opts)` → `{candidates: [agentId], reason}` | New |
| `bin/josh/lib/cost-math.js` | `predictTokens(agent, todo)`, `predictCost(candidates, todo)`, `enforceCeiling(candidates, todo, ceiling)` | New |
| `bin/josh/lib/trigger-tokens.js` | `detectTrigger(verdictText)` → `'requires_e08' \| 'auto_accept' \| null`, `applyAutoAccept(env)` | New |
| `bin/josh/lib/adjudicator.js` | `enqueueAdjudication(joshRoot, todoId, candidates)`, `materializeWinner(joshRoot, todoId, winnerJson)` | New |
| `bin/josh/lib/gold-set.js` | `readGold(joshRoot, agentId)`, `replayGold(joshRoot, agentId, briefText)` → `{pass, fail, regression_count}` | New |
| `bin/josh/lib/trust.js` | `readTrust(joshRoot, agentId)`, `updateTrust(joshRoot, agentId, dimensions, agreed)` | New |
| `bin/josh/josh.js` | `cmdVerdict` dispatcher (submit/list/show), `cmdMatrix` (status), tick scan steps | Modify |
| `bin/josh/test/verdict-envelope.test.js` | Schema validation + I/O | New |
| `bin/josh/test/matrix-router.test.js` | Candidate selection rules | New |
| `bin/josh/test/cost-math.test.js` | Prediction + ceiling enforcement | New |
| `bin/josh/test/trigger-tokens.test.js` | Sentinel detection | New |
| `bin/josh/test/adjudicator.test.js` | Dispatch queue + winner materialization | New |
| `bin/josh/test/gold-set.test.js` | Replay accuracy | New |
| `bin/josh/test/trust.test.js` | Rolling agreement updates | New |
| `bin/josh/test/matrix-smoke.test.js` | End-to-end 3-agent → E08 → winner+dissent+trust | New |
| `bin/josh/README.md` | Document verdict matrix + matrix CLI | Modify |
| `USER-MANUAL.md` | Add §7.17 verdict matrix | Modify |

Each lib stays under ~250 LOC.

---

## Task 1: `verdict-envelope.js` — schema validate + I/O

**Schema (per spec §6.4):**

Required top-level fields: `schema:1`, `id` (ULID), `todo_id`, `agent_id`, `agent_version` (int), `brief_hash` (sha256 hex), `produced_at` (ISO), `payload` (object), `confidence` (number 0..1), `cost` (object).
Required `payload` fields: `claim_text` (string), `status` (enum `approve|hold|rewrite|reject`), `evidence_basis` (string), `risk_if_accepted` (string), `risk_if_rejected` (string), `verification_required` (string), `human_review_needed` (bool), `blockers` (array), `trust_dimensions` (array of strings).
Optional: `sentinel` (enum or null), `sig` (string or null in Phase 4 — will be filled in Phase 6).

**Files:** Create `bin/josh/lib/verdict-envelope.js`, `bin/josh/test/verdict-envelope.test.js`.

- [ ] **Step 1**: write tests for `validateEnvelope` (accepts good envelope, rejects each missing required field, rejects bad enum), `writeEnvelope`/`readEnvelope` round-trip under `~/.josh/todo/<id>/verdicts/<agent>.json`, `listVerdicts` returns ULIDs.
- [ ] **Step 2**: implement.
- [ ] **Step 3**: tests pass.
- [ ] **Step 4**: commit `feat(josh): add verdict-envelope (schema + I/O)`.

---

## Task 2: `cost-math.js` — predict + enforce ceiling

**Tier costs** (per spec §13 row 4 + Hail_Hydra port). Stored as a constant table in the lib:

```js
const TIER_COSTS = {
  haiku:  { in_per_1m: 0.25,  out_per_1m: 1.25 },
  sonnet: { in_per_1m: 3.0,   out_per_1m: 15.0 },
  opus:   { in_per_1m: 15.0,  out_per_1m: 75.0 },
};
const MAX_TOKENS_PER_VERDICT = 50000;
```

`predictTokens(agent, todo)`: returns `{tokens_in, tokens_out}` based on agent's `manifest.budget.preferred_model` and a heuristic from todo's `target_minutes` (default 30 minutes → 5000 in / 1500 out). Override via `agent.budget.max_tokens_per_claim`.

`predictCost(candidates, todo)`: sum of all candidates' predicted in+out tokens, USD computed via tier table.

`enforceCeiling(candidates, todo, ceiling = MAX_TOKENS_PER_VERDICT)`: if total predicted > ceiling, prune by lowest marginal utility (= `confidence_estimate / cost_estimate`). For v1, simpler proxy: prune candidate with highest cost first. Returns `{kept: [agent_id], pruned: [{agent_id, reason}]}`.

**Files:** Create `bin/josh/lib/cost-math.js`, `bin/josh/test/cost-math.test.js`.

- [ ] **Step 1-4**: TDD as Task 1.
- [ ] **Commit**: `feat(josh): add cost-math (token + USD prediction, ceiling enforcement)`.

---

## Task 3: `matrix-router.js` — candidate selection

**Selection algorithm:**

1. Read `~/.josh/orchestrator/routing.json` (existing, extend with `matrix_rules`).
2. For the todo's `primary_role` agent, find the matching `matrix_rules` entry (by capability list intersection).
3. Default candidate set: 3 agents with highest capability overlap with the todo's `labels`.
4. If `todo.verdict_mode === "matrix"` OR `todo.risk === "high"` OR override flag → run matrix.
5. Otherwise return `{single: agentId}` and skip matrix.
6. Apply `cost-math.enforceCeiling` to prune.

**Schema for `routing.json` extension:**

```json
{
  "schema": 1,
  "rules": [...],
  "matrix_rules": [
    { "if_labels": ["legal"], "candidates": ["A03", "A07", "A09"] },
    { "if_phase": 1, "candidates": ["A01", "A02", "A03"] }
  ],
  "default_matrix_candidates": ["A01", "A03", "E08"]
}
```

**Files:** Create `bin/josh/lib/matrix-router.js`, `bin/josh/test/matrix-router.test.js`.

- [ ] TDD + commit `feat(josh): add matrix-router (N=3 candidate selection)`.

---

## Task 4: `trigger-tokens.js` — sentinel detection

Per spec §8.5, specialists end output with one of:
- `⚠️ JOSH_VERDICT_REQUIRES_E08`
- `✅ JOSH_VERDICT_AUTO_ACCEPT`

`detectTrigger(envelope)` reads `envelope.sentinel` (if specialist set it) OR scans `envelope.payload.claim_text` for the literal trigger strings. Returns `'requires_e08'`, `'auto_accept'`, or `null`.

`applyAutoAccept(envelope, todo)`: returns `{accept: bool, reason: string}`. Accepts only when:
- `envelope.confidence >= 0.9`
- `todo.risk` is `'low'`, `'medium'`, or unset (i.e., `risk !== 'high'`)
- sentinel is `'auto_accept'`

**Files:** Create `bin/josh/lib/trigger-tokens.js`, `bin/josh/test/trigger-tokens.test.js`.

- [ ] TDD + commit `feat(josh): add trigger-tokens (REQUIRES_E08 / AUTO_ACCEPT sentinels)`.

---

## Task 5: `adjudicator.js` — E08 dispatch + winner materialization

`enqueueAdjudication(joshRoot, todoId, candidateEnvelopes)`:
- Writes `~/.josh/E08/incoming/adj-<ulid>.json` with `{schema:1, id, todo_id, candidates:[envelope-paths], gold_match:null, trust_scores: {agent: trust}, queued_at}`.
- Returns `{adjudication_id}`.

`materializeWinner(joshRoot, todoId, winnerJson)`:
- Reads `winnerJson` shape: `{winner_id: agent_id, synthesis_notes: string, confidence: number}`.
- Copies/links winner's envelope to `~/.josh/todo/<id>/verdicts/winner.json`.
- Moves runner-up envelopes to `~/.josh/todo/<id>/verdicts/dissent/<agent>.md` (markdown summary: synthesis of envelope payload).
- Returns `{winner: agentId, dissent_count}`.

**Files:** Create `bin/josh/lib/adjudicator.js`, `bin/josh/test/adjudicator.test.js`.

- [ ] TDD + commit `feat(josh): add adjudicator (E08 dispatch queue + winner materialization)`.

---

## Task 6: `gold-set.js` — read + replay

Gold items live at `~/.josh/agents/<id>/gold/*.json`. Each has `{schema:1, id, todo_minimal: {title, labels, ...}, expected_verdict: {status, claim_text}, rubric: string}`.

`readGold(joshRoot, agentId)`: returns array of gold items.

`replayGold(joshRoot, agentId, candidateBriefText, candidateProducedVerdicts)`: takes the agent's candidate brief and a map of `{gold_id → produced_envelope}` (produced by replaying the gold's `todo_minimal` against the candidate brief — in practice the runtime fills this; josh's job is comparing). Returns `{pass: int, fail: int, regression_count: int, items: [{gold_id, expected, got, match}]}`. Match logic:
- `status` matches expected
- if `rubric` includes `"strict_text"`, `claim_text` exact match; else fuzzy (string contains expected key phrases).

**Files:** Create `bin/josh/lib/gold-set.js`, `bin/josh/test/gold-set.test.js`.

- [ ] TDD + commit `feat(josh): add gold-set (replay + pass/fail/regression accounting)`.

---

## Task 7: `trust.js` — rolling agreement scores

`agents/<id>/trust.json` shape:

```json
{
  "schema": 1,
  "agent_id": "A03",
  "dimensions": {
    "legal_accuracy": { "agreed": 17, "total": 20, "rate": 0.85 },
    "source_safety": { "agreed": 18, "total": 20, "rate": 0.90 }
  },
  "matrix_runs": 20,
  "last_updated": "2026-05-10T..."
}
```

`readTrust(joshRoot, agentId)`: returns trust object (defaults `{agent_id, dimensions: {}, matrix_runs: 0}` if absent).

`updateTrust(joshRoot, agentId, dimensions, agreed)`: increments `total` for every dimension and `agreed` for those in `agreed`. Recomputes `rate`. Atomic write. Returns updated trust.

**Files:** Create `bin/josh/lib/trust.js`, `bin/josh/test/trust.test.js`.

- [ ] TDD + commit `feat(josh): add trust (per-dimension rolling agreement scores)`.

---

## Task 8: `josh verdict` CLI surface

Subcommands (mirror `cmdProject` / `cmdPlan` pattern):

- `josh verdict submit <todo-id> --envelope <path> [--as <actor>]` — validates the envelope file, writes it to `~/.josh/todo/<id>/verdicts/<agent>.json`. Auto-detects matrix completion (N=3 envelopes present) and triggers `enqueueAdjudication`.
- `josh verdict list <todo-id>` — prints one line per envelope: `<agent> <status> <confidence> <produced_at>`.
- `josh verdict show <todo-id> <agent-id>` — prints the envelope (or `winner.json` if exists and agent omitted).

Wire `cmdVerdict` into the COMMANDS dispatcher.

**Files:** Modify `bin/josh/josh.js`, append CLI tests to `bin/josh/test/josh-cli-folder-layout.test.js`.

- [ ] TDD + commit `feat(josh): add 'josh verdict' subcommands (submit/list/show)`.

---

## Task 9: `josh matrix` CLI surface

`josh matrix status [--todo <id>]` — prints matrix progress for one todo (or all in_progress todos with `verdicts/` non-empty): `D1-001  candidates=A03,A07,A09  envelopes=2/3  winner=—`.

**Files:** Modify `bin/josh/josh.js`, append CLI tests.

- [ ] TDD + commit `feat(josh): add 'josh matrix status' subcommand`.

---

## Task 10: Tick step — auto-enqueue E08 when N candidates present

In `cmdTick`, after the doom-loop sweep, add a step that walks `todo/in_progress/*/verdicts/`. For each todo:
- If `winner.json` exists → skip.
- If candidate envelope count ≥ N (read N from the matrix-router decision in meta, default 3) → call `enqueueAdjudication`.
- Apply trigger-token logic: any envelope with `JOSH_VERDICT_AUTO_ACCEPT` + qualifying conditions → skip matrix and synthesize that envelope as winner directly.

Audit: emit `matrix.adjudication_queued` per dispatch.

- [ ] TDD + commit `feat(josh): tick auto-enqueues E08 adjudication when N candidates present`.

---

## Task 11: Tick step — materialize winner when E08 emits

In `cmdTick`, after the auto-enqueue step, walk `todo/in_progress/*/` for any todo whose `verdicts/winner.json` was just written by an E08 session. (Detection: presence of `winner.json` + absence of a `winner_materialized` history entry.)

- Call `materializeWinner` to archive dissent.
- Call `updateTrust` for each candidate agent: `agreed = (agent_id === winner_id)` for now (single-dim "matrix_agreement"); per-dimension trust update happens when the runtime emits per-dim verdicts (Phase 4B).
- Append `winner_materialized` history entry; emit audit `matrix.winner_picked`.

- [ ] TDD + commit `feat(josh): tick materializes E08 winner + updates trust scores`.

---

## Task 12: End-to-end matrix smoke test

`bin/josh/test/matrix-smoke.test.js`:
1. Setup root + 3 agents (A01, A03, E08) with manifests + minimal briefs.
2. Seed a todo in `in_progress/` with `verdict_mode: matrix`, `meta.matrix_candidates: ["A01","A03","A07"]`.
3. Submit 3 envelopes via `josh verdict submit` (different statuses).
4. Run `josh tick` → assert E08 adjudication queued at `~/.josh/E08/incoming/adj-*.json`.
5. Simulate E08: write `verdicts/winner.json` with `{winner_id: "A03", synthesis_notes: "...", confidence: 0.85}`.
6. Run `josh tick` → assert `verdicts/winner.json` materialized, `verdicts/dissent/A01.md` and `verdicts/dissent/A07.md` written, `agents/A03/trust.json` updated.

- [ ] commit `test(josh): end-to-end matrix smoke (3 candidates → E08 → winner+dissent+trust)`.

---

## Task 13: Documentation

Update `bin/josh/README.md` (new "Verdict matrix (Phase 4)" section) and `USER-MANUAL.md` §7.17.

- [ ] commit `docs(josh): document Phase 4 verdict matrix`.

---

## Self-review checklist

- All required §6.4 envelope fields validated. ✓
- §8.1 triggers (explicit + risk + disagreement) — explicit + risk wired in router; disagreement deferred to 4B (needs 50 runs of data).
- §8.2 N=3 default, ceiling enforcement — wired.
- §8.3 E08 never voting — adjudicator separate; tick materializes winner.
- §8.4 pick-one + dissent — winner.json + dissent/*.md.
- §8.5 trigger tokens — detect + auto-accept logic.
- Trust scores update on every matrix run.
- Cost math enforces ceiling.
- No new npm deps. ✓

## Phase 4B (deferred)

- Trust-weighted candidate selection (§8.3) — needs ≥50 matrix runs of data first.
- Auto on disagreement (§8.1.3) — single-agent verdict with `confidence < 0.7` triggers matrix. Needs single-agent flow first; we have it via legacy `cmdClaim` path.
- Per-dimension trust updates (currently single "matrix_agreement" dim).
- Drift-alert auto-trigger of spec-evolver (Phase 7 hookup).
