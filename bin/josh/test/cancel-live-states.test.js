// `josh help` documents cancel as "any live state → cancelled". It accepted four
// of the ten live states. The six it refused are the entire Phase 2A lifecycle,
// so a todo an agent had claimed and abandoned — or one waiting on a human
// approval that never came — could not be cancelled at all.
//
// `fail` and `unblock` do not accept those states either, so there was no
// supported way out of them except forward.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const JOSH = path.join(__dirname, '..', 'josh.js');

const LIVE = [
  'incoming', 'triaged', 'claimed', 'planning', 'awaiting_approval',
  'approved', 'rejected', 'revised', 'in_progress', 'blocked',
];
const TERMINAL = ['done', 'failed', 'cancelled'];

// A root holding one todo, parked directly in `state` and claimed by alice.
function parked(state, id = '01CANCEL0000000000000000A') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-cx-'));
  spawnSync(process.execPath, [JOSH, 'init'], { env: { ...process.env, JOSH_ROOT: root }, encoding: 'utf8' });
  const d = path.join(root, 'todo', state, id);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'meta.json'), JSON.stringify({
    schema: 1, id, title: 't', state, priority: 'p2',
    created_at: new Date().toISOString(),
    claim: { by: 'alice', at: new Date().toISOString(), ttl_sec: 3600 },
    history: [],
  }));
  fs.writeFileSync(path.join(d, 'state'), `${state}\n`);
  return { root, id };
}

function cancel(root, id, extra = []) {
  return spawnSync(process.execPath, [JOSH, 'cancel', id, '--as', 'operator', ...extra], {
    env: { ...process.env, JOSH_ROOT: root }, encoding: 'utf8',
  });
}

const landedIn = (root, id) =>
  [...LIVE, ...TERMINAL].find((s) => fs.existsSync(path.join(root, 'todo', s, id)));

test('every live state can be cancelled', () => {
  for (const state of LIVE) {
    const { root, id } = parked(state);
    const r = cancel(root, id);
    assert.strictEqual(r.status, 0, `cancel from ${state} failed: ${r.stderr}`);
    assert.strictEqual(landedIn(root, id), 'cancelled', `${state} did not land in cancelled`);
  }
});

test('the six Phase 2A states specifically', () => {
  for (const state of ['claimed', 'planning', 'awaiting_approval', 'approved', 'rejected', 'revised']) {
    const { root, id } = parked(state);
    assert.strictEqual(cancel(root, id).status, 0, `${state} must be cancellable`);
  }
});

test('terminal states are still refused', () => {
  for (const state of TERMINAL) {
    const { root, id } = parked(state);
    const r = cancel(root, id);
    assert.notStrictEqual(r.status, 0, `cancel from ${state} should be refused`);
    assert.strictEqual(landedIn(root, id), state, `${state} must not move`);
  }
});

test('cancelling a claimed todo releases the claim', () => {
  const { root, id } = parked('claimed');
  cancel(root, id);
  const meta = JSON.parse(fs.readFileSync(path.join(root, 'todo', 'cancelled', id, 'meta.json'), 'utf8'));
  assert.strictEqual(meta.claim, null, "the agent's hold must be released");
  assert.strictEqual(meta.cancelled_by, 'operator');
});

test('--reason is recorded from a Phase 2A state', () => {
  const { root, id } = parked('awaiting_approval');
  cancel(root, id, ['--reason', 'superseded']);
  const meta = JSON.parse(fs.readFileSync(path.join(root, 'todo', 'cancelled', id, 'meta.json'), 'utf8'));
  assert.strictEqual(meta.cancel_reason, 'superseded');
});

test('a cancelled event is recorded in history', () => {
  const { root, id } = parked('planning');
  cancel(root, id);
  const meta = JSON.parse(fs.readFileSync(path.join(root, 'todo', 'cancelled', id, 'meta.json'), 'utf8'));
  assert.ok(meta.history.some((h) => h.event === 'cancelled'));
});

test('the audit log records the cancellation', () => {
  const { root, id } = parked('approved');
  cancel(root, id, ['--reason', 'no longer needed']);
  const date = new Date().toISOString().slice(0, 10);
  const audit = fs.readFileSync(path.join(root, 'audit', `${date}.jsonl`), 'utf8');
  const ev = audit.split('\n').filter(Boolean).map(JSON.parse).find((e) => e.action === 'todo.cancelled');
  assert.ok(ev, 'a todo.cancelled audit event is written');
  assert.strictEqual(ev.details.reason, 'no longer needed');
});

test('the previously-supported states still work', () => {
  for (const state of ['incoming', 'triaged', 'in_progress', 'blocked']) {
    const { root, id } = parked(state);
    assert.strictEqual(cancel(root, id).status, 0, `${state} regressed`);
  }
});

test('help still describes cancel as covering any live state', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-cx-'));
  const out = execFileSync(process.execPath, [JOSH, 'help'], {
    env: { ...process.env, JOSH_ROOT: root }, encoding: 'utf8',
  });
  assert.match(out, /cancel <id>.*any live state/);
});
