// A pending approval can carry `default_after_sec` + `default_choice`, and
// `tick` applies them once the window passes. `josh list approvals` rendered an
// approval that will decide itself in 30 seconds identically to one that will
// wait forever, so the human choosing what to action could not see which was
// which.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const JOSH = path.join(__dirname, '..', 'josh.js');

function run(root, args) {
  return execFileSync(process.execPath, [JOSH, ...args], {
    env: { ...process.env, JOSH_ROOT: root }, encoding: 'utf8',
  });
}

function initRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-la-'));
  run(root, ['init']);
  return root;
}

// The `auto` cell of the row whose summary matches.
function autoCell(out, summary) {
  const line = out.split('\n').find((l) => l.includes(summary));
  assert.ok(line, `no row for "${summary}" in:\n${out}`);
  return line.split(/\s{2,}/)[4].trim();
}

test('an approval with no auto-default shows a dash', () => {
  const root = initRoot();
  run(root, ['push', 'approval', 'routine log rotation', '--requester', 'claude']);
  assert.strictEqual(autoCell(run(root, ['list', 'approvals']), 'routine log rotation'), '—');
});

test('an approval that will auto-approve says so, with the window', () => {
  const root = initRoot();
  run(root, ['push', 'approval', 'deploy to prod', '--requester', 'claude',
    '--default-after', '30s', '--default-choice', 'approve']);
  assert.match(autoCell(run(root, ['list', 'approvals']), 'deploy to prod'), /^approve in \d+s$/);
});

test('an approval that will auto-deny says deny', () => {
  const root = initRoot();
  run(root, ['push', 'approval', 'risky thing', '--requester', 'claude',
    '--default-after', '1h', '--default-choice', 'deny']);
  assert.strictEqual(autoCell(run(root, ['list', 'approvals']), 'risky thing'), 'deny in 1h');
});

test('longer windows render in the largest sensible unit', () => {
  const root = initRoot();
  run(root, ['push', 'approval', 'two hours', '--requester', 'c', '--default-after', '2h', '--default-choice', 'approve']);
  run(root, ['push', 'approval', 'three days', '--requester', 'c', '--default-after', '3d', '--default-choice', 'approve']);
  run(root, ['push', 'approval', 'ten minutes', '--requester', 'c', '--default-after', '10m', '--default-choice', 'approve']);

  const out = run(root, ['list', 'approvals']);
  assert.strictEqual(autoCell(out, 'two hours'), 'approve in 2h');
  assert.strictEqual(autoCell(out, 'three days'), 'approve in 3d');
  assert.strictEqual(autoCell(out, 'ten minutes'), 'approve in 10m');
});

test('the ones that decide themselves are distinguishable from the one that does not', () => {
  const root = initRoot();
  run(root, ['push', 'approval', 'waits forever', '--requester', 'claude']);
  run(root, ['push', 'approval', 'decides itself', '--requester', 'claude',
    '--default-after', '30s', '--default-choice', 'approve']);

  const out = run(root, ['list', 'approvals']);
  assert.notStrictEqual(autoCell(out, 'waits forever'), autoCell(out, 'decides itself'));
});

test('a resolved approval shows a dash rather than a stale countdown', () => {
  const root = initRoot();
  run(root, ['push', 'approval', 'already handled', '--requester', 'claude',
    '--default-after', '2h', '--default-choice', 'approve']);
  const id = run(root, ['list', 'approvals', '--json']);
  const approvalId = JSON.parse(id)[0].id;
  run(root, ['approve', approvalId, '--as', 'human']);

  const out = run(root, ['list', 'approvals', '--state', 'done']);
  assert.strictEqual(autoCell(out, 'already handled'), '—');
});

test('an elapsed window reads 0s rather than a negative number', () => {
  const root = initRoot();
  const id = '01ELAPSED0000000000000000A';
  fs.writeFileSync(path.join(root, 'approvals', 'pending', `${id}.json`), JSON.stringify({
    schema: 1, id, created_at: '2026-01-01T00:00:00.000Z', requester: 'claude',
    summary: 'long overdue', details: '', options: ['approve', 'deny'],
    default_after_sec: 60, default_choice: 'approve', history: [],
  }));
  assert.strictEqual(autoCell(run(root, ['list', 'approvals']), 'long overdue'), 'approve in 0s');
});

test('--json output is unchanged', () => {
  const root = initRoot();
  run(root, ['push', 'approval', 'x', '--requester', 'claude', '--default-after', '2h', '--default-choice', 'approve']);
  const items = JSON.parse(run(root, ['list', 'approvals', '--json']));
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].default_choice, 'approve');
  assert.strictEqual(items[0].default_after_sec, 7200);
  assert.strictEqual(items[0].auto, undefined, 'the JSON shape gains no derived field');
});

test('the other columns still line up', () => {
  const root = initRoot();
  run(root, ['push', 'approval', 'a summary here', '--requester', 'claude']);
  const out = run(root, ['list', 'approvals']);
  const row = out.split('\n').find((l) => l.includes('a summary here')).split(/\s{2,}/);
  assert.strictEqual(row[1], 'pending');
  assert.strictEqual(row[3], '—', 'decision');
  assert.strictEqual(row[5], 'claude', 'requester');
  assert.strictEqual(row[6], 'a summary here');
});
