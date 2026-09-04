// `complete` asserts that the claimed work is finished. It stamped
// `completed_by` with whoever ran the command and never compared that against
// `claim.by`, so any actor could close out another agent's in-flight todo - the
// folder moves to done/ underneath the agent still working in it.

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

// A todo claimed by `alice`, sitting in in_progress.
function claimedByAlice() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-cc-'));
  run(root, ['init']);
  const id = run(root, ['push', 'todo', 'task']).match(/[0-9A-HJKMNP-TV-Z]{26}/)[0];
  run(root, ['tick']);
  run(root, ['claim', id, '--as', 'alice']);
  return { root, id };
}

const stateOf = (root, id) => ['in_progress', 'done'].find((s) => fs.existsSync(path.join(root, 'todo', s, id)));
const metaOf = (root, id, s) => JSON.parse(fs.readFileSync(path.join(root, 'todo', s, id, 'meta.json'), 'utf8'));

test('another actor cannot complete a todo they did not claim', () => {
  const { root, id } = claimedByAlice();

  const r = tryRun(root, ['complete', id, '--as', 'mallory', '--skip-handoff']);

  assert.strictEqual(r.code, 3, 'claim conflict is exit 3');
  assert.match(r.stderr, /claimed by alice/);
  assert.strictEqual(stateOf(root, id), 'in_progress', "alice's work stays in flight");
});

test('the claimant can complete their own todo', () => {
  const { root, id } = claimedByAlice();

  const r = tryRun(root, ['complete', id, '--as', 'alice', '--skip-handoff']);

  assert.strictEqual(r.code, 0);
  assert.strictEqual(stateOf(root, id), 'done');
  assert.strictEqual(metaOf(root, id, 'done').completed_by, 'alice');
});

test('--force completes another claimant todo, for the stuck-agent case', () => {
  const { root, id } = claimedByAlice();

  const r = tryRun(root, ['complete', id, '--as', 'operator', '--force', '--skip-handoff']);

  assert.strictEqual(r.code, 0);
  assert.strictEqual(stateOf(root, id), 'done');
});

test('a forced completion is recorded as forced, with the real claimant', () => {
  const { root, id } = claimedByAlice();
  run(root, ['complete', id, '--as', 'operator', '--force', '--skip-handoff']);

  const date = new Date().toISOString().slice(0, 10);
  const audit = fs.readFileSync(path.join(root, 'audit', `${date}.jsonl`), 'utf8');
  const ev = audit.split('\n').filter(Boolean).map(JSON.parse).reverse()
    .find((e) => e.action === 'todo.completed');

  assert.strictEqual(ev.details.forced, true);
  assert.strictEqual(ev.details.claimed_by, 'alice');
  assert.strictEqual(ev.actor, 'operator');
});

test('a normal completion is not marked forced', () => {
  const { root, id } = claimedByAlice();
  run(root, ['complete', id, '--as', 'alice', '--skip-handoff']);

  const date = new Date().toISOString().slice(0, 10);
  const audit = fs.readFileSync(path.join(root, 'audit', `${date}.jsonl`), 'utf8');
  const ev = audit.split('\n').filter(Boolean).map(JSON.parse).reverse()
    .find((e) => e.action === 'todo.completed');

  assert.strictEqual(ev.details.forced, undefined);
});

test('--note still reaches the audit event alongside the check', () => {
  const { root, id } = claimedByAlice();
  run(root, ['complete', id, '--as', 'alice', '--skip-handoff', '--note', 'shipped']);

  const date = new Date().toISOString().slice(0, 10);
  const audit = fs.readFileSync(path.join(root, 'audit', `${date}.jsonl`), 'utf8');
  const ev = audit.split('\n').filter(Boolean).map(JSON.parse).reverse()
    .find((e) => e.action === 'todo.completed');

  assert.strictEqual(ev.details.note, 'shipped');
});

test('a todo with no claim can still be completed by anyone', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-cc-'));
  run(root, ['init']);
  const id = '01UNCLAIMED00000000000000A';
  const d = path.join(root, 'todo', 'in_progress', id);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'meta.json'), JSON.stringify({
    schema: 1, id, title: 'orphan', state: 'in_progress', priority: 'p2',
    created_at: new Date().toISOString(), claim: null, history: [],
  }));
  fs.writeFileSync(path.join(d, 'state'), 'in_progress\n');

  assert.strictEqual(tryRun(root, ['complete', id, '--as', 'anyone', '--skip-handoff']).code, 0);
});

test('completing a todo that is not in progress is still a state error', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-cc-'));
  run(root, ['init']);
  const id = run(root, ['push', 'todo', 'task']).match(/[0-9A-HJKMNP-TV-Z]{26}/)[0];

  const r = tryRun(root, ['complete', id, '--as', 'alice', '--skip-handoff']);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.stderr, /expected one of: in_progress/);
});
