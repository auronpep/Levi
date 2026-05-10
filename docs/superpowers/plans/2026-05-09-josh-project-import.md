# Phase 1: `josh project` — Substrate Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `josh project import`, `josh project status`, and `josh project sync` subcommands that read the BarMatrix Markdown corpus at `C:/AINC/MEV/experiments/mbe_tension_matrix/` and reflect it as machine-readable entities in `~/.josh/projects/`, `~/.josh/agents/`, and `~/.josh/todo/triaged/`, without copying the source Markdown.

**Architecture:** Pure read on the corpus side; atomic writes on the `~/.josh/` side. New library files under `bin/josh/lib/` (parser + importer + status + sync) keep `josh.js` from bloating further. Tests use Node's built-in `node:test` runner (no new deps).

**Tech Stack:** Node.js ≥18, CommonJS, `node:test`, `node:assert/strict`. Reuses existing `josh.js` helpers (`readJson`, `writeJsonAtomic`, `ulid`, `appendAudit`, `defaultActor`).

**Source spec:** `docs/superpowers/specs/2026-05-09-josh-orchestration-design.md` Sections 4.2, 4.3, 4.4, 6.1, 6.2, 6.3, 16.

---

## Background context for implementer

### What the corpus looks like (read this once before starting)

The corpus root is `C:/AINC/MEV/experiments/mbe_tension_matrix/`. Inside:

- `FOUR_DAY_FULL_PROJECT_DISPATCH/README.md` — project charter (objective, day-by-day goals).
- `FOUR_DAY_FULL_PROJECT_DISPATCH/TASK_INDEX.md` — index of all 408 tasks.
- `FOUR_DAY_FULL_PROJECT_DISPATCH/day_[1-4]_*/D[1-4]-XXX_*.md` — 408 individual task files. Each has a uniform structure:

```markdown
# Day N - <day name> Task NNN: <title>

## Dispatch

- Day: 1 - May 9, 2026
- Phase: 01 - Command Center And Sequence Lock
- Primary role: A01 Command Center
- Required order: after `none`, before `D1-002`
- Parallel safety: this task may run in parallel only with tasks in the same phase that do not edit the same output file.

## Why This Task Exists
...

## Inputs
...
```

- `agent_orchestration/agents/AGENT_[01-10]_*.md` — 10 launch agent briefs. Each has a uniform structure:

```markdown
# Agent A03 - Claims, Compliance, And Source Safety

Status: READY

## Mission
...

## Primary Inputs
...

## Owned Outputs
...

## Tasks
...

## Acceptance Gates
...

## Do Not Do
...

## Progress Log
```

The 9 grading workers (E00-E08) are referenced in `agent_orchestration/README.md` and `PROGRESS_TRACKER.md` but don't have individual brief files yet — for Phase 1, we still create their manifests by parsing those tables.

### Where things land in `~/.josh/`

- `~/.josh/projects/<project-ulid>/charter.json` — one per imported project.
- `~/.josh/agents/<agent-id>/manifest.json` — one per agent (A01..A10, E00..E08).
- `~/.josh/todo/triaged/<todo-ulid>.json` — one per dispatch task. (Existing `.josh` convention is `<state>/<id>.json`, NOT `<state>/<id>/`. We honor that convention. The richer per-todo folder layout in the spec is Phase 2 work.)
- `~/.josh/audit/<YYYY-MM-DD>.jsonl` — one event per import action (`project.imported`, `todo.imported`, `agent.imported`, `project.synced`).

### Why we don't write per-todo folders yet

The spec's Section 4.4 describes `~/.josh/todo/<ulid>/` as a folder with `meta.json`, `state`, `plan.md`, etc. That layout is Phase 2 (plan/approve/execute file contract). For Phase 1, we keep the existing `<state>/<id>.json` flat-file pattern — the importer just creates the JSON files in `triaged/`. Phase 2 will migrate them to folder shape.

### Conventions to follow

- All paths absolute. No `~` shorthand in code (use `os.homedir()` or the existing `JOSH_ROOT` resolver in `josh.js`).
- All timestamps `new Date().toISOString()`.
- All IDs: ULIDs via the existing `ulid()` helper in `josh.js`.
- All writes atomic: `writeJsonAtomic()` (existing helper).
- All audit events via `appendAudit()` (existing helper).
- File naming under `bin/josh/lib/` uses kebab-case to match `bin/josh/scripts/register-task-scheduler.ps1` convention.

---

## File structure

| File | Purpose | New / modify |
|---|---|---|
| `bin/josh/lib/markdown-parser.js` | Pure functions: `extractFrontmatter`, `parseDispatchBlock`, `parseRequiredOrder`, `parseAgentHeading` | New |
| `bin/josh/lib/project-importer.js` | `parseCharter(readmePath)`, `parseTask(taskPath)`, `parseAgent(agentPath)`, `importProject(corpusPath, opts)` | New |
| `bin/josh/lib/project-status.js` | `renderDailyReview(projectId)` → string | New |
| `bin/josh/lib/project-sync.js` | `diffProject(projectId)`, `applySync(projectId, dryRun)` | New |
| `bin/josh/josh.js` | Add `cmdProject(args)` dispatcher + import/status/sync subcommands at the bottom | Modify |
| `bin/josh/test/markdown-parser.test.js` | Unit tests for parser | New |
| `bin/josh/test/project-importer.test.js` | Unit tests + integration test for importer | New |
| `bin/josh/test/project-status.test.js` | Unit tests for status renderer | New |
| `bin/josh/test/project-sync.test.js` | Unit tests for sync diff | New |
| `bin/josh/test/fixtures/corpus/...` | Minimal fixture corpus (see Task 1 setup) | New |
| `bin/josh/package.json` | Add `"scripts": { "test": "node --test test/" }` | Modify |
| `bin/josh/README.md` | Document new commands | Modify |

Each lib file stays under ~200 LOC. Tests are co-located in `bin/josh/test/`.

---

## Task 1: Set up test infrastructure + fixture corpus

**Files:**
- Create: `bin/josh/test/fixtures/corpus/FOUR_DAY_FULL_PROJECT_DISPATCH/README.md`
- Create: `bin/josh/test/fixtures/corpus/FOUR_DAY_FULL_PROJECT_DISPATCH/TASK_INDEX.md`
- Create: `bin/josh/test/fixtures/corpus/FOUR_DAY_FULL_PROJECT_DISPATCH/day_1_lock_scope_and_command/D1-001_freeze_four_day_launch_definition.md`
- Create: `bin/josh/test/fixtures/corpus/FOUR_DAY_FULL_PROJECT_DISPATCH/day_1_lock_scope_and_command/D1-003_map_dependency_chain.md`
- Create: `bin/josh/test/fixtures/corpus/agent_orchestration/agents/AGENT_01_COMMAND_CENTER.md`
- Create: `bin/josh/test/fixtures/corpus/agent_orchestration/agents/AGENT_03_CLAIMS_SOURCE_SAFETY.md`
- Create: `bin/josh/test/fixtures/corpus/agent_orchestration/PROGRESS_TRACKER.md`
- Modify: `bin/josh/package.json` — add `scripts.test`

- [ ] **Step 1: Create fixture project README**

Create `bin/josh/test/fixtures/corpus/FOUR_DAY_FULL_PROJECT_DISPATCH/README.md` with:

```markdown
# Four-Day Full Project Dispatch

This packet expands the project back from Presentation-only grading to
the full four-day BarMatrix launch execution plan.

## Definition Of Done

By the end of Day 4, the approved launch path is live or staged, and
every held path has a named blocker.

## Days

| Day | Date | Folder | Goal |
|---:|---|---|---|
| Day 1 | May 9, 2026 | day_1_lock_scope_and_command | Freeze the launch definition. |
| Day 2 | May 10, 2026 | day_2_build_all_surfaces | Produce the working launch surfaces. |
| Day 3 | May 11, 2026 | day_3_qa_hardening_and_integration | Run QA. |
| Day 4 | May 12, 2026 | day_4_launch_or_controlled_stage | Make the go/no-go decision. |
```

- [ ] **Step 2: Create fixture TASK_INDEX**

Create `bin/josh/test/fixtures/corpus/FOUR_DAY_FULL_PROJECT_DISPATCH/TASK_INDEX.md`:

```markdown
# Master Task Index

## Day 1: Day 1 - Lock Scope And Command

### Phase 01: Command Center And Sequence Lock
- D1-001: [Freeze four-day launch definition](day_1_lock_scope_and_command/D1-001_freeze_four_day_launch_definition.md)
- D1-003: [Map dependency chain](day_1_lock_scope_and_command/D1-003_map_dependency_chain.md)
```

- [ ] **Step 3: Create fixture task file D1-001**

Create `bin/josh/test/fixtures/corpus/FOUR_DAY_FULL_PROJECT_DISPATCH/day_1_lock_scope_and_command/D1-001_freeze_four_day_launch_definition.md`:

