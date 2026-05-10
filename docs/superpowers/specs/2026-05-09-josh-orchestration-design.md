# `.josh` Multi-Agent Orchestration — Design Spec

**Status:** Draft v1 (post-research, pre-implementation)
**Date:** 2026-05-09
**Author:** Brainstorm session, Claude (anthropic-skills:superpowers:brainstorming)
**First test case:** BarMatrix 4-day full-project launch dispatch
**Substrate:** Filesystem-as-API at `~/.josh/`, Markdown corpus at `C:/AINC/MEV/` as source of truth
**Runtime mesh:** Claude Code + Codex CLI + OpenClaw + Windows Task Scheduler + human approvals

---

## 1. Mission

Build a multi-runtime agent orchestration system where:

- Agents are **folder-defined** Markdown briefs (Mission / Inputs / Outputs / Acceptance Gates / Do-Not-Do).
- Todos are **imported** from existing dispatch task files with their dependency graph intact, not re-authored.
- Verdicts accumulate from N specialists into a **verdict matrix** that feeds promotion gates.
- Calibration runs continuously via **declarative eval suites against per-agent gold sets**.
- The audit log is a **cryptographically-signed HMAC chain** of every state transition.
- Specialist verdicts can be generated **speculatively in parallel** and adjudicated by a designated evaluator.
- The system **evolves itself** — agent briefs get patched by a meta-lane that learns from systematic verdict disagreement.

The orchestrator is a **mechanical executor for a paper system that's already fully specified.** It does not invent project management; it enforces what the existing C:/AINC/MEV corpus has already documented.

## 2. Problem context

### What already exists (do not duplicate)

- **`C:/MEV/`** — MEV evolution workspace (Python framework, manual LLM queue, lessons file).
- **`C:/AINC/MEV/`** — paper orchestration system: 408 numbered dispatch tasks, 19 agent briefs (10 launch A01-A10 + 9 grading E00-E08), `PROGRESS_TRACKER.md`, `PROMOTION_REVIEW_QUEUE.md`, `SOURCE_OF_TRUTH_INDEX.md`, `AI_AUDIT_PACKET/`, full schemas in Markdown.
- **`~/.josh/` runtime** — filesystem-as-API for cooperating agents. Currently v0.9 with directory tree, status board, todo lifecycle, handoffs, approvals, reviews, locks, atomic moves, append-only audit, smart triage routing, Task Scheduler heartbeat.
- **`josh` CLI** — ~2,700 LOC Node.js, npm-linked globally. Implements push/list/show/claim/complete/fail/block/unblock/cancel for todos; push handoff/reply/ack; push approval/approve/deny; push review/review; lock acquire/release/list; tick/control; validate.

### What's missing (this spec addresses)

1. The Markdown corpus and `.josh` are not connected — `.josh` doesn't know the BarMatrix project exists.
2. Agent folders inside `.josh` don't exist; the 19 agent briefs in `C:/AINC/MEV/` aren't usable as session context.
3. Dependency declarations in dispatch task files (`Required order: after X, before Y`) are not enforced.
4. The 8-field handoff template is documented but not validated.
5. No verdict matrix; todos have a single binary done/not-done state.
6. No calibration mechanism, no per-agent trust scores, no eval suites.
7. No tamper-evident audit; the JSONL is plain text.
8. No spec-evolver; agent briefs degrade or stagnate without correction signals.
9. No multi-machine awareness for the AM 4-PC network.

## 3. Non-goals

These are deliberately out of scope:

- **A new agent runtime.** We use Claude Code + Codex + OpenClaw as-is. Not building a new CLI, not building a Python agent loop.
- **A web UI / dashboard.** Phase 9 sketches one; not in v1.
- **A general-purpose LLM framework.** Not LangGraph, not Pydantic AI, not paperclip. We borrow schemas; we don't take dependencies.
- **A visual workflow builder.** Markdown-as-spec is intentional; visual canvas would split source of truth.
- **Multi-machine coordination beyond v1.** The AM 4-PC network coordination is Phase 10. v1 is single-machine.
- **A replacement for `C:/AINC/MEV/`.** That corpus stays as source of truth. `.josh` indexes and enforces; it does not replace.

## 4. The unified concept

### 4.1 The substrate

`~/.josh/` is the runtime. Atomic file moves are the lock primitive. Append-only JSONL is the audit primitive. ULIDs are identity. UTC ISO-8601 is time. Schemas are versioned.

### 4.2 The corpus binding

