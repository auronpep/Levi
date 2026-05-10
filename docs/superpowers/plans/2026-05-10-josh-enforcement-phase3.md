# Phase 3: `josh` enforcement layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `josh claim` refuse to acquire a todo whose hard dependencies are not yet `done`; cap concurrent `in_progress` work via a global+per-phase backpressure config; auto-block tasks that fail repeatedly (doom-loop detector); add a `josh heartbeat <id>` command that resets claim TTL and emits a `heartbeat` event. Phase 3 definition of done: a fixture corpus of D1-001 + D1-002 + D1-003 (chained deps) cannot be claimed out of order, cannot exceed the cap, and a task failed three times lands in `blocked/` automatically on the next tick.

**Architecture:** Three new pure-function lib modules (`dependency-checker.js`, `backpressure.js`, `doom-loop.js`) — each accepts `joshRoot` as a parameter and returns plain `{ok, ...}` shapes for testability. They are called from a small set of integration points in `josh.js`: `cmdClaim` (deps + backpressure), `promoteApproved` (backpressure on approved → in_progress), `cmdTick` (doom-loop sweep), and a new `cmdHeartbeat`. No changes to the state machine, no new states, no schema bumps.

**Tech Stack:** Node.js ≥18, CommonJS, `node:test`, `node:assert/strict`. Reuses existing `josh.js` helpers (`readJson`, `writeJsonAtomic`, `transitionTodo`, `appendAudit`, `defaultActor`, `resolveActor`, `parseArgs`).

**Source spec:** `docs/superpowers/specs/2026-05-09-josh-orchestration-design.md` Section 12 row 3 (Phase 3 — Enforcement layer).

**Phase 3B (deferred, NOT in this plan):** worktree isolation per claim (git worktree creation under `~/.josh/todo/<id>/worktree/`), chat-mode `APPROVE: <id>` guard hook, verification-evidence enforcement beyond the 9-field handoff (e.g. requiring a non-empty `## Verification` body that references a real artifact).

---

## Background context for implementer

### What changes from Phase 2A

Phase 2A established the plan-approve-execute lifecycle but `cmdClaim` does not consult `depends_on`, the orchestrator promotes anything in `approved/` regardless of cap, and a task failed N times stays in `failed/` until a human un-fails it. Phase 3 closes those gates without changing the state machine.

### How dependencies are stored

The Phase 1 importer wrote two parallel fields onto each todo's `meta.json`:

```json
"depends_on":              [{"id": "01HX...", "kind": "hard"}, ...],
"depends_on_display_ids":  ["D1-002"],
```

`depends_on` is the authoritative ULID-based link (used by enforcement). `depends_on_display_ids` is the display-ID copy preserved for human-readable error messages and future cross-corpus repointing. Phase 3 reads `depends_on` (filters `kind === 'hard'`) and uses `depends_on_display_ids` only when rendering error output.

A todo is "done" iff its folder lives at `~/.josh/todo/done/<ulid>/`. No content check is needed — `transitionTodo` is the only thing that puts a folder there, and it only does so via `cmdComplete`, which already validates the handoff.

### Backpressure config shape

```json
// ~/.josh/orchestrator/backpressure.json   (optional; defaults below if absent)
{
  "schema": 1,
  "max_concurrent": 10,
  "max_concurrent_per_phase": 5,
  "max_concurrent_per_agent": 2
}
```

If the file is missing, `readBackpressureConfig()` returns the defaults `{max_concurrent: 10, max_concurrent_per_phase: 5, max_concurrent_per_agent: 2}`. Unknown fields are preserved but ignored.

### Doom-loop semantics

A todo is in a doom loop when its `history` contains ≥ `MAX_FAILURES` events of `event === 'failed'` (the explicit `josh fail` action, NOT TTL sweeps — those are tracked separately as `claim_expired`). Default `MAX_FAILURES = 3`. The sweeper looks in two places:

- `~/.josh/todo/failed/<id>/` — most common case: task failed three times, now sitting in `failed/`.
- `~/.josh/todo/triaged/<id>/` — re-triaged after failure (someone manually reset state). Still doom-looped if the count hit the threshold.

When a doom loop is detected, the sweeper atomically renames the folder into `blocked/`, stamps `meta.blocked_reason = "doom-loop-detected:N"`, appends a `doom_loop_blocked` history event, writes `state` to `blocked\n`, and emits a `failed` lifecycle event (per the 14-event taxonomy) into `events.ndjson`.

### Heartbeat semantics

`josh heartbeat <id>` is a no-op move (the todo stays in its current state) that:

