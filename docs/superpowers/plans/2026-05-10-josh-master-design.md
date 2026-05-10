# `josh` Master Rollout Design — From Current State to All 10 Phases Working

**Status:** Locked-in master design. No further questions; autonomous execution.
**Date:** 2026-05-10
**Author:** Claude (Opus 4.7, 1M context) at user direction
**Source spec:** `docs/superpowers/specs/2026-05-09-josh-orchestration-design.md`

---

## 0. What this document is

A single top-level design that takes `josh` from its current state (Phase 1 + 2A shipped on `main`; Phase 3 plan written and in PR #2) to **all ten phases of the spec working end-to-end**. It locks in every decision that would otherwise pause execution for a clarifying question, picks the merge/PR strategy, and defines what "done" means for each phase and for the rollout as a whole.

The master goal:

> A fresh `josh init` + `josh project import C:/AINC/MEV/experiments/mbe_tension_matrix/` runs the BarMatrix Day 1 dispatch loop end-to-end through `josh tick` cycles, with verdict matrix on at least one task, signed audit chain, dashboard summary, and zero human intervention beyond the `APPROVE: <id>` chat signal.

Every phase below is sequenced toward that single integration test.

---

## 1. Locked-in decisions (no questions during execution)

These are the calls I would otherwise stop to ask. Locking them in here means I can run the rollout end-to-end without checkpoints.

### 1.1 Dependencies

- **Zero new npm dependencies.** Every later phase uses Node ≥18 built-ins. Confirmed available: `node:crypto` (HMAC-SHA256, Ed25519 keypair + sign + verify, sha256), `node:test`, `node:assert/strict`, `node:fs`, `node:path`, `node:os`, `node:child_process`, `node:util.parseArgs`. No `keytar`, no `jose`, no `did-resolver`. If any later phase uncovers a real blocker, I solve it with a Node built-in or a small in-repo helper, never a new dep.
- **No changes to `bin/josh/package.json`** beyond the existing `"scripts.test"`. Engines stay at `>=18.0.0`.

### 1.2 Crypto (Phase 6)

- **HMAC-SHA256 chain** computed via `crypto.createHmac('sha256', key)`. Audit key stored as raw 32 bytes at `~/.josh/keys/audit-<key_id>.key` with mode `0o600`. **No DPAPI/keychain wrapping in v1** — file-permission isolation is the v1 baseline; OS-keychain wrapping is a Phase 6.5 polish item that ships only if it's a clean drop-in.
- **Ed25519** via `crypto.generateKeyPairSync('ed25519')`, exported as raw 32-byte seed (private) + raw 32-byte public. Stored at `~/.josh/agents/<id>/identity.key` (priv, mode 0o600) + `~/.josh/agents/<id>/pubkey.jwk` (public JWK). DID derived as `did:key:z<base64url(pubkey_raw)>`.
- **JWS-compact** for signed payloads — implemented as a small in-repo module `bin/josh/lib/jws.js`. Header `{alg:"EdDSA", kid:<did>}`, body includes mandatory `aud:"josh:audit"` and `iat`, `nbf`, plus the bound `brief_hash`.
- **Canonical JSON** for the HMAC chain payload — implemented as a stable-key-sorted JSON serializer in `bin/josh/lib/canonical-json.js`. Recursive sort by key, no whitespace. Lock the algorithm at v1; documented in `bin/josh/README.md` under "Canonical JSON v1".
- **Key rotation** — `josh audit rotate-key` mints `audit-<YYYY-MM>.key` and appends `audit.key_rotated` as the first event of the new period. Verifier walks back to the most recent rotation marker.

### 1.3 Verdict matrix execution model (Phases 4 + 5)

- **Verdict envelopes** are written by whatever runtime produced them. `josh` does not invoke models directly — it provides the file contract and the matrix orchestration. A specialist agent's session emits `~/.josh/todo/<id>/verdicts/<agent>.json` (verdict envelope per spec §6.4) and the orchestrator picks them up on tick.
- **Adjudicator (E08)** is invoked the same way: a `josh tick` step sees N candidate verdicts in `verdicts/` and queues an E08 dispatch via `~/.josh/E08/incoming/<adj-id>.json`. The E08 session reads the candidate envelopes, writes `verdicts/winner.json`, and moves the runners-up to `verdicts/dissent/<agent>.md`. We don't reach into model runtimes; we orchestrate the file flow.
- **Speculative parallel execution (Phase 5)** uses worktree-per-claim (`~/.josh/todo/<id>/worktree/`) created by `josh claim --speculative N`. The worktree is a real `git worktree` on branch `agent/<short-id>`. Cleanup is `git worktree remove --force` after the matrix winner is picked.

### 1.4 Spec-evolver (Phase 7)

- **Trigger sources implemented in v1**: nightly cron + manual (`josh evolve <agent-id>`). Disagreement-threshold trigger needs ≥10 matrix verdicts of history per agent; we ship the counter but the threshold-fire logic is gated behind `--enable-disagreement-trigger` until we have data.
- **Agents in v1**: A01 + E00 + E08 only (per spec §13 row 7). The CLI accepts any agent ID but logs a warning for non-v1 agents.
- **Iteration cap**: default N=5, hard ceiling N=8. Halt rules per spec §10.3 verbatim.
- **Output format**: `~/.josh/approvals/evolve-<agent>-<ts>/` with `before.md`, `after.md`, `diff.patch`, `gold-replay.json`, `approval.md`. Approve → `mv` into agent slot + version bump. Reject → archive to `~/.josh/approvals/done/`.

### 1.5 Cross-runtime gateway (Phase 8)

- **MCP registry** is a JSON file at `~/.josh/mcp/registry.json` with shape `{servers: [{id, command, args, env, capabilities[], scopes[]}]}`. `josh tool list/use/scope` are the CLI surface.
- **Tool scoping** — each agent's manifest gets an `allowed_tools: ["mcp:duckdb", "fs:read"]` field. `josh claim --agent A03` writes `runtime.json.allowed_tools` from the manifest. Enforcement is **declarative** in v1 — the runtime is expected to honor it; josh logs an audit event when a runtime reports a tool use outside scope (via stream events).
- **A2A bridge** — minimal HTTP server `bin/josh/lib/a2a-bridge.js` listening on `127.0.0.1:<port>` (port from env `JOSH_A2A_PORT`, default 7843) with two endpoints: `POST /tasks/sendSubscribe` (claim a todo as the registered A2A agent) and `GET /tasks/<id>` (status). This is a stub-but-functional surface; production hardening in a later phase.

### 1.6 Dashboard + cost telemetry (Phase 9)

- **Cost ledger** at `~/.josh/cost/<YYYY-MM>.jsonl` — append-only. Each line: `{at, todo_id, agent_id, model, tokens_in, tokens_out, wall_seconds, usd}`. Written by `josh cost log` (called by runtimes/agents) and `josh tick` aggregation.
- **Dashboard** is a **text-mode CLI command** `josh dashboard [--project <id>] [--since <ISO>]`. No web UI. Output: agent-level utilization, in-flight count by phase, cost burn rate, drift alerts (verdict disagreements over rolling window). Uses existing `renderDailyReview` style.
- **Drift alerts** — surface only when `same agent + same archetype + ≥3 verdict disagreements in last 10 matrix runs`. Below that threshold = noise; not surfaced.

### 1.7 Multi-machine + sprint continuity (Phase 10)

- **Substrate**: Syncthing (per spec §13 row 10). We **do not configure Syncthing** in this phase — that's user infra. We ship the primitives that make `~/.josh/` safe to put under Syncthing:
  - Per-PC capacity tag in `~/.josh/<hostname>.capacity.json` (not synced — `.stignore` pattern).
  - ULID-tiebreaker conflict resolver: `josh sync resolve` walks `~/.josh/todo/<state>/<id>/.sync-conflict-*` files and picks the lexicographically-greater ULID per pair, archives loser.
  - Per-machine claim namespace: `meta.claim.host` field; `sweepStaleClaims` only sweeps claims tagged with the current host. Cross-host double-claim prevention via folder atomic rename (already works on Syncthing-mediated sync because both sides race the same shared filesystem name).
- **Sprint continuity** — `josh sprint snapshot` captures the current `status.json` + `todo/` queue counts + `cost/` rollup into `~/.josh/sprints/<YYYY-MM-DD>.json`. `josh sprint resume <date>` is a no-op file-existence check that prints the snapshot — actual state is on disk; the snapshot is for human review.

### 1.8 Branch / PR strategy

**Stacked branches off `main`, one PR per phase, no waiting for human merges.**

```
main
 │
 └── claude/crazy-banzai-97d43f                    ← current; PR #2 (CRLF fix + Phase 3 plan)
      │
      └── claude/josh-phase3-enforcement           ← Phase 3 implementation; PR #3
           │
           └── claude/josh-phase4-verdict-matrix   ← Phase 4; PR #4
                │
                └── claude/josh-phase5-speculative ← Phase 5; PR #5
                     │
                     └── claude/josh-phase6-crypto ← Phase 6; PR #6
                          │
                          └── claude/josh-phase7-spec-evolver
                               │
                               └── claude/josh-phase8-cross-runtime
                                    │
                                    └── claude/josh-phase9-dashboard
                                         │
                                         └── claude/josh-phase10-multi-machine
```

Each phase branches off the previous one's HEAD. When the user merges PR #N, the branch for #N+1 stays valid (rebase if needed before `gh pr create`). I never wait for a merge before starting the next phase.

**Worktree management**: I create a new git worktree per phase under `C:/Levi/.claude/worktrees/josh-phase<N>-<short>/` so each phase has an isolated working directory. The current worktree (`crazy-banzai-97d43f`) stays as the master-design + Phase 3 staging area until Phase 3 lands, after which I'll branch from there.

**Commit cadence**: matches existing rhythm — one commit per task step in the per-phase plan (~15-20 commits per phase). No squash-merge; commits read as a TDD ladder.

### 1.9 Test infrastructure

- **Unit tests** continue to use `node:test` + `node:assert/strict` per existing pattern.
- **Per-phase smoke test** lands as `bin/josh/test/<phase-name>-smoke.test.js`.
- **Master integration test** at the end of Phase 10: `bin/josh/test/master-bm-day1.test.js` — gated behind `RUN_MASTER_INTEGRATION=1`. Imports the real BarMatrix corpus from `C:/AINC/MEV/...`, runs through Day 1's first 10 tasks under simulated agents (verdicts written by test fixtures, not real LLMs).
- **No fakes for the runtime layer**. Tests work directly with the file contract; real model invocation is exercised manually by the user.
- **Fixture line endings**: every new fixture under `bin/josh/test/fixtures/*.md` is added to `.gitattributes` with `eol=lf` (already pinned for the two existing ones). All test fixture writes use explicit `\n`.

### 1.10 Conventions (carried forward)

- All paths absolute. No `~` shorthand in code.
- All timestamps `new Date().toISOString()`.
- All writes atomic via `writeJsonAtomic` (JSON) or `tmp + rename` (other).
- All audit events via `appendAudit`.
- `JOSH_ROOT` is a const, not a function.
- File naming kebab-case under `bin/josh/lib/`.
- One axis at a time. Tests in `bin/josh/test/`.
- Each lib file stays under ~250 LOC.
- Plan documents go in `docs/superpowers/plans/2026-05-10-josh-<phase-name>.md`.

---

## 2. Phase rollout

Eight phases (3 → 10). Each section shows: inputs from previous phases, outputs this phase ships, where the per-phase plan doc lives, branch name, task count estimate, and the **definition of done** that ungates the next phase.

### 2.1 Phase 3 — Enforcement layer

- **Inputs**: Phase 2A folder layout, `transitionTodo`, `events-writer`.
- **Outputs**: `dependency-checker.js`, `backpressure.js`, `doom-loop.js`, `josh heartbeat`, wired into `cmdClaim`/`promoteApproved`/`cmdTick`.
- **Plan doc**: [docs/superpowers/plans/2026-05-10-josh-enforcement-phase3.md](2026-05-10-josh-enforcement-phase3.md) (already written).
- **Branch**: `claude/josh-phase3-enforcement` (off `claude/crazy-banzai-97d43f`).
- **Tasks**: 9.
- **Definition of done**: full test suite green, including new `enforcement-smoke.test.js` covering deps refuse → satisfy → claim, backpressure cap blocks claim, failed×3 sweeps to blocked, heartbeat extends TTL.

### 2.2 Phase 4 — Verdict matrix + calibration

- **Inputs**: Phase 3 enforcement; folder layout per todo.
- **Outputs**:
  - `bin/josh/lib/verdict-envelope.js` — `validate(envelope)` against §6.4 schema, `compute_brief_hash(briefPath)`, `read/write` helpers for `todo/<id>/verdicts/<agent>.json`.
  - `bin/josh/lib/matrix-router.js` — given a todo, return the N=3 candidate set per `routing.json` rules (capability matching). Hard ceiling `MAX_TOKENS_PER_VERDICT = 50000`.
  - `bin/josh/lib/cost-math.js` — port of Hail_Hydra `predict_tokens(agent, todo)`. Per-tier cost tables in JSON.
  - `bin/josh/lib/trigger-tokens.js` — detect `JOSH_VERDICT_REQUIRES_E08` / `JOSH_VERDICT_AUTO_ACCEPT` in verdict bodies; `auto-accept` requires `confidence >= 0.9 && risk <= medium`.
  - `bin/josh/lib/adjudicator.js` — given N envelopes, compose the E08 prompt (file artifact at `~/.josh/E08/incoming/<adj-id>.json`).
  - `bin/josh/lib/gold-set.js` — read `agents/<id>/gold/*.json`, replay against a candidate, return `{pass, fail, regression_count}`. Gold items: `{todo_minimal, expected_verdict, rubric}`.
  - `bin/josh/lib/trust.js` — rolling agreement-rate per dimension; written to `agents/<id>/trust.json`.
  - `josh verdict submit / list / show / verify-schema / matrix-status` subcommands.
  - `josh tick` step: scan `todo/in_progress/<id>/verdicts/` for candidate sets ≥ N; queue E08 adjudication; on `verdicts/winner.json` present, mark winner + archive dissent + transition `in_progress → awaiting_handoff` (sub-state inside `in_progress`, marked by presence of `winner.json`).
- **Plan doc**: `2026-05-10-josh-verdict-matrix-phase4.md`.
- **Branch**: `claude/josh-phase4-verdict-matrix`.
- **Tasks**: ~14.
- **Definition of done**: verdict-matrix-smoke test plays a 3-agent scenario with seeded envelopes, E08 adjudication, winner picked, dissent archived, trust scores updated. Replays a 50-item synthetic gold set; trust scores stable.

### 2.3 Phase 5 — Speculative parallel execution

- **Inputs**: Phase 4 verdict matrix.
- **Outputs**:
  - `bin/josh/lib/worktree.js` — `createWorktree(joshRoot, todoId, baseBranch)`, `removeWorktree(joshRoot, todoId)`. Uses `git worktree add/remove` via `child_process.execSync`. Branch name `agent/<short-todo-id>`.
  - `josh claim --speculative N <id>` — creates N worktrees, fans out N parallel claims under the same todo, writes one verdict envelope per fork, picks the winner via the existing matrix path. Cost cap enforced via `cost-math.js`.
  - Branch hygiene: `josh sweep-worktrees` removes dangling worktrees whose parent todo is in `done/` or `failed/`.
  - Tick step: `sweepWorktrees` runs after `sweepStaleClaims`.
- **Plan doc**: `2026-05-10-josh-speculative-phase5.md`.
- **Branch**: `claude/josh-phase5-speculative`.
- **Tasks**: ~8.
- **Definition of done**: smoke test runs `claim --speculative 3` against a fixture todo, three worktrees materialize, three envelopes produced, winner picked, three worktrees removed clean. Cost cap rejects speculative-4 over the per-todo budget.

### 2.4 Phase 6 — Cryptographic audit

- **Inputs**: Phase 4 verdict envelopes (the things to sign).
- **Outputs**:
  - `bin/josh/lib/canonical-json.js` — stable-key-sort serializer; covered by deterministic test cases.
  - `bin/josh/lib/jws.js` — minimal JWS-compact encode/verify for EdDSA. ~80 LOC.
  - `bin/josh/lib/identity.js` — `mintAgentIdentity(joshRoot, agentId)` (gen Ed25519 keypair, write `identity.key` 0600 + `pubkey.jwk`, derive DID), `loadAgentKeys(joshRoot, agentId)`, `agentBriefHash(joshRoot, agentId)`.
  - `bin/josh/lib/audit-chain.js` — `appendChainedAudit(joshRoot, event)` (computes HMAC over `prev_hmac || canonical(event_minus_hmac)`), `verifyChain(joshRoot, date)` returns `{valid, chain_length, errors[{position, expected, got}]}`. **Replaces** the existing `appendAudit` for new events; old plain events stay readable but verify-skip is recorded.
  - `bin/josh/lib/audit-key.js` — `mintAuditKey(joshRoot)`, `loadAuditKey(joshRoot, keyId)`, `rotateAuditKey(joshRoot)` (mints new key, appends `audit.key_rotated` event). Keys stored at `~/.josh/keys/audit-<key_id>.key` (raw 32B, 0600).
  - `bin/josh/lib/delegation.js` — issue / verify VC chains for ephemeral sub-agent verdicts.
  - CLI: `josh agent mint <id>`, `josh audit verify <date>`, `josh audit rotate-key`, `josh verdict verify <verdict-id>`.
  - Verdict envelope writer (Phase 4) is updated to sign the payload with the agent's key before write.
- **Plan doc**: `2026-05-10-josh-crypto-phase6.md`.
- **Branch**: `claude/josh-phase6-crypto`.
- **Tasks**: ~16.
- **Definition of done**: crypto-smoke test mints A03 identity, signs a sample verdict, verifies signature, tampers a single byte → verifier flags exact line, appends 50 audit events → chain verifies, rotates audit key mid-day → verifier walks across rotation cleanly. Forgery test (valid HMAC, wrong sig key) rejected.

### 2.5 Phase 7 — Spec-evolver meta-lane

- **Inputs**: Phase 4 (gold sets + trust), Phase 6 (signed verdicts so spec-evolver knows what's real).
- **Outputs**:
  - `bin/josh/lib/spec-evolver.js` — orchestrates the iteration loop. Reads agent brief, dispatches a "general-purpose Task" via the file contract (`~/.josh/orchestrator/incoming/evolve-<id>.json`), waits for the candidate brief at `~/.josh/agents/<id>/evolve-<round>/after.md`, replays gold set, records `pass_rate`, halts on convergence/regression/N=8.
  - 10-archetype catalog at `bin/josh/lib/archetypes.json` (`{1: "single_atomic_change", 2: "multi-file refactor", ...}`) — verbatim from gonzaloetjo/setup-claude-md.
  - "Removal test" in `bin/josh/lib/removal-test.js` — for each line in the brief, mark candidate-for-removal if no gold-item failure correlates with it.
  - `<NO_NEW_GAPS_FOUND>` sentinel detection in candidate Task output.
  - CLI: `josh evolve <agent-id> [--rounds N] [--dry-run]`, `josh evolve status`, `josh evolve approve <evolve-id>`, `josh evolve reject <evolve-id>`.
  - Approval drop format per spec §10.4.
  - Lessons file at `~/.josh/agents/<id>/lessons.md` — `josh lesson add <agent> "<text>"` appends with timestamp + actor.
- **Plan doc**: `2026-05-10-josh-spec-evolver-phase7.md`.
- **Branch**: `claude/josh-phase7-spec-evolver`.
- **Tasks**: ~12.
- **Definition of done**: evolve-smoke test runs 3 rounds against A01 with a synthetic gold set, halts on `<NO_NEW_GAPS_FOUND>` × 2 OR `pass_rate >= 0.95`, drops a complete approval folder, `josh evolve approve` swaps the brief and bumps `manifest.version`. Old verdicts (pre-bump) re-resolve to v1 brief by `verdict verify` reading `brief_hash` from the signed payload.

### 2.6 Phase 8 — Cross-runtime gateway

- **Inputs**: Phase 4 verdict matrix (per-agent capability set), Phase 6 signed verdicts.
- **Outputs**:
  - `bin/josh/lib/mcp-registry.js` — read/write `~/.josh/mcp/registry.json`. CLI: `josh tool register / list / show / scope-add / scope-remove`.
  - `agents/<id>/manifest.json` gains `allowed_tools: []` (default empty = full access; v1 backward-compat). `josh claim --agent A03` writes `runtime.json.allowed_tools` from the manifest.
  - `bin/josh/lib/tool-violation.js` — `recordViolation(joshRoot, todoId, agentId, tool)` appends to `~/.josh/audit/violations-<date>.jsonl` and emits a `failed` lifecycle event in the per-todo `events.ndjson`.
  - `bin/josh/lib/a2a-bridge.js` — Node HTTP server on `127.0.0.1:<JOSH_A2A_PORT>` (default 7843). Endpoints:
    - `POST /agents/register` `{id, did, pubkey_jwk, allowed_tools}` → writes a new agent manifest and identity stub.
    - `POST /tasks/sendSubscribe` `{todo_id, agent_id, sig}` → equivalent of `josh claim --agent <id>` with sig verification.
    - `GET /tasks/<id>` → returns the meta + state.
    - `GET /healthz` → `{ok: true, version}`.
  - CLI: `josh a2a serve [--port N]`, `josh a2a stop`. Server is daemonless (foreground process you `Ctrl+C` to stop, or run via Task Scheduler).
- **Plan doc**: `2026-05-10-josh-cross-runtime-phase8.md`.
- **Branch**: `claude/josh-phase8-cross-runtime`.
- **Tasks**: ~12.
- **Definition of done**: cross-runtime-smoke test starts the A2A bridge on a high port, registers a fake A2A agent, claims a todo via HTTP, completes it via HTTP, verifies `events.ndjson` has the expected lifecycle. Tool-scoping test: A03 manifest with `allowed_tools: ["fs:read"]` → `runtime.json` reflects it; a violation event surfaces an audit line when an out-of-scope tool is reported.

### 2.7 Phase 9 — Ops dashboard + cost telemetry

- **Inputs**: All prior phases.
- **Outputs**:
  - `bin/josh/lib/cost-ledger.js` — `appendCost(joshRoot, entry)`, `readCostsForMonth(joshRoot, yyyymm)`, `summarize(joshRoot, opts)` returns `{total_usd, by_agent, by_phase, by_model, run_count}`.
  - CLI: `josh cost log <args>` (called by runtimes) and `josh cost summary [--since <ISO>] [--month <YYYY-MM>] [--by agent|phase|model]`.
  - `bin/josh/lib/dashboard.js` — `renderDashboard(joshRoot, opts)` returns a multi-section text report: queue snapshot, in-flight by phase, per-agent utilization (last 24h), cost burn rate (USD/hour rolling), drift alerts.
  - `bin/josh/lib/drift-alerts.js` — `computeDriftAlerts(joshRoot)` walks last 50 verdict-matrix runs per agent, emits an alert when `same_agent + same_archetype + ≥3 disagreements_with_E08 / 10`.
  - CLI: `josh dashboard [--project <id>] [--since <ISO>]`.
- **Plan doc**: `2026-05-10-josh-dashboard-phase9.md`.
- **Branch**: `claude/josh-phase9-dashboard`.
- **Tasks**: ~9.
- **Definition of done**: dashboard-smoke seeds 30 cost entries + 50 verdict events, runs `josh dashboard`, snapshots the output, asserts every section renders and burn rate matches the seed. Drift alert fires on the seeded scenario.

### 2.8 Phase 10 — Multi-machine + sprint continuity

- **Inputs**: Phase 6 signed audit (cross-PC tamper-evidence), Phase 9 dashboard (per-PC capacity reporting).
- **Outputs**:
  - `bin/josh/lib/host.js` — `currentHost()` (returns `os.hostname()`), capacity-tag reader at `~/.josh/<host>.capacity.json` `{schema:1, host, max_concurrent, max_concurrent_per_phase, max_concurrent_per_agent}`. Used by `backpressure.js` (host-aware caps).
  - `meta.claim` gains `host` field. `sweepStaleClaims` only sweeps claims for `currentHost()`.
  - `bin/josh/lib/sync-conflict.js` — `findConflicts(joshRoot)` finds Syncthing-style `.sync-conflict-*` files, `resolveConflict(joshRoot, conflict)` picks lexicographically-greater ULID and archives loser to `~/.josh/conflicts/<date>/<id>/`.
  - CLI: `josh sync resolve [--dry-run]`, `josh sync status`.
  - `bin/josh/lib/sprint.js` — `snapshot(joshRoot, label?)` writes `~/.josh/sprints/<YYYY-MM-DD-HHmm>.json` with `{queue, costs_today, in_flight_by_agent, signed_audit_chain_tip}`. `loadSnapshot(joshRoot, file)` returns the snapshot.
  - CLI: `josh sprint snapshot [--label <s>]`, `josh sprint list`, `josh sprint show <file>`.
  - `bin/josh/lib/stignore.js` writes a `.stignore` file at `~/.josh/.stignore` listing per-host artifacts (`<host>.capacity.json`, `locks/`, `*.lock`, `*.tmp`).
- **Plan doc**: `2026-05-10-josh-multi-machine-phase10.md`.
- **Branch**: `claude/josh-phase10-multi-machine`.
- **Tasks**: ~10.
- **Definition of done**: multi-machine-smoke (single-host simulation): writes a synthetic `.sync-conflict-202605101500-host2-D1-001` file, `josh sync resolve` picks the winner deterministically (lexicographic ULID), archives loser, audit reflects it. Sprint snapshot round-trips. Per-host capacity tag overrides `backpressure.json` defaults.

---

## 3. Master integration test (the finish line)

After Phase 10 is committed, one final smoke test lands as `bin/josh/test/master-bm-day1.test.js`:

```javascript
test('master integration: BarMatrix Day 1 dispatch end-to-end', { skip: !process.env.RUN_MASTER_INTEGRATION }, async () => {
  // 1. Fresh JOSH_ROOT, init, import real BarMatrix corpus.
  // 2. Mint A01 identity.
  // 3. Walk the first 10 D1-XXX tasks: claim --agent → simulate plan submit → simulate APPROVE → tick → simulate handoff → complete.
  // 4. On at least one task, fan out verdict matrix N=3 with seeded envelopes; assert E08 winner picked + dissent archived.
  // 5. Run josh audit verify <today> → chain valid.
  // 6. Run josh dashboard → asserts all sections render with expected counts.
  // 7. josh sprint snapshot → assert file exists with right shape.
});
```

When this test passes, the master goal is reached.

---

## 4. Reverse-the-question protocol (used while autonomous)

Per `~/.claude/CLAUDE.md` and auto-memory `feedback_reverse_the_question.md`, before pausing for a human, I ask: *how would I solve this without the user?*

| Hypothetical mid-flight question | What I'll do instead |
|---|---|
| "What format does PROGRESS_TRACKER.md actually use?" | Read the file at `C:/AINC/MEV/.../PROGRESS_TRACKER.md`. |
| "Which Ed25519 export does Node 24 produce by default?" | Run `node -e "console.log(crypto.generateKeyPairSync('ed25519').publicKey.export({format:'jwk'}))"`. |
| "What does Codex's verdict envelope look like in practice?" | `where codex` → run `codex --help` + spawn a trivial codex exec to capture its output shape. |
| "Should I use `~/` or `$HOME` in this script?" | Always `os.homedir()` per existing convention (search `bin/josh/josh.js` for `homedir`). |
| "What canonical JSON does paperclip use?" | We're not paperclip; we define ours in `canonical-json.js`. Lock the algorithm and document it. |
| "Is the fixture corpus complete enough?" | Read `bin/josh/test/fixtures/corpus/` — Phase 1 already ships a small one. If insufficient, add to it (fixture additions are not "tests"; they're data). |
| "What's the right exit code for tool-scope violation?" | Spec doesn't say. Pick the safest: exit code 3 (lock-conflict family), document in `bin/josh/README.md`. |
| "Does Syncthing handle `.tmp` files cleanly?" | Add `*.tmp` to `.stignore` (already in spec §1.7). |

If a question genuinely cannot be answered from the filesystem, the codebase, the spec, or a 2-line Node REPL probe — and **only then** — I escalate via `/escalate` and stop.

---

## 5. Cross-cutting concerns

### 5.1 Backwards compatibility

- Existing flat-file readers were removed in Phase 2A. We don't re-introduce them.
- Schema versions: every new entity carries `schema: 1`. If a later phase needs a breaking change, we bump and write a one-shot migrator under `bin/josh/lib/migrators/v1-to-v2.js`. **No silent reads of older shapes.**
- Old commands (push todo, push handoff, push approval, etc.) keep working through every phase. Phase tests assert their continued behavior.

### 5.2 Error handling

- Every subcommand returns the documented exit code (0 success, 1 validation, 2 not-found, 3 lock-conflict, 4 fs-error). New conditions map onto these — no new exit codes.
- Audit writes are best-effort: a failed `appendAudit` warns but does not fail the operation, **except** for HMAC-chain audit in Phase 6+, which fails the operation if it cannot append (tamper-evidence integrity > availability).
- All `child_process.execSync` calls use `stdio: 'pipe'` and surface `e.status` / `e.stderr` on failure.

### 5.3 Performance

- Tick budget: 200ms median, 1s p99, on a `~/.josh/` with up to 1000 todo folders. Backpressure scans + doom-loop scans are O(N) directory reads — acceptable at this scale. If we hit 10K folders we'll add an in-memory index; defer until measured.
- Audit chain verify: O(lines × hash). 1M-line/year is 16 KB/sec sustained — fine.

### 5.4 Documentation cadence

- Each phase commits a doc update to `bin/josh/README.md` (feature section) and `USER-MANUAL.md` (Section 7.X subsection).
- No phase-internal documentation drift. README updates in the same PR as the feature.

### 5.5 Per-phase journal

I keep a running log at `docs/superpowers/plans/master-rollout-log.md` — append-only, one section per phase, recording: when the phase started, decisions revisited mid-flight, surprises, what shipped vs what was deferred to a later phase or to "Phase 6.5 polish."

---

## 6. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| BarMatrix integration test parses a task file the importer doesn't handle | Medium | Phase 1 already passed integration on the real corpus; add specific fixtures for edge cases as discovered. |
| Node 24 changes a `crypto` API mid-rollout | Very low | Stay on `node:crypto` core API. If broken, pin Node version in `package.json:engines`. |
| `git worktree add` fails on Windows for paths with spaces | Low | Worktree paths under `~/.josh/todo/<id>/worktree/` — no spaces. Test on this machine before shipping. |
| Phase 6 HMAC-chain change breaks Phase 1 audit reads | Medium | Phase 6 ships a one-shot migrator + back-compat read path that returns `{verified: false, reason: "pre-chain"}` for old events. |
| A2A bridge port collision with another local service | Low | Port from env, default 7843 (uncommon), `--port` flag, exit cleanly with an error message if `listen` fails. |
| Spec-evolver loops infinitely | Medium | Halt rules per §10.3 verbatim, plus a watchdog: max 8 rounds × max 30 minutes wall = 4 hour kill. |
| Total token cost during the rollout | Self-bounded | I don't invoke models during execution — I write code and run tests. Real verdicts fan-out happens when the user runs the master integration test. |
| Repo grows unwieldy | Medium | Per-phase plan docs split, lib files capped at 250 LOC, tests co-located. Phase 9 dashboard surfaces this if it happens. |
| Phase 10 needs Syncthing on at least one of the AM PCs to test cross-PC | High | Sidestepped: Phase 10 ships primitives + single-host simulation only. Real cross-PC validation is post-rollout. |

---

## 7. Definition of done — master rollout

The rollout is complete when **all of**:

1. PRs #3 through #10 are pushed to `origin` (each phase = one PR off the previous).
2. `bin/josh && node --test "test/*.test.js"` runs green on the final phase branch — every phase's smoke test included, only `master-bm-day1` and Phase 1's BarMatrix integration test gated behind env vars.
3. `RUN_MASTER_INTEGRATION=1 RUN_BARMATRIX_INTEGRATION=1 node --test test/master-bm-day1.test.js test/integration-barmatrix.test.js` run green against the real `C:/AINC/MEV/...` corpus.
4. `USER-MANUAL.md` Sections 7.16 through 7.22 (one per Phase 3-10) are filled in.
5. `bin/josh/README.md` documents every new subcommand.
6. The master rollout log at `docs/superpowers/plans/master-rollout-log.md` has a section per phase recording: shipped, deferred, surprises.

When all 6 hold, I post a summary message: `"Master rollout complete. PRs #3-#10 ready for review. Master integration test: <pass/fail>."`

If any single test fails on a phase that's already shipped to a PR, I push a fix-up commit to that PR's branch and rebase later branches as needed. **I never pretend a test passed when it didn't.**

---

## 8. Execution preamble

After committing this design, I:

1. Open PR #2 → keep open (CRLF fix + Phase 3 plan + master design).
2. Branch `claude/josh-phase3-enforcement` off the current HEAD. Move the Phase 3 plan to that branch's worktree.
3. Execute Phase 3 task-by-task per the existing plan. Push when complete; open PR #3 against `main` (not against PR #2 — PRs target main, parent-tree relationship is git-only).
4. Branch `claude/josh-phase4-verdict-matrix` off Phase 3 HEAD, write the Phase 4 plan, execute, PR #4.
5. Repeat for Phases 5, 6, 7, 8, 9, 10.
6. Land master integration test on Phase 10 branch (PR #10 includes it).
7. Post completion summary.

If the user merges PRs in the middle, later branches rebase onto `main` before opening their PR. Branch parent relationships exist for my working convenience; PR target is always `main`.

---

End of master design. Locking in. Starting Phase 3 execution.