```markdown
# Day 1 - Lock Scope And Command Task 001: Freeze four-day launch definition

## Dispatch

- Day: 1 - May 9, 2026
- Phase: 01 - Command Center And Sequence Lock
- Primary role: A01 Command Center
- Required order: after `none`, before `D1-002`
- Parallel safety: this task may run in parallel only with tasks in the same phase that do not edit the same output file.

## Why This Task Exists

Lock the order of operations.

## Output Required

A concrete artifact.

## Acceptance Criteria

- The output advances the Day 1 goal.
```

- [ ] **Step 4: Create fixture task file D1-003**

Create `bin/josh/test/fixtures/corpus/FOUR_DAY_FULL_PROJECT_DISPATCH/day_1_lock_scope_and_command/D1-003_map_dependency_chain.md`:

```markdown
# Day 1 - Lock Scope And Command Task 003: Map dependency chain

## Dispatch

- Day: 1 - May 9, 2026
- Phase: 01 - Command Center And Sequence Lock
- Primary role: A01 Command Center
- Required order: after `D1-002`, before `D1-004`
- Parallel safety: this task may run in parallel only with tasks in the same phase that do not edit the same output file.

## Why This Task Exists

Map dependencies.
```

- [ ] **Step 5: Create fixture agent A01**

Create `bin/josh/test/fixtures/corpus/agent_orchestration/agents/AGENT_01_COMMAND_CENTER.md`:

```markdown
# Agent A01 - Command Center And Integration

Status: READY

## Mission

Own launch coordination.

## Primary Inputs

- `../README.md`

## Owned Outputs

- updates to PROGRESS_TRACKER.md.

## Tasks

- Reconcile.

## Acceptance Gates

- Every public-facing asset has clearance.

## Do Not Do

- Do not let agents silently rewrite strategy.
```

- [ ] **Step 6: Create fixture agent A03**

Create `bin/josh/test/fixtures/corpus/agent_orchestration/agents/AGENT_03_CLAIMS_SOURCE_SAFETY.md`:

```markdown
# Agent A03 - Claims, Compliance, And Source Safety

Status: READY

## Mission

Protect the launch from unsupported claims.

## Owned Outputs

- claims ledger draft.

## Acceptance Gates

- Every public claim has a status.

## Do Not Do

- Do not approve claims because they sound plausible.
```

- [ ] **Step 7: Create fixture PROGRESS_TRACKER**

Create `bin/josh/test/fixtures/corpus/agent_orchestration/PROGRESS_TRACKER.md`:

```markdown
# Agent Progress Tracker

## Parked Launch Status Board

| Agent | Workstream | Status | Current owner/session | Last update | Output location | Next gate |
|---|---|---|---|---|---|---|
| A01 | Command Center and Integration | READY | Unassigned | 2026-05-07 | `agents/AGENT_01_COMMAND_CENTER.md` | Reconcile workstreams. |
| A02 | Website and Funnel Build | READY | Unassigned | 2026-05-07 | `agents/AGENT_02_WEBSITE_FUNNEL.md` | Produce build packet. |
| A03 | Claims, Compliance, and Source Safety | READY | Unassigned | 2026-05-07 | `agents/AGENT_03_CLAIMS_SOURCE_SAFETY.md` | Produce claims ledger. |

## Current Presentation Grading Board

| Worker | Workstream | Status | Current owner/session | Last update | Output location | Next gate |
|---|---|---|---|---|---|---|
| E00 | Command/Intake | READY | Unassigned | 2026-05-09 | runbook | Freeze rubric. |
| E01 | Structural Intake | READY | Unassigned | 2026-05-09 | shard outputs | Run manifests. |
```

- [ ] **Step 8: Add test script to package.json**

Modify `bin/josh/package.json` — add `scripts` block. The full file becomes:

```json
{
  "name": "@levi/josh",
  "version": "0.9.0",
  "description": "josh — CLI for the ~/.josh/ shared agent runtime. Implements the spec at ~/.josh/README.md.",
  "bin": {
    "josh": "josh.js"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "type": "commonjs",
  "license": "MIT",
  "scripts": {
    "test": "node --test test/"
  }
}
```

- [ ] **Step 9: Verify test runner reachable**

Run: `cd bin/josh && npm test`
Expected: `node --test` runs, finds zero test files, exits 0 (or exits with "no test files found" but still 0). No errors.

- [ ] **Step 10: Commit**

```bash
git add bin/josh/test/fixtures bin/josh/package.json
git commit -m "test(josh): add fixture corpus + node:test runner script"
```

---

## Task 2: `markdown-parser.js` — extract frontmatter

**Files:**
- Create: `bin/josh/lib/markdown-parser.js`
- Create: `bin/josh/test/markdown-parser.test.js`

- [ ] **Step 1: Write the failing test**

Create `bin/josh/test/markdown-parser.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const { extractFrontmatter } = require('../lib/markdown-parser');

test('extractFrontmatter: parses YAML frontmatter block', () => {
  const input = '---\nstatus: READY\nday: 1\n---\nbody text\nmore body';
  const result = extractFrontmatter(input);
  assert.deepEqual(result.frontmatter, { status: 'READY', day: '1' });
  assert.equal(result.body, 'body text\nmore body');
});

test('extractFrontmatter: returns empty frontmatter when none present', () => {
  const input = '# Heading\n\nNo frontmatter here.';
  const result = extractFrontmatter(input);
  assert.deepEqual(result.frontmatter, {});
  assert.equal(result.body, '# Heading\n\nNo frontmatter here.');
});

test('extractFrontmatter: handles missing closing delimiter', () => {
  const input = '---\nbroken: yes\n# heading';
  const result = extractFrontmatter(input);
  assert.deepEqual(result.frontmatter, {});
  assert.equal(result.body, input);
});

test('extractFrontmatter: trims values', () => {
  const input = '---\nname:   bar  \n---\nbody';
  const result = extractFrontmatter(input);
  assert.equal(result.frontmatter.name, 'bar');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bin/josh && npm test`
Expected: FAIL — `Cannot find module '../lib/markdown-parser'`.

- [ ] **Step 3: Write minimal implementation**

Create `bin/josh/lib/markdown-parser.js`:

```javascript
'use strict';

function extractFrontmatter(text) {
  const empty = { frontmatter: {}, body: text };
  if (!text.startsWith('---\n')) return empty;
  const closeIdx = text.indexOf('\n---\n', 4);
  if (closeIdx === -1) return empty;
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
  return { frontmatter, body };
}

module.exports = { extractFrontmatter };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd bin/josh && npm test`
Expected: 4 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add bin/josh/lib/markdown-parser.js bin/josh/test/markdown-parser.test.js
git commit -m "feat(josh): add extractFrontmatter parser"
```

---

## Task 3: `markdown-parser.js` — parse Required order

**Files:**
- Modify: `bin/josh/lib/markdown-parser.js`
- Modify: `bin/josh/test/markdown-parser.test.js`

- [ ] **Step 1: Write the failing test**

Append to `bin/josh/test/markdown-parser.test.js`:

```javascript
const { parseRequiredOrder } = require('../lib/markdown-parser');

test('parseRequiredOrder: simple after/before', () => {
  const result = parseRequiredOrder('after `D1-002`, before `D1-004`');
  assert.deepEqual(result.after, ['D1-002']);
  assert.deepEqual(result.before, ['D1-004']);
});

test('parseRequiredOrder: after none', () => {
  const result = parseRequiredOrder('after `none`, before `D1-002`');
  assert.deepEqual(result.after, []);
  assert.deepEqual(result.before, ['D1-002']);
});

test('parseRequiredOrder: multiple ids', () => {
  const result = parseRequiredOrder('after `D1-001` and `D1-002`, before `D1-004`');
  assert.deepEqual(result.after, ['D1-001', 'D1-002']);
  assert.deepEqual(result.before, ['D1-004']);
});

