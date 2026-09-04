// A heartbeat means "I am still working on this" and resets the claim TTL.
// Anyone being able to send one meant a third party could keep a dead agent's
// claim alive indefinitely: `tick` never expires it and the todo is never
// returned to the queue.

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

function claimedByAlice() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-hb-'));
  run(root, ['init']);
  const id = run(root, ['push', 'todo', 'task']).match(/[0-9A-HJKMNP-TV-Z]{26}/)[0];
  run(root, ['tick']);
  run(root, ['claim', id, '--as', 'alice']);
  return { root, id };
}

const claimOf = (root, id) =>
  JSON.parse(fs.readFileSync(path.join(root, 'todo', 'in_progress', id, 'meta.json'), 'utf8')).claim;

test('a third party cannot heartbeat another agent claim', () => {
  const { root, id } = claimedByAlice();
  const before = claimOf(root, id);

  const r = tryRun(root, ['heartbeat', id, '--as', 'mallory']);

  assert.strictEqual(r.code, 3);
  assert.match(r.stderr, /claimed by alice/);
  assert.strictEqual(claimOf(root, id).at, before.at, 'the TTL must not be extended');
});

test('the claimant can heartbeat their own todo', async () => {
  const { root, id } = claimedByAlice();
  const before = claimOf(root, id);
  await new Promise((r) => setTimeout(r, 5));

  assert.strictEqual(tryRun(root, ['heartbeat', id, '--as', 'alice']).code, 0);
  assert.notStrictEqual(claimOf(root, id).at, before.at, 'the TTL is extended');
});

test('--force lets an operator heartbeat on behalf of the claimant', () => {
  const { root, id } = claimedByAlice();
  assert.strictEqual(tryRun(root, ['heartbeat', id, '--as', 'operator', '--force']).code, 0);
});

test('the claim is refreshed, never transferred', () => {
  const { root, id } = claimedByAlice();
  run(root, ['heartbeat', id, '--as', 'operator', '--force']);
  assert.strictEqual(claimOf(root, id).by, 'alice', 'a heartbeat does not steal the claim');
});

test('an unclaimed todo can still be heartbeat by anyone', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-hb-'));
  run(root, ['init']);
  const id = '01UNCLAIMED00000000000000A';
  const d = path.join(root, 'todo', 'in_progress', id);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'meta.json'), JSON.stringify({
    schema: 1, id, title: 'orphan', state: 'in_progress', priority: 'p2',
    created_at: new Date().toISOString(), claim: null, history: [],
  }));
  fs.writeFileSync(path.join(d, 'state'), 'in_progress\n');

  assert.strictEqual(tryRun(root, ['heartbeat', id, '--as', 'anyone']).code, 0);
});

test('a heartbeat event is still written for a legitimate caller', () => {
  const { root, id } = claimedByAlice();
  run(root, ['heartbeat', id, '--as', 'alice']);

  const events = fs.readFileSync(path.join(root, 'todo', 'in_progress', id, 'events.ndjson'), 'utf8')
    .split('\n').filter(Boolean).map(JSON.parse);
  assert.ok(events.some((e) => e.kind === 'heartbeat' && e.actor === 'alice'));
});

test('no heartbeat event is written when the caller is refused', () => {
  const { root, id } = claimedByAlice();
  tryRun(root, ['heartbeat', id, '--as', 'mallory']);

  const p = path.join(root, 'todo', 'in_progress', id, 'events.ndjson');
  const events = fs.existsSync(p)
    ? fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map(JSON.parse) : [];
  assert.ok(!events.some((e) => e.kind === 'heartbeat'), 'a refusal must leave no trace of work');
});

test('a terminal state is still refused before the claim check', () => {
  const { root, id } = claimedByAlice();
  run(root, ['complete', id, '--as', 'alice', '--skip-handoff']);
  const r = tryRun(root, ['heartbeat', id, '--as', 'alice']);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.stderr, /expected one of/);
});