The Markdown corpus at `C:/AINC/MEV/experiments/mbe_tension_matrix/` is the spec. `.josh` reads it (never writes back unless via promotion queue) and reflects it as machine-readable entities:

```
C:/AINC/MEV/experiments/mbe_tension_matrix/
  ├── FOUR_DAY_FULL_PROJECT_DISPATCH/      ──┐
  │   ├── README.md                          │ Imported by `josh project import`
  │   ├── TASK_INDEX.md                      │ → ~/.josh/projects/<id>/charter.json
  │   └── day_[1-4]_*/D[1-4]-XXX_*.md  ──────┘ → ~/.josh/todo/<ulid>/  (one folder per task)
  │
  ├── agent_orchestration/agents/
  │   ├── AGENT_01_COMMAND_CENTER.md     ────┐ Imported as references (no copy)
  │   └── ... AGENT_10                       │ → ~/.josh/agents/A01/manifest.json
  │                                          │     └── source_path: <abs>
  ├── (Presentation grading lanes E00-E08) ──┘
  │
  └── (source-of-truth docs: LAUNCH_COMMAND_CENTER.md, etc.)
                                          ↓
                                          conflict-resolution order
                                          enforced by josh at read-time
```

### 4.3 The agent folder

Each `~/.josh/agents/<agent-id>/` is:

```
~/.josh/agents/A03/
├── manifest.json              # version, source_path, capabilities, verdict.schema, budget
├── identity.enc               # OS-keychain-protected Ed25519 private key
├── pubkey.jwk                 # public key, used for verdict signature verification
├── verdict.schema.json        # Pydantic-compatible JSON schema for this agent's verdicts
├── gold/                      # calibration items: {todo, expected_verdict, rubric}
│   └── *.json
├── trust.json                 # rolling agreement-rate per dimension
├── lessons.md                 # per-agent corrections (corrections to base brief)
├── budget.json                # max tokens per claim, max wall-clock, model preference
└── (no CLAUDE.md file — pointer in manifest.json points at C:/AINC/MEV/.../AGENT_03_*.md)
```

The brief is **referenced**, not copied. When a session claims a todo for A03, the orchestrator reads `manifest.json.source_path`, then injects that file's contents as session context.

### 4.4 The todo folder

Each `~/.josh/todo/<ulid>/` is the per-task working directory:

```
~/.josh/todo/01HX.../
├── meta.json                  # imported from D1-XXX.md: day, phase, primary_role, deps, parallel_safety, priority
├── source_path                # one-line: pointer to the source dispatch task file
├── state                      # one-line: triaged|claimed|planning|awaiting_approval|approved|in_progress|done|rejected|blocked|failed
├── plan.md                    # 8-section plan (kesslerio template), generated during planning
├── plan-review.json           # readiness gate: schema_version, plan_id, ready_for_implementation, blocking_decisions
├── approval                   # absent | "pending" | "approved" | "rejected" — atomic-mv signal
├── events.ndjson              # append-only event stream (14-event taxonomy)
├── worktree/                  # git worktree on branch agent/<short-ulid>
├── verdicts/                  # if matrix-mode: one JSON per specialist
│   ├── A03.json
│   ├── A05.json
│   └── E08.json               # adjudicator's choice + dissent paths
├── handoff.md                 # final 8-field handoff
└── runtime.json               # harness, session_id, backend_ref, started_at
```

### 4.5 The audit primitive

`~/.josh/audit/YYYY-MM-DD.jsonl` is append-only, daily-rotated. Each line is one event with two cryptographic guarantees:

- **HMAC chain** (we build): `hmac_i = HMAC_SHA256(audit_key, hmac_{i-1} || canonical_json(event_minus_hmac))`. Tamper any line → break detected at exact line on `josh audit verify`.
- **Ed25519 signature** (Utopia5327 pattern): every verdict and state transition is signed by the responsible agent's key. Forge a line with valid HMAC but wrong signing key → break detected at exact line.

Both must hold for a line to be accepted at read time.

