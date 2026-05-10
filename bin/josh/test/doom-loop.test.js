const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  countFailureEvents,
  detectDoomLoop,
  sweepDoomLoops,
  DEFAULT_MAX_FAILURES,
} = require('../lib/doom-loop');

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-dl-'));
  for (const s of ['failed', 'triaged', 'blocked']) {
    fs.mkdirSync(path.join(root, 'todo', s), { recursive: true });
  }
  return root;
}

function seed(root, state, id, history) {
  const dir = path.join(root, 'todo', state, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({
    schema: 1, id, history,
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'state'), state + '\n');
  fs.writeFileSync(path.join(dir, 'events.ndjson'), '');
}

test('countFailureEvents: returns 0 for empty history', () => {
  assert.equal(countFailureEvents({ history: [] }), 0);
  assert.equal(countFailureEvents({}), 0);
});

test('countFailureEvents: counts only event=failed', () => {
  const todo = {
    history: [
      { event: 'imported' },
      { event: 'claimed' },
      { event: 'failed', details: { reason: 'flaky' } },
      { event: 'claim_expired' },
      { event: 'failed', details: { reason: 'flaky again' } },
    ],
  };
  assert.equal(countFailureEvents(todo), 2);
});

test('detectDoomLoop: false under threshold', () => {
  const todo = { history: [{ event: 'failed' }, { event: 'failed' }] };
  const r = detectDoomLoop(todo, 3);
  assert.equal(r.isLoop, false);
  assert.equal(r.failure_count, 2);
});

test('detectDoomLoop: true at threshold', () => {
  const todo = { history: [{ event: 'failed' }, { event: 'failed' }, { event: 'failed' }] };
  const r = detectDoomLoop(todo, 3);
  assert.equal(r.isLoop, true);
  assert.equal(r.failure_count, 3);
});

test('detectDoomLoop: default max is 3', () => {
  assert.equal(DEFAULT_MAX_FAILURES, 3);
  const todo = { history: [{ event: 'failed' }, { event: 'failed' }, { event: 'failed' }] };
  assert.equal(detectDoomLoop(todo).isLoop, true);
});

test('sweepDoomLoops: moves looping todo from failed/ to blocked/', () => {
  const root = makeRoot();
  seed(root, 'failed', '01LOOP', [
    { event: 'failed' }, { event: 'failed' }, { event: 'failed' },
  ]);
  const swept = sweepDoomLoops(root);
  assert.equal(swept, 1);
  assert.equal(fs.existsSync(path.join(root, 'todo', 'failed', '01LOOP')), false);
  assert.equal(fs.existsSync(path.join(root, 'todo', 'blocked', '01LOOP')), true);
  const meta = JSON.parse(fs.readFileSync(path.join(root, 'todo', 'blocked', '01LOOP', 'meta.json'), 'utf8'));
  assert.match(meta.blocked_reason, /doom-loop-detected:3/);
  const lastEvent = meta.history[meta.history.length - 1];
  assert.equal(lastEvent.event, 'doom_loop_blocked');
  const stateFile = fs.readFileSync(path.join(root, 'todo', 'blocked', '01LOOP', 'state'), 'utf8').trim();
  assert.equal(stateFile, 'blocked');
  fs.rmSync(root, { recursive: true, force: true });
});

test('sweepDoomLoops: also catches re-triaged loops', () => {
  const root = makeRoot();
  seed(root, 'triaged', '01RT', [
    { event: 'failed' }, { event: 'failed' }, { event: 'failed' },
  ]);
  const swept = sweepDoomLoops(root);
  assert.equal(swept, 1);
  assert.equal(fs.existsSync(path.join(root, 'todo', 'blocked', '01RT')), true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('sweepDoomLoops: leaves under-threshold todos alone', () => {
  const root = makeRoot();
  seed(root, 'failed', '01OK', [{ event: 'failed' }, { event: 'failed' }]);
  const swept = sweepDoomLoops(root);
  assert.equal(swept, 0);
  assert.equal(fs.existsSync(path.join(root, 'todo', 'failed', '01OK')), true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('sweepDoomLoops: does not collide with already-blocked id', () => {
  const root = makeRoot();
  seed(root, 'failed',  '01DUP', [{ event: 'failed' }, { event: 'failed' }, { event: 'failed' }]);
  seed(root, 'blocked', '01DUP', [{ event: 'imported' }]);
  const swept = sweepDoomLoops(root);
  assert.equal(swept, 0);
  assert.equal(fs.existsSync(path.join(root, 'todo', 'failed', '01DUP')), true);
  assert.equal(fs.existsSync(path.join(root, 'todo', 'blocked', '01DUP')), true);
  fs.rmSync(root, { recursive: true, force: true });
});
