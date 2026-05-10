# Phase 2A: `josh` agent dispatch — plan/approve/execute file contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `~/.josh/todo/` from flat-file (`<state>/<id>.json`) to per-todo folder (`<state>/<id>/meta.json` + siblings); add the `claimed`, `planning`, `awaiting_approval`, `approved`, `rejected`, `revised` states; extend `claim` to support `--agent` filtering and inject the agent brief reference; add `josh plan submit/approve/reject` subcommands; auto-promote `approved → in_progress` on tick; require an 8-field `handoff.md` on `complete`; ship a per-todo `events.ndjson` append helper for the 14-event taxonomy. End state: a single D1-001 task can run end-to-end (claim → plan → approve → tick → execute → complete) under a passing smoke test.

**Architecture:** Existing flat-file reads in `josh.js` are replaced wholesale (one-pass migration) with folder-layout reads via a new shared helper module `bin/josh/lib/todo-folder.js`. The Phase 1 importer also writes folder layout from this point forward. New subcommands live in `bin/josh/josh.js` (matching the existing `cmdProject` dispatcher pattern); the heavy logic moves to dedicated lib files (`plan-validator.js`, `handoff-validator.js`, `events-writer.js`, `todo-folder.js`). Tests use Node's built-in `node:test` runner (no new deps). The tick loop in `cmdTick` gains a single new step (auto-promote `approved → in_progress`).

**Tech Stack:** Node.js ≥18, CommonJS, `node:test`, `node:assert/strict`. Reuses existing `josh.js` helpers (`readJson`, `writeJsonAtomic`, `ulid`, `appendAudit`, `defaultActor`, `transitionTodo`).

**Source spec:** `docs/superpowers/specs/2026-05-09-josh-orchestration-design.md` Sections 4.4, 7.1, 7.2, 7.3, 7.4, 12 (Phase 2 row).

**Phase 2B (deferred, NOT in this plan):** worktree isolation per claim, chat-mode `APPROVE: <id>` guard hook, Doom Loop Detector, backpressure gates, verification-evidence enforcement, HMAC chain audit, Ed25519 signing.

---

## Background context for implementer

### What changes from Phase 1

After Phase 1, `~/.josh/todo/<state>/<id>.json` is a flat file. Spec Section 4.4 says it should be a folder:

```
~/.josh/todo/<state>/<ulid>/
├── meta.json          ← the existing flat-file content moves here verbatim
├── state              ← one-line, mirrors parent dir name (useful for grep)
├── plan.md            ← added in 'planning' state, persists into later states
├── plan-review.json   ← added when plan submitted
├── approval           ← absent | "pending" | "approved" | "rejected" — atomic-mv signal
├── handoff.md         ← written when state → done
├── events.ndjson      ← append-only, all 14 event types
└── runtime.json       ← {harness, session_id, claimed_by, started_at} written on claim
```

Phase 2A migrates **every existing read path in `josh.js`** to the folder layout (one pass, no transition window). The Phase 1 importer (`bin/josh/lib/project-importer.js`) is updated to write folder layout from this point forward.

### State machine after Phase 2A

```
incoming
   │
   │ tick (triage)
   ▼
triaged ──claim──▶ claimed ──plan submit──▶ planning ──finalize──▶ awaiting_approval
                                                                          │
                                            ┌────reject─────────────────  │
                                            │                             │
                                            ▼                  approve    │
                                       rejected                           ▼
                                       (terminal)                    approved
                                                                          │
                                                                    tick  │
                                                                          ▼
                                                                    in_progress
                                                                          │
                                                          handoff verified│
                                                                          ▼
                                                                         done
                                                                    (terminal)
```

Side branches preserved from Phase 1: any state → `blocked`, `failed`, `cancelled`. New side branch: `awaiting_approval` → `revised` → `planning` (Phase 2A defines the state but the revision loop UX is sketched as a stub — full UX is Phase 2B).

### States added by Phase 2A

`claimed`, `planning`, `awaiting_approval`, `approved`, `rejected`, `revised`. Each gets a directory under `~/.josh/todo/`. `cmdInit` is updated to create them on `josh init`.

### The 8-section plan template (kesslerio, verbatim from spec §7.2)

`plan.md` always has these 8 sections, in this order:

1. **Fast-Path** — one-paragraph summary
2. **Problem statement**
3. **Current state evidence**
4. **Proposed approach**
5. **Step-by-step change list**
6. **Risks + rollback**
7. **Test plan**
8. **Approval prompt** — literally `Reply APPROVE: <plan-id>` or `REVISE: <reason>`

YAML frontmatter required: `id`, `status` (PENDING|APPROVED|REVISED), `claimed_by`, `plan_hash`. Validated by `josh plan submit`.

### The 8-field handoff (validated by `josh complete`)

The handoff is a Markdown file at `~/.josh/todo/<state>/<id>/handoff.md` with a single H2 per field, in any order. Required fields:

1. `## Task ID`
2. `## Files changed`
3. `## Decision`
4. `## Open blockers`
5. `## Risks`
6. `## Downstream unblocked`
7. `## Downstream blocked`
8. `## Verification`
9. `## Human review`

That's 9 H2s; spec calls it the "8-field handoff" but lists 9 fields (the 9th, "Human review", is the human-attention flag). We keep the spec's count name and validate all 9.

### The 14-event taxonomy (`events.ndjson`)

Per spec §7.3, two groups:

**Lifecycle (5):** `start`, `heartbeat`, `done`, `failed`, `interrupted`.
**Stream (9):** `backend_ref`, `run_started`, `text_delta`, `tool_call`, `pending_input`, `pending_input_resolved`, `plan_artifact`, `settings_changed`, `run_completed`.

Phase 2A ships only the **append helper** (`bin/josh/lib/events-writer.js`) and validates the event-kind enum. Wiring real session emission is future work.

### Conventions to follow

- All paths absolute. No `~` shorthand in code.
- All timestamps `new Date().toISOString()`.
- All IDs: ULIDs via the existing `ulid()` helper in `josh.js`.
- All writes atomic: `writeJsonAtomic()` (existing helper).
- All audit events via `appendAudit()` (existing helper).
- `JOSH_ROOT` is a **`const`**, not a function. Use `JOSH_ROOT`, never `JOSH_ROOT()`.
- File naming under `bin/josh/lib/` is kebab-case.
- One axis at a time. Tests live in `bin/josh/test/`.

---

## File structure

| File | Purpose | New / modify |
|---|---|---|
| `bin/josh/lib/todo-folder.js` | `readMeta(joshRoot, state, id)`, `writeMeta(...)`, `locateFolder(...)`, `transitionFolder(...)`, `listTodosInState(...)`, `findFolderById(...)` | New |
| `bin/josh/lib/plan-validator.js` | `validatePlan(text)` → `{ok, errors, frontmatter, sections}` (8-section + frontmatter check) | New |
| `bin/josh/lib/handoff-validator.js` | `validateHandoff(text)` → `{ok, errors, fields}` (9 H2s, non-empty) | New |
| `bin/josh/lib/events-writer.js` | `appendEvent(joshRoot, state, todoId, event)` | New |
| `bin/josh/lib/agent-brief.js` | `loadBrief(joshRoot, agentId)` → `{path, contents}` | New |
| `bin/josh/lib/project-importer.js` | Switch `~/.josh/todo/triaged/<id>.json` writes to folder layout (`<id>/meta.json` + `state` file + empty `events.ndjson`). Same for project import. | Modify |
| `bin/josh/lib/project-status.js` | Switch readers from flat-file to folder layout via `todo-folder.js`. | Modify |
| `bin/josh/lib/project-sync.js` | Switch readers from flat-file to folder layout via `todo-folder.js`. | Modify |
| `bin/josh/josh.js` | Update: `cmdInit` (new state dirs), `locateTodo`, `transitionTodo`, `moveTodo`, `cmdListTodo`, `cmdShow` (folder-aware), `cmdControl/reorder`, `sweepStaleClaims`, `validatorFor`, `triageOne` (folder writes), `cmdTick` (auto-promote step), `cmdClaim` (--agent + brief inject + runtime.json), `cmdComplete` (handoff validation). Add: `cmdPlan`, `cmdPlanSubmit`, `cmdPlanApprove`, `cmdPlanReject`. | Modify |
| `bin/josh/test/todo-folder.test.js` | Unit tests for `todo-folder.js` | New |
| `bin/josh/test/plan-validator.test.js` | Unit tests for `plan-validator.js` | New |
| `bin/josh/test/handoff-validator.test.js` | Unit tests for `handoff-validator.js` | New |
| `bin/josh/test/events-writer.test.js` | Unit tests for `events-writer.js` | New |
| `bin/josh/test/agent-brief.test.js` | Unit tests for `agent-brief.js` | New |
| `bin/josh/test/project-importer.test.js` | Update existing tests to assert folder layout. | Modify |
| `bin/josh/test/project-status.test.js` | Update existing tests to seed folder layout. | Modify |
| `bin/josh/test/project-sync.test.js` | Update existing tests to seed folder layout. | Modify |
| `bin/josh/test/dispatch-smoke.test.js` | End-to-end: import → claim --agent → plan submit → approve → tick → complete. | New |
| `bin/josh/test/fixtures/sample-plan.md` | Valid 8-section plan fixture used by multiple tests. | New |
| `bin/josh/test/fixtures/sample-handoff.md` | Valid 9-H2 handoff fixture used by multiple tests. | New |
| `bin/josh/README.md` | Document the new commands + folder layout | Modify |
| `USER-MANUAL.md` (root) | Add Section 7.15 for plan-approve-execute lifecycle | Modify |

Each lib file stays under ~250 LOC. Tests are co-located in `bin/josh/test/`.

---

## Task 1: Add new state directories to `cmdInit`

**Files:**
- Modify: `bin/josh/josh.js`

- [ ] **Step 1: Write the failing test**

Append to `bin/josh/test/project-importer.test.js` (we re-use this file for josh.js init coverage; a dedicated `init.test.js` is overkill for one assertion):

```javascript
test('cmdInit creates the Phase 2A state directories', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-init-'));
  const { execSync } = require('node:child_process');
  const joshBin = path.resolve(__dirname, '..', 'josh.js');
  execSync(`node "${joshBin}" init`, {
    env: { ...process.env, JOSH_ROOT: tmpRoot },
    stdio: 'pipe',
  });
  for (const state of ['claimed', 'planning', 'awaiting_approval', 'approved', 'rejected', 'revised']) {
    const dir = path.join(tmpRoot, 'todo', state);
    assert.equal(fs.existsSync(dir), true, `expected ${state} dir to exist`);
    assert.equal(fs.statSync(dir).isDirectory(), true);
  }
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bin/josh && npm test`
Expected: FAIL — at least one of the new state dirs does not exist after `josh init`.

- [ ] **Step 3: Write the implementation**

In `bin/josh/josh.js`, find the `SUBDIRS` array (around line 40). Add the six new state directories after the existing `'todo/cancelled'` line. The full block becomes:

```javascript
const SUBDIRS = [
  'claude/incoming',
  'claude/outgoing',
  'claude/processed',
  'codex/incoming',
  'codex/outgoing',
  'codex/processed',
  'orchestrator/incoming',
  'orchestrator/processed',
  'todo/incoming',
  'todo/triaged',
  'todo/claimed',
  'todo/planning',
  'todo/awaiting_approval',
  'todo/approved',
  'todo/rejected',
  'todo/revised',
  'todo/in_progress',
  'todo/done',
  'todo/blocked',
  'todo/failed',
  'todo/cancelled',
  'approvals/pending',
  'approvals/done',
  'reviews/pending',
  'reviews/done',
  'locks',
  'audit',
  'shared'
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd bin/josh && npm test`
Expected: 27 tests pass total (26 existing + 1 new), 0 fail.

- [ ] **Step 5: Commit**

```bash
git add bin/josh/josh.js bin/josh/test/project-importer.test.js
git commit -m "feat(josh): add Phase 2A state directories on init"
```

---

## Task 2: `todo-folder.js` — readMeta, writeMeta, ensureFolder

**Files:**
- Create: `bin/josh/lib/todo-folder.js`
- Create: `bin/josh/test/todo-folder.test.js`

- [ ] **Step 1: Write the failing test**

Create `bin/josh/test/todo-folder.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const tf = require('../lib/todo-folder');

function tmpRoot() {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-tf-'));
  for (const s of ['triaged', 'claimed', 'planning', 'awaiting_approval', 'approved', 'rejected', 'revised', 'in_progress', 'done', 'blocked', 'failed', 'cancelled', 'incoming']) {
    fs.mkdirSync(path.join(r, 'todo', s), { recursive: true });
  }
  fs.mkdirSync(path.join(r, 'audit'), { recursive: true });
  return r;
}

test('writeMeta + readMeta: round-trip in folder layout', () => {
  const root = tmpRoot();
  const id = '01HXTEST0000000000000001';
  tf.ensureFolder(root, 'triaged', id);
  tf.writeMeta(root, 'triaged', id, { schema: 1, id, title: 'hello' });
  const meta = tf.readMeta(root, 'triaged', id);
  assert.equal(meta.id, id);
  assert.equal(meta.title, 'hello');
  // state file written
  const stateFile = path.join(root, 'todo', 'triaged', id, 'state');
  assert.equal(fs.readFileSync(stateFile, 'utf8').trim(), 'triaged');
  fs.rmSync(root, { recursive: true, force: true });
});

test('readMeta: returns null when folder absent', () => {
  const root = tmpRoot();
  const meta = tf.readMeta(root, 'triaged', '01HXMISSING0000000000001');
  assert.equal(meta, null);
  fs.rmSync(root, { recursive: true, force: true });
});

test('ensureFolder: idempotent', () => {
  const root = tmpRoot();
  const id = '01HXTEST0000000000000002';
  tf.ensureFolder(root, 'triaged', id);
  tf.ensureFolder(root, 'triaged', id); // second call must not throw
  assert.equal(fs.existsSync(path.join(root, 'todo', 'triaged', id)), true);
  fs.rmSync(root, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bin/josh && npm test`
Expected: FAIL — `Cannot find module '../lib/todo-folder'`.

- [ ] **Step 3: Write minimal implementation**

Create `bin/josh/lib/todo-folder.js`:

```javascript
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ALL_STATES = [
  'incoming', 'triaged', 'claimed', 'planning', 'awaiting_approval',
  'approved', 'rejected', 'revised', 'in_progress', 'done',
  'blocked', 'failed', 'cancelled',
];

function folderPath(joshRoot, state, id) {
  return path.join(joshRoot, 'todo', state, id);
}

function metaPath(joshRoot, state, id) {
  return path.join(folderPath(joshRoot, state, id), 'meta.json');
}

function ensureFolder(joshRoot, state, id) {
  fs.mkdirSync(folderPath(joshRoot, state, id), { recursive: true });
}

function writeJsonAtomic(p, obj) {
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, p);
}

function writeMeta(joshRoot, state, id, meta) {
  ensureFolder(joshRoot, state, id);
  writeJsonAtomic(metaPath(joshRoot, state, id), meta);
  // Also keep the one-line `state` sibling in sync.
  fs.writeFileSync(path.join(folderPath(joshRoot, state, id), 'state'), state + '\n', 'utf8');
}

function readMeta(joshRoot, state, id) {
  const p = metaPath(joshRoot, state, id);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

module.exports = {
  ALL_STATES,
  folderPath,
  metaPath,
  ensureFolder,
  writeMeta,
  readMeta,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd bin/josh && npm test`
