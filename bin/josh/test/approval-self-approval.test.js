// `josh push approval` is the human-gated decision primitive. If the party
// asking for permission can grant it, the gate grants nothing.

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

function tryRun(root, args) {
  try { return { code: 0, stdout: run(root, args), stderr: '' }; }
  catch (e) { return { code: e.status, stdout: String(e.stdout || ''), stderr: String(e.stderr || '') }; }
}

function pending(requester = 'claude') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-sa-'));
  run(root, ['init']);
  run(root, ['push', 'approval', 'deploy to production', '--requester', requester]);
  const id = JSON.parse(run(root, ['list', 'approvals', '--json']))[0].id;
  return { root, id };
}

const stateOf = (root, id) =>
  ['pending', 'done'].find((s) => fs.existsSync(path.join(root, 'approvals', s, `${id}.json`)));
const record = (root, id, s) =>
  JSON.parse(fs.readFileSync(path.join(root, 'approvals', s, `${id}.json`), 'utf8'));

function auditEvent(root) {
  const date = new Date().toISOString().slice(0, 10);
  const audit = fs.readFileSync(path.join(root, 'audit', `${date}.jsonl`), 'utf8');
  return audit.split('\n').filter(Boolean).map(JSON.parse).reverse()
    .find((e) => e.action === 'approval.decided');
}

test('the requester cannot approve their own request', () => {
  const { root, id } = pending();

  const r = tryRun(root, ['approve', id, '--as', 'claude']);

  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /requested by claude/);
  assert.strictEqual(stateOf(root, id), 'pending', 'a refusal must leave it pending');
});

test('a different actor can approve it', () => {
  const { root, id } = pending();

  assert.strictEqual(tryRun(root, ['approve', id, '--as', 'human']).code, 0);
  assert.strictEqual(stateOf(root, id), 'done');
  assert.strictEqual(record(root, id, 'done').decided_by, 'human');
});

test('the requester CAN deny their own request - that withdraws it', () => {
  const { root, id } = pending();

  assert.strictEqual(tryRun(root, ['deny', id, '--as', 'claude']).code, 0);
  assert.strictEqual(record(root, id, 'done').decision, 'deny');
});

test('--force allows a self-approval for a single-operator setup', () => {
  const { root, id } = pending();
  assert.strictEqual(tryRun(root, ['approve', id, '--as', 'claude', '--force']).code, 0);
  assert.strictEqual(record(root, id, 'done').decision, 'approve');
});

test('a forced self-approval is recorded as one', () => {
  const { root, id } = pending();
  run(root, ['approve', id, '--as', 'claude', '--force']);

  const ev = auditEvent(root);
  assert.strictEqual(ev.details.self_approved, true);
  assert.strictEqual(ev.details.requester, 'claude');
});

test('a normal approval is not marked self-approved', () => {
  const { root, id } = pending();
  run(root, ['approve', id, '--as', 'human']);
  assert.strictEqual(auditEvent(root).details.self_approved, undefined);
});

test('--note and --reason still reach the record', () => {
  const { root, id } = pending();
  run(root, ['approve', id, '--as', 'human', '--note', 'checked', '--reason', 'looks fine']);

  const rec = record(root, id, 'done');
  assert.strictEqual(rec.decision_note, 'checked');
  assert.strictEqual(rec.decision_reason, 'looks fine');
});

test('an already-decided approval still reports that first', () => {
  const { root, id } = pending();
  run(root, ['approve', id, '--as', 'human']);
  const r = tryRun(root, ['approve', id, '--as', 'human']);
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /already done/);
});

test('an approval with no requester recorded is not blocked', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-sa-'));
  run(root, ['init']);
  const id = '01NOREQUESTER000000000000A';
  fs.writeFileSync(path.join(root, 'approvals', 'pending', `${id}.json`), JSON.stringify({
    schema: 1, id, created_at: new Date().toISOString(), summary: 's',
    options: ['approve', 'deny'], history: [],
  }));
  assert.strictEqual(tryRun(root, ['approve', id, '--as', 'anyone']).code, 0);
});

test('the auto-default path is unaffected by the requester check', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-sa-'));
  run(root, ['init']);
  const id = '01AUTOEXPIRE000000000000A';
  fs.writeFileSync(path.join(root, 'approvals', 'pending', `${id}.json`), JSON.stringify({
    schema: 1, id, created_at: '2026-01-01T00:00:00.000Z', requester: 'claude', summary: 's',
    options: ['approve', 'deny'], default_after_sec: 60, default_choice: 'approve', history: [],
  }));

  run(root, ['tick']);
  assert.strictEqual(stateOf(root, id), 'done', 'tick still applies the configured default');
  assert.strictEqual(record(root, id, 'done').decision, 'approve');
});
