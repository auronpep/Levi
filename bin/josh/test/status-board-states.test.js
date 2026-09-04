// `josh init` creates 13 todo state directories; the status board counted 5.
// Work sitting in claimed / planning / awaiting_approval / approved - the whole
// Phase 2A plan-approve-execute lifecycle - was invisible to `josh status`,
// including awaiting_approval, the one state that exists to get a human's
// attention.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const JOSH = path.join(__dirname, '..', 'josh.js');

const TODO_STATES = [
  'incoming', 'triaged', 'claimed', 'planning', 'awaiting_approval',
  'approved', 'rejected', 'revised', 'in_progress', 'done',
  'blocked', 'failed', 'cancelled',
];

function initRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-status-'));
  run(root, ['init']);
  return root;
}

function run(root, args) {
  return execFileSync(process.execPath, [JOSH, ...args], {
    env: { ...process.env, JOSH_ROOT: root }, encoding: 'utf8',
  });
}

function seedEach(root) {
  for (const s of TODO_STATES) {
    const d = path.join(root, 'todo', s, `T-${s}`);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'meta.json'), JSON.stringify({ id: `T-${s}` }));
  }
}

// `josh status` refreshes the board in memory and prints it; status.json on disk
// is maintained by `tick`. So the board under test is the printed one.
function printedQueue(root) {
  const out = run(root, ['status']);
  const lines = out.split('\n');
  const start = lines.findIndex((l) => l.trim() === 'queue:');
  assert.ok(start >= 0, 'status should print a queue section');
  const queue = {};
  for (const line of lines.slice(start + 1)) {
    const m = line.match(/^\s{2}(\S+)\s+(\d+)\s*$/);
    if (!m) break;
    queue[m[1]] = Number(m[2]);
  }
  return queue;
}

test('every state directory init creates is also counted by status', () => {
  const root = initRoot();
  seedEach(root);

  const q = printedQueue(root);
  for (const s of TODO_STATES) {
    assert.strictEqual(q[s], 1, `state ${s} is missing from the queue board`);
  }
});

test('the board totals reconcile with what is on disk', () => {
  const root = initRoot();
  seedEach(root);

  const q = printedQueue(root);
  const counted = TODO_STATES.reduce((n, s) => n + q[s], 0);
  assert.strictEqual(counted, TODO_STATES.length, '13 todos on disk must be 13 todos on the board');
});

test('the Phase 2A lifecycle states are reported', () => {
  const root = initRoot();
  seedEach(root);
  const out = run(root, ['status']);
  for (const s of ['claimed', 'planning', 'awaiting_approval', 'approved']) {
    assert.match(out, new RegExp(s), `${s} should appear in the printed board`);
  }
});

test('awaiting_approval is visible when it is the only work present', () => {
  const root = initRoot();
  const d = path.join(root, 'todo', 'awaiting_approval', 'T1');
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'meta.json'), '{"id":"T1"}');

  assert.strictEqual(printedQueue(root).awaiting_approval, 1);
});

test('a fresh root reports zero for every state, not undefined', () => {
  const root = initRoot();
  const q = printedQueue(root);
  for (const s of TODO_STATES) {
    assert.strictEqual(q[s], 0, `${s} should initialise to 0`);
  }
});

test('the previously-reported states still report the same numbers', () => {
  const root = initRoot();
  seedEach(root);
  const q = printedQueue(root);
  for (const s of ['incoming', 'triaged', 'in_progress', 'blocked', 'failed']) {
    assert.strictEqual(q[s], 1, `${s} regressed`);
  }
});

test('approvals_pending and reviews_pending are still reported', () => {
  const root = initRoot();
  fs.mkdirSync(path.join(root, 'approvals', 'pending', 'A1'), { recursive: true });
  fs.mkdirSync(path.join(root, 'reviews', 'pending', 'R1'), { recursive: true });

  const q = printedQueue(root);
  assert.strictEqual(q.approvals_pending, 1);
  assert.strictEqual(q.reviews_pending, 1);
});

test('states are reported in lifecycle order', () => {
  const root = initRoot();
  const keys = Object.keys(printedQueue(root)).filter((k) => TODO_STATES.includes(k));
  assert.deepStrictEqual(keys, TODO_STATES, 'the board should read in the order work moves');
});

test('init still creates a directory for every state it reports', () => {
  const root = initRoot();
  for (const s of TODO_STATES) {
    assert.ok(fs.existsSync(path.join(root, 'todo', s)), `init did not create todo/${s}`);
  }
});