test('parseRequiredOrder: empty input', () => {
  const result = parseRequiredOrder('');
  assert.deepEqual(result.after, []);
  assert.deepEqual(result.before, []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bin/josh && npm test`
Expected: FAIL — `parseRequiredOrder is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `bin/josh/lib/markdown-parser.js` (before `module.exports`):

```javascript
function parseRequiredOrder(text) {
  const result = { after: [], before: [] };
  if (!text) return result;
  // Match `after `...`` and `before `...`` blocks
  const afterMatch = text.match(/after\s+(.+?)(?:,\s*before|$)/i);
  const beforeMatch = text.match(/before\s+(.+)$/i);
  const extractIds = (s) => {
    if (!s) return [];
    const ids = [];
    const re = /`([^`]+)`/g;
    let m;
    while ((m = re.exec(s)) !== null) {
      if (m[1] !== 'none') ids.push(m[1]);
    }
    return ids;
  };
  result.after = extractIds(afterMatch ? afterMatch[1] : '');
  result.before = extractIds(beforeMatch ? beforeMatch[1] : '');
  return result;
}
```

Update the `module.exports` line:

```javascript
module.exports = { extractFrontmatter, parseRequiredOrder };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd bin/josh && npm test`
Expected: 8 tests pass total (4 existing + 4 new), 0 fail.

- [ ] **Step 5: Commit**

```bash
git add bin/josh/lib/markdown-parser.js bin/josh/test/markdown-parser.test.js
git commit -m "feat(josh): add parseRequiredOrder for dispatch deps"
```

---

## Task 4: `markdown-parser.js` — parse dispatch block

**Files:**
- Modify: `bin/josh/lib/markdown-parser.js`
- Modify: `bin/josh/test/markdown-parser.test.js`

- [ ] **Step 1: Write the failing test**

Append to `bin/josh/test/markdown-parser.test.js`:

```javascript
const { parseDispatchBlock } = require('../lib/markdown-parser');

const SAMPLE_DISPATCH = `## Dispatch

- Day: 1 - May 9, 2026
- Phase: 01 - Command Center And Sequence Lock
- Primary role: A01 Command Center
- Required order: after \`none\`, before \`D1-002\`
- Parallel safety: this task may run in parallel only with tasks in the same phase that do not edit the same output file.

## Why This Task Exists`;

test('parseDispatchBlock: extracts all fields', () => {
  const result = parseDispatchBlock(SAMPLE_DISPATCH);
  assert.equal(result.day, 1);
  assert.equal(result.day_date, 'May 9, 2026');
  assert.equal(result.phase_num, 1);
  assert.equal(result.phase_name, 'Command Center And Sequence Lock');
  assert.equal(result.primary_role, 'A01');
  assert.deepEqual(result.required_order.after, []);
  assert.deepEqual(result.required_order.before, ['D1-002']);
  assert.match(result.parallel_safety, /same phase/);
});

test('parseDispatchBlock: returns null for missing dispatch section', () => {
  const result = parseDispatchBlock('# Some doc with no dispatch section');
  assert.equal(result, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bin/josh && npm test`
Expected: FAIL — `parseDispatchBlock is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `bin/josh/lib/markdown-parser.js` (before `module.exports`):

```javascript
function parseDispatchBlock(text) {
  const dispatchIdx = text.indexOf('## Dispatch');
  if (dispatchIdx === -1) return null;
  // Find next H2 (or end of text)
  const afterDispatch = text.slice(dispatchIdx + '## Dispatch'.length);
  const nextH2 = afterDispatch.search(/\n## /);
  const block = nextH2 === -1 ? afterDispatch : afterDispatch.slice(0, nextH2);

  const findField = (label) => {
    const re = new RegExp(`-\\s+${label}:\\s+(.+)`, 'i');
    const m = block.match(re);
    return m ? m[1].trim() : null;
  };

  const dayLine = findField('Day');
  let day = null, dayDate = null;
  if (dayLine) {
    const dayMatch = dayLine.match(/^(\d+)\s*-\s*(.+)$/);
    if (dayMatch) {
      day = parseInt(dayMatch[1], 10);
      dayDate = dayMatch[2].trim();
    }
  }

  const phaseLine = findField('Phase');
  let phaseNum = null, phaseName = null;
  if (phaseLine) {
    const phaseMatch = phaseLine.match(/^(\d+)\s*-\s*(.+)$/);
    if (phaseMatch) {
      phaseNum = parseInt(phaseMatch[1], 10);
      phaseName = phaseMatch[2].trim();
    }
  }

  const primaryRoleLine = findField('Primary role');
  let primaryRole = null;
  if (primaryRoleLine) {
    const roleMatch = primaryRoleLine.match(/^([AE]\d{2})\b/);
    primaryRole = roleMatch ? roleMatch[1] : primaryRoleLine.split(/\s/)[0];
  }

  const requiredOrderLine = findField('Required order');
  const requiredOrder = parseRequiredOrder(requiredOrderLine || '');

  const parallelSafety = findField('Parallel safety');

  return {
    day,
    day_date: dayDate,
    phase_num: phaseNum,
    phase_name: phaseName,
    primary_role: primaryRole,
    required_order: requiredOrder,
    parallel_safety: parallelSafety,
  };
}
```

Update `module.exports`:

```javascript
module.exports = { extractFrontmatter, parseRequiredOrder, parseDispatchBlock };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd bin/josh && npm test`
Expected: 10 tests pass total, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add bin/josh/lib/markdown-parser.js bin/josh/test/markdown-parser.test.js
git commit -m "feat(josh): add parseDispatchBlock for task metadata"
```

---

## Task 5: `markdown-parser.js` — parse agent heading

**Files:**
- Modify: `bin/josh/lib/markdown-parser.js`
- Modify: `bin/josh/test/markdown-parser.test.js`

- [ ] **Step 1: Write the failing test**

Append to `bin/josh/test/markdown-parser.test.js`:

```javascript
const { parseAgentHeading } = require('../lib/markdown-parser');

test('parseAgentHeading: extracts id and role group', () => {
  const result = parseAgentHeading('# Agent A03 - Claims, Compliance, And Source Safety\n\nStatus: READY');
  assert.equal(result.id, 'A03');
  assert.equal(result.title, 'Claims, Compliance, And Source Safety');
  assert.equal(result.role_group, 'claims_compliance_and_source_safety');
  assert.equal(result.status, 'READY');
});

test('parseAgentHeading: A01 with multi-word title', () => {
  const result = parseAgentHeading('# Agent A01 - Command Center And Integration\n\nStatus: READY');
  assert.equal(result.id, 'A01');
  assert.equal(result.title, 'Command Center And Integration');
  assert.equal(result.role_group, 'command_center_and_integration');
});

test('parseAgentHeading: unknown id returns null', () => {
  const result = parseAgentHeading('# Some other heading');
  assert.equal(result, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bin/josh && npm test`
Expected: FAIL — `parseAgentHeading is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `bin/josh/lib/markdown-parser.js` (before `module.exports`):

```javascript
function parseAgentHeading(text) {
  const headingMatch = text.match(/^#\s+Agent\s+([AE]\d{2})\s*-\s*(.+)$/m);
  if (!headingMatch) return null;
  const id = headingMatch[1];
  const title = headingMatch[2].trim();
  const role_group = title
    .toLowerCase()
    .replace(/[,]/g, '')
    .replace(/\s+/g, '_');
  const statusMatch = text.match(/^Status:\s+(\w+)/m);
  const status = statusMatch ? statusMatch[1] : null;
  return { id, title, role_group, status };
}
```

Update `module.exports`:

```javascript
module.exports = { extractFrontmatter, parseRequiredOrder, parseDispatchBlock, parseAgentHeading };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd bin/josh && npm test`
Expected: 13 tests pass total, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add bin/josh/lib/markdown-parser.js bin/josh/test/markdown-parser.test.js
git commit -m "feat(josh): add parseAgentHeading for agent brief metadata"
```

---

## Task 6: `project-importer.js` — parseCharter

**Files:**
- Create: `bin/josh/lib/project-importer.js`
- Create: `bin/josh/test/project-importer.test.js`

- [ ] **Step 1: Write the failing test**

Create `bin/josh/test/project-importer.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { parseCharter } = require('../lib/project-importer');

const FIXTURE_DISPATCH = path.join(__dirname, 'fixtures/corpus/FOUR_DAY_FULL_PROJECT_DISPATCH');

test('parseCharter: extracts title, definition_of_done, days', () => {
  const result = parseCharter(path.join(FIXTURE_DISPATCH, 'README.md'));
  assert.equal(result.title, 'Four-Day Full Project Dispatch');
  assert.match(result.definition_of_done, /approved launch path is live/);
  assert.equal(result.days.length, 4);
  assert.equal(result.days[0].day, 1);
  assert.equal(result.days[0].date, 'May 9, 2026');
  assert.equal(result.days[0].folder, 'day_1_lock_scope_and_command');
  assert.match(result.days[0].goal, /launch definition/);
  assert.equal(result.source_path, path.resolve(path.join(FIXTURE_DISPATCH, 'README.md')));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bin/josh && npm test`
Expected: FAIL — `Cannot find module '../lib/project-importer'`.

- [ ] **Step 3: Write minimal implementation**

Create `bin/josh/lib/project-importer.js`:

```javascript
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function parseCharter(readmePath) {
  const text = fs.readFileSync(readmePath, 'utf8');
  const titleMatch = text.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled Project';

  // Extract Definition Of Done section
  const dodMatch = text.match(/##\s+Definition\s+Of\s+Done\s*\n+([\s\S]*?)(?:\n##\s+|\n*$)/i);
  const definition_of_done = dodMatch ? dodMatch[1].trim() : null;

  // Extract Days table — find rows like `| Day 1 | May 9, 2026 | folder | goal |`
  const days = [];
  const dayRowRe = /\|\s*Day\s+(\d+)\s*\|\s*([^|]+?)\s*\|\s*(\[[^\]]+\]\([^)]+\)|[^|]+?)\s*\|\s*([^|]+?)\s*\|/g;
  let m;
  while ((m = dayRowRe.exec(text)) !== null) {
    const folderRaw = m[3].trim();
    const folderMatch = folderRaw.match(/\(([^)]+)\)/);
    const folder = folderMatch
      ? folderMatch[1].replace(/\/.*$/, '')  // strip trailing /README.md
      : folderRaw;
    days.push({
      day: parseInt(m[1], 10),
      date: m[2].trim(),
      folder,
      goal: m[4].trim(),
    });
  }

  return {
    title,
    definition_of_done,
    days,
    source_path: path.resolve(readmePath),
  };
}

module.exports = { parseCharter };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd bin/josh && npm test`
Expected: 14 tests pass total, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add bin/josh/lib/project-importer.js bin/josh/test/project-importer.test.js
git commit -m "feat(josh): add parseCharter for project README"
```

---

## Task 7: `project-importer.js` — parseTask

**Files:**
- Modify: `bin/josh/lib/project-importer.js`
- Modify: `bin/josh/test/project-importer.test.js`

- [ ] **Step 1: Write the failing test**

Append to `bin/josh/test/project-importer.test.js`:

```javascript
const { parseTask } = require('../lib/project-importer');

test('parseTask: extracts display_id, title, dispatch metadata', () => {
  const taskPath = path.join(FIXTURE_DISPATCH, 'day_1_lock_scope_and_command', 'D1-001_freeze_four_day_launch_definition.md');
  const result = parseTask(taskPath);
  assert.equal(result.display_id, 'D1-001');
  assert.equal(result.title, 'Freeze four-day launch definition');
  assert.equal(result.day, 1);
  assert.equal(result.phase, 1);
  assert.equal(result.primary_role, 'A01');
  assert.deepEqual(result.depends_on_display_ids, []);
  assert.deepEqual(result.blocks_display_ids, ['D1-002']);
  assert.match(result.parallel_safety, /same phase/);
  assert.equal(result.source_path, path.resolve(taskPath));
});

test('parseTask: D1-003 has D1-002 as upstream', () => {
  const taskPath = path.join(FIXTURE_DISPATCH, 'day_1_lock_scope_and_command', 'D1-003_map_dependency_chain.md');
  const result = parseTask(taskPath);
  assert.equal(result.display_id, 'D1-003');
  assert.deepEqual(result.depends_on_display_ids, ['D1-002']);
  assert.deepEqual(result.blocks_display_ids, ['D1-004']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bin/josh && npm test`
Expected: FAIL — `parseTask is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `bin/josh/lib/project-importer.js` (before `module.exports`):

```javascript
const { parseDispatchBlock } = require('./markdown-parser');

function parseTask(taskPath) {
  const text = fs.readFileSync(taskPath, 'utf8');
  // Filename: D1-001_freeze_four_day_launch_definition.md → D1-001
  const filename = path.basename(taskPath, '.md');
  const displayIdMatch = filename.match(/^(D\d+-\d+)/);
  const display_id = displayIdMatch ? displayIdMatch[1] : null;

  // Title: from H1 — "# Day 1 - ... Task NNN: <title>"
  const headingMatch = text.match(/^#\s+.+?Task\s+\d+:\s+(.+)$/m);
  const title = headingMatch ? headingMatch[1].trim() : filename;

  const dispatch = parseDispatchBlock(text) || {};

  return {
    display_id,
    title,
    day: dispatch.day,
    phase: dispatch.phase_num,
    phase_name: dispatch.phase_name,
    primary_role: dispatch.primary_role,
    depends_on_display_ids: dispatch.required_order ? dispatch.required_order.after : [],
    blocks_display_ids: dispatch.required_order ? dispatch.required_order.before : [],
    parallel_safety: dispatch.parallel_safety,
    source_path: path.resolve(taskPath),
  };
}
```

Update `module.exports`:

```javascript
module.exports = { parseCharter, parseTask };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd bin/josh && npm test`
Expected: 16 tests pass total, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add bin/josh/lib/project-importer.js bin/josh/test/project-importer.test.js
git commit -m "feat(josh): add parseTask for dispatch task files"
```

---

## Task 8: `project-importer.js` — parseAgent

**Files:**
- Modify: `bin/josh/lib/project-importer.js`
- Modify: `bin/josh/test/project-importer.test.js`

- [ ] **Step 1: Write the failing test**

Append to `bin/josh/test/project-importer.test.js`:

```javascript
const { parseAgent } = require('../lib/project-importer');
const FIXTURE_AGENT_DIR = path.join(__dirname, 'fixtures/corpus/agent_orchestration/agents');

test('parseAgent: A01 extracts id, title, role_group, source_path, source_path_hash', () => {
  const result = parseAgent(path.join(FIXTURE_AGENT_DIR, 'AGENT_01_COMMAND_CENTER.md'));
  assert.equal(result.id, 'A01');
  assert.equal(result.title, 'Command Center And Integration');
  assert.equal(result.role_group, 'command_center_and_integration');
  assert.equal(result.status, 'READY');
  assert.equal(result.source_path, path.resolve(path.join(FIXTURE_AGENT_DIR, 'AGENT_01_COMMAND_CENTER.md')));
  assert.match(result.source_path_hash, /^[a-f0-9]{64}$/);
});

test('parseAgent: A03 includes mission and gates', () => {
  const result = parseAgent(path.join(FIXTURE_AGENT_DIR, 'AGENT_03_CLAIMS_SOURCE_SAFETY.md'));
  assert.equal(result.id, 'A03');
  assert.match(result.mission_summary, /unsupported claims/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bin/josh && npm test`
Expected: FAIL — `parseAgent is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `bin/josh/lib/project-importer.js`. First add the imports at the top of the file (after the existing `const { parseDispatchBlock } = ...` line):

```javascript
const crypto = require('node:crypto');
const { parseAgentHeading } = require('./markdown-parser');
```

Then append before `module.exports`:

```javascript
function parseAgent(agentPath) {
  const text = fs.readFileSync(agentPath, 'utf8');
  const heading = parseAgentHeading(text);
  if (!heading) {
    throw new Error(`No agent heading found in ${agentPath}`);
  }
  const source_path_hash = crypto.createHash('sha256').update(text).digest('hex');

  // Extract mission summary: first paragraph under ## Mission
  const missionMatch = text.match(/##\s+Mission\s*\n+([^\n][^\n]*(?:\n[^\n][^\n]*)*?)(?:\n\n|\n##)/);
  const mission_summary = missionMatch ? missionMatch[1].trim() : null;

  return {
    id: heading.id,
    title: heading.title,
    role_group: heading.role_group,
    status: heading.status,
    mission_summary,
    source_path: path.resolve(agentPath),
    source_path_hash,
  };
}
```

Update `module.exports`:

```javascript
module.exports = { parseCharter, parseTask, parseAgent };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd bin/josh && npm test`
Expected: 18 tests pass total, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add bin/josh/lib/project-importer.js bin/josh/test/project-importer.test.js
git commit -m "feat(josh): add parseAgent for AGENT_XX briefs"
```

---

## Task 9: `project-importer.js` — importProject orchestrator

**Files:**
- Modify: `bin/josh/lib/project-importer.js`
- Modify: `bin/josh/test/project-importer.test.js`

- [ ] **Step 1: Write the failing test**

Append to `bin/josh/test/project-importer.test.js`:

```javascript
const { importProject } = require('../lib/project-importer');
const fs = require('node:fs');
const os = require('node:os');

const FIXTURE_CORPUS = path.join(__dirname, 'fixtures/corpus');

test('importProject: writes charter, todos, agent manifests under JOSH_ROOT', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-test-'));
  // Seed minimal .josh directory
  fs.mkdirSync(path.join(tmpRoot, 'projects'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'agents'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'todo', 'triaged'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'audit'), { recursive: true });

  const result = importProject(FIXTURE_CORPUS, { joshRoot: tmpRoot, actor: 'cli:test' });

  assert.equal(result.todo_count, 2);
  assert.equal(result.agent_count, 2);
  assert.equal(typeof result.project_id, 'string');

  // Verify charter file exists
  const charterPath = path.join(tmpRoot, 'projects', result.project_id, 'charter.json');
  assert.equal(fs.existsSync(charterPath), true);
  const charter = JSON.parse(fs.readFileSync(charterPath, 'utf8'));
  assert.equal(charter.title, 'Four-Day Full Project Dispatch');
  assert.equal(charter.imported_by, 'cli:test');

  // Verify agent manifests
  const a01Path = path.join(tmpRoot, 'agents', 'A01', 'manifest.json');
  assert.equal(fs.existsSync(a01Path), true);
  const a01 = JSON.parse(fs.readFileSync(a01Path, 'utf8'));
  assert.equal(a01.id, 'A01');
  assert.equal(a01.version, 1);
  assert.match(a01.source_path_hash, /^[a-f0-9]{64}$/);

  // Verify todos written to triaged/
  const triaged = fs.readdirSync(path.join(tmpRoot, 'todo', 'triaged'));
  assert.equal(triaged.length, 2);

  // Verify audit log has events
  const auditFiles = fs.readdirSync(path.join(tmpRoot, 'audit'));
  assert.ok(auditFiles.length > 0);

  fs.rmSync(tmpRoot, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bin/josh && npm test`
Expected: FAIL — `importProject is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `bin/josh/lib/project-importer.js` before `module.exports`:

```javascript
function ulid(now = Date.now()) {
  // Crockford base32 ULID — same algorithm as in josh.js
  const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let timeStr = '';
  let t = now;
  for (let i = 9; i >= 0; i--) {
    timeStr = ENCODING[t % 32] + timeStr;
    t = Math.floor(t / 32);
  }
  let randStr = '';
  for (let i = 0; i < 16; i++) {
    randStr += ENCODING[Math.floor(Math.random() * 32)];
  }
  return timeStr + randStr;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJsonAtomic(p, obj) {
  const tmp = p + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, p);
}

function appendAuditEvent(joshRoot, event) {
  const date = new Date().toISOString().slice(0, 10);
  const auditPath = path.join(joshRoot, 'audit', `${date}.jsonl`);
  ensureDir(path.dirname(auditPath));
  fs.appendFileSync(auditPath, JSON.stringify(event) + '\n');
}

function findTaskFiles(corpusPath) {
  const dispatchDir = path.join(corpusPath, 'FOUR_DAY_FULL_PROJECT_DISPATCH');
  const taskFiles = [];
  for (const dayFolder of fs.readdirSync(dispatchDir)) {
    if (!/^day_\d+_/.test(dayFolder)) continue;
    const dayPath = path.join(dispatchDir, dayFolder);
    if (!fs.statSync(dayPath).isDirectory()) continue;
    for (const file of fs.readdirSync(dayPath)) {
      if (/^D\d+-\d+_.+\.md$/.test(file)) {
        taskFiles.push(path.join(dayPath, file));
      }
    }
  }
  return taskFiles;
}

function findAgentFiles(corpusPath) {
  const agentDir = path.join(corpusPath, 'agent_orchestration', 'agents');
  if (!fs.existsSync(agentDir)) return [];
  return fs.readdirSync(agentDir)
    .filter((f) => /^AGENT_\d+_.+\.md$/.test(f))
    .map((f) => path.join(agentDir, f));
}

function importProject(corpusPath, opts = {}) {
  const joshRoot = opts.joshRoot || path.join(require('os').homedir(), '.josh');
  const actor = opts.actor || 'cli:josh';
  const now = new Date().toISOString();

  // 1. Parse charter
  const dispatchReadme = path.join(corpusPath, 'FOUR_DAY_FULL_PROJECT_DISPATCH', 'README.md');
  const charter = parseCharter(dispatchReadme);

  // 2. Parse all tasks
  const taskFiles = findTaskFiles(corpusPath);
  const tasks = taskFiles.map(parseTask);

  // 3. Parse all agents
  const agentFiles = findAgentFiles(corpusPath);
  const agents = agentFiles.map(parseAgent);

  // 4. Generate project ULID
  const project_id = ulid();

  // 5. Write charter
  const projectDir = path.join(joshRoot, 'projects', project_id);
  ensureDir(projectDir);
  writeJsonAtomic(path.join(projectDir, 'charter.json'), {
    schema: 1,
    id: project_id,
    title: charter.title,
    source_path: charter.source_path,
    definition_of_done: charter.definition_of_done,
    days: charter.days,
    agent_set_snapshot: agents.map((a) => a.id),
    imported_at: now,
    imported_by: actor,
  });

  appendAuditEvent(joshRoot, {
    schema: 1,
    at: now,
    actor,
    action: 'project.imported',
    id: project_id,
    details: { title: charter.title, todo_count: tasks.length, agent_count: agents.length },
  });

  // 6. Write agent manifests
  for (const agent of agents) {
    const agentDir = path.join(joshRoot, 'agents', agent.id);
    ensureDir(agentDir);
    writeJsonAtomic(path.join(agentDir, 'manifest.json'), {
      schema: 1,
      id: agent.id,
      version: 1,
      project_id,
      source_path: agent.source_path,
      source_path_hash: agent.source_path_hash,
      title: agent.title,
      role_group: agent.role_group,
      status: agent.status,
      mission_summary: agent.mission_summary,
      capabilities: [],
      verdict_schema: null,
      budget: { max_tokens_per_claim: 50000, max_wall_seconds: 600, preferred_model: 'sonnet' },
      did: null,
      pubkey_path: null,
      superseded_by: null,
      trust_dimensions: [],
      imported_at: now,
      imported_by: actor,
    });

    appendAuditEvent(joshRoot, {
      schema: 1,
      at: now,
      actor,
      action: 'agent.imported',
      id: agent.id,
      details: { title: agent.title, source_path: agent.source_path },
    });
  }

  // 7. Build display_id → ulid map for cross-references
  const taskUlids = {};
  for (const task of tasks) {
    taskUlids[task.display_id] = ulid();
  }

  // 8. Write todos
  const triagedDir = path.join(joshRoot, 'todo', 'triaged');
  ensureDir(triagedDir);
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
    writeJsonAtomic(path.join(triagedDir, `${todo_id}.json`), todoData);

    appendAuditEvent(joshRoot, {
      schema: 1,
      at: now,
      actor,
      action: 'todo.imported',
      id: todo_id,
      details: { display_id: task.display_id, primary_role: task.primary_role },
    });
  }

  return {
    project_id,
    todo_count: tasks.length,
    agent_count: agents.length,
  };
}
```

Update `module.exports`:

```javascript
module.exports = { parseCharter, parseTask, parseAgent, importProject };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd bin/josh && npm test`
Expected: 19 tests pass total, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add bin/josh/lib/project-importer.js bin/josh/test/project-importer.test.js
git commit -m "feat(josh): add importProject orchestrator (charter+todos+agents+audit)"
```

---

## Task 10: Wire `josh project import` subcommand into `josh.js`

**Files:**
- Modify: `bin/josh/josh.js`

- [ ] **Step 1: Read josh.js dispatcher pattern**

Open `bin/josh/josh.js`. Find the main function that dispatches subcommands by argv[2]. It is named like `function main()` or runs at the bottom. Find the `switch` or `if/else` chain that matches commands like `'init'`, `'status'`, `'push'`, `'list'`, etc. Note the pattern.

- [ ] **Step 2: Add cmdProject dispatcher (top-level subcommand)**

Append to `bin/josh/josh.js`, before the main dispatcher block (i.e., near the other `function cmdX(args)` definitions):

```javascript
function cmdProject(args) {
  const sub = args[0];
  const rest = args.slice(1);
  if (!sub || sub === 'help' || sub === '--help' || sub === '-h') {
    log(`Usage: josh project <subcommand>

Subcommands:
  import <corpus-path>    Import a Markdown corpus (project + agents + todos)
  status [--project ID]   Render the daily-review template
  sync [--project ID]     Refresh imported entities from source files`);
    return 0;
  }
  switch (sub) {
    case 'import':  return cmdProjectImport(rest);
    case 'status':  return cmdProjectStatus(rest);
    case 'sync':    return cmdProjectSync(rest);
    default:
      err(`unknown project subcommand: ${sub}`);
      return 1;
  }
}

function cmdProjectImport(args) {
  if (args.length < 1 || args[0].startsWith('-')) {
    err('usage: josh project import <corpus-path>');
    return 1;
  }
  const corpusPath = path.resolve(args[0]);
  if (!fs.existsSync(corpusPath)) {
    err(`error: corpus path does not exist: ${corpusPath}`);
    return 2;
  }
  const { importProject } = require('./lib/project-importer');
  const actor = defaultActor();
  try {
    const result = importProject(corpusPath, { joshRoot: JOSH_ROOT(), actor });
    log(`imported project ${result.project_id}`);
    log(`  todos:  ${result.todo_count}`);
    log(`  agents: ${result.agent_count}`);
    return 0;
  } catch (e) {
    err(`import failed: ${e.message}`);
    if (process.env.JOSH_DEBUG) err(e.stack);
    return 4;
  }
}

function cmdProjectStatus(args) {
  err('not yet implemented (Task 11)');
  return 1;
}

function cmdProjectSync(args) {
  err('not yet implemented (Task 13)');
  return 1;
}
```

- [ ] **Step 3: Add `project` to the main dispatcher**

Find the main dispatcher block. It probably looks like:

```javascript
switch (cmd) {
  case 'init': return cmdInit();
  case 'status': return cmdStatus();
  // ...
}
```

Add a new case before the `default`:

```javascript
case 'project': return cmdProject(args.slice(1));
```

(Where `args` is the existing `process.argv.slice(2)` or equivalent variable. Match the existing pattern.)

- [ ] **Step 4: Test it manually against the fixture corpus**

Run:
```bash
JOSH_ROOT=/tmp/josh-manual-test cd bin/josh && \
  mkdir -p /tmp/josh-manual-test/{projects,agents,todo/triaged,audit} && \
  node josh.js project import test/fixtures/corpus
```

Expected stdout:
```
imported project 01H...
  todos:  2
  agents: 2
```

Verify files written:
```bash
ls /tmp/josh-manual-test/projects/*/charter.json
ls /tmp/josh-manual-test/agents/A01/manifest.json
ls /tmp/josh-manual-test/agents/A03/manifest.json
ls /tmp/josh-manual-test/todo/triaged/*.json | wc -l   # → 2
```

(On Windows Git Bash, replace `/tmp/josh-manual-test` with `$LOCALAPPDATA/Temp/josh-manual-test` or similar.)

Cleanup:
```bash
rm -rf /tmp/josh-manual-test
```

- [ ] **Step 5: Commit**

```bash
git add bin/josh/josh.js
git commit -m "feat(josh): add 'josh project import' subcommand"
```

---

## Task 11: `project-status.js` — renderDailyReview

**Files:**
- Create: `bin/josh/lib/project-status.js`
- Create: `bin/josh/test/project-status.test.js`

- [ ] **Step 1: Write the failing test**

Create `bin/josh/test/project-status.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { importProject } = require('../lib/project-importer');
const { renderDailyReview } = require('../lib/project-status');

const FIXTURE_CORPUS = path.join(__dirname, 'fixtures/corpus');

test('renderDailyReview: includes title, day-by-day breakdown, agent list', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-status-'));
  fs.mkdirSync(path.join(tmpRoot, 'projects'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'agents'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'todo', 'triaged'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'audit'), { recursive: true });

  const result = importProject(FIXTURE_CORPUS, { joshRoot: tmpRoot, actor: 'cli:test' });
  const output = renderDailyReview(result.project_id, { joshRoot: tmpRoot });

  assert.match(output, /Four-Day Full Project Dispatch/);
  assert.match(output, /Day 1.*May 9, 2026/);
  assert.match(output, /A01/);
  assert.match(output, /A03/);
  assert.match(output, /todos: 2/i);

  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test('renderDailyReview: throws on missing project', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-status-'));
  assert.throws(() => renderDailyReview('NONEXISTENT', { joshRoot: tmpRoot }));
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bin/josh && npm test`
Expected: FAIL — `Cannot find module '../lib/project-status'`.

- [ ] **Step 3: Write minimal implementation**

Create `bin/josh/lib/project-status.js`:

```javascript
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function renderDailyReview(projectId, opts = {}) {
  const joshRoot = opts.joshRoot || path.join(os.homedir(), '.josh');
  const charterPath = path.join(joshRoot, 'projects', projectId, 'charter.json');
  if (!fs.existsSync(charterPath)) {
    throw new Error(`project ${projectId} not found at ${charterPath}`);
  }
  const charter = readJson(charterPath);

  // Gather all todos with this project_id from every state directory
  const states = ['incoming', 'triaged', 'in_progress', 'done', 'blocked', 'failed', 'cancelled'];
  const counts = {};
  const byDay = {};
  for (const state of states) {
    counts[state] = 0;
    const dir = path.join(joshRoot, 'todo', state);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      let todo;
      try { todo = readJson(path.join(dir, file)); } catch (e) { continue; }
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

  // Gather agents for this project
  const agentsDir = path.join(joshRoot, 'agents');
  const agents = [];
  if (fs.existsSync(agentsDir)) {
    for (const id of fs.readdirSync(agentsDir)) {
      const manifestPath = path.join(agentsDir, id, 'manifest.json');
      if (!fs.existsSync(manifestPath)) continue;
      const m = readJson(manifestPath);
      if (m.project_id === projectId) agents.push(m);
    }
  }

  const totalTodos = Object.values(counts).reduce((a, b) => a + b, 0);

  const lines = [];
  lines.push(`# ${charter.title}`);
  lines.push('');
  lines.push(`Project ID: ${charter.id}`);
  lines.push(`Source: ${charter.source_path}`);
  lines.push(`Imported: ${charter.imported_at} by ${charter.imported_by}`);
  lines.push('');
  lines.push(`## Counts`);
  lines.push(`- todos: ${totalTodos}`);
  for (const state of states) {
    if (counts[state] > 0) lines.push(`  - ${state}: ${counts[state]}`);
  }
  lines.push(`- agents: ${agents.length}`);
  lines.push('');
  lines.push(`## Day-by-day`);
  for (const day of charter.days || []) {
    const k = `Day ${day.day}`;
    const d = byDay[k] || { total: 0, done: 0, in_progress: 0, blocked: 0 };
    const pct = d.total > 0 ? Math.round((d.done / d.total) * 100) : 0;
    lines.push(`- ${k} (${day.date}): ${d.done}/${d.total} done (${pct}%) — ${day.goal}`);
  }
  lines.push('');
  lines.push(`## Agents`);
  for (const agent of agents.sort((a, b) => a.id.localeCompare(b.id))) {
    lines.push(`- ${agent.id}: ${agent.title} [${agent.status || 'UNKNOWN'}]`);
  }

  return lines.join('\n');
}

module.exports = { renderDailyReview };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd bin/josh && npm test`
Expected: 21 tests pass total, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add bin/josh/lib/project-status.js bin/josh/test/project-status.test.js
git commit -m "feat(josh): add renderDailyReview for project status"
```

---

## Task 12: Wire `josh project status` subcommand

**Files:**
- Modify: `bin/josh/josh.js`

- [ ] **Step 1: Replace the stub cmdProjectStatus**

In `bin/josh/josh.js`, find the `function cmdProjectStatus(args)` stub from Task 10. Replace its body:

```javascript
function cmdProjectStatus(args) {
  const { renderDailyReview } = require('./lib/project-status');
  let projectId = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project') {
      projectId = args[++i];
    }
  }
  // If no --project flag, find the only project under JOSH_ROOT/projects/
  if (!projectId) {
    const projectsDir = path.join(JOSH_ROOT(), 'projects');
    if (!fs.existsSync(projectsDir)) {
      err('no projects imported yet');
      return 2;
    }
    const ids = fs.readdirSync(projectsDir).filter((d) =>
      fs.statSync(path.join(projectsDir, d)).isDirectory()
    );
    if (ids.length === 0) {
      err('no projects imported yet');
      return 2;
    }
    if (ids.length > 1) {
      err(`multiple projects exist; specify one with --project <id>`);
      err(`available: ${ids.join(', ')}`);
      return 1;
    }
    projectId = ids[0];
  }
  try {
    log(renderDailyReview(projectId, { joshRoot: JOSH_ROOT() }));
    return 0;
  } catch (e) {
    err(e.message);
    return 2;
  }
}
```

- [ ] **Step 2: Test manually**

Run:
```bash
mkdir -p /tmp/josh-status-test/{projects,agents,todo/triaged,audit}
JOSH_ROOT=/tmp/josh-status-test node bin/josh/josh.js project import bin/josh/test/fixtures/corpus
JOSH_ROOT=/tmp/josh-status-test node bin/josh/josh.js project status
```

Expected stdout: starts with `# Four-Day Full Project Dispatch`, includes `Day 1`, `A01`, `A03`, `todos: 2`.

Cleanup: `rm -rf /tmp/josh-status-test`.

- [ ] **Step 3: Commit**

```bash
git add bin/josh/josh.js
git commit -m "feat(josh): wire 'josh project status' subcommand"
```

---

## Task 13: `project-sync.js` — diffProject + applySync

**Files:**
- Create: `bin/josh/lib/project-sync.js`
- Create: `bin/josh/test/project-sync.test.js`

- [ ] **Step 1: Write the failing test**

Create `bin/josh/test/project-sync.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { importProject } = require('../lib/project-importer');
const { diffProject, applySync } = require('../lib/project-sync');

function setupFixture() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-sync-'));
  fs.mkdirSync(path.join(tmpRoot, 'projects'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'agents'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'todo', 'triaged'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'audit'), { recursive: true });

  // Copy fixture corpus to a writable location so we can mutate it
  const corpus = path.join(tmpRoot, 'corpus');
  fs.cpSync(path.join(__dirname, 'fixtures/corpus'), corpus, { recursive: true });
  return { tmpRoot, corpus };
}

test('diffProject: returns empty changes when nothing changed', () => {
  const { tmpRoot, corpus } = setupFixture();
  const { project_id } = importProject(corpus, { joshRoot: tmpRoot, actor: 'cli:test' });
  const diff = diffProject(project_id, { joshRoot: tmpRoot });
  assert.equal(diff.agents_changed.length, 0);
  assert.equal(diff.tasks_changed.length, 0);
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test('diffProject: detects changed agent file', () => {
  const { tmpRoot, corpus } = setupFixture();
  const { project_id } = importProject(corpus, { joshRoot: tmpRoot, actor: 'cli:test' });
  // Modify A01 source
  const a01Source = path.join(corpus, 'agent_orchestration/agents/AGENT_01_COMMAND_CENTER.md');
  fs.appendFileSync(a01Source, '\n## New Section\n\nAdded line.');
  const diff = diffProject(project_id, { joshRoot: tmpRoot });
  assert.equal(diff.agents_changed.length, 1);
  assert.equal(diff.agents_changed[0].id, 'A01');
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test('applySync: updates manifest hash after change', () => {
  const { tmpRoot, corpus } = setupFixture();
  const { project_id } = importProject(corpus, { joshRoot: tmpRoot, actor: 'cli:test' });
  const a01Source = path.join(corpus, 'agent_orchestration/agents/AGENT_01_COMMAND_CENTER.md');
  fs.appendFileSync(a01Source, '\n## New Section\n\nAdded line.');
  const result = applySync(project_id, { joshRoot: tmpRoot, actor: 'cli:test' });
  assert.equal(result.agents_updated, 1);
  // Verify manifest hash changed
  const manifest = JSON.parse(fs.readFileSync(path.join(tmpRoot, 'agents/A01/manifest.json'), 'utf8'));
  assert.match(manifest.source_path_hash, /^[a-f0-9]{64}$/);
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd bin/josh && npm test`
Expected: FAIL — `Cannot find module '../lib/project-sync'`.

- [ ] **Step 3: Write minimal implementation**

Create `bin/josh/lib/project-sync.js`:

```javascript
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { parseAgent, parseTask } = require('./project-importer');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function writeJsonAtomic(p, obj) {
  const tmp = p + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, p);
}

function appendAuditEvent(joshRoot, event) {
  const date = new Date().toISOString().slice(0, 10);
  const auditPath = path.join(joshRoot, 'audit', `${date}.jsonl`);
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  fs.appendFileSync(auditPath, JSON.stringify(event) + '\n');
}

function fileHash(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function diffProject(projectId, opts = {}) {
  const joshRoot = opts.joshRoot || path.join(os.homedir(), '.josh');
  const result = { agents_changed: [], agents_missing: [], tasks_changed: [], tasks_missing: [] };

  // Diff agents
  const agentsDir = path.join(joshRoot, 'agents');
  if (fs.existsSync(agentsDir)) {
    for (const id of fs.readdirSync(agentsDir)) {
      const manifestPath = path.join(agentsDir, id, 'manifest.json');
      if (!fs.existsSync(manifestPath)) continue;
      const manifest = readJson(manifestPath);
      if (manifest.project_id !== projectId) continue;
      if (!fs.existsSync(manifest.source_path)) {
        result.agents_missing.push({ id: manifest.id, source_path: manifest.source_path });
        continue;
      }
      const currentHash = fileHash(manifest.source_path);
      if (currentHash !== manifest.source_path_hash) {
        result.agents_changed.push({ id: manifest.id, old_hash: manifest.source_path_hash, new_hash: currentHash });
      }
    }
  }

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
      if (!fs.existsSync(todo.source_path)) {
        result.tasks_missing.push({ id: todo.id, display_id: todo.display_id, source_path: todo.source_path });
        continue;
      }
      // For tasks, we don't store a content hash currently, so re-parse and compare title + day + phase + deps.
      // Sufficient for Phase 1 — content-hash for tasks is Phase 6 (audit binding).
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

  return result;
}

function applySync(projectId, opts = {}) {
  const joshRoot = opts.joshRoot || path.join(os.homedir(), '.josh');
  const actor = opts.actor || 'cli:josh';
  const dryRun = !!opts.dryRun;
  const now = new Date().toISOString();
  const diff = diffProject(projectId, { joshRoot });
  let agents_updated = 0;
  let tasks_updated = 0;

  if (!dryRun) {
    for (const change of diff.agents_changed) {
      const manifestPath = path.join(joshRoot, 'agents', change.id, 'manifest.json');
      const manifest = readJson(manifestPath);
      const fresh = parseAgent(manifest.source_path);
      manifest.source_path_hash = fresh.source_path_hash;
      manifest.title = fresh.title;
      manifest.role_group = fresh.role_group;
      manifest.status = fresh.status;
      manifest.mission_summary = fresh.mission_summary;
      manifest.synced_at = now;
      manifest.synced_by = actor;
      writeJsonAtomic(manifestPath, manifest);
      agents_updated++;
      appendAuditEvent(joshRoot, {
        schema: 1, at: now, actor, action: 'agent.synced', id: change.id,
        details: { old_hash: change.old_hash, new_hash: change.new_hash },
      });
    }

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
      writeJsonAtomic(todoPath, todo);
      tasks_updated++;
      appendAuditEvent(joshRoot, {
        schema: 1, at: now, actor, action: 'todo.synced', id: todo.id,
        details: { display_id: todo.display_id },
      });
    }
  }

  return {
    project_id: projectId,
    dry_run: dryRun,
    agents_changed: diff.agents_changed.length,
    agents_missing: diff.agents_missing.length,
    agents_updated,
    tasks_changed: diff.tasks_changed.length,
    tasks_missing: diff.tasks_missing.length,
    tasks_updated,
  };
}

module.exports = { diffProject, applySync };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd bin/josh && npm test`
Expected: 24 tests pass total, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add bin/josh/lib/project-sync.js bin/josh/test/project-sync.test.js
git commit -m "feat(josh): add diffProject + applySync for corpus refresh"
```

---

## Task 14: Wire `josh project sync` subcommand

**Files:**
- Modify: `bin/josh/josh.js`

- [ ] **Step 1: Replace the stub cmdProjectSync**

In `bin/josh/josh.js`, find the `function cmdProjectSync(args)` stub from Task 10. Replace its body:

```javascript
function cmdProjectSync(args) {
  const { applySync } = require('./lib/project-sync');
  let projectId = null;
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project') projectId = args[++i];
    else if (args[i] === '--dry-run') dryRun = true;
  }
  if (!projectId) {
    const projectsDir = path.join(JOSH_ROOT(), 'projects');
    if (!fs.existsSync(projectsDir)) {
      err('no projects imported yet');
      return 2;
    }
    const ids = fs.readdirSync(projectsDir).filter((d) =>
      fs.statSync(path.join(projectsDir, d)).isDirectory()
    );
    if (ids.length === 0) { err('no projects imported yet'); return 2; }
    if (ids.length > 1) {
      err('multiple projects exist; specify one with --project <id>');
      return 1;
    }
    projectId = ids[0];
  }
  try {
    const result = applySync(projectId, { joshRoot: JOSH_ROOT(), actor: defaultActor(), dryRun });
    log(`sync ${result.dry_run ? '(dry-run) ' : ''}for project ${result.project_id}`);
    log(`  agents:  changed=${result.agents_changed} missing=${result.agents_missing} updated=${result.agents_updated}`);
    log(`  tasks:   changed=${result.tasks_changed} missing=${result.tasks_missing} updated=${result.tasks_updated}`);
    return 0;
  } catch (e) {
    err(e.message);
    if (process.env.JOSH_DEBUG) err(e.stack);
    return 4;
  }
}
```

- [ ] **Step 2: Test manually**

Run:
```bash
mkdir -p /tmp/josh-sync-manual/{projects,agents,todo/triaged,audit}
cp -r bin/josh/test/fixtures/corpus /tmp/josh-sync-manual/corpus
JOSH_ROOT=/tmp/josh-sync-manual node bin/josh/josh.js project import /tmp/josh-sync-manual/corpus
JOSH_ROOT=/tmp/josh-sync-manual node bin/josh/josh.js project sync
```

Expected: `agents: changed=0 missing=0 updated=0`, `tasks: changed=0 missing=0 updated=0`.

Now mutate a source file:
```bash
echo "## Extra section" >> /tmp/josh-sync-manual/corpus/agent_orchestration/agents/AGENT_01_COMMAND_CENTER.md
JOSH_ROOT=/tmp/josh-sync-manual node bin/josh/josh.js project sync --dry-run
```

Expected: `agents: changed=1 missing=0 updated=0` (dry-run, no changes applied).

```bash
JOSH_ROOT=/tmp/josh-sync-manual node bin/josh/josh.js project sync
```

Expected: `agents: changed=1 missing=0 updated=1`.

Cleanup: `rm -rf /tmp/josh-sync-manual`.

- [ ] **Step 3: Commit**

```bash
git add bin/josh/josh.js
git commit -m "feat(josh): wire 'josh project sync' subcommand with --dry-run"
```

---

## Task 15: Integration test against real BarMatrix corpus

**Files:**
- Create: `bin/josh/test/integration-barmatrix.test.js`

Note: this test only runs when `RUN_BARMATRIX_INTEGRATION=1` is set in the environment, since the corpus path is environment-specific.

- [ ] **Step 1: Write the integration test**

Create `bin/josh/test/integration-barmatrix.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { importProject } = require('../lib/project-importer');
const { renderDailyReview } = require('../lib/project-status');

const SHOULD_RUN = process.env.RUN_BARMATRIX_INTEGRATION === '1';
const BARMATRIX_CORPUS = process.env.BARMATRIX_CORPUS_PATH ||
  'C:/AINC/MEV/experiments/mbe_tension_matrix';

test('integration: import real BarMatrix corpus', { skip: !SHOULD_RUN }, () => {
  if (!fs.existsSync(BARMATRIX_CORPUS)) {
    throw new Error(`BarMatrix corpus not found at ${BARMATRIX_CORPUS}`);
  }
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-bm-'));
  fs.mkdirSync(path.join(tmpRoot, 'projects'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'agents'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'todo', 'triaged'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'audit'), { recursive: true });

  const result = importProject(BARMATRIX_CORPUS, { joshRoot: tmpRoot, actor: 'cli:integration' });
  // BarMatrix has 408 dispatch tasks (D1-001 .. D4-100) and 10 launch agents
  assert.ok(result.todo_count >= 400, `expected ≥400 tasks, got ${result.todo_count}`);
  assert.ok(result.todo_count <= 420, `expected ≤420 tasks, got ${result.todo_count}`);
  assert.equal(result.agent_count, 10, `expected 10 agents (A01-A10), got ${result.agent_count}`);

  const status = renderDailyReview(result.project_id, { joshRoot: tmpRoot });
  assert.match(status, /Day 1/);
  assert.match(status, /Day 4/);
  assert.match(status, /A01/);
  assert.match(status, /A10/);

  fs.rmSync(tmpRoot, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run integration test**

Run:
```bash
cd bin/josh && RUN_BARMATRIX_INTEGRATION=1 npm test
```

Expected: 25 tests pass (24 unit + 1 integration). Integration test confirms ≥400 tasks and exactly 10 agents imported.

If the test fails: open `bin/josh/test/integration-barmatrix.test.js`, set `JOSH_DEBUG=1`, run again, and inspect what didn't parse. Fix the relevant parser (`parseTask` or `parseAgent`) and re-run.

- [ ] **Step 3: Commit**

```bash
git add bin/josh/test/integration-barmatrix.test.js
git commit -m "test(josh): add integration test against real BarMatrix corpus"
```

---

## Task 16: Update documentation

**Files:**
- Modify: `bin/josh/README.md`
- Modify: `USER-MANUAL.md` (root of Levi repo)

- [ ] **Step 1: Update bin/josh/README.md**

Add a new section before the "Maintenance" section in `bin/josh/README.md`:

```markdown
## Project import

Reflect a Markdown corpus (project + agents + tasks) into `~/.josh/`:

```
josh project import <corpus-path>          # one-shot import
josh project status [--project <id>]       # render the daily-review template
josh project sync   [--project <id>] [--dry-run]   # refresh entities from source
```

### Layout

`josh project import` creates:
- `~/.josh/projects/<ulid>/charter.json` — the project charter (one per import)
- `~/.josh/agents/<id>/manifest.json` — one per agent (A01..A10, E00..E08)
- `~/.josh/todo/triaged/<ulid>.json` — one per dispatch task

The Markdown source is **not copied**. `manifest.json` and the todo files reference source paths and store SHA-256 hashes so `josh project sync` can detect changes.

### Source-of-truth conflict order

When a task or agent reference points to a path that no longer exists, `josh project sync` reports it as `missing` rather than auto-deleting. Removal is deliberate; no orphan cleanup unless explicitly requested.
```

- [ ] **Step 2: Update USER-MANUAL.md**

In the project root `USER-MANUAL.md`, find Section 7 "josh CLI — complete reference" and add a new subsection 7.14 before "Help & version":

```markdown
### 7.14 Project import

Reflect a Markdown corpus into `~/.josh/`. See `bin/josh/README.md#project-import` for layout details.

#### `josh project import <corpus-path>`

Reads:
- `<corpus-path>/FOUR_DAY_FULL_PROJECT_DISPATCH/README.md` (charter)
- `<corpus-path>/FOUR_DAY_FULL_PROJECT_DISPATCH/day_*/D*-*.md` (tasks)
- `<corpus-path>/agent_orchestration/agents/AGENT_*.md` (agent briefs)

Writes:
- `~/.josh/projects/<project-ulid>/charter.json`
- `~/.josh/agents/<agent-id>/manifest.json` (per agent)
- `~/.josh/todo/triaged/<todo-ulid>.json` (per task)
- `~/.josh/audit/<date>.jsonl` (project.imported / agent.imported / todo.imported events)

Stdout: `imported project <ulid>` plus `todos: N` and `agents: N` counts.

#### `josh project status [--project <id>]`

Renders a daily-review template summarizing project progress: title, source, day-by-day done/total counts, and agent list. If only one project exists, `--project` is optional.

#### `josh project sync [--project <id>] [--dry-run]`

Re-parses all source paths referenced by the project's agents and todos, updates manifests/todos when source content changed, and writes `agent.synced` / `todo.synced` audit events. `--dry-run` reports what would change without writing.

Reported counts: `changed` (source differs), `missing` (source path no longer exists — surfaced, not auto-cleaned), `updated` (writes performed).
```

- [ ] **Step 3: Commit**

```bash
git add bin/josh/README.md USER-MANUAL.md
git commit -m "docs(josh): document 'josh project' subcommands"
```

---

## Self-review (run after writing the plan)

### 1. Spec coverage

- ✅ Section 4.2 (corpus binding) — Tasks 6-9 cover charter + tasks + agents parsing.
- ✅ Section 4.3 (agent folder) — Task 9 writes manifest.json with all spec-listed fields except crypto fields (deferred to Phase 6 per spec Section 13).
- ✅ Section 4.4 (todo folder) — Task 9 writes flat-file todo per existing `.josh` convention; spec Section 16 explicitly notes folder-shape migration is Phase 2.
- ✅ Section 6.1 (project schema) — Task 9 writes the full charter JSON.
- ✅ Section 6.2 (agent manifest schema) — Task 9 writes the full manifest with v1 defaults for unspec'd fields.
- ✅ Section 6.3 (todo schema) — Task 9 writes the full todo JSON.
- ✅ Section 16 (Phase 1 entry point: import + status + sync) — Tasks 10, 12, 14.
- ✅ Audit events for every state change — `appendAuditEvent` calls in Tasks 9 and 13.

### 2. Placeholder scan

- No "TBD", "TODO", "implement later", or "fill in details" in any task.
- No "Add appropriate error handling" — error handling is shown explicitly in Tasks 10, 12, 14 (try/catch with `process.env.JOSH_DEBUG` stack trace gate).
- No "similar to Task N" — code is repeated rather than referenced.
- Every code step has a complete code block.

### 3. Type consistency

- `parseTask` returns `{display_id, title, day, phase, phase_name, primary_role, depends_on_display_ids, blocks_display_ids, parallel_safety, source_path}`. Same names used in Tasks 7, 9, 13.
- `parseAgent` returns `{id, title, role_group, status, mission_summary, source_path, source_path_hash}`. Same names used in Tasks 8, 9, 13.
- `parseCharter` returns `{title, definition_of_done, days[], source_path}`. Same names used in Tasks 6, 9, 11.
- `importProject` returns `{project_id, todo_count, agent_count}`. Same names used in Task 10's CLI output.
- `applySync` returns `{project_id, dry_run, agents_changed, agents_missing, agents_updated, tasks_changed, tasks_missing, tasks_updated}`. Same names used in Task 14's CLI output.

### 4. Ambiguity check

- "JOSH_ROOT()" — assumed to be a function in josh.js that resolves the runtime root. If it's a constant or env-var read, the implementer can substitute. Either way the call site is consistent.
- "defaultActor()" — existing helper in josh.js (confirmed at line 207).
- "log/err" — existing helpers in josh.js (confirmed at lines 72-73).
- The integration test at Task 15 hard-codes the BarMatrix corpus path; an env var override is provided.

### Spec-to-task coverage gaps (intentional, not bugs)

- **Crypto fields** (`did`, `pubkey_path`, `source_path_hash` for verdict signing) — Phase 6, not Phase 1. Manifests carry these as `null` for now.
- **`verdict_schema.json`** per agent — Phase 4, not Phase 1.
- **`gold/` folder** per agent — Phase 4, not Phase 1.
- **Per-todo folder layout** with `plan.md`, `state`, `events.ndjson` — Phase 2, not Phase 1.
- **`josh project status` formatted exactly like the existing `PROGRESS_TRACKER.md`** — current renderer is a simpler summary; matching the existing format byte-for-byte is Phase 1.5 polish.

These are acceptable deferrals consistent with the spec's phase rollout (Section 12).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-09-josh-project-import.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for a 16-task plan with tight TDD ladder.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints. Best if you want to watch each step.

**Which approach?**