Expected: 30 tests pass total (27 existing + 3 new), 0 fail.

- [ ] **Step 5: Commit**

```bash
git add bin/josh/lib/todo-folder.js bin/josh/test/todo-folder.test.js
git commit -m "feat(josh): add todo-folder helper (readMeta/writeMeta/ensureFolder)"
```

---

## Task 3: `todo-folder.js` — listTodosInState, findFolderById, transitionFolder

**Files:**
- Modify: `bin/josh/lib/todo-folder.js`
- Modify: `bin/josh/test/todo-folder.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `bin/josh/test/todo-folder.test.js`:

```javascript
test('listTodosInState: returns metas with their state', () => {
  const root = tmpRoot();
  tf.writeMeta(root, 'triaged', '01HXTEST0000000000000010', { schema: 1, id: '01HXTEST0000000000000010', title: 'a' });
  tf.writeMeta(root, 'triaged', '01HXTEST0000000000000011', { schema: 1, id: '01HXTEST0000000000000011', title: 'b' });
  tf.writeMeta(root, 'in_progress', '01HXTEST0000000000000012', { schema: 1, id: '01HXTEST0000000000000012', title: 'c' });
  const triaged = tf.listTodosInState(root, 'triaged');
  assert.equal(triaged.length, 2);
  assert.equal(triaged[0]._state, 'triaged');
  const ip = tf.listTodosInState(root, 'in_progress');
  assert.equal(ip.length, 1);
  assert.equal(ip[0].id, '01HXTEST0000000000000012');
  fs.rmSync(root, { recursive: true, force: true });
});

test('listTodosInState: returns empty for missing dir', () => {
  const root = tmpRoot();
  fs.rmSync(path.join(root, 'todo', 'triaged'), { recursive: true });
  const r = tf.listTodosInState(root, 'triaged');
  assert.deepEqual(r, []);
  fs.rmSync(root, { recursive: true, force: true });
});

test('findFolderById: locates folder by full id', () => {
  const root = tmpRoot();
  const id = '01HXTEST0000000000000020';
  tf.writeMeta(root, 'planning', id, { schema: 1, id, title: 'x' });
  const found = tf.findFolderById(root, id);
  assert.equal(found.state, 'planning');
  assert.equal(found.id, id);
  fs.rmSync(root, { recursive: true, force: true });
});

test('findFolderById: locates folder by 6-char suffix', () => {
  const root = tmpRoot();
  const id = '01HXTEST0000000000ABC123';
  tf.writeMeta(root, 'triaged', id, { schema: 1, id, title: 'y' });
  const found = tf.findFolderById(root, 'ABC123');
  assert.equal(found.state, 'triaged');
  assert.equal(found.id, id);
  fs.rmSync(root, { recursive: true, force: true });
});

test('findFolderById: returns null when not found', () => {
  const root = tmpRoot();
  assert.equal(tf.findFolderById(root, '01HXMISSING0000000000999'), null);
  fs.rmSync(root, { recursive: true, force: true });
});

