// `reply` and `ack` consume a handoff: the file leaves the recipient's incoming/
// and lands in processed/. Neither checked that the actor was the agent the
// message was addressed to, so any agent could swallow another's mail - and
// `reply` fabricated an answer under the wrong name.

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

// claude asks codex a question.
function pending() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-hr-'));
  run(root, ['init']);
  const id = run(root, [
    'push', 'handoff', '--to', 'codex', '--from', 'claude',
    '--kind', 'request', '--title', 'q', '--body', 'b',
  ]).match(/[0-9A-HJKMNP-TV-Z]{26}/)[0];
  return { root, id };
}

const count = (root, ...seg) => {
  try { return fs.readdirSync(path.join(root, ...seg)).length; } catch (e) { return 0; }
};

test('the sender cannot reply to a handoff addressed to someone else', () => {
  const { root, id } = pending();

  const r = tryRun(root, ['reply', id, '--as', 'claude', '--body', 'answer']);

  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /addressed to codex, not claude/);
  assert.strictEqual(count(root, 'codex', 'incoming'), 1, 'the message stays in codex inbox');
  assert.strictEqual(count(root, 'codex', 'processed'), 0, 'and is not marked handled');
  assert.strictEqual(count(root, 'claude', 'incoming'), 0, 'no answer is fabricated');
});

test('the recipient can reply', () => {
  const { root, id } = pending();

  const r = tryRun(root, ['reply', id, '--as', 'codex', '--body', 'answer']);

  assert.strictEqual(r.code, 0);
  assert.strictEqual(count(root, 'codex', 'incoming'), 0);
  assert.strictEqual(count(root, 'codex', 'processed'), 1);
  assert.strictEqual(count(root, 'claude', 'incoming'), 1, 'the sender gets the answer');
});

test('the reply is attributed to the recipient', () => {
  const { root, id } = pending();
  run(root, ['reply', id, '--as', 'codex', '--body', 'answer']);

  const [f] = fs.readdirSync(path.join(root, 'claude', 'incoming'));
  const answer = JSON.parse(fs.readFileSync(path.join(root, 'claude', 'incoming', f), 'utf8'));
  assert.strictEqual(answer.from, 'codex');
  assert.strictEqual(answer.to, 'claude');
});

test('a third party cannot ack a handoff addressed to someone else', () => {
  const { root, id } = pending();

  const r = tryRun(root, ['ack', id, '--as', 'orchestrator']);

  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /addressed to codex/);
  assert.strictEqual(count(root, 'codex', 'incoming'), 1);
});

test('the recipient can ack', () => {
  const { root, id } = pending();
  assert.strictEqual(tryRun(root, ['ack', id, '--as', 'codex']).code, 0);
  assert.strictEqual(count(root, 'codex', 'processed'), 1);
});

test('--force lets an operator reply on the recipient behalf', () => {
  const { root, id } = pending();
  const r = tryRun(root, ['reply', id, '--as', 'claude', '--body', 'answer', '--force']);
  assert.strictEqual(r.code, 0);
  assert.strictEqual(count(root, 'codex', 'processed'), 1);
});

test('--force works for ack too', () => {
  const { root, id } = pending();
  assert.strictEqual(tryRun(root, ['ack', id, '--as', 'orchestrator', '--force']).code, 0);
});

test('an already-processed handoff still reports that first', () => {
  const { root, id } = pending();
  run(root, ['ack', id, '--as', 'codex']);
  const r = tryRun(root, ['ack', id, '--as', 'codex']);
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /already processed/);
});

test('a handoff with no `to` field is not blocked by the check', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-hr-'));
  run(root, ['init']);
  const id = '01NOTOFIELD00000000000000A';
  const p = path.join(root, 'codex', 'incoming', `${id}.json`);
  fs.writeFileSync(p, JSON.stringify({
    schema: 1, id, from: 'claude', kind: 'note', title: 't', body: 'b',
    created_at: new Date().toISOString(), history: [],
  }));
  assert.strictEqual(tryRun(root, ['ack', id, '--as', 'anyone']).code, 0);
});