## 5. Architecture overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         User / human review                          │
└──────────────┬───────────────────────────────────────────────────────┘
               │ approves / rejects / promotes
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       ~/.josh/ runtime                               │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  status.json (queue snapshot)                                │    │
│  │  projects/<id>/  charter, milestones, agent-set snapshot     │    │
│  │  agents/<id>/    manifest, identity, gold, trust, lessons    │    │
│  │  todo/<ulid>/    state machine + plan + events + verdicts    │    │
│  │  approvals/      pending/done (atomic mv)                    │    │
│  │  reviews/        pending/done                                │    │
│  │  decisions/      promoted decisions, citation graph          │    │
│  │  audit/<date>.jsonl  HMAC-chained, signature-verified        │    │
│  │  cost/<month>.jsonl  per-claim token + wall + model + USD    │    │
│  │  shared/<project>/   dossier, lessons, brainstorm            │    │
│  └──────────────────────────────────────────────────────────────┘    │
└─────▲────────────────────▲──────────────────────────────▲────────────┘
      │ reads (no writes)  │ atomic claim                  │ heartbeat
      │                    │                                │
      │            ┌───────┴────────┐               ┌──────┴────────┐
      │            │ Claude Code    │               │ Task Scheduler │
      │            │ Codex CLI      │               │ josh tick      │
      │            │ OpenClaw       │               │ + OpenClaw cron │
      │            └────────────────┘               └────────────────┘
      │            (sessions claim todos,
      │             produce plans, await approval,
      │             execute, write handoff)
      │
┌─────┴────────────────────────────────────────────────────────────────┐
│         C:/AINC/MEV/   (Markdown corpus — source of truth)           │
│  - 408 dispatch task files                                           │
│  - 19 agent briefs (A01-A10 + E00-E08)                               │
│  - SOURCE_OF_TRUTH_INDEX, LAUNCH_COMMAND_CENTER, etc.                │
└──────────────────────────────────────────────────────────────────────┘
```

Read flow: corpus → `josh project import` → `~/.josh/` entities. Source-of-truth conflict order (`SOURCE_OF_TRUTH_INDEX.md`) honored at every read.

Write flow: agent claims todo → produces plan → awaits approval → executes → writes signed handoff → orchestrator updates audit and verdict matrix.

## 6. Core entities and schemas

All JSON entities carry `"schema": <int>` (current = 1).

### 6.1 Project

```json
{
  "schema": 1,
  "id": "01HX...",
  "title": "BarMatrix four-day full-project launch dispatch",
  "source_path": "C:/AINC/MEV/.../FOUR_DAY_FULL_PROJECT_DISPATCH/",
  "objective": "...",
  "definition_of_done": "...",
  "completion_criteria": ["...", "..."],
  "launch_modes": ["internal_stage", "marketing_launch", "controlled_founding_cohort", "no_go"],
  "agent_set_snapshot": ["A01", "A02", ..., "E08"],
  "phases": [
    {"day": 1, "phase": 1, "name": "Command Center And Sequence Lock", "todo_count": 10},
    ...
  ],
  "phase_locks": [
    {"name": "launch_definition_lock", "must_happen_before": "day_2_build", "reason": "..."},
    ...
  ],
  "imported_at": "2026-05-09T...",
  "imported_by": "cli:josh"
}
```

### 6.2 Agent manifest

```json
{
  "schema": 1,
  "id": "A03",
  "version": 1,
  "source_path": "C:/AINC/MEV/.../AGENT_03_CLAIMS_SOURCE_SAFETY.md",
  "source_path_hash": "<sha256>",
  "role_group": "claims_compliance",
  "capabilities": ["claims_review", "source_safety", "public_use_gate"],
  "verdict_schema": "verdict.schema.json",
  "budget": {"max_tokens_per_claim": 50000, "max_wall_seconds": 600, "preferred_model": "sonnet"},
  "did": "did:key:z...",
  "pubkey_path": "pubkey.jwk",
  "superseded_by": null,
  "trust_dimensions": ["legal_accuracy", "source_safety", "california", "non_affiliation"]
}
```

### 6.3 Todo (machine fields imported from `D[1-4]-XXX_*.md`)

```json
{
  "schema": 1,
  "id": "01HX...",
  "display_id": "D1-001",
  "title": "Freeze four-day launch definition",
  "source_path": "C:/AINC/MEV/.../day_1_lock_scope_and_command/D1-001_*.md",
  "project_id": "01HY...",
  "day": 1,
  "phase": 1,
  "primary_role": "A01",
  "depends_on": [{"id": "<ulid>", "kind": "hard|soft"}],
  "blocks": ["<ulid>", "..."],
  "parallel_safety": "same_phase_no_same_output",
  "priority": "p1",
  "labels": ["scope_lock", "command"],
  "verify_kind": "redacted_rollup_hash | git_diff_check | screenshot_url | tests_pass | none",
  "target_minutes": 30,
  "timeout_minutes": 90,
  "verdict_mode": "single | matrix",
  "claim": null,
  "history": [{"at": "...", "actor": "...", "event": "imported"}]
}
```

### 6.4 Verdict envelope

```json
{
  "schema": 1,
  "id": "01HX...",
  "todo_id": "01HY...",
  "agent_id": "A03",
  "agent_version": 1,
  "brief_hash": "<sha256 of source brief at time of verdict>",
  "produced_at": "2026-05-09T...",
  "payload": {
    "claim_text": "...",
    "status": "approve | hold | rewrite | reject",
    "evidence_basis": "...",
    "risk_if_accepted": "...",
    "risk_if_rejected": "...",
    "verification_required": "...",
    "human_review_needed": true,
    "blockers": [],
    "trust_dimensions": ["legal_accuracy", "source_safety"]
  },
  "confidence": 0.84,
  "sentinel": "JOSH_VERDICT_REQUIRES_E08 | JOSH_VERDICT_AUTO_ACCEPT | null",
  "cost": {"tokens_in": 4200, "tokens_out": 1100, "wall_seconds": 32, "model": "sonnet", "usd": 0.038},
  "sig": "<JWS-compact, EdDSA, kid=did:key:z...>"
}
```

### 6.5 Audit event

```json
{
  "schema": 1,
  "ulid": "01HX...",
  "ts": "2026-05-09T...",
  "actor": "A03 | cli:josh | orchestrator | human:sunnylwood",
  "kind": "verdict | action | state_transition",
  "event": "todo.claimed | verdict.signed | approval.granted | ...",
  "id": "<entity ulid this event is about>",
  "details": {...},
  "brief_hash": "<sha256>",
  "sig": "<JWS or null for non-agent events>",
  "key_id": "audit-2026-05",
  "prev_hmac": "<hex>",
  "hmac": "<hex>"
}
```

## 7. The plan-approve-execute file contract

Forged from goldmar/openclaw-code-agent + kesslerio/coding-agent-openclaw-skill. This is the canonical lifecycle for any todo.

### 7.1 State machine

```
   triaged ──claim──▶ claimed ──plan──▶ planning ──finalize──▶ awaiting_approval
                                                                        │
                                       ┌────reject──────────────────────┤
                                       │                                │
                                       ▼                       approve  │
                                  rejected                              ▼
                                  (terminal)                       approved
                                                                        │
                                                                  start │
                                                                        ▼
                                                                  in_progress
                                                                        │
                                                       handoff verified │
                                                                        ▼
                                                                       done
                                                                  (terminal)