test('transitionFolder: moves entire folder atomically + updates state file', () => {
  const root = tmpRoot();
  const id = '01HXTEST0000000000000030';
  tf.writeMeta(root, 'triaged', id, { schema: 1, id, title: 'm' });
  // Add a sibling that must move too
  fs.writeFileSync(path.join(root, 'todo', 'triaged', id, 'plan.md'), 'plan body');
  const r = tf.transitionFolder(root, 'triaged', 'planning', id);
  assert.equal(r.error, undefined);
  assert.equal(fs.existsSync(path.join(root, 'todo', 'triaged', id)), false);
  assert.equal(fs.existsSync(path.join(root, 'todo', 'planning', id, 'meta.json')), true);
  assert.equal(fs.existsSync(path.join(root, 'todo', 'planning', id, 'plan.md')), true);
  // state file matches new dir
  assert.equal(
    fs.readFileSync(path.join(root, 'todo', 'planning', id, 'state'), 'utf8').trim(),
    'planning'
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test('transitionFolder: returns code=3 when src missing (race)', () => {
  const root = tmpRoot();
  const r = tf.transitionFolder(root, 'triaged', 'planning', '01HXMISSING0000000000777');
  assert.equal(r.code, 3);
  assert.match(r.error, /no longer in triaged/);
  fs.rmSync(root, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bin/josh && npm test`
Expected: FAIL — `listTodosInState is not a function` (and others).

- [ ] **Step 3: Write minimal implementation**

Append to `bin/josh/lib/todo-folder.js` before `module.exports`:

```javascript
function listTodosInState(joshRoot, state) {
  const dir = path.join(joshRoot, 'todo', state);
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return []; }
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const meta = readMeta(joshRoot, state, e.name);
    if (!meta) continue;
    out.push({ ...meta, _state: state });
  }
  return out;
}

function findFolderById(joshRoot, idOrSuffix) {
  if (!idOrSuffix) return null;
  let exactHit = null;
  let suffixHit = null;
  for (const state of ALL_STATES) {
    const dir = path.join(joshRoot, 'todo', state);
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { continue; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name === idOrSuffix) {
        exactHit = { state, id: e.name };
        break;
      }
      if (idOrSuffix.length >= 4 && idOrSuffix.length < 26 && e.name.endsWith(idOrSuffix)) {
        if (!suffixHit) suffixHit = { state, id: e.name };
        else suffixHit.collision = true;
      }
    }
    if (exactHit) break;
  }
  return exactHit || suffixHit;
}

function transitionFolder(joshRoot, fromState, toState, id) {
  const fromDir = folderPath(joshRoot, fromState, id);
  const toDir = folderPath(joshRoot, toState, id);
  if (!fs.existsSync(fromDir)) {
    return { code: 3, error: `todo no longer in ${fromState} (race?)` };
  }
  if (fs.existsSync(toDir)) {
    return { code: 4, error: `target already exists: ${toState}/${id}` };
  }
  // Ensure parent exists
  fs.mkdirSync(path.dirname(toDir), { recursive: true });
  try {
    fs.renameSync(fromDir, toDir);
  } catch (e) {
    return { code: 4, error: `rename failed: ${e.message}` };
  }
  // Sync the one-line state file with the new parent dir name.
  try {
    fs.writeFileSync(path.join(toDir, 'state'), toState + '\n', 'utf8');
  } catch (e) {
    // non-fatal; meta.json is canonical
  }
  return { code: 0 };
}
```

Update `module.exports` to:

```javascript
module.exports = {
  ALL_STATES,
  folderPath,
  metaPath,
  ensureFolder,
  writeMeta,
  readMeta,
  listTodosInState,
  findFolderById,
  transitionFolder,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd bin/josh && npm test`
Expected: 36 tests pass total, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add bin/josh/lib/todo-folder.js bin/josh/test/todo-folder.test.js
git commit -m "feat(josh): add listTodosInState, findFolderById, transitionFolder"
```

---

## Task 4: Migrate `project-importer.js` to write folder layout

**Files:**
- Modify: `bin/josh/lib/project-importer.js`
- Modify: `bin/josh/test/project-importer.test.js`

- [ ] **Step 1: Update the existing failing test**

Replace the body of the existing test in `bin/josh/test/project-importer.test.js` named `'importProject: writes charter, todos, agent manifests under JOSH_ROOT'`. Find the lines:

```javascript
  // Verify todos written to triaged/
  const triaged = fs.readdirSync(path.join(tmpRoot, 'todo', 'triaged'));
  assert.equal(triaged.length, 2);
```

Replace them with:

```javascript
  // Verify todos written to triaged/<id>/meta.json (folder layout)
  const triaged = fs.readdirSync(path.join(tmpRoot, 'todo', 'triaged'), { withFileTypes: true });
  const todoDirs = triaged.filter((e) => e.isDirectory());
  assert.equal(todoDirs.length, 2, `expected 2 todo folders, got ${todoDirs.length}`);
  for (const e of todoDirs) {
    const metaPath = path.join(tmpRoot, 'todo', 'triaged', e.name, 'meta.json');
    assert.equal(fs.existsSync(metaPath), true, `meta.json missing for ${e.name}`);
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    assert.equal(meta.id, e.name, `meta.id mismatch for ${e.name}`);
    // state sibling exists and matches dir
    const stateFile = path.join(tmpRoot, 'todo', 'triaged', e.name, 'state');
    assert.equal(fs.readFileSync(stateFile, 'utf8').trim(), 'triaged');
    // events.ndjson sibling exists (empty file is fine)
    assert.equal(fs.existsSync(path.join(tmpRoot, 'todo', 'triaged', e.name, 'events.ndjson')), true);
  }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bin/josh && npm test`
Expected: FAIL — current importer writes flat `<id>.json` not `<id>/meta.json`.

- [ ] **Step 3: Write the implementation**

In `bin/josh/lib/project-importer.js`, find the loop:

```javascript
  for (const task of tasks) {
    const todo_id = taskUlids[task.display_id];
    const todoData = {
      ...
    };
    writeJsonAtomic(path.join(triagedDir, `${todo_id}.json`), todoData);
    ...
```

Replace the `writeJsonAtomic` line and surrounding folder setup. The full loop becomes:

```javascript
  for (const task of tasks) {
    const todo_id = taskUlids[task.display_id];
    const todoData = {
      schema: 1,
      id: todo_id,
      display_id: task.display_id,
      project_id,
      title: task.title,
      source_path: task.source_path,
      day: task.day,
      phase: task.phase,
      phase_name: task.phase_name,
      primary_role: task.primary_role,
      depends_on: task.depends_on_display_ids
        .map((d) => taskUlids[d])
        .filter(Boolean)
        .map((id) => ({ id, kind: 'hard' })),
      depends_on_display_ids: task.depends_on_display_ids,
      blocks_display_ids: task.blocks_display_ids,
      parallel_safety: task.parallel_safety,
      priority: 'p2',
      labels: [],
      verdict_mode: 'single',
      claim: null,
      created_at: now,
      created_by: actor,
      history: [{ at: now, actor, event: 'imported' }],
    };
    const todoDir = path.join(triagedDir, todo_id);
    ensureDir(todoDir);
    writeJsonAtomic(path.join(todoDir, 'meta.json'), todoData);
    fs.writeFileSync(path.join(todoDir, 'state'), 'triaged\n', 'utf8');
    // Touch an empty events.ndjson so the append helper has a file to grow.
    fs.writeFileSync(path.join(todoDir, 'events.ndjson'), '', 'utf8');

    appendAuditEvent(joshRoot, {
      schema: 1,
      at: now,
      actor,
      action: 'todo.imported',
      id: todo_id,
      details: { display_id: task.display_id, primary_role: task.primary_role },
    });
  }
```

(The only changes are: replace the single `writeJsonAtomic` call with a 4-line block that ensures the folder, writes `meta.json`, writes `state`, writes empty `events.ndjson`. The rest of the loop is unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd bin/josh && npm test`
Expected: The updated importer test passes. Other tests (project-status, project-sync) **will fail** because they read flat-file. This is expected — Tasks 5-6 fix them.

- [ ] **Step 5: Commit**

```bash
git add bin/josh/lib/project-importer.js bin/josh/test/project-importer.test.js
git commit -m "feat(josh): importer writes folder layout (meta.json + state + events.ndjson)"
```

---

## Task 5: Migrate `project-status.js` to read folder layout

**Files:**
- Modify: `bin/josh/lib/project-status.js`
- Modify: `bin/josh/test/project-status.test.js`

- [ ] **Step 1: Existing tests already failing from Task 4 — confirm**

Run: `cd bin/josh && npm test`
Expected: Project-status tests fail because the readers walk `<state>/<file>.json` but Task 4 now writes `<state>/<id>/meta.json`. Note the failing test names.

- [ ] **Step 2: Write the implementation**

Open `bin/josh/lib/project-status.js`. Find the inner loop:

```javascript
  for (const state of states) {
    counts[state] = 0;
    const dir = path.join(joshRoot, 'todo', state);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      let todo;
      try { todo = readJson(path.join(dir, file)); } catch (e) { continue; }
      ...
    }
  }
```

Replace with the folder-aware version. Add at the top of the file (after `const os = require('node:os');`):

```javascript
const tf = require('./todo-folder');
```

Replace the `for (const state of states)` block with:

```javascript
  for (const state of states) {
    counts[state] = 0;
    for (const todo of tf.listTodosInState(joshRoot, state)) {
      if (todo.project_id !== projectId) continue;
      counts[state]++;
      const dayKey = `Day ${todo.day}`;
      if (!byDay[dayKey]) byDay[dayKey] = { total: 0, done: 0, in_progress: 0, blocked: 0 };
      byDay[dayKey].total++;
      if (state === 'done') byDay[dayKey].done++;
      if (state === 'in_progress') byDay[dayKey].in_progress++;
      if (state === 'blocked') byDay[dayKey].blocked++;
    }
  }
```

Update the `states` array constant near the top of `renderDailyReview` (find the line `const states = ['incoming', 'triaged', 'in_progress', 'done', 'blocked', 'failed', 'cancelled'];`) — extend with the new states:

```javascript
  const states = [
    'incoming', 'triaged', 'claimed', 'planning', 'awaiting_approval',
    'approved', 'rejected', 'revised', 'in_progress', 'done',
    'blocked', 'failed', 'cancelled',
  ];
```

The local `readJson` helper inside this file is no longer used by the todo-iter loop, but the `charter.json` and `manifest.json` reads still call it — leave those alone.

- [ ] **Step 3: Run test to verify it passes**

Run: `cd bin/josh && npm test`
Expected: project-status tests pass again. project-sync tests still fail — fixed in Task 6.

- [ ] **Step 4: Commit**

```bash
git add bin/josh/lib/project-status.js
git commit -m "feat(josh): project-status reads folder layout via todo-folder helper"
```

---

## Task 6: Migrate `project-sync.js` to read/write folder layout

**Files:**
- Modify: `bin/josh/lib/project-sync.js`

- [ ] **Step 1: Confirm failing tests**

Run: `cd bin/josh && npm test`
Expected: project-sync tests still fail because `diffProject` and `applySync` walk `<state>/<file>.json`.

- [ ] **Step 2: Write the implementation**

Open `bin/josh/lib/project-sync.js`. Add at the top after the existing requires:

```javascript
const tf = require('./todo-folder');
```

Find the `diffProject` function and locate the section:

```javascript
  // Diff todos (any state)
  const states = ['incoming', 'triaged', 'in_progress', 'done', 'blocked', 'failed', 'cancelled'];
  for (const state of states) {
    const dir = path.join(joshRoot, 'todo', state);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      let todo;
      try { todo = readJson(path.join(dir, file)); } catch (e) { continue; }
      if (todo.project_id !== projectId) continue;
      ...
    }
  }
```

Replace with:

```javascript
  // Diff todos (any state)
  const states = [
    'incoming', 'triaged', 'claimed', 'planning', 'awaiting_approval',
    'approved', 'rejected', 'revised', 'in_progress', 'done',
    'blocked', 'failed', 'cancelled',
  ];
  for (const state of states) {
    for (const todo of tf.listTodosInState(joshRoot, state)) {
      if (todo.project_id !== projectId) continue;
      if (!fs.existsSync(todo.source_path)) {
        result.tasks_missing.push({ id: todo.id, display_id: todo.display_id, source_path: todo.source_path });
        continue;
      }
      const fresh = parseTask(todo.source_path);
      const changed =
        fresh.title !== todo.title ||
        fresh.day !== todo.day ||
        fresh.phase !== todo.phase ||
        fresh.primary_role !== todo.primary_role ||
        JSON.stringify(fresh.depends_on_display_ids) !== JSON.stringify(todo.depends_on_display_ids) ||
        JSON.stringify(fresh.blocks_display_ids) !== JSON.stringify(todo.blocks_display_ids);
      if (changed) {
        result.tasks_changed.push({ id: todo.id, display_id: todo.display_id, state });
      }
    }
  }
```

In `applySync`, find the section that locates a todo file:

```javascript
    const states = ['incoming', 'triaged', 'in_progress', 'done', 'blocked', 'failed', 'cancelled'];
    for (const change of diff.tasks_changed) {
      // Locate todo file
      let todoPath = null;
      for (const state of states) {
        const candidate = path.join(joshRoot, 'todo', state, `${change.id}.json`);
        if (fs.existsSync(candidate)) { todoPath = candidate; break; }
      }
      if (!todoPath) continue;
      const todo = readJson(todoPath);
      ...
      writeJsonAtomic(todoPath, todo);
      ...
    }
```

Replace with:

```javascript
    const allStates = [
      'incoming', 'triaged', 'claimed', 'planning', 'awaiting_approval',
      'approved', 'rejected', 'revised', 'in_progress', 'done',
      'blocked', 'failed', 'cancelled',
    ];
    for (const change of diff.tasks_changed) {
      const found = tf.findFolderById(joshRoot, change.id);
      if (!found) continue;
      const todo = tf.readMeta(joshRoot, found.state, found.id);
      if (!todo) continue;
      const fresh = parseTask(todo.source_path);
      todo.title = fresh.title;
      todo.day = fresh.day;
      todo.phase = fresh.phase;
      todo.phase_name = fresh.phase_name;
      todo.primary_role = fresh.primary_role;
      todo.depends_on_display_ids = fresh.depends_on_display_ids;
      todo.blocks_display_ids = fresh.blocks_display_ids;
      todo.parallel_safety = fresh.parallel_safety;
      todo.synced_at = now;
      todo.synced_by = actor;
      todo.history = todo.history || [];
      todo.history.push({ at: now, actor, event: 'synced' });
      tf.writeMeta(joshRoot, found.state, found.id, todo);
      tasks_updated++;
      appendAuditEvent(joshRoot, {
        schema: 1, at: now, actor, action: 'todo.synced', id: todo.id,
        details: { display_id: todo.display_id },
      });
    }
```

(The unused local `allStates` array is left in place because the test file may reference it; if `npm test` flags an unused-variable lint, leave it — there is no linter wired into this project.)

- [ ] **Step 3: Run test to verify it passes**

Run: `cd bin/josh && npm test`
Expected: All 36 tests pass.

- [ ] **Step 4: Commit**

```bash
git add bin/josh/lib/project-sync.js
git commit -m "feat(josh): project-sync reads/writes folder layout via todo-folder helper"
```

---

## Task 7: Migrate `josh.js` core helpers (`locateTodo`, `transitionTodo`, `moveTodo`) to folder layout

**Files:**
- Modify: `bin/josh/josh.js`

This is the biggest migration step. After Task 6, the importer + sync + status all use folder layout, but `josh.js` itself still walks flat `<state>/<id>.json` paths in `locateTodo`, `transitionTodo`, `moveTodo`, `triageOne`, `sweepStaleClaims`, `findById`, and the `cmdControl` reorder branch. We migrate them all in one pass so that an existing project import + claim flow keeps working end to end.

- [ ] **Step 1: Write a failing integration test**

Create `bin/josh/test/josh-cli-folder-layout.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

const JOSH_BIN = path.resolve(__dirname, '..', 'josh.js');

function runCli(args, env) {
  return execSync(`node "${JOSH_BIN}" ${args}`, {
    env: { ...process.env, ...env },
    stdio: 'pipe',
  }).toString();
}

function setupRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-cli-'));
  runCli('init', { JOSH_ROOT: root });
  return root;
}

test('cli: claim flow works against folder layout', () => {
  const root = setupRoot();
  // Push a todo via the CLI (creates flat-file in incoming under current code paths)
  const out = runCli('push todo "do a thing"', { JOSH_ROOT: root });
  // The push CLI prints the new id on the last non-empty line
  const id = out.trim().split('\n').filter(Boolean).pop().trim();

  // Tick to triage it (push goes to incoming → triaged)
  runCli('tick', { JOSH_ROOT: root });

  // Verify folder layout in triaged
  const triagedDir = path.join(root, 'todo', 'triaged', id);
  assert.equal(fs.existsSync(path.join(triagedDir, 'meta.json')), true,
    `expected ${triagedDir}/meta.json after tick`);
  assert.equal(fs.readFileSync(path.join(triagedDir, 'state'), 'utf8').trim(), 'triaged');

  // Claim — moves into in_progress (Phase 2A keeps existing claim semantics for now;
  // the new --agent + claimed state lands in Task 11.)
  runCli(`claim ${id} --as test`, { JOSH_ROOT: root });
  const ipDir = path.join(root, 'todo', 'in_progress', id);
  assert.equal(fs.existsSync(path.join(ipDir, 'meta.json')), true, 'expected meta.json in in_progress');

  fs.rmSync(root, { recursive: true, force: true });
});
```

Run: `cd bin/josh && npm test`
Expected: FAIL — current `josh.js` writes flat-file in `triageOne` / `cmdPushTodo`, so `meta.json` will not exist.

- [ ] **Step 2: Update `cmdPushTodo` to write folder layout in incoming/**

In `bin/josh/josh.js`, find `cmdPushTodo`. Locate the line near the end:

```javascript
  const filepath = path.join(JOSH_ROOT, 'todo', 'incoming', `${id}.json`);
  writeJsonAtomic(filepath, todo);
  appendAudit({ actor: createdBy, action: 'todo.pushed', id, details: { agent: todo.agent, priority: todo.priority } });
  log(id);
  return 0;
```

Replace the `filepath` and `writeJsonAtomic` lines with:

```javascript
  const todoDir = path.join(JOSH_ROOT, 'todo', 'incoming', id);
  fs.mkdirSync(todoDir, { recursive: true });
  writeJsonAtomic(path.join(todoDir, 'meta.json'), todo);
  fs.writeFileSync(path.join(todoDir, 'state'), 'incoming\n', 'utf8');
  fs.writeFileSync(path.join(todoDir, 'events.ndjson'), '', 'utf8');
```

- [ ] **Step 3: Update `locateTodo` to find folders**

Replace the body of `locateTodo` in `bin/josh/josh.js`:

```javascript
function locateTodo(idOrSuffix, expectedStates) {
  // Folder layout: ~/.josh/todo/<state>/<id>/meta.json
  const ALL_STATES = [
    'incoming', 'triaged', 'claimed', 'planning', 'awaiting_approval',
    'approved', 'rejected', 'revised', 'in_progress', 'done',
    'blocked', 'failed', 'cancelled',
  ];
  let exactHit = null;
  let suffixHit = null;
  for (const state of ALL_STATES) {
    const dir = path.join(JOSH_ROOT, 'todo', state);
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { continue; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name === idOrSuffix) {
        exactHit = { state, id: e.name };
        break;
      }
      if (idOrSuffix.length >= 4 && idOrSuffix.length < 26 && e.name.endsWith(idOrSuffix)) {
        if (!suffixHit) suffixHit = { state, id: e.name };
        else suffixHit.collision = true;
      }
    }
    if (exactHit) break;
  }
  const hit = exactHit || suffixHit;
  if (!hit) return { error: 'not found', code: 2 };
  if (expectedStates && !expectedStates.includes(hit.state)) {
    return { error: `todo is in state '${hit.state}', expected one of: ${expectedStates.join(', ')}`, code: 1 };
  }
  return {
    path: path.join(JOSH_ROOT, 'todo', hit.state, hit.id, 'meta.json'),
    folder: path.join(JOSH_ROOT, 'todo', hit.state, hit.id),
    state: hit.state,
    id: hit.id,
    relative: `todo/${hit.state}/${hit.id}`,
  };
}
```

- [ ] **Step 4: Update `transitionTodo` to move folders**

Replace the body of `transitionTodo`:

```javascript
function transitionTodo({ src, dst, srcStates, idOrSuffix, actor, eventName, eventDetails, update, audit }) {
  const located = locateTodo(idOrSuffix, srcStates);
  if (located.error) return { code: located.code, error: located.error };

  const fromDir = located.folder;
  const toDir = path.join(JOSH_ROOT, 'todo', dst, located.id);
  if (fs.existsSync(toDir)) {
    return { code: 4, error: `target already exists: todo/${dst}/${located.id}` };
  }

  // Atomic rename of the entire folder = lock acquisition.
  try {
    fs.mkdirSync(path.dirname(toDir), { recursive: true });
    fs.renameSync(fromDir, toDir);
  } catch (e) {
    if (e.code === 'ENOENT') return { code: 3, error: `todo no longer in ${located.state} (race?)` };
    if (e.code === 'EEXIST' || e.code === 'EPERM' || e.code === 'EACCES') {
      return { code: 4, error: `rename failed: ${e.message}` };
    }
    throw e;
  }

  // We own the folder at toDir. Read meta, mutate, write.
  const metaPath = path.join(toDir, 'meta.json');
  const todo = readJson(metaPath);
  if (!todo) return { code: 4, error: `malformed meta.json at ${dst}/${located.id}` };
  todo.history = todo.history || [];
  const now = new Date().toISOString();
  todo.history.push({ at: now, actor, event: eventName, details: eventDetails || {} });
  if (typeof update === 'function') update(todo, now);
  writeJsonAtomic(metaPath, todo);
  // Sync the one-line state file.
  try { fs.writeFileSync(path.join(toDir, 'state'), dst + '\n', 'utf8'); } catch (e) { /* non-fatal */ }

  if (audit) appendAudit({ actor, action: audit.action, id: located.id, details: audit.details || {} });

  return { code: 0, id: located.id, todo };
}
```

- [ ] **Step 5: Update `moveTodo` to move folders**

Replace `moveTodo`:

```javascript
function moveTodo(fromMetaPath, toState, todo) {
  // fromMetaPath is a path to ~/.josh/todo/<state>/<id>/meta.json.
  const fromDir = path.dirname(fromMetaPath);
  const id = todo.id;
  const toDir = path.join(JOSH_ROOT, 'todo', toState, id);
  // Re-write meta with updated history first, then rename the folder.
  writeJsonAtomic(fromMetaPath, todo);
  fs.mkdirSync(path.dirname(toDir), { recursive: true });
  fs.renameSync(fromDir, toDir);
  try { fs.writeFileSync(path.join(toDir, 'state'), toState + '\n', 'utf8'); } catch (e) { /* non-fatal */ }
}
```

- [ ] **Step 6: Update `triageOne`, `sweepStaleClaims`, `cmdControl/reorder` to walk folders**

In `triageOne` (around line 434), find the block at the top:

```javascript
function triageOne(file, opts, routingCfg) {
  const todo = readJson(file.path);
  if (!todo) {
    err(`warn: skipping malformed ${file.path}; moving to failed/`);
    const failedPath = path.join(JOSH_ROOT, 'todo', 'failed', file.name);
    try { fs.renameSync(file.path, failedPath); } catch (e) {}
    appendAudit({ actor: 'orchestrator', action: 'todo.malformed', id: file.name, details: {} });
    return { result: 'malformed' };
  }
  const now = new Date().toISOString();
  ...
  moveTodo(file.path, 'triaged', todo);
```

The signature `file = { path, name }` now refers to a folder. Replace `triageOne` with this folder-aware version:

```javascript
function triageOne(folderEntry, opts, routingCfg) {
  // folderEntry: { dir, id }  where dir is full path to the per-todo folder under incoming/
  const metaPath = path.join(folderEntry.dir, 'meta.json');
  const todo = readJson(metaPath);
  if (!todo) {
    err(`warn: skipping malformed ${metaPath}; moving folder to failed/`);
    const failedDir = path.join(JOSH_ROOT, 'todo', 'failed', folderEntry.id);
    try {
      fs.mkdirSync(path.dirname(failedDir), { recursive: true });
      fs.renameSync(folderEntry.dir, failedDir);
    } catch (e) {}
    appendAudit({ actor: 'orchestrator', action: 'todo.malformed', id: folderEntry.id, details: {} });
    return { result: 'malformed' };
  }
  const now = new Date().toISOString();

  const route = applyRouting(todo, routingCfg);
  let routedFrom = null;
  if (route.agent !== todo.agent) {
    routedFrom = todo.agent;
    todo.agent = route.agent;
  }

  todo.history = todo.history || [];
  todo.history.push({
    at: now,
    actor: 'orchestrator',
    event: 'triaged',
    ...(routedFrom !== null
      ? { details: { routed_from: routedFrom, routed_to: route.agent, matched_rule: route.matched_rule || null } }
      : {})
  });
  moveTodo(metaPath, 'triaged', todo);
  appendAudit({
    actor: 'orchestrator',
    action: 'todo.triaged',
    id: todo.id,
    details: {
      agent: todo.agent,
      priority: todo.priority,
      ...(routedFrom !== null ? { routed_from: routedFrom, matched_rule: route.matched_rule || null } : {})
    }
  });
  return { result: 'triaged', id: todo.id, routed: routedFrom !== null };
}
```

In `cmdTick`, find the block that calls `triageOne`:

```javascript
      const incomingDir = path.join(JOSH_ROOT, 'todo', 'incoming');
      for (const file of listJsonIn(incomingDir)) {
        const r = triageOne(file, null, routingCfg);
```

Replace with a folder-walker:

```javascript
      const incomingDir = path.join(JOSH_ROOT, 'todo', 'incoming');
      let entries = [];
      try { entries = fs.readdirSync(incomingDir, { withFileTypes: true }); } catch (e) {}
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        const folderEntry = { dir: path.join(incomingDir, e.name), id: e.name };
        const r = triageOne(folderEntry, null, routingCfg);
```

In `sweepStaleClaims`, replace:

```javascript
function sweepStaleClaims(opts) {
  let swept = 0;
  const dir = path.join(JOSH_ROOT, 'todo', 'in_progress');
  for (const file of listJsonIn(dir)) {
    const todo = readJson(file.path);
    ...
    moveTodo(file.path, 'triaged', todo);
```

With:

```javascript
function sweepStaleClaims(opts) {
  let swept = 0;
  const dir = path.join(JOSH_ROOT, 'todo', 'in_progress');
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) {}
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const metaPath = path.join(dir, e.name, 'meta.json');
    const todo = readJson(metaPath);
    if (!todo) continue;
    if (!todo.claim || !todo.claim.at || !todo.claim.ttl_sec) continue;
    const claimAt = new Date(todo.claim.at).getTime();
    const expiresAt = claimAt + todo.claim.ttl_sec * 1000;
    if (Date.now() < expiresAt) continue;
    const previousHolder = todo.claim.by;
    const previousTtl = todo.claim.ttl_sec;
    todo.claim = null;
    todo.history = todo.history || [];
    todo.history.push({
      at: new Date().toISOString(),
      actor: 'orchestrator',
      event: 'claim_expired',
      details: { previous_holder: previousHolder, ttl_sec: previousTtl }
    });
    moveTodo(metaPath, 'triaged', todo);
    appendAudit({
      actor: 'orchestrator',
      action: 'todo.claim_expired',
      id: todo.id,
      details: { previous_holder: previousHolder, ttl_sec: previousTtl }
    });
    swept++;
  }
  return swept;
}
```

In `processControlOne`'s `reorder` branch, find:

```javascript
      for (const state of ['incoming', 'triaged', 'blocked']) {
        const filePath = path.join(JOSH_ROOT, 'todo', state, `${todoId}.json`);
        if (!fs.existsSync(filePath)) continue;
        const todo = readJson(filePath);
        ...
        writeJsonAtomic(filePath, todo);
```

Replace with:

```javascript
      for (const state of ['incoming', 'triaged', 'blocked']) {
        const metaPath = path.join(JOSH_ROOT, 'todo', state, todoId, 'meta.json');
        if (!fs.existsSync(metaPath)) continue;
        const todo = readJson(metaPath);
        if (!todo) continue;
        const oldPri = todo.priority;
        todo.priority = newPri;
        todo.history.push({ at: new Date().toISOString(), actor: 'orchestrator', event: 'reordered', details: { from: oldPri, to: newPri } });
        writeJsonAtomic(metaPath, todo);
        touched = true;
        appendAudit({ actor: 'orchestrator', action: 'todo.reordered', id: todoId, details: { from: oldPri, to: newPri } });
        break;
      }
```

- [ ] **Step 7: Update `findById` to find folders too**

`findById` (line 183) is also used by `cmdShow` for non-todo artifacts (handoffs, approvals, reviews, locks). Those still live as flat-file `.json`. Add a folder branch that fires only inside `todo/`:

Insert this helper near `findById` (right after it):

```javascript
function findTodoFolderById(idOrSuffix) {
  // Returns { path, relative } where path → meta.json, OR null.
  const ALL_STATES = [
    'incoming', 'triaged', 'claimed', 'planning', 'awaiting_approval',
    'approved', 'rejected', 'revised', 'in_progress', 'done',
    'blocked', 'failed', 'cancelled',
  ];
  let exactHit = null;
  let suffixHit = null;
  for (const state of ALL_STATES) {
    const dir = path.join(JOSH_ROOT, 'todo', state);
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { continue; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name === idOrSuffix) {
        exactHit = { state, id: e.name };
        break;
      }
      if (idOrSuffix.length >= 4 && idOrSuffix.length < 26 && e.name.endsWith(idOrSuffix)) {
        if (!suffixHit) suffixHit = { state, id: e.name };
      }
    }
    if (exactHit) break;
  }
  const hit = exactHit || suffixHit;
  if (!hit) return null;
  return {
    path: path.join(JOSH_ROOT, 'todo', hit.state, hit.id, 'meta.json'),
    folder: path.join(JOSH_ROOT, 'todo', hit.state, hit.id),
    relative: `todo/${hit.state}/${hit.id}`,
  };
}
```

Update `cmdShow`. Find the block:

```javascript
  const found = findById(id);
  if (!found) {
    err(`not found: ${id}`);
    return 2;
  }
```

Insert a todo-folder fallback right before the `found` check fails. Replace `cmdShow` body's first lines:

```javascript
function cmdShow(args) {
  const id = args[0];
  if (!id) {
    err('error: id required. usage: josh show <id>');
    return 1;
  }

  // Look in todo/<state>/<id>/meta.json first.
  const todoFound = findTodoFolderById(id);
  if (todoFound) {
    log(`# ${todoFound.relative}/meta.json`);
    const obj = readJson(todoFound.path);
    if (obj) log(JSON.stringify(obj, null, 2));
    else log(fs.readFileSync(todoFound.path, 'utf8'));
    return 0;
  }

  const found = findById(id);
  if (!found) {
    err(`not found: ${id}`);
    return 2;
  }
  if (found.collision) {
    err(`warn: id suffix '${id}' matched multiple files; showing first. use full ID to disambiguate.`);
  }

  log(`# ${found.relative}`);
  if (found.path.endsWith('.json')) {
    const obj = readJson(found.path);
    if (obj) log(JSON.stringify(obj, null, 2));
    else log(fs.readFileSync(found.path, 'utf8'));
  } else {
    log(fs.readFileSync(found.path, 'utf8'));
  }
  return 0;
}
```

- [ ] **Step 8: Update `cmdListTodo` to walk folders**

In `cmdListTodo`, find:

```javascript
  for (const state of states) {
    const dir = path.join(JOSH_ROOT, 'todo', state);
    let files;
    try { files = fs.readdirSync(dir).filter(f => f.endsWith('.json')); } catch (e) { continue; }
    for (const f of files) {
      const todo = readJson(path.join(dir, f));
      ...
```

Replace with:

```javascript
  for (const state of states) {
    const dir = path.join(JOSH_ROOT, 'todo', state);
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { continue; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const todo = readJson(path.join(dir, e.name, 'meta.json'));
      if (!todo) continue;
      if (parsed.values.agent && todo.agent !== parsed.values.agent) continue;
      if (parsed.values.priority && todo.priority !== parsed.values.priority) continue;
      todos.push({ ...todo, _state: state });
    }
  }
```

Also update `allStates` near the top of `cmdListTodo`:

```javascript
  const allStates = [
    'incoming', 'triaged', 'claimed', 'planning', 'awaiting_approval',
    'approved', 'rejected', 'revised', 'in_progress', 'done',
    'blocked', 'failed', 'cancelled',
  ];
  const liveStates = [
    'incoming', 'triaged', 'claimed', 'planning', 'awaiting_approval',
    'approved', 'in_progress', 'blocked',
  ];
```

- [ ] **Step 9: Update `validatorFor` regex**

Find `validatorFor` (around line 2448). Update the todo line:

```javascript
  if (norm.match(/^todo\/(incoming|triaged|in_progress|done|blocked|failed|cancelled)\/.+\.json$/)) {
    return { kind: 'todo', fn: validateTodo };
  }
```

Replace with:

```javascript
  if (norm.match(/^todo\/(incoming|triaged|claimed|planning|awaiting_approval|approved|rejected|revised|in_progress|done|blocked|failed|cancelled)\/[^/]+\/meta\.json$/)) {
    return { kind: 'todo', fn: validateTodo };
  }
```

- [ ] **Step 10: Update `refreshQueueCounts` and `countDir`**

`countDir` walks any dir and counts non-`.tmp` non-dot entries — it counts directories just fine (each todo is a dir now). No code change required there. But `refreshQueueCounts` can stay as-is because each per-todo subfolder is exactly one count. Confirm by inspection — no edit needed.

- [ ] **Step 11: Run all tests**

Run: `cd bin/josh && npm test`
Expected: All tests pass (37 unit + integration test from Task 7 = 38 tests total). The new `josh-cli-folder-layout.test.js` exercises push → tick → claim end-to-end against the migrated CLI.

If a test fails: open the test, run it in isolation with `node --test test/<file>.test.js`, set `JOSH_DEBUG=1` for stack traces.

- [ ] **Step 12: Commit**

```bash
git add bin/josh/josh.js bin/josh/test/josh-cli-folder-layout.test.js
git commit -m "feat(josh): migrate josh.js core helpers to folder layout"
```

---

## Task 8: `events-writer.js` — append events.ndjson

**Files:**
- Create: `bin/josh/lib/events-writer.js`
- Create: `bin/josh/test/events-writer.test.js`

- [ ] **Step 1: Write the failing test**

Create `bin/josh/test/events-writer.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { appendEvent, EVENT_KINDS } = require('../lib/events-writer');
const tf = require('../lib/todo-folder');

function tmpRoot() {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-ev-'));
  fs.mkdirSync(path.join(r, 'todo', 'in_progress'), { recursive: true });
  return r;
}

test('EVENT_KINDS exposes all 14 event types', () => {
  assert.equal(EVENT_KINDS.length, 14);
  for (const k of ['start', 'heartbeat', 'done', 'failed', 'interrupted',
    'backend_ref', 'run_started', 'text_delta', 'tool_call', 'pending_input',
    'pending_input_resolved', 'plan_artifact', 'settings_changed', 'run_completed']) {
    assert.ok(EVENT_KINDS.includes(k), `missing event kind: ${k}`);
  }
});

test('appendEvent: writes one JSON line', () => {
  const root = tmpRoot();
  const id = '01HXEVT00000000000000001';
  tf.writeMeta(root, 'in_progress', id, { schema: 1, id, title: 't' });
  appendEvent(root, 'in_progress', id, { kind: 'start', actor: 'A01' });
  const lines = fs.readFileSync(path.join(root, 'todo', 'in_progress', id, 'events.ndjson'), 'utf8').trim().split('\n');
  assert.equal(lines.length, 1);
  const ev = JSON.parse(lines[0]);
  assert.equal(ev.kind, 'start');
  assert.equal(ev.actor, 'A01');
  assert.match(ev.ts, /^\d{4}-\d{2}-\d{2}T/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('appendEvent: rejects unknown kind', () => {
  const root = tmpRoot();
  const id = '01HXEVT00000000000000002';
  tf.writeMeta(root, 'in_progress', id, { schema: 1, id });
  assert.throws(() => appendEvent(root, 'in_progress', id, { kind: 'gibberish' }), /unknown event kind/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('appendEvent: appends without overwriting prior events', () => {
  const root = tmpRoot();
  const id = '01HXEVT00000000000000003';
  tf.writeMeta(root, 'in_progress', id, { schema: 1, id });
  appendEvent(root, 'in_progress', id, { kind: 'start' });
  appendEvent(root, 'in_progress', id, { kind: 'heartbeat' });
  appendEvent(root, 'in_progress', id, { kind: 'done' });
  const lines = fs.readFileSync(path.join(root, 'todo', 'in_progress', id, 'events.ndjson'), 'utf8').trim().split('\n');
  assert.equal(lines.length, 3);
  assert.equal(JSON.parse(lines[0]).kind, 'start');
  assert.equal(JSON.parse(lines[2]).kind, 'done');
  fs.rmSync(root, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bin/josh && npm test`
Expected: FAIL — `Cannot find module '../lib/events-writer'`.

- [ ] **Step 3: Write the implementation**

Create `bin/josh/lib/events-writer.js`:

```javascript
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const LIFECYCLE_KINDS = ['start', 'heartbeat', 'done', 'failed', 'interrupted'];
const STREAM_KINDS = [
  'backend_ref',
  'run_started',
  'text_delta',
  'tool_call',
  'pending_input',
  'pending_input_resolved',
  'plan_artifact',
  'settings_changed',
  'run_completed',
];
const EVENT_KINDS = [...LIFECYCLE_KINDS, ...STREAM_KINDS];
const EVENT_KINDS_SET = new Set(EVENT_KINDS);

function appendEvent(joshRoot, state, todoId, event) {
  if (!event || typeof event.kind !== 'string') {
    throw new Error('event must have a "kind" string field');
  }
  if (!EVENT_KINDS_SET.has(event.kind)) {
    throw new Error(`unknown event kind: ${event.kind}. expected one of: ${EVENT_KINDS.join(', ')}`);
  }
  const folderDir = path.join(joshRoot, 'todo', state, todoId);
  if (!fs.existsSync(folderDir)) {
    throw new Error(`todo folder does not exist: ${folderDir}`);
  }
  const out = path.join(folderDir, 'events.ndjson');
  const enriched = { ts: new Date().toISOString(), ...event };
  fs.appendFileSync(out, JSON.stringify(enriched) + '\n', 'utf8');
}

module.exports = {
  LIFECYCLE_KINDS,
  STREAM_KINDS,
  EVENT_KINDS,
  appendEvent,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd bin/josh && npm test`
Expected: 42 tests pass total, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add bin/josh/lib/events-writer.js bin/josh/test/events-writer.test.js
git commit -m "feat(josh): add events-writer (14-event taxonomy append helper)"
```

---

## Task 9: `agent-brief.js` — load agent brief reference

**Files:**
- Create: `bin/josh/lib/agent-brief.js`
- Create: `bin/josh/test/agent-brief.test.js`

- [ ] **Step 1: Write the failing test**

Create `bin/josh/test/agent-brief.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { loadBrief } = require('../lib/agent-brief');

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'josh-brief-'));
}

test('loadBrief: returns path + contents from manifest source_path', () => {
  const root = tmpRoot();
  const briefSource = path.join(root, 'AGENT_07.md');
  fs.writeFileSync(briefSource, '# Agent A07 - Demo\n\nMission: testing.\n');
  fs.mkdirSync(path.join(root, 'agents', 'A07'), { recursive: true });
  fs.writeFileSync(path.join(root, 'agents', 'A07', 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A07', source_path: briefSource,
  }));
  const r = loadBrief(root, 'A07');
  assert.equal(r.path, briefSource);
  assert.match(r.contents, /Mission: testing/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('loadBrief: throws when manifest missing', () => {
  const root = tmpRoot();
  assert.throws(() => loadBrief(root, 'A99'), /manifest not found/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('loadBrief: throws when source file missing', () => {
  const root = tmpRoot();
  fs.mkdirSync(path.join(root, 'agents', 'A06'), { recursive: true });
  fs.writeFileSync(path.join(root, 'agents', 'A06', 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A06', source_path: path.join(root, 'does-not-exist.md'),
  }));
  assert.throws(() => loadBrief(root, 'A06'), /source brief not found/);
  fs.rmSync(root, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bin/josh && npm test`
Expected: FAIL — `Cannot find module '../lib/agent-brief'`.

- [ ] **Step 3: Write the implementation**

Create `bin/josh/lib/agent-brief.js`:

```javascript
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function loadBrief(joshRoot, agentId) {
  const manifestPath = path.join(joshRoot, 'agents', agentId, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`agent manifest not found: ${manifestPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!manifest.source_path || !fs.existsSync(manifest.source_path)) {
    throw new Error(`agent source brief not found: ${manifest.source_path || '<unset>'}`);
  }
  const contents = fs.readFileSync(manifest.source_path, 'utf8');
  return { path: manifest.source_path, contents };
}

module.exports = { loadBrief };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd bin/josh && npm test`
Expected: 45 tests pass total, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add bin/josh/lib/agent-brief.js bin/josh/test/agent-brief.test.js
git commit -m "feat(josh): add agent-brief loader (resolves manifest.source_path)"
```

---

## Task 10: `plan-validator.js` — validate 8-section plan + frontmatter

**Files:**
- Create: `bin/josh/lib/plan-validator.js`
- Create: `bin/josh/test/plan-validator.test.js`
- Create: `bin/josh/test/fixtures/sample-plan.md`

- [ ] **Step 1: Write the fixture**

Create `bin/josh/test/fixtures/sample-plan.md`:

```markdown
---
id: 01HXPLAN00000000000000001
status: PENDING
claimed_by: A01
plan_hash: abc123
---

## Fast-Path

This plan locks the four-day launch definition.

## Problem statement

The launch definition is currently fluid.

## Current state evidence

PROGRESS_TRACKER.md shows the launch in scope-lock day 1.

## Proposed approach

Freeze the definition by writing a one-page brief and committing it.

## Step-by-step change list

1. Draft the brief.
2. Review with command center.
3. Commit.

## Risks + rollback

Risk: scope grows mid-week. Rollback: revert the commit and re-run scope.

## Test plan

Run `josh project status` and confirm Day 1 phase 1 shows the new brief.

## Approval prompt

Reply APPROVE: 01HXPLAN00000000000000001 or REVISE: <reason>
```

- [ ] **Step 2: Write the failing test**

Create `bin/josh/test/plan-validator.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validatePlan } = require('../lib/plan-validator');

const SAMPLE = fs.readFileSync(path.join(__dirname, 'fixtures/sample-plan.md'), 'utf8');

test('validatePlan: accepts the sample fixture', () => {
  const r = validatePlan(SAMPLE);
  assert.equal(r.ok, true, `errors: ${JSON.stringify(r.errors)}`);
  assert.equal(r.frontmatter.id, '01HXPLAN00000000000000001');
  assert.equal(r.frontmatter.status, 'PENDING');
  assert.equal(r.sections.length, 8);
});

test('validatePlan: rejects missing frontmatter', () => {
  const r = validatePlan('## Fast-Path\n\ntext\n');
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /frontmatter/i.test(e)));
});

test('validatePlan: rejects missing required frontmatter field', () => {
  const broken = SAMPLE.replace(/\nclaimed_by: A01/, '');
  const r = validatePlan(broken);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /claimed_by/.test(e)));
});

test('validatePlan: rejects invalid status', () => {
  const broken = SAMPLE.replace(/\nstatus: PENDING/, '\nstatus: WHATEVER');
  const r = validatePlan(broken);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /status.*PENDING.*APPROVED.*REVISED/.test(e)));
});

test('validatePlan: rejects missing required section', () => {
  const broken = SAMPLE.replace(/\n## Risks \+ rollback\n[\s\S]*?\n## Test plan/, '\n## Test plan');
  const r = validatePlan(broken);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /Risks \+ rollback/.test(e)));
});

test('validatePlan: rejects sections in wrong order', () => {
  const swapped = SAMPLE.replace(
    /## Problem statement([\s\S]*?)\n## Current state evidence/,
    '## Current state evidence$1\n## Problem statement'
  );
  const r = validatePlan(swapped);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /order/i.test(e)));
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd bin/josh && npm test`
Expected: FAIL — `Cannot find module '../lib/plan-validator'`.

- [ ] **Step 4: Write the implementation**

Create `bin/josh/lib/plan-validator.js`:

```javascript
'use strict';

const REQUIRED_SECTIONS = [
  'Fast-Path',
  'Problem statement',
  'Current state evidence',
  'Proposed approach',
  'Step-by-step change list',
  'Risks + rollback',
  'Test plan',
  'Approval prompt',
];

const REQUIRED_FRONTMATTER = ['id', 'status', 'claimed_by', 'plan_hash'];
const VALID_STATUS = ['PENDING', 'APPROVED', 'REVISED'];

function parseFrontmatter(text) {
  if (!text.startsWith('---\n')) return { found: false, frontmatter: {}, body: text };
  const closeIdx = text.indexOf('\n---\n', 4);
  if (closeIdx === -1) return { found: false, frontmatter: {}, body: text };
  const block = text.slice(4, closeIdx);
  const body = text.slice(closeIdx + 5);
  const frontmatter = {};
  for (const line of block.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (key) frontmatter[key] = value;
  }
  return { found: true, frontmatter, body };
}

function extractSections(body) {
  // Each H2 heading starts a section. Returns [{title, body}] in order.
  const sections = [];
  const re = /^##\s+(.+)$/gm;
  const matches = [];
  let m;
  while ((m = re.exec(body)) !== null) {
    matches.push({ title: m[1].trim(), start: m.index, contentStart: m.index + m[0].length });
  }
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const next = matches[i + 1];
    const sectionBody = body.slice(cur.contentStart, next ? next.start : body.length).trim();
    sections.push({ title: cur.title, body: sectionBody });
  }
  return sections;
}

function validatePlan(text) {
  const errors = [];
  const fm = parseFrontmatter(text);
  if (!fm.found) {
    errors.push('plan must start with YAML frontmatter delimited by --- ... ---');
    return { ok: false, errors, frontmatter: {}, sections: [] };
  }
  for (const k of REQUIRED_FRONTMATTER) {
    if (!fm.frontmatter[k]) errors.push(`frontmatter missing required field: ${k}`);
  }
  if (fm.frontmatter.status && !VALID_STATUS.includes(fm.frontmatter.status)) {
    errors.push(`frontmatter status must be one of PENDING / APPROVED / REVISED (got: ${fm.frontmatter.status})`);
  }
  const sections = extractSections(fm.body);
  // Check each required section exists in correct order.
  const titles = sections.map((s) => s.title);
  for (const req of REQUIRED_SECTIONS) {
    if (!titles.includes(req)) {
      errors.push(`missing required section: ## ${req}`);
    }
  }
  // Order check: filter the section titles to the required ones, then compare.
  const filtered = titles.filter((t) => REQUIRED_SECTIONS.includes(t));
  for (let i = 0; i < filtered.length; i++) {
    if (filtered[i] !== REQUIRED_SECTIONS[i]) {
      errors.push(`sections out of order: expected '${REQUIRED_SECTIONS[i]}' at position ${i + 1}, got '${filtered[i]}'`);
      break;
    }
  }
  // Each required section must have a non-empty body.
  for (const s of sections) {
    if (REQUIRED_SECTIONS.includes(s.title) && !s.body) {
      errors.push(`section '${s.title}' is empty`);
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    frontmatter: fm.frontmatter,
    sections,
  };
}

module.exports = {
  REQUIRED_SECTIONS,
  REQUIRED_FRONTMATTER,
  VALID_STATUS,
  validatePlan,
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd bin/josh && npm test`
Expected: 51 tests pass total, 0 fail.

- [ ] **Step 6: Commit**

```bash
git add bin/josh/lib/plan-validator.js bin/josh/test/plan-validator.test.js bin/josh/test/fixtures/sample-plan.md
git commit -m "feat(josh): add plan-validator (8-section template + frontmatter)"
```

---

## Task 11: Extend `cmdClaim` — `--agent` filter, brief inject, runtime.json, claimed state

**Files:**
- Modify: `bin/josh/josh.js`
- Modify: `bin/josh/test/josh-cli-folder-layout.test.js`

The new claim semantics: `josh claim <id> --agent A01` filters to triaged todos whose `primary_role === 'A01'`, transitions to `claimed` (not `in_progress`), writes `runtime.json` with the session metadata, and stamps `meta.json` with `agent_brief_path` (a reference, not a copy).

If `--agent` is not specified, claim retains its existing behavior (triaged → in_progress) for backward compatibility with the existing test suite. The dispatch flow (claim → planning → approval → in_progress) is opt-in via `--agent`.

- [ ] **Step 1: Write the failing test**

Append to `bin/josh/test/josh-cli-folder-layout.test.js`:

```javascript
test('cli: claim --agent moves to claimed and writes runtime.json + agent_brief_path', () => {
  const root = setupRoot();
  // Seed an agent manifest so loadBrief works
  const briefSource = path.join(root, 'AGENT_01_TEST.md');
  fs.writeFileSync(briefSource, '# Agent A01 - Test\n\n## Mission\n\nDo the thing.\n');
  fs.mkdirSync(path.join(root, 'agents', 'A01'), { recursive: true });
  fs.writeFileSync(path.join(root, 'agents', 'A01', 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A01', source_path: briefSource,
  }));

  // Push a todo whose primary_role matches A01
  const out = runCli('push todo "do command-center work" --label A01', { JOSH_ROOT: root });
  const id = out.trim().split('\n').filter(Boolean).pop().trim();
  runCli('tick', { JOSH_ROOT: root });

  // Manually set primary_role on the meta (push doesn't take a flag for it; this is what import would do)
  const metaPath = path.join(root, 'todo', 'triaged', id, 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  meta.primary_role = 'A01';
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

  // Claim with --agent A01
  runCli(`claim ${id} --agent A01 --as A01`, { JOSH_ROOT: root });

  // Folder should be in claimed/
  const claimedDir = path.join(root, 'todo', 'claimed', id);
  assert.equal(fs.existsSync(claimedDir), true, 'expected claimed folder');
  // runtime.json present
  const runtime = JSON.parse(fs.readFileSync(path.join(claimedDir, 'runtime.json'), 'utf8'));
  assert.equal(runtime.claimed_by, 'A01');
  assert.equal(typeof runtime.started_at, 'string');
  // agent_brief_path stamped on meta
  const newMeta = JSON.parse(fs.readFileSync(path.join(claimedDir, 'meta.json'), 'utf8'));
  assert.equal(newMeta.agent_brief_path, briefSource);

  fs.rmSync(root, { recursive: true, force: true });
});

test('cli: claim --agent rejects when primary_role does not match', () => {
  const root = setupRoot();
  fs.mkdirSync(path.join(root, 'agents', 'A02'), { recursive: true });
  fs.writeFileSync(path.join(root, 'agents', 'A02', 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A02', source_path: 'irrelevant',
  }));

  const out = runCli('push todo "wrong-role work"', { JOSH_ROOT: root });
  const id = out.trim().split('\n').filter(Boolean).pop().trim();
  runCli('tick', { JOSH_ROOT: root });
  const metaPath = path.join(root, 'todo', 'triaged', id, 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  meta.primary_role = 'A09';
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

  let err = null;
  try {
    runCli(`claim ${id} --agent A02 --as A02`, { JOSH_ROOT: root });
  } catch (e) {
    err = e;
  }
  assert.ok(err, 'expected claim to fail');
  assert.match(err.stderr.toString(), /primary_role/);

  fs.rmSync(root, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bin/josh && npm test`
Expected: FAIL — current `cmdClaim` does not support `--agent`.

- [ ] **Step 3: Write the implementation**

In `bin/josh/josh.js`, replace the body of `cmdClaim` with:

```javascript
function cmdClaim(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        as:    { type: 'string' },
        actor: { type: 'string' },
        ttl:   { type: 'string' },
        agent: { type: 'string' },
      },
      allowPositionals: true,
      strict: true
    });
  } catch (e) { return errExit(e.message, 1); }

  const idArg = parsed.positionals[0];
  if (!idArg) return errExit('claim requires <todo-id>', 1);

  const actor = resolveActor(parsed.values);
  const ttlSec = parsed.values.ttl ? parseInt(parsed.values.ttl, 10) : 3600;
  if (!Number.isFinite(ttlSec) || ttlSec < 1 || ttlSec > 86400) {
    return errExit('--ttl must be in [1, 86400] seconds', 1);
  }

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
    // Load brief (asserts manifest + source exist).
    let brief;
    try {
      const { loadBrief } = require('./lib/agent-brief');
      brief = loadBrief(JOSH_ROOT, agentId);
    } catch (e) {
      return errExit(e.message, 2);
    }
    // Transition triaged → claimed. Stamp agent_brief_path. Write runtime.json.
    const r = transitionTodo({
      srcStates: ['triaged'],
      dst: 'claimed',
      idOrSuffix: idArg,
      actor,
      eventName: 'claimed',
      eventDetails: { ttl_sec: ttlSec, agent_id: agentId },
      update: (t, now) => {
        t.claim = { by: actor, at: now, ttl_sec: ttlSec, agent_id: agentId };
        t.agent_brief_path = brief.path;
      },
      audit: { action: 'todo.claimed', details: { ttl_sec: ttlSec, agent_id: agentId } }
    });
    if (r.error) return errExit(r.error, r.code);
    // After move, write runtime.json next to meta.json.
    const claimedFolder = path.join(JOSH_ROOT, 'todo', 'claimed', r.id);
    const runtime = {
      schema: 1,
      harness: process.env.JOSH_HARNESS || 'unknown',
      session_id: process.env.JOSH_SESSION_ID || null,
      claimed_by: agentId,
      actor,
      started_at: new Date().toISOString(),
    };
    writeJsonAtomic(path.join(claimedFolder, 'runtime.json'), runtime);
    log(r.id);
    return 0;
  }

  // Backward-compatible path: triaged → in_progress (no --agent).
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
  if (r.error) return errExit(r.error, r.code);
  log(r.id);
  return 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd bin/josh && npm test`
Expected: 47 tests pass total, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add bin/josh/josh.js bin/josh/test/josh-cli-folder-layout.test.js
git commit -m "feat(josh): claim --agent transitions to claimed + writes runtime.json"
```

---

## Task 12: `josh plan submit` — validate + transition claimed → planning → awaiting_approval

**Files:**
- Modify: `bin/josh/josh.js`

The plan submission flow: agent in `claimed` state writes their plan to a file, runs `josh plan submit <id> --plan path/to/plan.md`. The CLI:

1. Validates the plan against the 8-section template (`plan-validator.js`).
2. Copies plan.md into the todo folder.
3. Writes `plan-review.json` (schema_version, ready_for_implementation: false, etc.).
4. Transitions claimed → planning → awaiting_approval (single atomic move; the planning state is logged in history but Phase 2A doesn't pause there).

- [ ] **Step 1: Write the failing test**

Append to `bin/josh/test/josh-cli-folder-layout.test.js`:

```javascript
test('cli: plan submit validates 8-section plan and transitions to awaiting_approval', () => {
  const root = setupRoot();
  // Seed agent A01
  const briefSource = path.join(root, 'AGENT_01.md');
  fs.writeFileSync(briefSource, '# Agent A01\n');
  fs.mkdirSync(path.join(root, 'agents', 'A01'), { recursive: true });
  fs.writeFileSync(path.join(root, 'agents', 'A01', 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A01', source_path: briefSource,
  }));
  // Push and triage and claim
  const out = runCli('push todo "plan-test"', { JOSH_ROOT: root });
  const id = out.trim().split('\n').filter(Boolean).pop().trim();
  runCli('tick', { JOSH_ROOT: root });
  const metaPath = path.join(root, 'todo', 'triaged', id, 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  meta.primary_role = 'A01';
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  runCli(`claim ${id} --agent A01 --as A01`, { JOSH_ROOT: root });

  // Submit a valid plan
  const planSource = path.resolve(__dirname, 'fixtures/sample-plan.md');
  runCli(`plan submit ${id} --plan "${planSource}" --as A01`, { JOSH_ROOT: root });

  // Folder should now be in awaiting_approval/
  const aaDir = path.join(root, 'todo', 'awaiting_approval', id);
  assert.equal(fs.existsSync(aaDir), true, 'expected awaiting_approval folder');
  assert.equal(fs.existsSync(path.join(aaDir, 'plan.md')), true, 'plan.md should be copied into folder');
  assert.equal(fs.existsSync(path.join(aaDir, 'plan-review.json')), true, 'plan-review.json should exist');
  assert.equal(fs.existsSync(path.join(aaDir, 'approval')), true, 'approval signal file should exist');
  assert.equal(fs.readFileSync(path.join(aaDir, 'approval'), 'utf8').trim(), 'pending');

  fs.rmSync(root, { recursive: true, force: true });
});

test('cli: plan submit rejects an invalid plan', () => {
  const root = setupRoot();
  const briefSource = path.join(root, 'AGENT_03.md');
  fs.writeFileSync(briefSource, '# Agent A03\n');
  fs.mkdirSync(path.join(root, 'agents', 'A03'), { recursive: true });
  fs.writeFileSync(path.join(root, 'agents', 'A03', 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A03', source_path: briefSource,
  }));
  const out = runCli('push todo "plan-bad"', { JOSH_ROOT: root });
  const id = out.trim().split('\n').filter(Boolean).pop().trim();
  runCli('tick', { JOSH_ROOT: root });
  const metaPath = path.join(root, 'todo', 'triaged', id, 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  meta.primary_role = 'A03';
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  runCli(`claim ${id} --agent A03 --as A03`, { JOSH_ROOT: root });

  // Write an invalid plan (no frontmatter)
  const badPlanPath = path.join(root, 'bad-plan.md');
  fs.writeFileSync(badPlanPath, '## Fast-Path\n\nincomplete\n');
  let err = null;
  try {
    runCli(`plan submit ${id} --plan "${badPlanPath}" --as A03`, { JOSH_ROOT: root });
  } catch (e) {
    err = e;
  }
  assert.ok(err, 'expected plan submit to fail on invalid plan');
  assert.match(err.stderr.toString(), /frontmatter|missing required section/i);
  // Todo must remain in claimed
  assert.equal(fs.existsSync(path.join(root, 'todo', 'claimed', id)), true);

  fs.rmSync(root, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bin/josh && npm test`
Expected: FAIL — `unknown command: plan`.

- [ ] **Step 3: Write the implementation**

Append to `bin/josh/josh.js` near the other `cmdProject*` definitions (before `cmdHelp`):

```javascript
function cmdPlan(args) {
  const sub = args[0];
  const rest = args.slice(1);
  if (!sub || sub === 'help' || sub === '--help' || sub === '-h') {
    log(`Usage: josh plan <subcommand>

Subcommands:
  submit <todo-id> --plan <path>          claimed → awaiting_approval (validates 8-section plan)
  approve <todo-id>                       awaiting_approval → approved (writes approval signal)
  reject <todo-id> --reason "..."         awaiting_approval → rejected`);
    return 0;
  }
  switch (sub) {
    case 'submit':  return cmdPlanSubmit(rest);
    case 'approve': return cmdPlanApprove(rest);
    case 'reject':  return cmdPlanReject(rest);
    default:
      err(`unknown plan subcommand: ${sub}`);
      return 1;
  }
}

function cmdPlanSubmit(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        plan:  { type: 'string' },
        as:    { type: 'string' },
        actor: { type: 'string' },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch (e) { return errExit(e.message, 1); }

  const idArg = parsed.positionals[0];
  if (!idArg) return errExit('plan submit requires <todo-id>', 1);
  const planPath = parsed.values.plan;
  if (!planPath) return errExit('plan submit requires --plan <path>', 1);
  if (!fs.existsSync(planPath)) return errExit(`plan file not found: ${planPath}`, 2);

  const actor = resolveActor(parsed.values);
  const planText = fs.readFileSync(planPath, 'utf8');
  const { validatePlan } = require('./lib/plan-validator');
  const v = validatePlan(planText);
  if (!v.ok) {
    err('plan validation failed:');
    for (const e of v.errors) err(`  - ${e}`);
    return 1;
  }

  // Transition claimed → awaiting_approval (single move; planning state is logged in history).
  const r = transitionTodo({
    srcStates: ['claimed'],
    dst: 'awaiting_approval',
    idOrSuffix: idArg,
    actor,
    eventName: 'plan_submitted',
    eventDetails: { plan_id: v.frontmatter.id, plan_status: v.frontmatter.status },
    update: (t, now) => {
      t.history.push({ at: now, actor, event: 'planning', details: { plan_id: v.frontmatter.id } });
      t.plan_id = v.frontmatter.id;
    },
    audit: { action: 'todo.plan_submitted', details: { plan_id: v.frontmatter.id } },
  });
  if (r.error) return errExit(r.error, r.code);

  // After the move, the folder is at awaiting_approval/<id>/.
  const folder = path.join(JOSH_ROOT, 'todo', 'awaiting_approval', r.id);
  // Copy plan.md into the folder.
  fs.writeFileSync(path.join(folder, 'plan.md'), planText, 'utf8');
  // Write plan-review.json.
  const planReview = {
    schema_version: 1,
    plan_id: v.frontmatter.id,
    submitted_at: new Date().toISOString(),
    submitted_by: actor,
    ready_for_implementation: false,
    blocking_decisions: [],
    section_count: v.sections.length,
  };
  writeJsonAtomic(path.join(folder, 'plan-review.json'), planReview);
  // Write approval signal file (atomic-mv pattern).
  fs.writeFileSync(path.join(folder, 'approval'), 'pending\n', 'utf8');

  log(r.id);
  return 0;
}

function cmdPlanApprove(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        as:    { type: 'string' },
        actor: { type: 'string' },
        note:  { type: 'string' },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch (e) { return errExit(e.message, 1); }
  const idArg = parsed.positionals[0];
  if (!idArg) return errExit('plan approve requires <todo-id>', 1);
  const actor = resolveActor(parsed.values);

  const r = transitionTodo({
    srcStates: ['awaiting_approval'],
    dst: 'approved',
    idOrSuffix: idArg,
    actor,
    eventName: 'plan_approved',
    eventDetails: parsed.values.note ? { note: parsed.values.note } : {},
    update: (t, now) => {
      t.plan_approved_at = now;
      t.plan_approved_by = actor;
    },
    audit: { action: 'todo.plan_approved', details: parsed.values.note ? { note: parsed.values.note } : {} },
  });
  if (r.error) return errExit(r.error, r.code);

  // Update the approval signal file in the new location.
  const folder = path.join(JOSH_ROOT, 'todo', 'approved', r.id);
  try { fs.writeFileSync(path.join(folder, 'approval'), 'approved\n', 'utf8'); } catch (e) { /* non-fatal */ }
  log(r.id);
  return 0;
}

function cmdPlanReject(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        as:     { type: 'string' },
        actor:  { type: 'string' },
        reason: { type: 'string' },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch (e) { return errExit(e.message, 1); }
  const idArg = parsed.positionals[0];
  if (!idArg) return errExit('plan reject requires <todo-id>', 1);
  const reason = parsed.values.reason;
  if (!reason) return errExit('plan reject requires --reason "<text>"', 1);
  const actor = resolveActor(parsed.values);

  const r = transitionTodo({
    srcStates: ['awaiting_approval'],
    dst: 'rejected',
    idOrSuffix: idArg,
    actor,
    eventName: 'plan_rejected',
    eventDetails: { reason },
    update: (t, now) => {
      t.plan_rejected_at = now;
      t.plan_rejected_by = actor;
      t.plan_rejection_reason = reason;
    },
    audit: { action: 'todo.plan_rejected', details: { reason } },
  });
  if (r.error) return errExit(r.error, r.code);

  const folder = path.join(JOSH_ROOT, 'todo', 'rejected', r.id);
  try { fs.writeFileSync(path.join(folder, 'approval'), 'rejected\n', 'utf8'); } catch (e) { /* non-fatal */ }
  log(r.id);
  return 0;
}
```

Add to the `COMMANDS` map (right after `project: cmdProject,`):

```javascript
  plan: cmdPlan,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd bin/josh && npm test`
Expected: 49 tests pass total, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add bin/josh/josh.js bin/josh/test/josh-cli-folder-layout.test.js
git commit -m "feat(josh): add plan submit/approve/reject subcommands"
```

---

## Task 13: Tick auto-promotes `approved → in_progress`

**Files:**
- Modify: `bin/josh/josh.js`

When a todo's state is `approved` and the orchestrator ticks, the todo should auto-promote to `in_progress`. The check is: state directory equals `approved` AND the `approval` signal file equals `approved`. The transition runs only on tick (no model can self-promote).

- [ ] **Step 1: Write the failing test**

Append to `bin/josh/test/josh-cli-folder-layout.test.js`:

```javascript
test('cli: tick promotes approved → in_progress', () => {
  const root = setupRoot();
  // Seed agent
  const briefSource = path.join(root, 'AGENT_05.md');
  fs.writeFileSync(briefSource, '# Agent A05\n');
  fs.mkdirSync(path.join(root, 'agents', 'A05'), { recursive: true });
  fs.writeFileSync(path.join(root, 'agents', 'A05', 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A05', source_path: briefSource,
  }));
  const out = runCli('push todo "tick-promo"', { JOSH_ROOT: root });
  const id = out.trim().split('\n').filter(Boolean).pop().trim();
  runCli('tick', { JOSH_ROOT: root });
  const metaPath = path.join(root, 'todo', 'triaged', id, 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  meta.primary_role = 'A05';
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  runCli(`claim ${id} --agent A05 --as A05`, { JOSH_ROOT: root });
  const planSource = path.resolve(__dirname, 'fixtures/sample-plan.md');
  runCli(`plan submit ${id} --plan "${planSource}" --as A05`, { JOSH_ROOT: root });
  runCli(`plan approve ${id} --as human`, { JOSH_ROOT: root });

  assert.equal(fs.existsSync(path.join(root, 'todo', 'approved', id)), true, 'should be in approved');

  // Tick
  runCli('tick', { JOSH_ROOT: root });

  assert.equal(fs.existsSync(path.join(root, 'todo', 'approved', id)), false, 'should leave approved');
  assert.equal(fs.existsSync(path.join(root, 'todo', 'in_progress', id, 'meta.json')), true, 'should land in in_progress');

  fs.rmSync(root, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bin/josh && npm test`
Expected: FAIL — tick does not promote approved → in_progress.

- [ ] **Step 3: Write the implementation**

In `bin/josh/josh.js`, add a helper near `sweepStaleClaims` (before `processControlOne`):

```javascript
function promoteApproved() {
  let promoted = 0;
  const dir = path.join(JOSH_ROOT, 'todo', 'approved');
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return 0; }
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
  return promoted;
}
```

In `cmdTick`, find the section between sweepStaleClaims and expireApprovals:

```javascript
    // 5. Sweep stale claims
    swept = sweepStaleClaims();

    // 6. Auto-resolve expired approvals (default decision applied)
    expired = expireApprovals();
```

Insert a step 5b between them:

```javascript
    // 5. Sweep stale claims
    swept = sweepStaleClaims();

    // 5b. Promote approved → in_progress (Phase 2A dispatch)
    let promoted = 0;
    if (!paused) promoted = promoteApproved();

    // 6. Auto-resolve expired approvals (default decision applied)
    expired = expireApprovals();
```

Also extend the audit details and the verbose-summary log to include `promoted`:

Find the audit append:

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
        expired_approvals: expired,
        paused,
        draining,
        duration_ms: Date.now() - tickStart.getTime()
      }
    });
```

Replace the `details` block to include `promoted`:

```javascript
      details: {
        controls: controlsProcessed,
        triaged,
        routed,
        triaged_failed: triagedFailed,
        swept,
        promoted,
        expired_approvals: expired,
        paused,
        draining,
        duration_ms: Date.now() - tickStart.getTime()
      }
```

Update the verbose log:

```javascript
      log(`  controls: ${controlsProcessed}  triaged: ${triaged} (routed: ${routed})  swept: ${swept}  expired: ${expired}  failed: ${triagedFailed}`);
```

Replace with:

```javascript
      log(`  controls: ${controlsProcessed}  triaged: ${triaged} (routed: ${routed})  swept: ${swept}  promoted: ${promoted}  expired: ${expired}  failed: ${triagedFailed}`);
```

And the one-line summary:

```javascript
      log(`tick ${tickN}: triaged=${triaged}${routed > 0 ? ` (routed:${routed})` : ''} swept=${swept} expired=${expired} controls=${controlsProcessed}${paused ? ' [paused]' : ''}${draining ? ' [draining]' : ''}`);
```

Replace with:

```javascript
      log(`tick ${tickN}: triaged=${triaged}${routed > 0 ? ` (routed:${routed})` : ''} swept=${swept} promoted=${promoted} expired=${expired} controls=${controlsProcessed}${paused ? ' [paused]' : ''}${draining ? ' [draining]' : ''}`);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd bin/josh && npm test`
Expected: 50 tests pass total, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add bin/josh/josh.js bin/josh/test/josh-cli-folder-layout.test.js
git commit -m "feat(josh): tick auto-promotes approved → in_progress"
```

---

## Task 14: `handoff-validator.js` — validate 9-field handoff.md

**Files:**
- Create: `bin/josh/lib/handoff-validator.js`
- Create: `bin/josh/test/handoff-validator.test.js`
- Create: `bin/josh/test/fixtures/sample-handoff.md`

- [ ] **Step 1: Write the fixture**

Create `bin/josh/test/fixtures/sample-handoff.md`:

```markdown
## Task ID

01HXTODO00000000000000001

## Files changed

- bin/josh/josh.js
- bin/josh/lib/plan-validator.js

## Decision

Adopted the 8-section plan template verbatim from kesslerio.

## Open blockers

None.

## Risks

None known. Existing tests pass.

## Downstream unblocked

D1-002 can now claim against A01.

## Downstream blocked

None.

## Verification

`cd bin/josh && npm test` reports 50/50 passing.

## Human review

Not required for this task.
```

- [ ] **Step 2: Write the failing test**

Create `bin/josh/test/handoff-validator.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateHandoff, REQUIRED_FIELDS } = require('../lib/handoff-validator');

const SAMPLE = fs.readFileSync(path.join(__dirname, 'fixtures/sample-handoff.md'), 'utf8');

test('REQUIRED_FIELDS lists the 9 expected H2s', () => {
  assert.equal(REQUIRED_FIELDS.length, 9);
  for (const f of [
    'Task ID', 'Files changed', 'Decision', 'Open blockers', 'Risks',
    'Downstream unblocked', 'Downstream blocked', 'Verification', 'Human review',
  ]) {
    assert.ok(REQUIRED_FIELDS.includes(f), `missing required field: ${f}`);
  }
});

test('validateHandoff: accepts the sample fixture', () => {
  const r = validateHandoff(SAMPLE);
  assert.equal(r.ok, true, `errors: ${JSON.stringify(r.errors)}`);
  assert.equal(r.fields.length, 9);
});

test('validateHandoff: rejects missing field', () => {
  const broken = SAMPLE.replace(/## Risks[\s\S]*?\n## Downstream unblocked/, '## Downstream unblocked');
  const r = validateHandoff(broken);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /Risks/.test(e)));
});

test('validateHandoff: rejects empty field body', () => {
  const broken = SAMPLE.replace(/## Decision\n\n[^\n]+/, '## Decision\n');
  const r = validateHandoff(broken);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /Decision.*empty/.test(e)));
});

test('validateHandoff: order does not matter', () => {
  // Reverse the section order — should still validate as long as all 9 are present and non-empty.
  const sections = SAMPLE.split(/(?=^## )/m).filter(Boolean);
  const reversed = sections.reverse().join('');
  const r = validateHandoff(reversed);
  assert.equal(r.ok, true, `unexpected errors: ${JSON.stringify(r.errors)}`);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd bin/josh && npm test`
Expected: FAIL — `Cannot find module '../lib/handoff-validator'`.

- [ ] **Step 4: Write the implementation**

Create `bin/josh/lib/handoff-validator.js`:

```javascript
'use strict';

const REQUIRED_FIELDS = [
  'Task ID',
  'Files changed',
  'Decision',
  'Open blockers',
  'Risks',
  'Downstream unblocked',
  'Downstream blocked',
  'Verification',
  'Human review',
];

function extractH2Sections(text) {
  const sections = [];
  const re = /^##\s+(.+)$/gm;
  const matches = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    matches.push({ title: m[1].trim(), start: m.index, contentStart: m.index + m[0].length });
  }
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const next = matches[i + 1];
    const body = text.slice(cur.contentStart, next ? next.start : text.length).trim();
    sections.push({ title: cur.title, body });
  }
  return sections;
}

function validateHandoff(text) {
  const errors = [];
  const sections = extractH2Sections(text);
  const titleSet = new Set(sections.map((s) => s.title));
  for (const req of REQUIRED_FIELDS) {
    if (!titleSet.has(req)) {
      errors.push(`missing required field: ## ${req}`);
    }
  }
  for (const s of sections) {
    if (REQUIRED_FIELDS.includes(s.title) && !s.body) {
      errors.push(`field '${s.title}' is empty`);
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    fields: sections.filter((s) => REQUIRED_FIELDS.includes(s.title)),
  };
}

module.exports = { REQUIRED_FIELDS, validateHandoff };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd bin/josh && npm test`
Expected: 55 tests pass total, 0 fail.

- [ ] **Step 6: Commit**

```bash
git add bin/josh/lib/handoff-validator.js bin/josh/test/handoff-validator.test.js bin/josh/test/fixtures/sample-handoff.md
git commit -m "feat(josh): add handoff-validator (9-field handoff.md)"
```

---

## Task 15: Extend `cmdComplete` to require valid `handoff.md`

**Files:**
- Modify: `bin/josh/josh.js`
- Modify: `bin/josh/test/josh-cli-folder-layout.test.js`

`josh complete <id>` now requires that `handoff.md` exists in the todo folder and validates against the 9-field template. If `--skip-handoff` is passed, the check is bypassed (matches the existing `--skip-verify` pattern).

- [ ] **Step 1: Write the failing test**

Append to `bin/josh/test/josh-cli-folder-layout.test.js`:

```javascript
test('cli: complete rejects when handoff.md missing', () => {
  const root = setupRoot();
  // Push, tick, claim (legacy path, no --agent → in_progress)
  const out = runCli('push todo "no-handoff"', { JOSH_ROOT: root });
  const id = out.trim().split('\n').filter(Boolean).pop().trim();
  runCli('tick', { JOSH_ROOT: root });
  runCli(`claim ${id} --as worker`, { JOSH_ROOT: root });

  let err = null;
  try { runCli(`complete ${id} --as worker`, { JOSH_ROOT: root }); } catch (e) { err = e; }
  assert.ok(err, 'expected complete to fail without handoff.md');
  assert.match(err.stderr.toString(), /handoff\.md/);
  // Still in in_progress
  assert.equal(fs.existsSync(path.join(root, 'todo', 'in_progress', id, 'meta.json')), true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('cli: complete accepts a valid handoff.md', () => {
  const root = setupRoot();
  const out = runCli('push todo "with-handoff"', { JOSH_ROOT: root });
  const id = out.trim().split('\n').filter(Boolean).pop().trim();
  runCli('tick', { JOSH_ROOT: root });
  runCli(`claim ${id} --as worker`, { JOSH_ROOT: root });
  // Drop the handoff fixture in place
  const handoffSource = fs.readFileSync(path.join(__dirname, 'fixtures/sample-handoff.md'), 'utf8');
  fs.writeFileSync(path.join(root, 'todo', 'in_progress', id, 'handoff.md'), handoffSource);
  runCli(`complete ${id} --as worker`, { JOSH_ROOT: root });

  assert.equal(fs.existsSync(path.join(root, 'todo', 'done', id, 'meta.json')), true);
  assert.equal(fs.existsSync(path.join(root, 'todo', 'done', id, 'handoff.md')), true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('cli: complete --skip-handoff bypasses validation', () => {
  const root = setupRoot();
  const out = runCli('push todo "skip-handoff"', { JOSH_ROOT: root });
  const id = out.trim().split('\n').filter(Boolean).pop().trim();
  runCli('tick', { JOSH_ROOT: root });
  runCli(`claim ${id} --as worker`, { JOSH_ROOT: root });
  runCli(`complete ${id} --as worker --skip-handoff`, { JOSH_ROOT: root });
  assert.equal(fs.existsSync(path.join(root, 'todo', 'done', id, 'meta.json')), true);
  fs.rmSync(root, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bin/josh && npm test`
Expected: FAIL — `complete` does not enforce handoff.md.

- [ ] **Step 3: Write the implementation**

In `bin/josh/josh.js`, replace the body of `cmdComplete`:

```javascript
function cmdComplete(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        as:             { type: 'string' },
        actor:          { type: 'string' },
        note:           { type: 'string' },
        'skip-verify':  { type: 'boolean' },
        'skip-handoff': { type: 'boolean' },
      },
      allowPositionals: true,
      strict: true
    });
  } catch (e) { return errExit(e.message, 1); }

  const idArg = parsed.positionals[0];
  if (!idArg) return errExit('complete requires <todo-id>', 1);

  const actor = resolveActor(parsed.values);

  // Locate first so we can run verify + handoff check before the move.
  const located = locateTodo(idArg, ['in_progress']);
  if (located.error) return errExit(located.error, located.code);

  const todo = readJson(located.path);
  if (!todo) return errExit(`malformed todo at ${located.relative}`, 4);

  if (todo.verify && todo.verify.type === 'command' && !parsed.values['skip-verify']) {
    try {
      require('child_process').execSync(todo.verify.value, { stdio: 'pipe' });
    } catch (e) {
      err(`verify failed: ${todo.verify.value}`);
      err(`exit code: ${e.status}`);
      if (e.stderr) err(`stderr: ${e.stderr.toString().trim()}`);
      return errExit('verification failed; not completing. use --skip-verify to override or `josh fail` to mark failed', 1);
    }
  }

  // Handoff check (Phase 2A): handoff.md must exist + validate, unless --skip-handoff.
  if (!parsed.values['skip-handoff']) {
    const handoffPath = path.join(located.folder, 'handoff.md');
    if (!fs.existsSync(handoffPath)) {
      return errExit(`handoff.md not found at ${path.relative(JOSH_ROOT, handoffPath).replace(/\\/g, '/')}; write the 9-field handoff before completing (or pass --skip-handoff)`, 1);
    }
    const text = fs.readFileSync(handoffPath, 'utf8');
    const { validateHandoff } = require('./lib/handoff-validator');
    const v = validateHandoff(text);
    if (!v.ok) {
      err('handoff.md validation failed:');
      for (const e of v.errors) err(`  - ${e}`);
      return 1;
    }
  }

  const r = transitionTodo({
    srcStates: ['in_progress'],
    dst: 'done',
    idOrSuffix: idArg,
    actor,
    eventName: 'completed',
    eventDetails: parsed.values.note ? { note: parsed.values.note } : {},
    update: (t, now) => {
      t.completed_at = now;
      t.completed_by = actor;
      if (parsed.values.note) t.completion_note = parsed.values.note;
    },
    audit: { action: 'todo.completed', details: parsed.values.note ? { note: parsed.values.note } : {} }
  });
  if (r.error) return errExit(r.error, r.code);
  log(r.id);
  return 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd bin/josh && npm test`
Expected: 58 tests pass total, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add bin/josh/josh.js bin/josh/test/josh-cli-folder-layout.test.js
git commit -m "feat(josh): complete requires valid handoff.md (9 fields)"
```

---

## Task 16: End-to-end smoke test — full dispatch lifecycle

**Files:**
- Create: `bin/josh/test/dispatch-smoke.test.js`

A single test that walks the full happy path: `import` → `claim --agent` → `plan submit` → `plan approve` → `tick` → write handoff → `complete`. Uses the existing fixture corpus.

- [ ] **Step 1: Write the test**

Create `bin/josh/test/dispatch-smoke.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

const JOSH_BIN = path.resolve(__dirname, '..', 'josh.js');
const FIXTURE_CORPUS = path.resolve(__dirname, 'fixtures/corpus');
const SAMPLE_PLAN = path.resolve(__dirname, 'fixtures/sample-plan.md');
const SAMPLE_HANDOFF = path.resolve(__dirname, 'fixtures/sample-handoff.md');

function runCli(args, env) {
  return execSync(`node "${JOSH_BIN}" ${args}`, {
    env: { ...process.env, ...env },
    stdio: 'pipe',
  }).toString();
}

test('smoke: full dispatch lifecycle import → claim → plan → approve → tick → complete', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-smoke-'));
  runCli('init', { JOSH_ROOT: root });

  // 1. Import the fixture corpus
  const importOut = runCli(`project import "${FIXTURE_CORPUS}"`, { JOSH_ROOT: root });
  assert.match(importOut, /imported project/);
  assert.match(importOut, /todos:\s+2/);
  assert.match(importOut, /agents:\s+2/);

  // 2. Find the D1-001 todo (primary_role A01) by listing triaged
  const triagedDir = path.join(root, 'todo', 'triaged');
  const ids = fs.readdirSync(triagedDir, { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name);
  assert.equal(ids.length, 2);
  let targetId = null;
  for (const id of ids) {
    const meta = JSON.parse(fs.readFileSync(path.join(triagedDir, id, 'meta.json'), 'utf8'));
    if (meta.display_id === 'D1-001') {
      targetId = id;
      break;
    }
  }
  assert.ok(targetId, 'expected to find D1-001 todo');

  // 3. Claim with --agent A01
  runCli(`claim ${targetId} --agent A01 --as A01`, { JOSH_ROOT: root });
  assert.equal(fs.existsSync(path.join(root, 'todo', 'claimed', targetId, 'runtime.json')), true);
  const stampedMeta = JSON.parse(fs.readFileSync(path.join(root, 'todo', 'claimed', targetId, 'meta.json'), 'utf8'));
  assert.match(stampedMeta.agent_brief_path, /AGENT_01_COMMAND_CENTER\.md$/);

  // 4. Submit plan
  runCli(`plan submit ${targetId} --plan "${SAMPLE_PLAN}" --as A01`, { JOSH_ROOT: root });
  assert.equal(fs.existsSync(path.join(root, 'todo', 'awaiting_approval', targetId, 'plan.md')), true);
  assert.equal(fs.readFileSync(path.join(root, 'todo', 'awaiting_approval', targetId, 'approval'), 'utf8').trim(), 'pending');

  // 5. Approve
  runCli(`plan approve ${targetId} --as human:tester`, { JOSH_ROOT: root });
  assert.equal(fs.existsSync(path.join(root, 'todo', 'approved', targetId)), true);
  assert.equal(fs.readFileSync(path.join(root, 'todo', 'approved', targetId, 'approval'), 'utf8').trim(), 'approved');

  // 6. Tick — should auto-promote to in_progress
  runCli('tick', { JOSH_ROOT: root });
  assert.equal(fs.existsSync(path.join(root, 'todo', 'in_progress', targetId, 'meta.json')), true);

  // 7. Write handoff into the in_progress folder
  fs.copyFileSync(SAMPLE_HANDOFF, path.join(root, 'todo', 'in_progress', targetId, 'handoff.md'));

  // 8. Complete
  runCli(`complete ${targetId} --as A01`, { JOSH_ROOT: root });
  assert.equal(fs.existsSync(path.join(root, 'todo', 'done', targetId, 'meta.json')), true);
  assert.equal(fs.existsSync(path.join(root, 'todo', 'done', targetId, 'handoff.md')), true);

  // 9. Audit log captures every transition.
  const auditDir = path.join(root, 'audit');
  const auditFiles = fs.readdirSync(auditDir).filter((f) => f.endsWith('.jsonl'));
  assert.ok(auditFiles.length > 0);
  const auditLines = fs.readFileSync(path.join(auditDir, auditFiles[0]), 'utf8').trim().split('\n').map(JSON.parse);
  const actions = auditLines.map((l) => l.action);
  for (const a of [
    'project.imported', 'todo.imported', 'todo.claimed',
    'todo.plan_submitted', 'todo.plan_approved',
    'todo.auto_promoted', 'todo.completed',
  ]) {
    assert.ok(actions.includes(a), `audit log missing action: ${a}; got: ${actions.join(', ')}`);
  }

  fs.rmSync(root, { recursive: true, force: true });
});

test('smoke: rejection path import → claim → plan → reject leaves todo in rejected', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-smoke-rej-'));
  runCli('init', { JOSH_ROOT: root });
  runCli(`project import "${FIXTURE_CORPUS}"`, { JOSH_ROOT: root });
  const triagedDir = path.join(root, 'todo', 'triaged');
  const ids = fs.readdirSync(triagedDir, { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name);
  let targetId = null;
  for (const id of ids) {
    const meta = JSON.parse(fs.readFileSync(path.join(triagedDir, id, 'meta.json'), 'utf8'));
    if (meta.display_id === 'D1-001') { targetId = id; break; }
  }
  runCli(`claim ${targetId} --agent A01 --as A01`, { JOSH_ROOT: root });
  runCli(`plan submit ${targetId} --plan "${SAMPLE_PLAN}" --as A01`, { JOSH_ROOT: root });
  runCli(`plan reject ${targetId} --reason "scope drift" --as human:tester`, { JOSH_ROOT: root });

  assert.equal(fs.existsSync(path.join(root, 'todo', 'rejected', targetId, 'meta.json')), true);
  assert.equal(fs.readFileSync(path.join(root, 'todo', 'rejected', targetId, 'approval'), 'utf8').trim(), 'rejected');
  fs.rmSync(root, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run the test**

Run: `cd bin/josh && npm test`
Expected: 60 tests pass total, 0 fail. The smoke test exercises every Phase 2A command end-to-end.

If this test fails: the failure points to whichever step in the lifecycle is broken. Walk the failed assertion back to the earlier task that owns that behavior.

- [ ] **Step 3: Commit**

```bash
git add bin/josh/test/dispatch-smoke.test.js
git commit -m "test(josh): end-to-end dispatch smoke test"
```

---

## Task 17: Update help output + documentation

**Files:**
- Modify: `bin/josh/josh.js` (help text)
- Modify: `bin/josh/README.md`
- Modify: `USER-MANUAL.md` (root of Levi repo)

- [ ] **Step 1: Update `cmdHelp` in josh.js**

Find `cmdHelp` (around line 2668). Locate the `project ops:` section. Insert a new section right after it (before `help`/`version`):

```javascript
  log(``);
  log(`agent dispatch (Phase 2A — plan/approve/execute):`);
  log(`  claim <id> --agent A01 [--as actor] [--ttl 3600]`);
  log(`         triaged → claimed; injects agent brief reference + writes runtime.json`);
  log(`  plan submit <id> --plan <path> [--as actor]    claimed → awaiting_approval`);
  log(`  plan approve <id> [--as actor] [--note "..."]  awaiting_approval → approved`);
  log(`  plan reject <id> --reason "..." [--as actor]   awaiting_approval → rejected`);
  log(`  complete <id> [--note "..."] [--skip-handoff] [--skip-verify]`);
  log(`         in_progress → done; requires valid 9-field handoff.md`);
  log(`         (next 'josh tick' auto-promotes approved → in_progress)`);
```

- [ ] **Step 2: Update `bin/josh/README.md`**

Add a new section before the `## Maintenance` section. Use the following body:

```markdown
## Agent dispatch (Phase 2A)

The plan/approve/execute lifecycle. Each todo lives in its own folder:

```
~/.josh/todo/<state>/<ulid>/
├── meta.json
├── state                  one-line, mirrors parent dir
├── plan.md                added in 'planning' state, persists into later states
├── plan-review.json       added when plan submitted
├── approval               absent | "pending" | "approved" | "rejected"
├── handoff.md             written when state → done
├── events.ndjson          append-only, 14-event taxonomy
└── runtime.json           {harness, session_id, claimed_by, started_at}
```

States: `incoming → triaged → claimed → planning → awaiting_approval → approved → in_progress → done`.
Side branches: `awaiting_approval → rejected`, any state → `blocked`/`failed`/`cancelled`, `awaiting_approval → revised → planning` (reserved for Phase 2B).

### Lifecycle commands

```
josh claim <id> --agent A01 [--as actor]            triaged → claimed
josh plan submit <id> --plan plan.md [--as actor]   claimed → awaiting_approval
josh plan approve <id> [--as actor]                 awaiting_approval → approved
josh plan reject  <id> --reason "..." [--as actor]  awaiting_approval → rejected
josh tick                                            auto-promotes approved → in_progress
josh complete <id> [--note "..."]                   in_progress → done (validates handoff.md)
```

### Plan template (8 sections, kesslerio)

Required YAML frontmatter: `id`, `status` (PENDING|APPROVED|REVISED), `claimed_by`, `plan_hash`.
Required H2 sections in this exact order: `Fast-Path`, `Problem statement`, `Current state evidence`,
`Proposed approach`, `Step-by-step change list`, `Risks + rollback`, `Test plan`, `Approval prompt`.

### Handoff template (9 fields)

Required H2s in any order: `Task ID`, `Files changed`, `Decision`, `Open blockers`, `Risks`,
`Downstream unblocked`, `Downstream blocked`, `Verification`, `Human review`. Each non-empty.

### Approval signal

`~/.josh/todo/<state>/<id>/approval` is the atomic-mv signal. `josh plan approve` writes `approved\n`;
`josh tick` reads it from the `approved` directory and promotes the todo to `in_progress`. No model
self-promotes a plan to execution.
```

- [ ] **Step 3: Update `USER-MANUAL.md`**

In the project root `USER-MANUAL.md`, locate Section 7 (`josh CLI — complete reference`). Add a new subsection 7.15 before "Help & version". Use this body:

```markdown
### 7.15 Agent dispatch (plan-approve-execute)

The Phase 2A lifecycle for an agent picking up a triaged todo, drafting a plan, getting human approval, executing, and handing off. See `bin/josh/README.md` for folder-layout details.

#### `josh claim <id> --agent <agent-id> [--as actor] [--ttl 3600]`

Atomically transitions a `triaged` todo to `claimed` if `meta.primary_role` matches `--agent`. Stamps `meta.agent_brief_path` with the absolute path to the agent's source brief (resolved via `~/.josh/agents/<id>/manifest.json`) and writes `runtime.json` into the todo folder with `harness`, `session_id`, `claimed_by`, `started_at`.

Without `--agent`, retains the legacy claim semantics (`triaged → in_progress`, no brief injection).

#### `josh plan submit <todo-id> --plan <path> [--as actor]`

Validates the plan file against the 8-section kesslerio template (frontmatter `id`/`status`/`claimed_by`/`plan_hash`; H2 sections in order: `Fast-Path`, `Problem statement`, `Current state evidence`, `Proposed approach`, `Step-by-step change list`, `Risks + rollback`, `Test plan`, `Approval prompt`). On pass: copies the plan into the todo folder as `plan.md`, writes `plan-review.json`, writes `approval` file containing `pending`, transitions `claimed → awaiting_approval`.

#### `josh plan approve <todo-id> [--as actor] [--note "..."]`

Transitions `awaiting_approval → approved`. Updates the `approval` signal file to `approved`. Next `josh tick` will auto-promote the todo to `in_progress`.

#### `josh plan reject <todo-id> --reason "..." [--as actor]`

Transitions `awaiting_approval → rejected` (terminal). Writes the rejection reason into `meta.plan_rejection_reason` and updates the `approval` signal file to `rejected`.

#### Tick auto-promotion

Each `josh tick` walks `~/.josh/todo/approved/`. For every todo whose `approval` file equals `approved`, the tick atomically moves the folder to `in_progress` and writes a `todo.auto_promoted` audit event. No model-side string-matching; only the orchestrator promotes.

#### `josh complete <todo-id> [--note "..."] [--skip-handoff] [--skip-verify]`

Now requires a valid `handoff.md` in the todo folder unless `--skip-handoff` is passed. The handoff must contain all 9 H2 fields (`Task ID`, `Files changed`, `Decision`, `Open blockers`, `Risks`, `Downstream unblocked`, `Downstream blocked`, `Verification`, `Human review`), each with a non-empty body. On pass: transitions `in_progress → done`. The `handoff.md` file follows the folder into the `done` directory.

#### Event stream — `events.ndjson`

Each todo folder carries an append-only `events.ndjson` for the 14-event taxonomy (5 lifecycle: `start`/`heartbeat`/`done`/`failed`/`interrupted`; 9 stream: `backend_ref`/`run_started`/`text_delta`/`tool_call`/`pending_input`/`pending_input_resolved`/`plan_artifact`/`settings_changed`/`run_completed`). Phase 2A ships only the append helper (`bin/josh/lib/events-writer.js`); session-side emission is wired by future code.
```

- [ ] **Step 4: Commit**

```bash
git add bin/josh/josh.js bin/josh/README.md USER-MANUAL.md
git commit -m "docs(josh): document Phase 2A plan-approve-execute lifecycle"
```

---

## Task 18: Final integration sweep + BarMatrix re-run

**Files:**
- (none new — verification only)

- [ ] **Step 1: Run the full unit suite**

Run: `cd bin/josh && npm test`
Expected: 60 tests pass, 0 fail (Phase 1's BarMatrix integration test is skipped by default unless `RUN_BARMATRIX_INTEGRATION=1`).

- [ ] **Step 2: Re-run the BarMatrix integration test against the migrated importer**

Run:
```bash
cd bin/josh && RUN_BARMATRIX_INTEGRATION=1 npm test
```

Expected: All tests pass. The integration test confirms the migrated importer still produces ≥400 todos and exactly 10 agents, but now in folder layout.

If the integration test fails: open `bin/josh/test/integration-barmatrix.test.js`. The test counts `triaged` entries — under Phase 2A this should count subdirectories, not `.json` files. If the assertion logic uses `f.endsWith('.json')`, update it to count directories instead. (This is a minor adjustment; record what you changed in the commit message.)

- [ ] **Step 3: Manual smoke against a real `~/.josh/`**

This step is optional but recommended on the first execution machine, to confirm the migration doesn't corrupt the operator's actual runtime root.

```bash
# In a scratch directory:
mkdir -p /tmp/josh-real-smoke && JOSH_ROOT=/tmp/josh-real-smoke node bin/josh/josh.js init
JOSH_ROOT=/tmp/josh-real-smoke node bin/josh/josh.js project import bin/josh/test/fixtures/corpus
JOSH_ROOT=/tmp/josh-real-smoke node bin/josh/josh.js list todo --state triaged
JOSH_ROOT=/tmp/josh-real-smoke node bin/josh/josh.js status
rm -rf /tmp/josh-real-smoke
```

Expected: each command runs cleanly, exits 0, emits sensible output. `list todo --state triaged` shows 2 todos. `status` shows queue counts ≥ 0 with no stack traces.

- [ ] **Step 4: Confirm clean git status + commit if anything fell out**

Run: `git status`
Expected: clean (no uncommitted changes). If integration test edits or doc tweaks fell out of step 2/3, commit them now with a final wrap-up commit:

```bash
git add -A
git commit -m "chore(josh): Phase 2A wrap — integration sweep + minor fixes"
```

(Skip if there is nothing to commit.)

---

## Self-review (run after writing the plan)

### 1. Spec coverage

- ✅ Section 4.4 (todo folder layout) — Tasks 2-7 migrate every read/write path to the folder shape.
- ✅ Section 7.1 (state machine) — Tasks 1, 11, 12, 13 add states + transitions; Task 1 wires `cmdInit`.
- ✅ Section 7.2 (8-section plan template + frontmatter) — Task 10 ships the validator; Task 12 wires `plan submit`.
- ✅ Section 7.3 (14-event taxonomy) — Task 8 ships the append helper. Session-side emission is explicitly deferred per spec phase rollout.
- ✅ Section 7.4 (approval signal — `mv`-based) — Tasks 12 (write `pending`), 12 (`plan approve` writes `approved`), 13 (tick reads `approved` to promote). Chat-mode `APPROVE: <id>` guard hook explicitly deferred to Phase 2B per scope.
- ✅ Section 12 row 2 (Phase 2 DoD: D1-001 runs end-to-end) — Task 16 smoke test exercises the exact path.

### 2. Placeholder scan

- No "TBD", "TODO", "implement later", or "fill in details" in any task.
- No "similar to Task N" — each code block is self-contained.
- Every code step has a complete code block.
- Error handling is shown explicitly (try/catch + `process.env.JOSH_DEBUG` stack-trace gate matches Phase 1 convention).

### 3. Type consistency

- `todo-folder.js` exports: `ALL_STATES`, `folderPath`, `metaPath`, `ensureFolder`, `writeMeta`, `readMeta`, `listTodosInState`, `findFolderById`, `transitionFolder`. Same names used in Tasks 2, 3, 5, 6.
- `events-writer.js` exports: `LIFECYCLE_KINDS`, `STREAM_KINDS`, `EVENT_KINDS`, `appendEvent`. Same names used in Task 8.
- `plan-validator.js` exports: `REQUIRED_SECTIONS`, `REQUIRED_FRONTMATTER`, `VALID_STATUS`, `validatePlan`. Returns `{ok, errors, frontmatter, sections}`. Used in Task 12.
- `handoff-validator.js` exports: `REQUIRED_FIELDS`, `validateHandoff`. Returns `{ok, errors, fields}`. Used in Task 15.
- `agent-brief.js` exports: `loadBrief`. Returns `{path, contents}`. Used in Task 11.
- The runtime.json schema is `{schema, harness, session_id, claimed_by, actor, started_at}` — same shape in Task 11 and Task 16.
- `approval` signal file values are `pending` | `approved` | `rejected` (literal strings, with trailing newline in writes, trimmed on read). Same in Tasks 12, 13, 16.

### 4. Sequencing constraints (load-bearing)

These constraints are **hard** — re-ordering breaks the migration:

1. **Task 1 must run first.** Without the new state directories, every later atomic-rename target fails with ENOENT.
2. **Tasks 2-3 must precede Task 4.** The importer migration in Task 4 calls `tf.writeMeta` style writes; without the helper module, the importer can't write folder layout.
3. **Task 4 must precede Tasks 5-6.** project-status and project-sync both rely on the importer producing folder layout to seed their fixtures (the existing tests use `importProject` to set up state).
4. **Task 7 must precede Task 11.** Task 11 calls `transitionTodo` to move from `triaged` to `claimed`. Until Task 7 migrates `transitionTodo` itself to the folder layout, the rename moves a single `.json` file rather than a folder, breaking subsequent reads.
5. **Tasks 4-7 form an atomic migration band.** Between Task 4 (importer writes folders) and Task 7 (josh.js core helpers read folders), Tasks 5-6 will still pass tests because they only touch project-status / project-sync, but the `josh-cli-folder-layout.test.js` introduced in Task 7 cannot pass until Task 7 itself completes. Some intermediate test failures during Tasks 4-6 are expected and documented (see Task 5 step 1 and Task 6 step 1).
6. **Task 13 cannot precede Task 12.** The tick auto-promote test requires `plan submit` + `plan approve` to populate the `approved` directory.
7. **Task 16 must follow every implementation task.** It is a true end-to-end smoke; it has no value running before any predecessor exists.

### 5. Spec-to-task coverage gaps (intentional, not bugs)

Phase 2B explicitly deferred per scope (will be addressed in a follow-up plan):

- Worktree isolation per claim (git worktree on `agent/<short-ulid>` branch).
- Chat-mode approval guard hook (`APPROVE: <id>` parsing in chat).
- Doom Loop Detector.
- Backpressure gates / verification-evidence enforcement.
- HMAC chain audit (Phase 6).
- Ed25519 signing (Phase 6).
- Spec-evolver meta-lane (Phase 7).
- Verdict matrix / fan-out (Phase 4-5).
- The `revised → planning` revision loop UX. The state directory exists (Task 1) and the field `meta.plan_rejection_reason` is captured, but no `josh plan revise` command lands in Phase 2A. Implementer can `mv` the folder manually if needed during Phase 2A.

These are acceptable deferrals consistent with the spec's phase rollout (Section 12) and the explicit scope statement at the top of this plan.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-10-josh-agent-dispatch-phase2.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration. Best fit for an 18-task plan with a tight TDD ladder. The migration band (Tasks 4-7) needs careful per-task review because intermediate test failures are expected and only resolve at Task 7. Use `superpowers:subagent-driven-development`.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints. Best if you want to watch each migration step and the integration sweeps live. Slower but lower-risk if any step turns out to need surgery.

**Which approach?**