1. Resets `meta.claim.at` to `now` (so `sweepStaleClaims` won't expire it for another full TTL).
2. Appends `{event: 'heartbeat', actor, at}` to `meta.history`.
3. Appends a `{kind: 'heartbeat', actor, at}` line to the per-todo `events.ndjson`.

Allowed source states: `claimed`, `planning`, `awaiting_approval`, `in_progress`. (Approved is excluded — once approved, the orchestrator drives promotion; the agent shouldn't keep heart-beating an idle todo.)

### Conventions to follow

- All paths absolute. No `~` shorthand in code.
- All timestamps `new Date().toISOString()`.
- All writes atomic: `writeJsonAtomic()` for JSON, `tmp + rename` for the `state` file.
- All audit events via `appendAudit()`.
- `JOSH_ROOT` is a **`const`** in `josh.js`. Use `JOSH_ROOT` (no parens). Lib files take `joshRoot` as a parameter — never read env directly.
- File naming under `bin/josh/lib/` is kebab-case.
- Tests live in `bin/josh/test/`. Fixture files in `bin/josh/test/fixtures/` (already pinned to LF via `.gitattributes`).

---

## File structure

| File | Purpose | New / modify |
|---|---|---|
| `bin/josh/lib/dependency-checker.js` | `checkDependencies(joshRoot, todo)` → `{ok, blocked_by[]}` | New |
| `bin/josh/lib/backpressure.js` | `readBackpressureConfig(joshRoot)`, `countInProgress(joshRoot)`, `countInProgressForPhase(joshRoot, phase)`, `countInProgressForAgent(joshRoot, agentId)`, `checkBackpressure(joshRoot, todo)` | New |
| `bin/josh/lib/doom-loop.js` | `countFailureEvents(todo)`, `detectDoomLoop(todo, maxFailures)`, `sweepDoomLoops(joshRoot, opts)` | New |
| `bin/josh/josh.js` | Wire deps + backpressure into `cmdClaim`; wire backpressure into `promoteApproved`; add `cmdHeartbeat` + dispatch case; wire `sweepDoomLoops` into `cmdTick` | Modify |
| `bin/josh/test/dependency-checker.test.js` | Unit tests for dependency-checker | New |
| `bin/josh/test/backpressure.test.js` | Unit tests for backpressure | New |
| `bin/josh/test/doom-loop.test.js` | Unit tests for doom-loop | New |
| `bin/josh/test/enforcement-smoke.test.js` | End-to-end: deps refuse → satisfy → claim → backpressure cap → doom-loop sweep | New |
| `bin/josh/README.md` | Document `josh heartbeat`, backpressure config, doom-loop policy, dependency enforcement | Modify |
| `USER-MANUAL.md` (root) | Add Section 7.16 for the enforcement layer | Modify |

Each lib file stays under ~150 LOC. Tests are co-located in `bin/josh/test/`.

---

## Task 1: `dependency-checker.js` — checkDependencies

**Files:**
- Create: `bin/josh/lib/dependency-checker.js`
- Create: `bin/josh/test/dependency-checker.test.js`

- [ ] **Step 1: Write the failing test**

Create `bin/josh/test/dependency-checker.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { checkDependencies } = require('../lib/dependency-checker');

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-dep-'));
  for (const s of ['triaged', 'in_progress', 'done', 'failed', 'blocked']) {
    fs.mkdirSync(path.join(root, 'todo', s), { recursive: true });
  }
  return root;
}

function seedTodo(root, state, id, meta) {
  const dir = path.join(root, 'todo', state, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ id, ...meta }, null, 2));
  fs.writeFileSync(path.join(dir, 'state'), state + '\n');
}

test('checkDependencies: ok when no deps', () => {
  const root = makeRoot();
  const r = checkDependencies(root, { id: '01A', depends_on: [] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.blocked_by, []);
  fs.rmSync(root, { recursive: true, force: true });
});

test('checkDependencies: ok when all hard deps are in done/', () => {
  const root = makeRoot();
  seedTodo(root, 'done', '01DEP1', { display_id: 'D1-001' });
  seedTodo(root, 'done', '01DEP2', { display_id: 'D1-002' });
  const todo = {
    id: '01A',
    depends_on: [{ id: '01DEP1', kind: 'hard' }, { id: '01DEP2', kind: 'hard' }],
    depends_on_display_ids: ['D1-001', 'D1-002'],
  };
  const r = checkDependencies(root, todo);
  assert.equal(r.ok, true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('checkDependencies: blocked when a hard dep is in triaged/', () => {
  const root = makeRoot();
  seedTodo(root, 'done',    '01DEP1', { display_id: 'D1-001' });
  seedTodo(root, 'triaged', '01DEP2', { display_id: 'D1-002' });
  const todo = {
    id: '01A',
    depends_on: [{ id: '01DEP1', kind: 'hard' }, { id: '01DEP2', kind: 'hard' }],
    depends_on_display_ids: ['D1-001', 'D1-002'],
  };
  const r = checkDependencies(root, todo);
  assert.equal(r.ok, false);
  assert.equal(r.blocked_by.length, 1);
  assert.equal(r.blocked_by[0].id, '01DEP2');
  assert.equal(r.blocked_by[0].display_id, 'D1-002');
  assert.equal(r.blocked_by[0].state, 'triaged');
  fs.rmSync(root, { recursive: true, force: true });
});

test('checkDependencies: ignores soft deps', () => {
  const root = makeRoot();
  seedTodo(root, 'triaged', '01SOFT', { display_id: 'D1-009' });
  const todo = {
    id: '01A',
    depends_on: [{ id: '01SOFT', kind: 'soft' }],
    depends_on_display_ids: ['D1-009'],
  };
  const r = checkDependencies(root, todo);
  assert.equal(r.ok, true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('checkDependencies: dep not found anywhere → reported as state=missing', () => {
  const root = makeRoot();
  const todo = {
    id: '01A',
    depends_on: [{ id: '01GHOST', kind: 'hard' }],
    depends_on_display_ids: ['D1-999'],
  };
  const r = checkDependencies(root, todo);
  assert.equal(r.ok, false);
  assert.equal(r.blocked_by[0].state, 'missing');
  assert.equal(r.blocked_by[0].display_id, 'D1-999');
  fs.rmSync(root, { recursive: true, force: true });
});

test('checkDependencies: missing depends_on field treated as no deps', () => {
  const root = makeRoot();
  const r = checkDependencies(root, { id: '01A' });
  assert.equal(r.ok, true);
  fs.rmSync(root, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bin/josh && node --test test/dependency-checker.test.js`
Expected: FAIL — `Cannot find module '../lib/dependency-checker'`.

- [ ] **Step 3: Write minimal implementation**

Create `bin/josh/lib/dependency-checker.js`:

```javascript
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ALL_LIVE_STATES = [
  'incoming', 'triaged', 'claimed', 'planning', 'awaiting_approval',
  'approved', 'rejected', 'revised', 'in_progress', 'done',
  'blocked', 'failed', 'cancelled',
];

function findState(joshRoot, depId) {
  for (const s of ALL_LIVE_STATES) {
    if (fs.existsSync(path.join(joshRoot, 'todo', s, depId))) return s;
  }
  return 'missing';
}

function readDisplayId(joshRoot, depId, state) {
  if (state === 'missing') return null;
  const metaPath = path.join(joshRoot, 'todo', state, depId, 'meta.json');
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    return meta.display_id || null;
  } catch (e) {
    return null;
  }
}

function checkDependencies(joshRoot, todo) {
  const deps = Array.isArray(todo && todo.depends_on) ? todo.depends_on : [];
  const displayIds = Array.isArray(todo && todo.depends_on_display_ids) ? todo.depends_on_display_ids : [];
  const blocked_by = [];
  for (let i = 0; i < deps.length; i++) {
    const dep = deps[i];
    if (!dep || dep.kind === 'soft') continue;
    const state = findState(joshRoot, dep.id);
    if (state === 'done') continue;
    const display_id = readDisplayId(joshRoot, dep.id, state) || displayIds[i] || dep.id.slice(-6);
    blocked_by.push({ id: dep.id, display_id, state });
  }
  return { ok: blocked_by.length === 0, blocked_by };
}

module.exports = { checkDependencies, ALL_LIVE_STATES };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd bin/josh && node --test test/dependency-checker.test.js`
Expected: 6 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add bin/josh/lib/dependency-checker.js bin/josh/test/dependency-checker.test.js
git commit -m "feat(josh): add dependency-checker (hard-dep enforcement)"
```

---

## Task 2: Wire `checkDependencies` into `josh claim`

**Files:**
- Modify: `bin/josh/josh.js`
- Modify: `bin/josh/test/josh-cli-folder-layout.test.js` (append a CLI test)

- [ ] **Step 1: Write the failing CLI test**

Append to `bin/josh/test/josh-cli-folder-layout.test.js`:

```javascript
test('cli: claim refuses when hard dep is not done', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-claim-dep-'));
  const env = { ...process.env, JOSH_ROOT: tmpRoot };
  execSync(`node "${joshBin}" init`, { env, stdio: 'pipe' });

  // Seed: agent A01 manifest (so --agent path works)
  const agentDir = path.join(tmpRoot, 'agents', 'A01');
  fs.mkdirSync(agentDir, { recursive: true });
  const briefPath = path.join(agentDir, 'brief.md');
  fs.writeFileSync(briefPath, '# Agent A01\n');
  fs.writeFileSync(path.join(agentDir, 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A01', source_path: briefPath,
  }, null, 2));

  // Seed two todos: D1-002 in triaged, D1-003 in triaged depending on D1-002
  function seedTriaged(id, meta) {
    const dir = path.join(tmpRoot, 'todo', 'triaged', id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({
      schema: 1, id, primary_role: 'A01', history: [], ...meta,
    }, null, 2));
    fs.writeFileSync(path.join(dir, 'state'), 'triaged\n');
    fs.writeFileSync(path.join(dir, 'events.ndjson'), '');
  }
  seedTriaged('01DEP002', { display_id: 'D1-002', depends_on: [], depends_on_display_ids: [] });
  seedTriaged('01DEP003', {
    display_id: 'D1-003',
    depends_on: [{ id: '01DEP002', kind: 'hard' }],
    depends_on_display_ids: ['D1-002'],
  });

  // Attempt to claim D1-003 while D1-002 is still triaged.
  let exitCode = 0; let stderrOut = '';
  try {
    execSync(`node "${joshBin}" claim 01DEP003 --agent A01 --as A01`, { env, stdio: 'pipe' });
  } catch (e) {
    exitCode = e.status;
    stderrOut = e.stderr.toString();
  }
  assert.equal(exitCode, 3, `expected exit 3, got ${exitCode}; stderr: ${stderrOut}`);
  assert.match(stderrOut, /D1-002/);
  assert.match(stderrOut, /dependencies/i);

  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test('cli: claim succeeds once hard dep is done', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-claim-deps-ok-'));
  const env = { ...process.env, JOSH_ROOT: tmpRoot };
  execSync(`node "${joshBin}" init`, { env, stdio: 'pipe' });

  // Seed agent A01
  const agentDir = path.join(tmpRoot, 'agents', 'A01');
  fs.mkdirSync(agentDir, { recursive: true });
  const briefPath = path.join(agentDir, 'brief.md');
  fs.writeFileSync(briefPath, '# Agent A01\n');
  fs.writeFileSync(path.join(agentDir, 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A01', source_path: briefPath,
  }, null, 2));

  // Seed D1-002 in done/, D1-003 in triaged/ depending on D1-002
  function seed(state, id, meta) {
    const dir = path.join(tmpRoot, 'todo', state, id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({
      schema: 1, id, primary_role: 'A01', history: [], ...meta,
    }, null, 2));
    fs.writeFileSync(path.join(dir, 'state'), state + '\n');
    fs.writeFileSync(path.join(dir, 'events.ndjson'), '');
  }
  seed('done',    '01DEP002', { display_id: 'D1-002' });
  seed('triaged', '01DEP003', {
    display_id: 'D1-003',
    depends_on: [{ id: '01DEP002', kind: 'hard' }],
    depends_on_display_ids: ['D1-002'],
  });

  const out = execSync(`node "${joshBin}" claim 01DEP003 --agent A01 --as A01`, { env }).toString();
  assert.match(out, /01DEP003/);
  assert.equal(fs.existsSync(path.join(tmpRoot, 'todo', 'claimed', '01DEP003', 'meta.json')), true);

  fs.rmSync(tmpRoot, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bin/josh && node --test test/josh-cli-folder-layout.test.js`
Expected: the new "claim refuses when hard dep is not done" test FAILS — `josh claim` succeeds even though `D1-002` is in `triaged/`.

- [ ] **Step 3: Write the implementation**

In `bin/josh/josh.js`, find the `cmdClaim(args)` function. Two integration points: the `--agent` (dispatch) path and the legacy path. Add a single dependency check that runs after locating the todo, before `transitionTodo`.

Locate the line near the top of `cmdClaim` that says:

```javascript
  const agentId = parsed.values.agent || null;

  // If --agent given, take the dispatch path (triaged → claimed) with brief injection.
  if (agentId) {
    // Pre-flight: locate, check primary_role.
    const located = locateTodo(idArg, ['triaged']);
    if (located.error) return errExit(located.error, located.code);
    const todo = readJson(located.path);
    if (!todo) return errExit(`malformed todo at ${located.relative}`, 4);
    if (todo.primary_role !== agentId) {
      return errExit(`todo primary_role is '${todo.primary_role || '<unset>'}', expected '${agentId}'`, 1);
    }
```

Immediately after the `primary_role` check, add the dependency check:

```javascript
    // Phase 3: hard-dep enforcement.
    const { checkDependencies } = require('./lib/dependency-checker');
    const dep = checkDependencies(JOSH_ROOT, todo);
    if (!dep.ok) {
      const list = dep.blocked_by.map((b) => `${b.display_id}(${b.state})`).join(', ');
      return errExit(`dependencies not yet done: ${list}`, 3);
    }
```

For the legacy path (the `if (agentId) { ... }` branch's tail), find the `// Backward-compatible path: triaged → in_progress (no --agent).` comment and insert the same check before `transitionTodo`:

```javascript
  // Backward-compatible path: triaged → in_progress (no --agent).
  // Phase 3: hard-dep enforcement also applies here.
  {
    const located = locateTodo(idArg, ['triaged']);
    if (located.error) return errExit(located.error, located.code);
    const todo = readJson(located.path);
    if (!todo) return errExit(`malformed todo at ${located.relative}`, 4);
    const { checkDependencies } = require('./lib/dependency-checker');
    const dep = checkDependencies(JOSH_ROOT, todo);
    if (!dep.ok) {
      const list = dep.blocked_by.map((b) => `${b.display_id}(${b.state})`).join(', ');
      return errExit(`dependencies not yet done: ${list}`, 3);
    }
  }

  const r = transitionTodo({
    srcStates: ['triaged'],
    dst: 'in_progress',
    idOrSuffix: idArg,
    actor,
    eventName: 'claimed',
    eventDetails: { ttl_sec: ttlSec },
    update: (todo, now) => {
      todo.claim = { by: actor, at: now, ttl_sec: ttlSec };
    },
    audit: { action: 'todo.claimed', details: { ttl_sec: ttlSec } }
  });
```

(The pre-locate is a small duplication of the work done inside `transitionTodo`, but it's the cleanest way to inject a check without rewriting `transitionTodo`'s signature. The cost is one extra directory walk per claim — acceptable.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd bin/josh && node --test test/josh-cli-folder-layout.test.js`
Expected: both new tests pass; existing tests still pass.

Run the full suite: `cd bin/josh && node --test "test/*.test.js"`
Expected: 0 failures.

- [ ] **Step 5: Commit**

```bash
git add bin/josh/josh.js bin/josh/test/josh-cli-folder-layout.test.js
git commit -m "feat(josh): claim refuses when hard deps not done (exit code 3)"
```

---

## Task 3: `backpressure.js` — config + checker

**Files:**
- Create: `bin/josh/lib/backpressure.js`
- Create: `bin/josh/test/backpressure.test.js`

- [ ] **Step 1: Write the failing test**

Create `bin/josh/test/backpressure.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  readBackpressureConfig,
  checkBackpressure,
  countInProgress,
  countInProgressForPhase,
  countInProgressForAgent,
  DEFAULTS,
} = require('../lib/backpressure');

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-bp-'));
  fs.mkdirSync(path.join(root, 'orchestrator'), { recursive: true });
  fs.mkdirSync(path.join(root, 'todo', 'in_progress'), { recursive: true });
  return root;
}

function seedInProgress(root, id, meta = {}) {
  const dir = path.join(root, 'todo', 'in_progress', id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ id, ...meta }, null, 2));
}

test('readBackpressureConfig: defaults when file absent', () => {
  const root = makeRoot();
  const cfg = readBackpressureConfig(root);
  assert.equal(cfg.max_concurrent, DEFAULTS.max_concurrent);
  assert.equal(cfg.max_concurrent_per_phase, DEFAULTS.max_concurrent_per_phase);
  assert.equal(cfg.max_concurrent_per_agent, DEFAULTS.max_concurrent_per_agent);
  fs.rmSync(root, { recursive: true, force: true });
});

test('readBackpressureConfig: file overrides defaults', () => {
  const root = makeRoot();
  fs.writeFileSync(
    path.join(root, 'orchestrator', 'backpressure.json'),
    JSON.stringify({ schema: 1, max_concurrent: 99, max_concurrent_per_phase: 7 })
  );
  const cfg = readBackpressureConfig(root);
  assert.equal(cfg.max_concurrent, 99);
  assert.equal(cfg.max_concurrent_per_phase, 7);
  // unspecified field still gets default
  assert.equal(cfg.max_concurrent_per_agent, DEFAULTS.max_concurrent_per_agent);
  fs.rmSync(root, { recursive: true, force: true });
});

test('countInProgress: counts top-level folders only', () => {
  const root = makeRoot();
  seedInProgress(root, '01A');
  seedInProgress(root, '01B');
  seedInProgress(root, '01C');
  assert.equal(countInProgress(root), 3);
  fs.rmSync(root, { recursive: true, force: true });
});

test('countInProgressForPhase: filters by meta.phase', () => {
  const root = makeRoot();
  seedInProgress(root, '01A', { phase: 1 });
  seedInProgress(root, '01B', { phase: 1 });
  seedInProgress(root, '01C', { phase: 2 });
  assert.equal(countInProgressForPhase(root, 1), 2);
  assert.equal(countInProgressForPhase(root, 2), 1);
  fs.rmSync(root, { recursive: true, force: true });
});

test('countInProgressForAgent: filters by meta.primary_role', () => {
  const root = makeRoot();
  seedInProgress(root, '01A', { primary_role: 'A01' });
  seedInProgress(root, '01B', { primary_role: 'A01' });
  seedInProgress(root, '01C', { primary_role: 'A03' });
  assert.equal(countInProgressForAgent(root, 'A01'), 2);
  assert.equal(countInProgressForAgent(root, 'A03'), 1);
  fs.rmSync(root, { recursive: true, force: true });
});

test('checkBackpressure: ok under all caps', () => {
  const root = makeRoot();
  seedInProgress(root, '01A', { phase: 1, primary_role: 'A01' });
  const r = checkBackpressure(root, { phase: 1, primary_role: 'A01' });
  assert.equal(r.ok, true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('checkBackpressure: hits global cap', () => {
  const root = makeRoot();
  fs.writeFileSync(
    path.join(root, 'orchestrator', 'backpressure.json'),
    JSON.stringify({ schema: 1, max_concurrent: 2 })
  );
  seedInProgress(root, '01A');
  seedInProgress(root, '01B');
  const r = checkBackpressure(root, { phase: 1, primary_role: 'A01' });
  assert.equal(r.ok, false);
  assert.equal(r.scope, 'global');
  assert.equal(r.current, 2);
  assert.equal(r.max, 2);
  fs.rmSync(root, { recursive: true, force: true });
});

test('checkBackpressure: hits per-phase cap', () => {
  const root = makeRoot();
  fs.writeFileSync(
    path.join(root, 'orchestrator', 'backpressure.json'),
    JSON.stringify({ schema: 1, max_concurrent_per_phase: 1 })
  );
  seedInProgress(root, '01A', { phase: 1 });
  const r = checkBackpressure(root, { phase: 1, primary_role: 'A01' });
  assert.equal(r.ok, false);
  assert.equal(r.scope, 'phase');
  assert.equal(r.current, 1);
  assert.equal(r.max, 1);
  fs.rmSync(root, { recursive: true, force: true });
});

test('checkBackpressure: hits per-agent cap', () => {
  const root = makeRoot();
  fs.writeFileSync(
    path.join(root, 'orchestrator', 'backpressure.json'),
    JSON.stringify({ schema: 1, max_concurrent_per_agent: 1 })
  );
  seedInProgress(root, '01A', { phase: 2, primary_role: 'A01' });
  const r = checkBackpressure(root, { phase: 1, primary_role: 'A01' });
  assert.equal(r.ok, false);
  assert.equal(r.scope, 'agent');
  fs.rmSync(root, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bin/josh && node --test test/backpressure.test.js`
Expected: FAIL — `Cannot find module '../lib/backpressure'`.

- [ ] **Step 3: Write minimal implementation**

Create `bin/josh/lib/backpressure.js`:

```javascript
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULTS = Object.freeze({
  max_concurrent: 10,
  max_concurrent_per_phase: 5,
  max_concurrent_per_agent: 2,
});

function readBackpressureConfig(joshRoot) {
  const cfgPath = path.join(joshRoot, 'orchestrator', 'backpressure.json');
  if (!fs.existsSync(cfgPath)) return { ...DEFAULTS };
  try {
    const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    return { ...DEFAULTS, ...raw };
  } catch (e) {
    return { ...DEFAULTS };
  }
}

function listInProgressFolders(joshRoot) {
  const dir = path.join(joshRoot, 'todo', 'in_progress');
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch (e) {
    return [];
  }
}

function readMeta(joshRoot, id) {
  const p = path.join(joshRoot, 'todo', 'in_progress', id, 'meta.json');
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

function countInProgress(joshRoot) {
  return listInProgressFolders(joshRoot).length;
}

function countInProgressForPhase(joshRoot, phase) {
  let n = 0;
  for (const id of listInProgressFolders(joshRoot)) {
    const m = readMeta(joshRoot, id);
    if (m && m.phase === phase) n++;
  }
  return n;
}

function countInProgressForAgent(joshRoot, agentId) {
  let n = 0;
  for (const id of listInProgressFolders(joshRoot)) {
    const m = readMeta(joshRoot, id);
    if (m && m.primary_role === agentId) n++;
  }
  return n;
}

function checkBackpressure(joshRoot, todo) {
  const cfg = readBackpressureConfig(joshRoot);

  const totalCurrent = countInProgress(joshRoot);
  if (totalCurrent >= cfg.max_concurrent) {
    return {
      ok: false,
      scope: 'global',
      reason: `global in_progress cap reached: ${totalCurrent}/${cfg.max_concurrent}`,
      current: totalCurrent,
      max: cfg.max_concurrent,
    };
  }

  if (todo && todo.phase != null) {
    const phaseCurrent = countInProgressForPhase(joshRoot, todo.phase);
    if (phaseCurrent >= cfg.max_concurrent_per_phase) {
      return {
        ok: false,
        scope: 'phase',
        reason: `phase ${todo.phase} cap reached: ${phaseCurrent}/${cfg.max_concurrent_per_phase}`,
        current: phaseCurrent,
        max: cfg.max_concurrent_per_phase,
      };
    }
  }

  if (todo && todo.primary_role) {
    const agentCurrent = countInProgressForAgent(joshRoot, todo.primary_role);
    if (agentCurrent >= cfg.max_concurrent_per_agent) {
      return {
        ok: false,
        scope: 'agent',
        reason: `agent ${todo.primary_role} cap reached: ${agentCurrent}/${cfg.max_concurrent_per_agent}`,
        current: agentCurrent,
        max: cfg.max_concurrent_per_agent,
      };
    }
  }

  return { ok: true };
}

module.exports = {
  DEFAULTS,
  readBackpressureConfig,
  countInProgress,
  countInProgressForPhase,
  countInProgressForAgent,
  checkBackpressure,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd bin/josh && node --test test/backpressure.test.js`
Expected: 9 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add bin/josh/lib/backpressure.js bin/josh/test/backpressure.test.js
git commit -m "feat(josh): add backpressure (global + per-phase + per-agent caps)"
```

---

## Task 4: Wire backpressure into `cmdClaim` and `promoteApproved`

**Files:**
- Modify: `bin/josh/josh.js`
- Modify: `bin/josh/test/josh-cli-folder-layout.test.js`

- [ ] **Step 1: Write the failing CLI test**

Append to `bin/josh/test/josh-cli-folder-layout.test.js`:

```javascript
test('cli: claim refuses when global backpressure cap is hit', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-bp-claim-'));
  const env = { ...process.env, JOSH_ROOT: tmpRoot };
  execSync(`node "${joshBin}" init`, { env, stdio: 'pipe' });

  // Cap = 1 global.
  fs.writeFileSync(
    path.join(tmpRoot, 'orchestrator', 'backpressure.json'),
    JSON.stringify({ schema: 1, max_concurrent: 1 })
  );

  // One in_progress to fill the cap.
  const dirA = path.join(tmpRoot, 'todo', 'in_progress', '01A');
  fs.mkdirSync(dirA, { recursive: true });
  fs.writeFileSync(path.join(dirA, 'meta.json'), JSON.stringify({
    schema: 1, id: '01A', primary_role: 'A02',
  }));
  fs.writeFileSync(path.join(dirA, 'state'), 'in_progress\n');

  // Triaged candidate to claim with legacy path (no --agent).
  const dirB = path.join(tmpRoot, 'todo', 'triaged', '01B');
  fs.mkdirSync(dirB, { recursive: true });
  fs.writeFileSync(path.join(dirB, 'meta.json'), JSON.stringify({
    schema: 1, id: '01B', primary_role: 'A01', history: [],
  }));
  fs.writeFileSync(path.join(dirB, 'state'), 'triaged\n');
  fs.writeFileSync(path.join(dirB, 'events.ndjson'), '');

  let exitCode = 0; let stderrOut = '';
  try {
    execSync(`node "${joshBin}" claim 01B --as A01`, { env, stdio: 'pipe' });
  } catch (e) {
    exitCode = e.status;
    stderrOut = e.stderr.toString();
  }
  assert.equal(exitCode, 3, `expected exit 3, got ${exitCode}; stderr: ${stderrOut}`);
  assert.match(stderrOut, /backpressure/i);
  // Sanity: 01B must NOT have moved to in_progress.
  assert.equal(fs.existsSync(path.join(tmpRoot, 'todo', 'in_progress', '01B')), false);
  assert.equal(fs.existsSync(path.join(tmpRoot, 'todo', 'triaged', '01B')), true);

  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test('cli: tick refuses to promote approved → in_progress when backpressure full', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-bp-tick-'));
  const env = { ...process.env, JOSH_ROOT: tmpRoot };
  execSync(`node "${joshBin}" init`, { env, stdio: 'pipe' });

  fs.writeFileSync(
    path.join(tmpRoot, 'orchestrator', 'backpressure.json'),
    JSON.stringify({ schema: 1, max_concurrent: 1 })
  );

  // Fill cap with one in_progress.
  const dirA = path.join(tmpRoot, 'todo', 'in_progress', '01A');
  fs.mkdirSync(dirA, { recursive: true });
  fs.writeFileSync(path.join(dirA, 'meta.json'), JSON.stringify({ schema: 1, id: '01A' }));
  fs.writeFileSync(path.join(dirA, 'state'), 'in_progress\n');

  // Approved candidate with approval=approved signal — would normally promote.
  const dirB = path.join(tmpRoot, 'todo', 'approved', '01B');
  fs.mkdirSync(dirB, { recursive: true });
  fs.writeFileSync(path.join(dirB, 'meta.json'), JSON.stringify({
    schema: 1, id: '01B', primary_role: 'A01', history: [],
  }));
  fs.writeFileSync(path.join(dirB, 'state'), 'approved\n');
  fs.writeFileSync(path.join(dirB, 'approval'), 'approved');
  fs.writeFileSync(path.join(dirB, 'events.ndjson'), '');

  execSync(`node "${joshBin}" tick`, { env, stdio: 'pipe' });

  // 01B should still be in approved/ (cap was full).
  assert.equal(fs.existsSync(path.join(tmpRoot, 'todo', 'approved', '01B')), true);
  assert.equal(fs.existsSync(path.join(tmpRoot, 'todo', 'in_progress', '01B')), false);

  fs.rmSync(tmpRoot, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bin/josh && node --test test/josh-cli-folder-layout.test.js`
Expected: both new backpressure tests FAIL — `claim` succeeds despite cap, `tick` promotes despite cap.

- [ ] **Step 3: Write the implementation — `cmdClaim`**

In `bin/josh/josh.js` `cmdClaim`, after each existing `checkDependencies` block (Task 2 added two of them — one in the `--agent` branch, one in the legacy branch), add a backpressure check.

For the `--agent` (dispatch) branch — the destination is `claimed/`, NOT `in_progress/`, so backpressure is advisory. We still want to surface it early, so check it but only against the global+phase scope (skip agent scope since the agent isn't in_progress yet by definition):

```javascript
    // Phase 3: backpressure — advisory check at claim time so the agent learns early.
    {
      const { checkBackpressure } = require('./lib/backpressure');
      const bp = checkBackpressure(JOSH_ROOT, todo);
      if (!bp.ok && (bp.scope === 'global' || bp.scope === 'phase')) {
        return errExit(`backpressure: ${bp.reason}`, 3);
      }
    }
```

For the legacy branch (no `--agent`), the destination is `in_progress/` directly, so all three scopes apply:

```javascript
  // Backward-compatible path: triaged → in_progress (no --agent).
  // Phase 3: hard-dep enforcement also applies here.
  {
    const located = locateTodo(idArg, ['triaged']);
    if (located.error) return errExit(located.error, located.code);
    const todo = readJson(located.path);
    if (!todo) return errExit(`malformed todo at ${located.relative}`, 4);
    const { checkDependencies } = require('./lib/dependency-checker');
    const dep = checkDependencies(JOSH_ROOT, todo);
    if (!dep.ok) {
      const list = dep.blocked_by.map((b) => `${b.display_id}(${b.state})`).join(', ');
      return errExit(`dependencies not yet done: ${list}`, 3);
    }
    const { checkBackpressure } = require('./lib/backpressure');
    const bp = checkBackpressure(JOSH_ROOT, todo);
    if (!bp.ok) return errExit(`backpressure: ${bp.reason}`, 3);
  }
```

- [ ] **Step 4: Write the implementation — `promoteApproved`**

In `bin/josh/josh.js`, find `function promoteApproved()` (around line 671). The current loop reads each approved folder, checks the `approval` signal, then calls `moveTodo(metaPath, 'in_progress', todo)`. Add a backpressure gate before the move:

```javascript
function promoteApproved() {
  let promoted = 0;
  let throttled = 0;
  const dir = path.join(JOSH_ROOT, 'todo', 'approved');
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return { promoted, throttled }; }
  const { checkBackpressure } = require('./lib/backpressure');
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const id = e.name;
    const folder = path.join(dir, id);
    // Confirm approval signal == "approved" before promoting.
    const signalPath = path.join(folder, 'approval');
    let signal = '';
    try { signal = fs.readFileSync(signalPath, 'utf8').trim(); } catch (err) {}
    if (signal !== 'approved') continue;
    const metaPath = path.join(folder, 'meta.json');
    const todo = readJson(metaPath);
    if (!todo) continue;
    // Phase 3: backpressure gate.
    const bp = checkBackpressure(JOSH_ROOT, todo);
    if (!bp.ok) {
      throttled++;
      continue;
    }
    todo.history = todo.history || [];
    todo.history.push({
      at: new Date().toISOString(),
      actor: 'orchestrator',
      event: 'auto_promoted',
      details: { from: 'approved', to: 'in_progress' },
    });
    moveTodo(metaPath, 'in_progress', todo);
    appendAudit({
      actor: 'orchestrator',
      action: 'todo.auto_promoted',
      id: todo.id,
      details: { from: 'approved', to: 'in_progress' },
    });
    promoted++;
  }
  return { promoted, throttled };
}
```

The return shape changed from `Number` to `{promoted, throttled}`. Find the call site in `cmdTick` (around line 1204):

```javascript
    // 5b. Promote approved → in_progress (Phase 2A dispatch)
    let promoted = 0;
    if (!paused) promoted = promoteApproved();
```

Update it to destructure both fields and audit `throttled`:

```javascript
    // 5b. Promote approved → in_progress (Phase 2A dispatch)
    let promoted = 0;
    let throttled = 0;
    if (!paused) {
      const r = promoteApproved();
      promoted = r.promoted;
      throttled = r.throttled;
    }
```

Then thread `throttled` into the audit and summary lines (around line 1228 and 1247):

```javascript
    appendAudit({
      actor: 'orchestrator',
      action: 'orchestrator.tick',
      id: null,
      details: {
        controls: controlsProcessed,
        triaged,
        routed,
        triaged_failed: triagedFailed,
        swept,
        promoted,
        throttled,                                         // ← new
        expired_approvals: expired,
        paused,
        draining,
        duration_ms: Date.now() - tickStart.getTime()
      }
    });
```

```javascript
    if (verbose) {
      log(`tick ${tickN} @ ${status.agents.orchestrator.last_tick}`);
      log(`  controls: ${controlsProcessed}  triaged: ${triaged} (routed: ${routed})  swept: ${swept}  promoted: ${promoted}  throttled: ${throttled}  expired: ${expired}  failed: ${triagedFailed}`);
      log(`  paused: ${paused}  draining: ${draining}`);
      log(`  queue: incoming=${status.queue.incoming} triaged=${status.queue.triaged} in_progress=${status.queue.in_progress}`);
    } else {
      log(`tick ${tickN}: triaged=${triaged}${routed > 0 ? ` (routed:${routed})` : ''} swept=${swept} promoted=${promoted}${throttled > 0 ? ` throttled=${throttled}` : ''} expired=${expired} controls=${controlsProcessed}${paused ? ' [paused]' : ''}${draining ? ' [draining]' : ''}`);
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd bin/josh && node --test "test/*.test.js"`
Expected: all tests pass, including the two new backpressure CLI tests. 0 failures.

- [ ] **Step 6: Commit**

```bash
git add bin/josh/josh.js bin/josh/test/josh-cli-folder-layout.test.js
git commit -m "feat(josh): backpressure gate on claim + promoteApproved"
```

---

## Task 5: `doom-loop.js` — detector + sweeper

**Files:**
- Create: `bin/josh/lib/doom-loop.js`
- Create: `bin/josh/test/doom-loop.test.js`

- [ ] **Step 1: Write the failing test**

Create `bin/josh/test/doom-loop.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  countFailureEvents,
  detectDoomLoop,
  sweepDoomLoops,
  DEFAULT_MAX_FAILURES,
} = require('../lib/doom-loop');

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-dl-'));
  for (const s of ['failed', 'triaged', 'blocked']) {
    fs.mkdirSync(path.join(root, 'todo', s), { recursive: true });
  }
  return root;
}

function seed(root, state, id, history) {
  const dir = path.join(root, 'todo', state, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({
    schema: 1, id, history,
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'state'), state + '\n');
  fs.writeFileSync(path.join(dir, 'events.ndjson'), '');
}

test('countFailureEvents: returns 0 for empty history', () => {
  assert.equal(countFailureEvents({ history: [] }), 0);
  assert.equal(countFailureEvents({}), 0);
});

test('countFailureEvents: counts only event=failed', () => {
  const todo = {
    history: [
      { event: 'imported' },
      { event: 'claimed' },
      { event: 'failed', details: { reason: 'flaky' } },
      { event: 'claim_expired' },           // does NOT count
      { event: 'failed', details: { reason: 'flaky again' } },
    ],
  };
  assert.equal(countFailureEvents(todo), 2);
});

test('detectDoomLoop: false under threshold', () => {
  const todo = { history: [{ event: 'failed' }, { event: 'failed' }] };
  const r = detectDoomLoop(todo, 3);
  assert.equal(r.isLoop, false);
  assert.equal(r.failure_count, 2);
});

test('detectDoomLoop: true at threshold', () => {
  const todo = { history: [{ event: 'failed' }, { event: 'failed' }, { event: 'failed' }] };
  const r = detectDoomLoop(todo, 3);
  assert.equal(r.isLoop, true);
  assert.equal(r.failure_count, 3);
});

test('detectDoomLoop: default max is 3', () => {
  assert.equal(DEFAULT_MAX_FAILURES, 3);
  const todo = { history: [{ event: 'failed' }, { event: 'failed' }, { event: 'failed' }] };
  assert.equal(detectDoomLoop(todo).isLoop, true);
});

test('sweepDoomLoops: moves looping todo from failed/ to blocked/', () => {
  const root = makeRoot();
  seed(root, 'failed', '01LOOP', [
    { event: 'failed' }, { event: 'failed' }, { event: 'failed' },
  ]);
  const swept = sweepDoomLoops(root);
  assert.equal(swept, 1);
  assert.equal(fs.existsSync(path.join(root, 'todo', 'failed', '01LOOP')), false);
  assert.equal(fs.existsSync(path.join(root, 'todo', 'blocked', '01LOOP')), true);
  const meta = JSON.parse(fs.readFileSync(path.join(root, 'todo', 'blocked', '01LOOP', 'meta.json'), 'utf8'));
  assert.match(meta.blocked_reason, /doom-loop-detected:3/);
  const lastEvent = meta.history[meta.history.length - 1];
  assert.equal(lastEvent.event, 'doom_loop_blocked');
  const stateFile = fs.readFileSync(path.join(root, 'todo', 'blocked', '01LOOP', 'state'), 'utf8').trim();
  assert.equal(stateFile, 'blocked');
  fs.rmSync(root, { recursive: true, force: true });
});

test('sweepDoomLoops: also catches re-triaged loops', () => {
  const root = makeRoot();
  seed(root, 'triaged', '01RT', [
    { event: 'failed' }, { event: 'failed' }, { event: 'failed' },
  ]);
  const swept = sweepDoomLoops(root);
  assert.equal(swept, 1);
  assert.equal(fs.existsSync(path.join(root, 'todo', 'blocked', '01RT')), true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('sweepDoomLoops: leaves under-threshold todos alone', () => {
  const root = makeRoot();
  seed(root, 'failed', '01OK', [{ event: 'failed' }, { event: 'failed' }]);
  const swept = sweepDoomLoops(root);
  assert.equal(swept, 0);
  assert.equal(fs.existsSync(path.join(root, 'todo', 'failed', '01OK')), true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('sweepDoomLoops: does not collide with already-blocked id', () => {
  const root = makeRoot();
  seed(root, 'failed',  '01DUP', [{ event: 'failed' }, { event: 'failed' }, { event: 'failed' }]);
  seed(root, 'blocked', '01DUP', [{ event: 'imported' }]);  // same id already in blocked/
  const swept = sweepDoomLoops(root);
  assert.equal(swept, 0); // refuses to clobber
  // Both still exist; the loop is left in failed/ untouched.
  assert.equal(fs.existsSync(path.join(root, 'todo', 'failed', '01DUP')), true);
  assert.equal(fs.existsSync(path.join(root, 'todo', 'blocked', '01DUP')), true);
  fs.rmSync(root, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bin/josh && node --test test/doom-loop.test.js`
Expected: FAIL — `Cannot find module '../lib/doom-loop'`.

- [ ] **Step 3: Write minimal implementation**

Create `bin/josh/lib/doom-loop.js`:

```javascript
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_MAX_FAILURES = 3;
const SCAN_STATES = ['failed', 'triaged'];

function countFailureEvents(todo) {
  if (!todo || !Array.isArray(todo.history)) return 0;
  let n = 0;
  for (const h of todo.history) {
    if (h && h.event === 'failed') n++;
  }
  return n;
}

function detectDoomLoop(todo, maxFailures = DEFAULT_MAX_FAILURES) {
  const failure_count = countFailureEvents(todo);
  return { isLoop: failure_count >= maxFailures, failure_count };
}

function writeJsonAtomic(p, obj) {
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  fs.renameSync(tmp, p);
}

function appendEventLine(eventsPath, event) {
  try {
    fs.appendFileSync(eventsPath, JSON.stringify(event) + '\n');
  } catch (e) { /* non-fatal */ }
}

function sweepOne(joshRoot, state, id, maxFailures) {
  const fromDir = path.join(joshRoot, 'todo', state, id);
  const metaPath = path.join(fromDir, 'meta.json');
  let todo;
  try { todo = JSON.parse(fs.readFileSync(metaPath, 'utf8')); }
  catch (e) { return false; }

  const det = detectDoomLoop(todo, maxFailures);
  if (!det.isLoop) return false;

  const toDir = path.join(joshRoot, 'todo', 'blocked', id);
  if (fs.existsSync(toDir)) return false;       // refuse to clobber

  try {
    fs.mkdirSync(path.dirname(toDir), { recursive: true });
    fs.renameSync(fromDir, toDir);
  } catch (e) {
    return false;
  }

  const now = new Date().toISOString();
  const newMetaPath = path.join(toDir, 'meta.json');
  try {
    const meta = JSON.parse(fs.readFileSync(newMetaPath, 'utf8'));
    meta.blocked_reason = `doom-loop-detected:${det.failure_count}`;
    meta.history = meta.history || [];
    meta.history.push({
      at: now,
      actor: 'orchestrator',
      event: 'doom_loop_blocked',
      details: { failure_count: det.failure_count, max_failures: maxFailures, from: state },
    });
    writeJsonAtomic(newMetaPath, meta);
  } catch (e) { /* meta read failed; folder still moved, leave as-is */ }

  try { fs.writeFileSync(path.join(toDir, 'state'), 'blocked\n', 'utf8'); }
  catch (e) { /* non-fatal */ }

  appendEventLine(path.join(toDir, 'events.ndjson'), {
    kind: 'failed',
    at: now,
    actor: 'orchestrator',
    reason: 'doom_loop',
    failure_count: det.failure_count,
  });

  return true;
}

function sweepDoomLoops(joshRoot, opts = {}) {
  const maxFailures = opts.maxFailures || DEFAULT_MAX_FAILURES;
  let swept = 0;
  for (const state of SCAN_STATES) {
    const dir = path.join(joshRoot, 'todo', state);
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (e) { continue; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (sweepOne(joshRoot, state, e.name, maxFailures)) swept++;
    }
  }
  return swept;
}

module.exports = {
  DEFAULT_MAX_FAILURES,
  SCAN_STATES,
  countFailureEvents,
  detectDoomLoop,
  sweepDoomLoops,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd bin/josh && node --test test/doom-loop.test.js`
Expected: 9 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add bin/josh/lib/doom-loop.js bin/josh/test/doom-loop.test.js
git commit -m "feat(josh): add doom-loop detector + sweeper"
```

---

## Task 6: Wire `sweepDoomLoops` into `cmdTick`

**Files:**
- Modify: `bin/josh/josh.js`
- Modify: `bin/josh/test/josh-cli-folder-layout.test.js`

- [ ] **Step 1: Write the failing CLI test**

Append to `bin/josh/test/josh-cli-folder-layout.test.js`:

```javascript
test('cli: tick sweeps doom-looped todos to blocked/', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-dl-tick-'));
  const env = { ...process.env, JOSH_ROOT: tmpRoot };
  execSync(`node "${joshBin}" init`, { env, stdio: 'pipe' });

  const dir = path.join(tmpRoot, 'todo', 'failed', '01LOOP');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({
    schema: 1,
    id: '01LOOP',
    history: [
      { at: '2026-05-10T01:00:00Z', actor: 'A01', event: 'failed' },
      { at: '2026-05-10T02:00:00Z', actor: 'A01', event: 'failed' },
      { at: '2026-05-10T03:00:00Z', actor: 'A01', event: 'failed' },
    ],
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'state'), 'failed\n');
  fs.writeFileSync(path.join(dir, 'events.ndjson'), '');

  const out = execSync(`node "${joshBin}" tick`, { env }).toString();
  assert.match(out, /doom_looped=1/);
  assert.equal(fs.existsSync(path.join(tmpRoot, 'todo', 'failed', '01LOOP')), false);
  assert.equal(fs.existsSync(path.join(tmpRoot, 'todo', 'blocked', '01LOOP')), true);

  const meta = JSON.parse(fs.readFileSync(
    path.join(tmpRoot, 'todo', 'blocked', '01LOOP', 'meta.json'), 'utf8'));
  assert.match(meta.blocked_reason, /doom-loop-detected:3/);

  fs.rmSync(tmpRoot, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bin/josh && node --test test/josh-cli-folder-layout.test.js`
Expected: the new test FAILS — `tick` output doesn't include `doom_looped=` and the folder isn't moved.

- [ ] **Step 3: Write the implementation**

In `bin/josh/josh.js`, find `cmdTick` (around line 1180). Find step "5. Sweep stale claims" — it currently does:

```javascript
    // 5. Sweep stale claims (TTL exceeded → reclaim back to triaged)
    let swept = 0;
    swept = sweepStaleClaims();
```

Add a new step "5c" right after the existing "5b" (promote approved):

```javascript
    // 5c. Phase 3: doom-loop sweep — push repeated-failure todos to blocked/
    let doomLooped = 0;
    if (!paused) {
      const { sweepDoomLoops } = require('./lib/doom-loop');
      doomLooped = sweepDoomLoops(JOSH_ROOT);
      if (doomLooped > 0) {
        appendAudit({
          actor: 'orchestrator',
          action: 'todo.doom_loop_swept',
          id: null,
          details: { count: doomLooped },
        });
      }
    }
```

Thread `doomLooped` into the audit details (around line 1228):

```javascript
    appendAudit({
      actor: 'orchestrator',
      action: 'orchestrator.tick',
      id: null,
      details: {
        controls: controlsProcessed,
        triaged,
        routed,
        triaged_failed: triagedFailed,
        swept,
        promoted,
        throttled,
        doom_looped: doomLooped,                            // ← new
        expired_approvals: expired,
        paused,
        draining,
        duration_ms: Date.now() - tickStart.getTime()
      }
    });
```

Thread it into the verbose + one-line summaries (around line 1247):

```javascript
    if (verbose) {
      log(`tick ${tickN} @ ${status.agents.orchestrator.last_tick}`);
      log(`  controls: ${controlsProcessed}  triaged: ${triaged} (routed: ${routed})  swept: ${swept}  promoted: ${promoted}  throttled: ${throttled}  doom_looped: ${doomLooped}  expired: ${expired}  failed: ${triagedFailed}`);
      log(`  paused: ${paused}  draining: ${draining}`);
      log(`  queue: incoming=${status.queue.incoming} triaged=${status.queue.triaged} in_progress=${status.queue.in_progress}`);
    } else {
      log(`tick ${tickN}: triaged=${triaged}${routed > 0 ? ` (routed:${routed})` : ''} swept=${swept} promoted=${promoted}${throttled > 0 ? ` throttled=${throttled}` : ''}${doomLooped > 0 ? ` doom_looped=${doomLooped}` : ''} expired=${expired} controls=${controlsProcessed}${paused ? ' [paused]' : ''}${draining ? ' [draining]' : ''}`);
    }
```

Note the test asserts `/doom_looped=1/` in stdout, which only appears in the one-line form when `doomLooped > 0`. The verbose form always includes it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd bin/josh && node --test "test/*.test.js"`
Expected: all tests pass; 0 failures.

- [ ] **Step 5: Commit**

```bash
git add bin/josh/josh.js bin/josh/test/josh-cli-folder-layout.test.js
git commit -m "feat(josh): tick sweeps doom-loops to blocked/"
```

---

## Task 7: `josh heartbeat <id>` subcommand

**Files:**
- Modify: `bin/josh/josh.js`
- Modify: `bin/josh/test/josh-cli-folder-layout.test.js`

- [ ] **Step 1: Write the failing CLI test**

Append to `bin/josh/test/josh-cli-folder-layout.test.js`:

```javascript
test('cli: heartbeat resets claim.at and emits a heartbeat event', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-hb-'));
  const env = { ...process.env, JOSH_ROOT: tmpRoot };
  execSync(`node "${joshBin}" init`, { env, stdio: 'pipe' });

  const dir = path.join(tmpRoot, 'todo', 'in_progress', '01HB');
  fs.mkdirSync(dir, { recursive: true });
  const oldTs = '2026-05-10T01:00:00.000Z';
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({
    schema: 1, id: '01HB',
    claim: { by: 'A01', at: oldTs, ttl_sec: 3600 },
    history: [{ at: oldTs, actor: 'A01', event: 'claimed' }],
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'state'), 'in_progress\n');
  fs.writeFileSync(path.join(dir, 'events.ndjson'), '');

  const out = execSync(`node "${joshBin}" heartbeat 01HB --as A01`, { env }).toString();
  assert.match(out, /heartbeat: 01HB/);

  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  assert.notEqual(meta.claim.at, oldTs); // reset to "now"
  const last = meta.history[meta.history.length - 1];
  assert.equal(last.event, 'heartbeat');
  assert.equal(last.actor, 'A01');

  const events = fs.readFileSync(path.join(dir, 'events.ndjson'), 'utf8').trim().split('\n');
  const lastEvent = JSON.parse(events[events.length - 1]);
  assert.equal(lastEvent.kind, 'heartbeat');
  assert.equal(lastEvent.actor, 'A01');

  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test('cli: heartbeat refuses on a terminal state', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-hb-bad-'));
  const env = { ...process.env, JOSH_ROOT: tmpRoot };
  execSync(`node "${joshBin}" init`, { env, stdio: 'pipe' });

  const dir = path.join(tmpRoot, 'todo', 'done', '01D');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ schema: 1, id: '01D', history: [] }));
  fs.writeFileSync(path.join(dir, 'state'), 'done\n');

  let exitCode = 0; let stderrOut = '';
  try {
    execSync(`node "${joshBin}" heartbeat 01D --as A01`, { env, stdio: 'pipe' });
  } catch (e) { exitCode = e.status; stderrOut = e.stderr.toString(); }
  assert.equal(exitCode, 1);
  assert.match(stderrOut, /state.*'done'/);

  fs.rmSync(tmpRoot, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bin/josh && node --test test/josh-cli-folder-layout.test.js`
Expected: both new tests FAIL — the `heartbeat` subcommand does not exist yet.

- [ ] **Step 3: Add `cmdHeartbeat`**

In `bin/josh/josh.js`, add a new function after `cmdComplete`. Example landing point: search for the line `function cmdFail(args)` and insert `cmdHeartbeat` immediately above it.

```javascript
function cmdHeartbeat(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        as:    { type: 'string' },
        actor: { type: 'string' },
      },
      allowPositionals: true,
      strict: true
    });
  } catch (e) { return errExit(e.message, 1); }

  const idArg = parsed.positionals[0];
  if (!idArg) return errExit('heartbeat requires <todo-id>', 1);

  const actor = resolveActor(parsed.values);
  const allowed = ['claimed', 'planning', 'awaiting_approval', 'in_progress'];
  const located = locateTodo(idArg, allowed);
  if (located.error) return errExit(located.error, located.code);

  const todo = readJson(located.path);
  if (!todo) return errExit(`malformed todo at ${located.relative}`, 4);

  const now = new Date().toISOString();
  if (todo.claim) todo.claim.at = now;
  todo.history = todo.history || [];
  todo.history.push({ at: now, actor, event: 'heartbeat' });
  writeJsonAtomic(located.path, todo);

  // Per-todo events stream.
  try {
    ew.appendEvent(JOSH_ROOT, located.state, located.id, {
      kind: 'heartbeat',
      at: now,
      actor,
    });
  } catch (e) { /* non-fatal */ }

  appendAudit({ actor, action: 'todo.heartbeat', id: located.id, details: {} });
  log(`heartbeat: ${located.id} at ${now}`);
  return 0;
}
```

- [ ] **Step 4: Wire `heartbeat` into the main dispatcher**

Find the main switch in `bin/josh/josh.js` (search for `case 'claim':`). Add a new case alongside the other lifecycle commands:

```javascript
    case 'heartbeat':  return cmdHeartbeat(args.slice(1));
```

Also update the help/usage block near the top of the file (the comment block listing commands). Find:

```javascript
//   josh fail <id>           — in_progress|triaged → failed (requires --reason)
```

Insert immediately above it:

```javascript
//   josh heartbeat <id>      — extend claim TTL + emit heartbeat event (claimed|planning|awaiting_approval|in_progress)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd bin/josh && node --test "test/*.test.js"`
Expected: all tests pass; 0 failures.

- [ ] **Step 6: Commit**

```bash
git add bin/josh/josh.js bin/josh/test/josh-cli-folder-layout.test.js
git commit -m "feat(josh): add 'josh heartbeat' (resets claim TTL + emits event)"
```

---

## Task 8: End-to-end enforcement smoke test

**Files:**
- Create: `bin/josh/test/enforcement-smoke.test.js`

- [ ] **Step 1: Write the integration test**

Create `bin/josh/test/enforcement-smoke.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

const joshBin = path.resolve(__dirname, '..', 'josh.js');

function runCli(cmd, env, opts = {}) {
  return execSync(`node "${joshBin}" ${cmd}`, {
    env, stdio: opts.stdio || 'pipe',
  }).toString();
}

function setupRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-enf-'));
  const env = { ...process.env, JOSH_ROOT: root };
  execSync(`node "${joshBin}" init`, { env, stdio: 'pipe' });

  // Seed agent A01 brief.
  const agentDir = path.join(root, 'agents', 'A01');
  fs.mkdirSync(agentDir, { recursive: true });
  const briefPath = path.join(agentDir, 'brief.md');
  fs.writeFileSync(briefPath, '# Agent A01\n');
  fs.writeFileSync(path.join(agentDir, 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A01', source_path: briefPath,
  }, null, 2));

  return { root, env };
}

function seedTodo(root, state, id, meta) {
  const dir = path.join(root, 'todo', state, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({
    schema: 1, id, primary_role: 'A01', history: [], ...meta,
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'state'), state + '\n');
  fs.writeFileSync(path.join(dir, 'events.ndjson'), '');
}

test('enforcement smoke: deps refuse → satisfy → claim succeeds', () => {
  const { root, env } = setupRoot();

  seedTodo(root, 'triaged', '01D002', {
    display_id: 'D1-002', phase: 1,
    depends_on: [], depends_on_display_ids: [],
  });
  seedTodo(root, 'triaged', '01D003', {
    display_id: 'D1-003', phase: 1,
    depends_on: [{ id: '01D002', kind: 'hard' }],
    depends_on_display_ids: ['D1-002'],
  });

  // 1. Refuse to claim D1-003 (D1-002 is in triaged, not done).
  let stderrOut = '';
  try {
    runCli('claim 01D003 --agent A01 --as A01', env);
    throw new Error('expected non-zero exit');
  } catch (e) {
    assert.equal(e.status, 3);
    stderrOut = e.stderr.toString();
  }
  assert.match(stderrOut, /D1-002.*triaged/);

  // 2. Move D1-002 to done by hand (simulates completed task).
  fs.renameSync(
    path.join(root, 'todo', 'triaged', '01D002'),
    path.join(root, 'todo', 'done', '01D002'),
  );
  fs.writeFileSync(path.join(root, 'todo', 'done', '01D002', 'state'), 'done\n');

  // 3. Now D1-003 claim succeeds.
  const out = runCli('claim 01D003 --agent A01 --as A01', env);
  assert.match(out, /01D003/);
  assert.equal(fs.existsSync(path.join(root, 'todo', 'claimed', '01D003')), true);

  fs.rmSync(root, { recursive: true, force: true });
});

test('enforcement smoke: backpressure cap blocks new claims', () => {
  const { root, env } = setupRoot();

  fs.writeFileSync(
    path.join(root, 'orchestrator', 'backpressure.json'),
    JSON.stringify({ schema: 1, max_concurrent: 1 })
  );

  seedTodo(root, 'in_progress', '01ALPHA', { display_id: 'D1-001', phase: 1 });
  seedTodo(root, 'triaged',     '01BETA',  {
    display_id: 'D1-002', phase: 1,
    depends_on: [], depends_on_display_ids: [],
  });

  let stderrOut = '';
  try {
    runCli('claim 01BETA --as A01', env);
    throw new Error('expected non-zero exit');
  } catch (e) {
    assert.equal(e.status, 3);
    stderrOut = e.stderr.toString();
  }
  assert.match(stderrOut, /backpressure.*global/);
  assert.equal(fs.existsSync(path.join(root, 'todo', 'triaged', '01BETA')), true);

  fs.rmSync(root, { recursive: true, force: true });
});

test('enforcement smoke: failed × 3 → tick blocks via doom-loop', () => {
  const { root, env } = setupRoot();

  seedTodo(root, 'failed', '01DOOM', {
    display_id: 'D1-007', phase: 1,
    history: [
      { at: '2026-05-10T01:00:00Z', actor: 'A01', event: 'failed', details: { reason: 'r1' } },
      { at: '2026-05-10T02:00:00Z', actor: 'A01', event: 'failed', details: { reason: 'r2' } },
      { at: '2026-05-10T03:00:00Z', actor: 'A01', event: 'failed', details: { reason: 'r3' } },
    ],
  });

  const tickOut = runCli('tick', env);
  assert.match(tickOut, /doom_looped=1/);

  assert.equal(fs.existsSync(path.join(root, 'todo', 'failed', '01DOOM')), false);
  const blockedMeta = JSON.parse(fs.readFileSync(
    path.join(root, 'todo', 'blocked', '01DOOM', 'meta.json'), 'utf8'));
  assert.match(blockedMeta.blocked_reason, /doom-loop-detected:3/);

  fs.rmSync(root, { recursive: true, force: true });
});

test('enforcement smoke: heartbeat extends TTL during long-running claim', () => {
  const { root, env } = setupRoot();

  const id = '01LONG';
  const dir = path.join(root, 'todo', 'in_progress', id);
  fs.mkdirSync(dir, { recursive: true });
  const oldTs = '2026-05-10T00:00:00.000Z';
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({
    schema: 1, id, primary_role: 'A01',
    claim: { by: 'A01', at: oldTs, ttl_sec: 60 },
    history: [{ at: oldTs, actor: 'A01', event: 'claimed' }],
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'state'), 'in_progress\n');
  fs.writeFileSync(path.join(dir, 'events.ndjson'), '');

  runCli(`heartbeat ${id} --as A01`, env);

  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  assert.notEqual(meta.claim.at, oldTs);
  const last = meta.history[meta.history.length - 1];
  assert.equal(last.event, 'heartbeat');

  fs.rmSync(root, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run the integration test**

Run: `cd bin/josh && node --test test/enforcement-smoke.test.js`
Expected: 4 tests pass, 0 fail.

Run the full suite for sanity:
Run: `cd bin/josh && node --test "test/*.test.js"`
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add bin/josh/test/enforcement-smoke.test.js
git commit -m "test(josh): end-to-end enforcement smoke (deps + backpressure + doom-loop + heartbeat)"
```

---

## Task 9: Documentation

**Files:**
- Modify: `bin/josh/README.md`
- Modify: `USER-MANUAL.md` (root of Levi repo)

- [ ] **Step 1: Update bin/josh/README.md**

In `bin/josh/README.md`, add a new section before "Maintenance":

````markdown
## Enforcement layer (Phase 3)

`josh claim` and `josh tick` enforce four guardrails so a multi-task corpus can run unattended.

### 1. Hard-dependency enforcement

`josh claim <id>` (with or without `--agent`) refuses with exit code **3** when any todo in `meta.depends_on` (`kind: hard`) is not yet in `done/`. Error message lists the blocking display IDs and their current states.

Soft deps (`kind: soft`) are advisory and are not checked.

### 2. Backpressure caps

Optional config at `~/.josh/orchestrator/backpressure.json`:

```json
{
  "schema": 1,
  "max_concurrent": 10,
  "max_concurrent_per_phase": 5,
  "max_concurrent_per_agent": 2
}
```

Defaults apply when the file is absent. Caps are checked in two places:

- `josh claim` (legacy and `--agent` paths) — exit **3** if any cap would be exceeded.
- `josh tick`'s `approved → in_progress` promotion — throttled todos stay in `approved/` until the cap clears. Reported as `throttled=N` in the tick summary.

### 3. Doom-loop detector

A todo whose history contains ≥ 3 events of `event: failed` is considered doom-looped. `josh tick` scans `failed/` and `triaged/` for these and atomically renames them into `blocked/`, stamping `meta.blocked_reason = "doom-loop-detected:N"` and emitting a `failed` lifecycle event into `events.ndjson`. Reported as `doom_looped=N` in the tick summary when nonzero.

### 4. Heartbeat

```
josh heartbeat <id> [--as <actor>]
```

Resets `meta.claim.at` to now (extending TTL by another full `claim.ttl_sec`) and appends both a history entry and a `kind: heartbeat` line to `events.ndjson`. Allowed source states: `claimed`, `planning`, `awaiting_approval`, `in_progress`. Anywhere else returns exit **1**.

````

- [ ] **Step 2: Update USER-MANUAL.md**

In the root `USER-MANUAL.md`, find Section 7 "josh CLI — complete reference" and add a new subsection 7.16 before "Help & version":

````markdown
### 7.16 Enforcement layer

Phase 3 guardrails ensure dispatch tasks run safely across multiple phases without collisions or runaway retries.

#### Hard-dependency enforcement

`josh claim <id>` checks `meta.depends_on` for any entries with `kind: hard` whose target todo is not in `done/`. If any are unfinished, the claim is refused with exit code **3** and a message naming the blockers.

#### Backpressure caps

Configure caps at `~/.josh/orchestrator/backpressure.json`:

```json
{
  "max_concurrent": 10,
  "max_concurrent_per_phase": 5,
  "max_concurrent_per_agent": 2
}
```

`josh claim` refuses (exit **3**) when any cap would be exceeded; `josh tick`'s promotion step holds back approved → in_progress moves until the cap clears, surfacing `throttled=N` in the summary.

#### Doom-loop detector

`josh tick` automatically moves any todo with ≥ 3 `failed` history events into `blocked/`, with `blocked_reason: doom-loop-detected:N`. The threshold is the constant `DEFAULT_MAX_FAILURES = 3` in `bin/josh/lib/doom-loop.js`.

#### `josh heartbeat <id>`

Extends a live claim's TTL and emits a `heartbeat` event into the per-todo `events.ndjson`. Use from inside an agent session that's expected to run longer than the configured TTL.

````

- [ ] **Step 3: Commit**

```bash
git add bin/josh/README.md USER-MANUAL.md
git commit -m "docs(josh): document Phase 3 enforcement layer (deps + backpressure + doom-loop + heartbeat)"
```

---

## Self-review (run after writing the plan)

### 1. Spec coverage

- ✅ Spec §12 row 3 "All 100 Day 1 tasks run safely across 10 phases" — Tasks 3-4 (backpressure), 5-6 (doom-loop), 7 (heartbeat) cover wave-execution / backpressure / Doom Loop Detector.
- ✅ "No collisions" — already enforced by Phase 2A's atomic `transitionTodo` rename. No new code needed; smoke test covers it indirectly via dependency ordering.
- ✅ "No accepted handoffs without evidence" — handoff validation already shipped in Phase 2A. Phase 3B will tighten "evidence" beyond the 9-field template.
- ✅ Hard-dep enforcement (spec §6.3 `depends_on` field) — Tasks 1-2.
- ✅ Heartbeat (spec §7.3 lifecycle event taxonomy, "heartbeat — every 20s for runs > 30s") — Task 7. The 20s/30s timing is harness-side; Task 7 ships the CLI primitive that any harness can call.

### 2. Placeholder scan

- No "TBD", "TODO", "implement later", or "fill in details" anywhere.
- No "add appropriate error handling" — every error path has explicit `errExit` or `try/catch` with the actual code shown.
- No "similar to Task N" — each task has its own complete code blocks.
- Every code step has a real, runnable implementation.

### 3. Type consistency

- `checkDependencies(joshRoot, todo)` returns `{ok: bool, blocked_by: [{id, display_id, state}]}`. Same shape used in Tasks 1, 2, 8.
- `checkBackpressure(joshRoot, todo)` returns `{ok: bool}` on success or `{ok: false, scope: 'global'|'phase'|'agent', reason, current, max}` on failure. Same shape used in Tasks 3, 4, 8.
- `detectDoomLoop(todo, maxFailures)` returns `{isLoop: bool, failure_count: int}`. Same shape used in Tasks 5, 6, 8.
- `sweepDoomLoops(joshRoot, opts)` returns `int` (count swept). Same shape used in Tasks 5, 6, 8.
- `promoteApproved()` return shape changes from `int` to `{promoted, throttled}` in Task 4 — call site is updated in the same task.

### 4. Ambiguity check

- `JOSH_ROOT` — `const` not function, per CLAUDE-noted convention from Phase 2A. All code uses `JOSH_ROOT` not `JOSH_ROOT()`.
- `defaultActor()` / `resolveActor()` / `parseArgs` / `errExit` / `readJson` / `writeJsonAtomic` / `appendAudit` / `transitionTodo` / `moveTodo` / `locateTodo` — all existing helpers in `josh.js`. Confirmed by reading `bin/josh/josh.js:248`, `:255`, `:319`, `:84`, `:88`, `:119`, `:365`, `:505`, `:323`.
- `ew.appendEvent(joshRoot, state, id, event)` — existing helper in `bin/josh/lib/events-writer.js`. Phase 2A wired it into `transitionTodo` and `cmdComplete`.

### Spec-to-task coverage gaps (intentional, not bugs)

- **Worktree isolation per claim** (`~/.josh/todo/<id>/worktree/` git worktree) — Phase 3B. Heartbeat + backpressure are higher-leverage for "100 tasks run safely" and don't require git plumbing.
- **Chat-mode `APPROVE: <id>` guard hook** — Phase 3B. The cron-friendly approval signal (Phase 2A) already drives the test corpus end-to-end.
- **Verification-evidence enforcement beyond 9-field handoff** — Phase 3B. Phase 2A's existence-and-non-empty check on `## Verification` is already strict enough for the smoke test.
- **HMAC-chained audit + Ed25519 signing** — Phase 6, not Phase 3.

These are acceptable deferrals consistent with the spec's phase rollout (§12).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-10-josh-enforcement-phase3.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for a 9-task plan with tight TDD ladder.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints. Best if you want to watch each step.

**Which approach?**
