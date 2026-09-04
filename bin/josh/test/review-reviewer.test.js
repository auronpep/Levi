// A review is assigned to a reviewer, and the feature exists to get a second
// agent's eyes on the work. Nothing checked that the actor submitting the verdict
// was that reviewer, so the agent whose work was under review could approve it.

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

// claude asks codex to review its work.
function pending() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-rv-'));
  run(root, ['init']);
  run(root, ['push', 'review', '--subject-ref', '01TODO', '--subject-type', 'todo',
    '--reviewer', 'codex', '--requested-by', 'claude', '--framing', 'regular']);
  const [f] = fs.readdirSync(path.join(root, 'reviews', 'pending'));
  const rec = JSON.parse(fs.readFileSync(path.join(root, 'reviews', 'pending', f), 'utf8'));
  return { root, id: rec.id };
}

const stateOf = (root, id) =>
  ['pending', 'done'].find((s) => fs.existsSync(path.join(root, 'reviews', s, `${id}.json`)));
const record = (root, id, s) =>
  JSON.parse(fs.readFileSync(path.join(root, 'reviews', s, `${id}.json`), 'utf8'));

test('the author cannot submit the verdict on their own review', () => {
  const { root, id } = pending();

  const r = tryRun(root, ['review', id, '--verdict', 'approve', '--reasoning', 'ok', '--as', 'claude']);

  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /assigned to codex, not claude/);
  assert.strictEqual(stateOf(root, id), 'pending', 'a refusal leaves it pending');
});

test('the assigned reviewer can submit it', () => {
  const { root, id } = pending();

  const r = tryRun(root, ['review', id, '--verdict', 'approve', '--reasoning', 'ok', '--as', 'codex']);

  assert.strictEqual(r.code, 0);
  assert.strictEqual(stateOf(root, id), 'done');
  const rec = record(root, id, 'done');
  assert.strictEqual(rec.verdict, 'approve');
  assert.strictEqual(rec.completed_by, 'codex');
});

test('an unrelated third party is refused too', () => {
  const { root, id } = pending();
  const r = tryRun(root, ['review', id, '--verdict', 'block', '--reasoning', 'no', '--as', 'orchestrator']);
  assert.strictEqual(r.code, 1);
  assert.strictEqual(stateOf(root, id), 'pending');
});

test('--force allows an override', () => {
  const { root, id } = pending();
  const r = tryRun(root, ['review', id, '--verdict', 'approve', '--reasoning', 'ok', '--as', 'claude', '--force']);
  assert.strictEqual(r.code, 0);
  assert.strictEqual(record(root, id, 'done').completed_by, 'claude');
});

test('the record still shows reviewer and completer separately', () => {
  const { root, id } = pending();
  run(root, ['review', id, '--verdict', 'approve', '--reasoning', 'ok', '--as', 'codex']);
  const rec = record(root, id, 'done');
  assert.strictEqual(rec.reviewer, 'codex');
  assert.strictEqual(rec.requested_by, 'claude');
  assert.strictEqual(rec.completed_by, 'codex');
});

test('a review with no assigned reviewer is not blocked', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-rv-'));
  run(root, ['init']);
  const id = '01NOREVIEWER00000000000AA';
  fs.writeFileSync(path.join(root, 'reviews', 'pending', `${id}.json`), JSON.stringify({
    schema: 1, id, created_at: new Date().toISOString(), requested_by: 'claude',
    subject_type: 'todo', subject_ref: '01TODO', framing: 'regular', priority: 'p2', history: [],
  }));

  assert.strictEqual(
    tryRun(root, ['review', id, '--verdict', 'approve', '--reasoning', 'ok', '--as', 'anyone']).code, 0);
});

test('an invalid verdict is still rejected before the reviewer check', () => {
  const { root, id } = pending();
  const r = tryRun(root, ['review', id, '--verdict', 'bogus', '--reasoning', 'ok', '--as', 'codex']);
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /--verdict must be one of/);
});

test('a missing --reasoning is still rejected', () => {
  const { root, id } = pending();
  const r = tryRun(root, ['review', id, '--verdict', 'approve', '--as', 'codex']);
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /--reasoning/);
});

test('an already-decided review still reports that first', () => {
  const { root, id } = pending();
  run(root, ['review', id, '--verdict', 'approve', '--reasoning', 'ok', '--as', 'codex']);
  const r = tryRun(root, ['review', id, '--verdict', 'approve', '--reasoning', 'ok', '--as', 'codex']);
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /already done/);
});