```

Side branches:
- `awaiting_approval` → `revised` → `planning` (loop, max N revisions configurable, default 3)
- Any state → `blocked` (with `depends_on` reference)
- Any state → `failed` (with reason)
- Any state → `cancelled`

State persisted at `~/.josh/todo/<ulid>/state` (one-line file). State transitions are atomic moves of the entire todo folder between top-level state directories — preserving the existing `.josh` lock primitive.

### 7.2 Plan template (verbatim from kesslerio)

The `plan.md` file always has these 8 sections, in this order:

1. **Fast-Path** — one-paragraph summary
2. **Problem statement**
3. **Current state evidence**
4. **Proposed approach**
5. **Step-by-step change list**
6. **Risks + rollback**
7. **Test plan**
8. **Approval prompt** — literally `Reply APPROVE: <plan-id>` or `REVISE: <reason>`

Frontmatter: `{id, status: PENDING|APPROVED|REVISED, claimed_by, plan_hash}`.

The implementer skill is `disable-model-invocation: true`. It only runs when the orchestrator's cron tick observes `state=approved`. No model can self-promote a plan to execution.

### 7.3 Event taxonomy (`events.ndjson`)

14 event types, two groups:

**Lifecycle (5, kesslerio)** — emitted by the runtime around every phase:
- `start` — phase begins
- `heartbeat` — every 20s for runs > 30s
- `done` — phase exit_code 0
- `failed` — phase exit_code non-zero, non-interrupt
- `interrupted` — phase exit_code 130/143/124/137 (signals or timeout)

**Stream (9, goldmar)** — emitted during model interaction:
- `backend_ref` — `{kind: "claude-code"|"codex", conversation_id}`
- `run_started` — `{run_id}`
- `text_delta` — `{text}`
- `tool_call` — `{name, input}`
- `pending_input` — `{request_id, kind: "question"|"approval", prompt_text, options, allows_free_text}`
- `pending_input_resolved` — `{request_id}`
- `plan_artifact` — `{finalized: bool, markdown_sha256}`
- `settings_changed` — `{permission_mode}`
- `run_completed` — `{success, duration_ms, num_turns, result, approval_execution_state}`

`approval_execution_state` is critical: `awaiting_plan_output | awaiting_approval | approved_then_implemented | implemented_without_required_approval | not_plan_gated`. The fourth value is what makes audit prosecutable.

### 7.4 Approval signal — two equivalent paths

1. **Cron-friendly:** `mv ~/.josh/todo/<ulid>/approval` to write the literal string `approved`. Heartbeat picks it up next tick.
2. **Chat-friendly:** human types `APPROVE: <id>` or `REVISE: <reason>` in any chat with a guard hook configured. The guard does the mv on disk. No model-side string-matching.

The pure-function decision (port of kesslerio's `decide_approval_transition`):

```
if plan.frontmatter.status == "APPROVED":             action = none
elif approval file == "approved":                      action = approve, set status=APPROVED, state=approved
elif approval file == "rejected":                      action = reject, state=rejected
elif require_approved && missing:                      error APPROVAL_REQUIRED
else:                                                  action = prompt (escalate via /relay)
```

## 8. Verdict matrix

The fan-out + multi-specialist adjudication layer. **This is our invention** — Hail_Hydra was a router, not a fan-out. We borrow its trigger-token pattern and cost math; the matrix is original.

### 8.1 When the orchestrator fans out

Three triggers, any one fires:

1. **Explicit opt-in:** todo carries `verdict_mode: matrix` in `meta.json`.
2. **Auto on risk:** `risk: high` per `~/.josh/codebase-map.json` (Hail_Hydra-derived schema).
3. **Auto on disagreement:** single-agent verdict has `confidence < 0.7`.

### 8.2 Candidate selection

- **N=3 specialists** by default, chosen by routing rules from `~/.josh/orchestrator/routing.json` extended with capability matching.
- **Hard ceiling:** `MAX_TOKENS_PER_VERDICT = 50000` total across candidates. Predicted cost = sum of `predict_tokens(agent_i, todo)` using the ported `hydra-token-math.js` model.
- If predicted total > ceiling, prune lowest-marginal-utility candidate first.
- **Hard kill:** any single candidate exceeding 2× its predicted budget mid-flight is cancelled via Task tool abort.

### 8.3 Adjudicator

**E08 (Gold Calibrator) is the designated evaluator** — never voting. Voting fails on small N and correlated errors.

E08 receives:
- All N candidate verdicts.
- Gold-set match (if applicable).
- Per-candidate trust scores (from `agents/<id>/trust.json`).

E08 emits:
- `winner_id` (one of the N).
- `synthesis_notes` (rationale + which dissent points are non-fatal).
- `confidence` (E08's confidence in the choice).

Trust-weighting deferred to v2 once we have calibration data.

### 8.4 Outcome — pick-one with attached dissent

Winner stored at `~/.josh/todo/<ulid>/verdicts/winner.json`.
Runner-up verdicts stored at `~/.josh/todo/<ulid>/verdicts/dissent/<agent>.md` for audit.
**No frankenstein merge.** A pick-one outcome is auditable; a merged outcome is not.

### 8.5 Trigger tokens (ported from Hail_Hydra `SKILL.md:21-42`)

Specialists end output with one of:
- `⚠️ JOSH_VERDICT_REQUIRES_E08` — forces evaluator dispatch even if single-agent confidence is high.
- `✅ JOSH_VERDICT_AUTO_ACCEPT` — skip matrix; allowed only when single-agent confidence ≥ 0.9 and todo risk ≤ medium.

## 9. Signed-verdict-on-tamper-chain audit

Two layers, both required at read time.

### 9.1 HMAC chain (we build)

Each line of `~/.josh/audit/YYYY-MM-DD.jsonl` is computed as:

```
canonical = json.canonical(event_minus_hmac)
hmac_i = HMAC_SHA256(audit_key_<key_id>, prev_hmac || canonical)
```

- `audit_key` stored in `~/.josh/keys/audit-<key_id>.key`, OS-keychain-protected (DPAPI on Windows).
- Key rotation: bump `key_id`, append a key-change event `{event: "audit.key_rotated", from: "audit-2026-05", to: "audit-2026-06"}` as the first line of the new period.
- Verification: `josh audit verify <date>` — single forward pass. Returns `{valid: bool, chain_length: int, errors: [{position, expected, got}]}` (response shape borrowed from lulzasaur9192).

### 9.2 Ed25519 signing (forged from Utopia5327)

Every verdict and significant state transition is signed by the responsible agent.

- Agent identity: `~/.josh/agents/<id>/identity.enc` (OS-keychain-protected) + `pubkey.jwk` (public).
- DID: `did:key:z<base64url(pubkey.x)>`.
- Signature: JWS-compact, alg=`EdDSA`, `kid=did`, payload includes mandatory `aud: "josh:audit"` and `iat` (replay defense).
- `brief_hash: sha256(source_brief)` is part of the signed payload — binds identity to the brief version active at signing time.

### 9.3 Delegation pattern (sub-agents)

When a parent agent (e.g., A01) spawns an ephemeral sub-agent for verdict gathering, the parent signs an `authorizationChain` VC:

```json
{
  "sub": "<owner-DID>",
  "act": "<parent-DID>",
  "delegate_to": "<ephemeral-DID>",
  "scope": ["claim:<todo-id>", "verdict:produce"],
  "expires_at": "..."
}
```

The sub-agent's verdict carries this VC. Verification walks the chain.

### 9.4 Verification at read time

`josh verdict verify <verdict-id>`:

1. Locate the verdict in `audit/`.
2. Walk the HMAC chain back to the most recent `audit.key_rotated` event. Confirm chain holds.
3. Verify Ed25519 signature against the agent's `pubkey.jwk` at the brief_hash version active at signing.
4. If brief_hash doesn't match the current brief, surface as a "brief drift" warning — verdict still valid for that brief version.

Both must hold. Tamper a verdict body → HMAC breaks. Forge a verdict with valid HMAC but wrong key → signature breaks. Either failure surfaces the exact line.

## 10. Spec-evolver meta-lane

Direct transplant of gonzaloetjo/setup-claude-md, applied per-agent-brief, with our convergence-gap-filler.

### 10.1 Trigger

Three sources:

1. **Nightly cron** at 03:00 — process top-3 agents by stale-brief score (`days_since_evolve × verdict_volume`).
2. **Disagreement threshold** — when an agent loses 3 of last 10 verdict-matrix runs, queue its brief for evolution.
3. **Manual** — user runs `josh evolve <agent-id>`.

### 10.2 Iteration loop

```
for round i in 1..N (default 5, max 8, min 3):
  archetype = ARCHETYPES[((i-1) % 10) + 1]   # 10-archetype rotation, setup-claude-md catalog
  complexity = "single-todo" if i ≤ 2 else "multi-todo" if i ≤ 5 else "cross-cutting"

  spawn fresh general-purpose Task (NEVER same agent that owns the brief — bias)
    Task plans (does NOT execute) the verdict against the current brief
    Logs "frustration": every guess/assumption while planning
    Categorizes gaps: Mission | Inputs | Outputs | Acceptance | Do-Not-Do | Anti-patterns
    Rates: Critical | Helpful
    Applies "removal test" to existing brief lines
    Produces candidate v_i of AGENT_XX.md
    Replays full gold set against v_i → records pass_rate, regression_count
