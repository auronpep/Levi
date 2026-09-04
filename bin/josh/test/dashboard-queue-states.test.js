// The dashboard kept its own copy of the state list and it had drifted to 11 of
// the 13 states. Todos in `rejected` or `revised` were not shown as zero - they
// were never looked at, so a rejected plan awaiting revision was invisible on
// the operator's overview.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { renderDashboard } = require('../lib/dashboard');
const { ALL_STATES } = require('../lib/todo-folder');

function rootWithOne(states) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-dash-'));
  for (const s of states) {
    const d = path.join(root, 'todo', s, `T-${s}`);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'meta.json'), JSON.stringify({ id: `T-${s}` }));
  }
  return root;
}

function snapshot(out) {
  return out.split('## Queue snapshot')[1].split('##')[0];
}

function counts(out) {
  const q = {};
  for (const line of snapshot(out).split('\n')) {
    const m = line.match(/^\s{2}(\S+)\s+(\d+)\s*$/);
    if (m) q[m[1]] = Number(m[2]);
  }
  return q;
}

test('every state with work appears in the queue snapshot', () => {
  const root = rootWithOne(ALL_STATES);
  const q = counts(renderDashboard(root));
  for (const s of ALL_STATES) {
    assert.strictEqual(q[s], 1, `state ${s} is missing from the dashboard`);
  }
});

test('rejected and revised are no longer invisible', () => {
  const root = rootWithOne(['rejected', 'revised']);
  const q = counts(renderDashboard(root));
  assert.strictEqual(q.rejected, 1);
  assert.strictEqual(q.revised, 1);
});

test('the snapshot totals reconcile with what is on disk', () => {
  const root = rootWithOne(ALL_STATES);
  const q = counts(renderDashboard(root));
  const total = Object.values(q).reduce((a, b) => a + b, 0);
  assert.strictEqual(total, ALL_STATES.length);
});

test('empty states are still omitted rather than printed as zero', () => {
  const root = rootWithOne(['triaged']);
  const q = counts(renderDashboard(root));
  assert.deepStrictEqual(Object.keys(q), ['triaged'], 'the snapshot stays terse');
});

test('states are listed in lifecycle order', () => {
  const root = rootWithOne(ALL_STATES);
  assert.deepStrictEqual(Object.keys(counts(renderDashboard(root))), ALL_STATES);
});

test('the previously-listed states still report the same numbers', () => {
  const root = rootWithOne(ALL_STATES);
  const q = counts(renderDashboard(root));
  for (const s of ['incoming', 'triaged', 'claimed', 'planning', 'awaiting_approval',
    'approved', 'in_progress', 'done', 'blocked', 'failed', 'cancelled']) {
    assert.strictEqual(q[s], 1, `${s} regressed`);
  }
});

test('an empty root renders without a queue section entry or a crash', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-dash-'));
  const out = renderDashboard(root);
  assert.match(out, /## Queue snapshot/);
  assert.deepStrictEqual(counts(out), {});
});

test('the rest of the dashboard still renders', () => {
  const root = rootWithOne(['in_progress']);
  const out = renderDashboard(root);
  for (const section of ['## In-flight by phase', '## In-flight by agent', '## Cost', '## Drift alerts']) {
    assert.ok(out.includes(section), `${section} should still render`);
  }
});