```

### 10.3 Halt rules (the convergence gap setup-claude-md doesn't have)

Stop early when **any** of:

1. Gold-set `pass_rate ≥ 0.95` AND meta-agent emits `<NO_NEW_GAPS_FOUND>` sentinel for 2 consecutive rounds.
2. Brief size > 250 lines after pruning (sentinel — bloating, not converging).
3. Regression detected (`pass_rate < prev_round.pass_rate`) — revert to previous round, halt.
4. N=8 hard ceiling reached.

### 10.4 Output — PR-style patch in approval queue

```
~/.josh/approvals/evolve-<agent>-<timestamp>/
  ├── before.md, after.md, diff.patch
  ├── iteration-logs/round-{i}.md
  ├── gold-replay.json (pass rate before vs after, per-archetype breakdown)
  └── approval.md (one-line summary)
```

Existing v0.9 auto-expire timer applies. Approve → mv into agent slot, version bump (`A03 v1` → `A03 v2`). Reject → archive.

**Old verdicts still resolve to v1 brief** (audit truth preserved). New verdicts use v2.

### 10.5 Per-agent lessons file

`~/.josh/agents/<id>/lessons.md` accumulates corrections specific to that agent. When an agent's verdict gets overturned by human review, the correction lands here, inherited into the next session as additional context. The spec-evolver reads this file as one of its inputs.

## 11. Cross-runtime gateway (Phase 8 sketch)

Not in v1. Sketched here for design coherence:

- MCP server registry at `~/.josh/mcp/registry.json`. All MCP servers (DuckDB, Chrome, computer-use, etc.) registered with capability declarations and auth scoping.
- `josh tool list / use / scope` — query and control tool access per agent. `agent A03 → only read_file + grep + the legal-DB MCP`. Scoping enforced at runtime.
- A2A bridge for external agents — register an A2A-compatible agent and assign it todos as if it were a local agent folder.

## 12. The 10 growth phases (refined)

| # | Phase | Key inputs from research | Definition of done |
|---:|---|---|---|
| 1 | **Substrate import** | paperclipai data model + goldmar layout | `josh project import` reads BarMatrix corpus → `josh project status` shows the same daily-review template the paper system uses; round-trip sync works. |
| 2 | **Agent dispatch** | goldmar + kesslerio (Section 7) | A single D1-001 task runs end-to-end: claim → plan → APPROVE → execute → handoff → done. Reject test passes. |
| 3 | **Enforcement layer** | cleo wave execution + ralph backpressure + ml-intern Doom Loop + langgraph interrupts | All 100 Day 1 tasks run safely across 10 phases. No collisions. No accepted handoffs without evidence. |
| 4 | **Verdict matrix + calibration** | Section 8 + promptfoo + pydantic-ai + cordum | Replay Day 1 with verdict matrix; trust scores stable after 50 verdicts; promptfoo eval suite catches a known regression. |
| 5 | **Speculative parallel execution** | Section 8 (matrix) + sandcastle worktree + agency-swarm flows | A complex public-demo selection runs speculatively N=3; cost cap respected; branch hygiene clean. |
| 6 | **Cryptographic audit** | Section 9 (HMAC + Ed25519 + delegation) | Tamper test breaks at exact line; forgery test rejected; delegation chain verifies for spawned sub-agents. |
| 7 | **Spec-evolver meta-lane** | Section 10 (gonzaloetjo + our halt rules) | After 3 BarMatrix sprints, ≥5 brief patches proposed; ≥2 approved; old verdicts still resolve to v1. |
| 8 | **Cross-runtime gateway** | MCP/servers + agentgateway + A2A + composio | A03 refused a tool not in scope; an A2A external agent claims and completes a todo. |
| 9 | **Ops dashboard + cost telemetry** | mission-control + agno + langfuse + paperclip | Dashboard answers fleet questions <1 min; cost ledger reconciles to invoice within 2%; drift alerts don't false-fire. |
| 10 | **Multi-machine + sprint continuity** | paperclip heartbeat + humanlayer ACP + our novel design | Cross-PC double-claim impossible; sprint roll-over carries state; per-PC capacity respected. |

## 13. Open questions — to resolve before each phase

| Phase | Question |
|---:|---|
| 1 | Reference-pointer or copy-and-sync for agent briefs? **Default: reference-pointer.** Decide before locking the manifest schema. |
| 2 | YAML frontmatter or Markdown sections for agent manifest? **Default: JSON manifest + Markdown brief, separate files.** |
| 4 | Pydantic AI as a soft dependency for verdict-schema validation, or roll our own JSON schema validator? **Lean Pydantic AI** for schema, no runtime adoption. |
| 5 | Speculative fan-out as opt-in only, or auto-trigger? **Opt-in for v1**, auto-trigger after 100 verdicts of cost data. |
| 6 | Key rotation cadence for HMAC and Ed25519? **Monthly HMAC, per-agent-version Ed25519.** |
| 7 | Spec-evolver runs for which agents in v1? **A01 + E00 + E08 only** (highest leverage). Expand after first cycle. |
| 8 | Adopt agentgateway as a binary, or implement scoping primitives directly in `josh`? **Build directly in `josh`** to avoid a network hop. |
| 9 | Build dashboard or use langfuse self-hosted as sidecar? **Defer until phase 9; revisit then.** |
| 10 | Sync substrate: git, Syncthing, or custom? **Lean Syncthing + ULID-tiebreaker for conflicts.** |

## 14. Repo borrowing map

For posterity. Which features come from which repos.

| Feature in our spec | Repo | What we took |
|---|---|---|
| Atomic task checkout / heartbeat | paperclipai (also our existing `.josh`) | Validation of substrate; heartbeat coalescing |
| Agent folder schema | orloj + agent-framework + goldmar | YAML/JSON keys; reference-only path pattern |
| Plan/approve/execute file contract | goldmar + kesslerio | State machine; 8-section template; event taxonomy |
| 8-section plan template | kesslerio | Verbatim |
| RUN_EVENT lifecycle | kesslerio | Verbatim (start/heartbeat/done/failed/interrupted, 20s heartbeat, 30s long-run threshold) |
| Harness 9-event taxonomy | goldmar | Verbatim (renamed for our context) |
| `approval_execution_state` enum | goldmar | Verbatim |
| Plan-don't-execute meta-rule | gonzaloetjo | Verbatim |
| 10-archetype task corpus rotation | gonzaloetjo | Verbatim |
| "Removal test" rubric | gonzaloetjo | Verbatim |
| `<NO_NEW_GAPS_FOUND>` convergence sentinel | ours | Fills gonzaloetjo gap |
| Gold-set replay regression check | ours | Fills gonzaloetjo gap |
| Verdict matrix fan-out | ours | Original — Hail_Hydra was misleading |
| Trigger tokens (`⚠️ JOSH_VERDICT_REQUIRES_E08`) | Hail_Hydra | Pattern adapted |
| Per-tier cost math | Hail_Hydra | Port of `hydra-token-math.js` |
| Auto-accept decision table | Hail_Hydra | Pattern |
| HMAC chain | ours | Original — lulzasaur was a stub |
| HMAC verify response shape | lulzasaur9192 | `{valid, chain_length, errors[{position, message}]}` |
| Ed25519 + did:key + JWS-compact + aud claim | Utopia5327 | Pattern + adaptations (OS keychain, brief_hash binding) |
| Delegation/OBO chain for sub-agents | Utopia5327 | Pattern |
| HMAC + Ed25519 layered envelope | ours | Original synthesis |
| Doom Loop Detector | ml-intern | Pattern |
| Backpressure gates | ralph-orchestrator | Pattern |
| Wave-based parallel execution | cleo | Pattern |
| Tool Confirmation HITL | adk-python | Pattern |
| Worktree isolation | sandcastle + goldmar | Pattern |
| Directional communication flows | agency-swarm | Pattern (Phase 8) |
| Declarative eval suites | promptfoo | Pattern (Phase 4) |
| Typed verdict envelopes | pydantic-ai | Pattern |
| Pre-execution policy + approvals + audit | cordum-io/cordum | Conceptual frame |
| MCP registry | modelcontextprotocol/servers | Standard |
| A2A bridge | a2aproject/A2A | Standard (Phase 8) |
| OS-keychain key storage | ours + Windows DPAPI / macOS Keychain | Replaces Utopia5327's MVP scrypt |
| Source-of-truth conflict order | C:/AINC/MEV/.../SOURCE_OF_TRUTH_INDEX.md | Existing — enforced by orchestrator |

## 15. Anti-paperclip framing — what makes this ours

| | Paperclip | This system |
|---|---|---|
| Substrate | Postgres | Filesystem (atomic mv = lock) |
| Spec source | DB-defined org chart | Markdown corpus (existing 408 tasks + 19 agent briefs) |
| Audit | Activity log table | HMAC-chained, Ed25519-signed JSONL |
| Verdict model | Single decision per ticket | Matrix of N specialists with adjudicator |
| Calibration | None | Per-agent gold sets + trust scores |
| Cross-runtime | BYO agent | Claude Code + Codex + OpenClaw first-class |
| Evolution | Manual spec edits | Spec-evolver meta-lane, learns from disagreement |
| Identity | DB user | Cryptographic per-agent signing with brief-hash binding |
| Source-of-truth conflict | DB constraints | Hierarchical Markdown precedence (existing index) |

The combination — Markdown-as-spec + filesystem-as-API + verdict matrix + signed audit + spec-evolver — does not exist in any of the 180+ repos researched. It is genuinely novel.

## 16. Implementation entry point

Phase 1 is the first thing to build. Concrete first-PR scope:

- Add `josh project import <path>` subcommand to `bin/josh/josh.js`.
- Parse `FOUR_DAY_FULL_PROJECT_DISPATCH/README.md` + `TASK_INDEX.md` + every `D[1-4]-XXX_*.md`.
- Extract dispatch metadata block (Day, Phase, Primary role, Required order, Parallel safety) into `meta.json` per todo.
- Create `~/.josh/projects/<ulid>/charter.json` from `README.md`.
- Create `~/.josh/agents/<id>/manifest.json` with `source_path` pointer to each `AGENT_XX_*.md`.
- Add `josh project status` rendering the existing daily-review template.
- Add `josh project sync` to refresh metadata when source files change.

Verification: import the BarMatrix corpus, run `josh project status`, compare against the existing `PROGRESS_TRACKER.md`. Round-trip sync test.

This unblocks every later phase.

---

**Next step after spec approval:** invoke `superpowers:writing-plans` skill to draft the Phase 1 implementation plan.
