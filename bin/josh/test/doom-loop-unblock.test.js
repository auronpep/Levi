// `sweepDoomLoops` scans `triaged`, and `josh unblock` is precisely what moves a
// todo back into `triaged`. Because failures were counted over the todo's whole
// lifetime, the failures that caused the quarantine were still on the tally when
// the operator released it - so the next `josh tick` re-blocked it at once, with
// no explanation. Unblocking a doom-looped todo was impossible.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { sweepDoomLoops, countFailureEvents, detectDoomLoop } = require('../lib/doom-loop');

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'josh-doom-'));
}

function put(root, state, id, history) {
  const d = path.join(root, 'todo', state, id);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'meta.json'), JSON.stringify({ id, history }, null, 2));
  return d;
}

const failed = (n) => Array.from({ length: n }, (_, i) => ({ at: `2026-09-0${i + 1}`, actor: 'claude', event: 'failed' }));

function unblock(root, id) {
  // What `josh unblock` does: move the folder back to triaged.
  fs.renameSync(path.join(root, 'todo', 'blocked', id), path.join(root, 'todo', 'triaged', id));
}

function isBlocked(root, id) {
  return fs.existsSync(path.join(root, 'todo', 'blocked', id));
}

test('an unblocked todo is not immediately re-blocked', () => {
  const root = tmpRoot();
  put(root, 'triaged', 'T1', failed(3));

  assert.strictEqual(sweepDoomLoops(root), 1, 'it loops, so it is quarantined');
  assert.strictEqual(isBlocked(root, 'T1'), true);

  unblock(root, 'T1');
  assert.strictEqual(sweepDoomLoops(root), 0, 'the operator released it; the sweep must respect that');
  assert.strictEqual(isBlocked(root, 'T1'), false);
});

test('the release is not permanent immunity - fresh failures re-block it', () => {
  const root = tmpRoot();
  put(root, 'triaged', 'T1', failed(3));
  sweepDoomLoops(root);
  unblock(root, 'T1');

  const metaPath = path.join(root, 'todo', 'triaged', 'T1', 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  meta.history.push(...failed(3));
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

  assert.strictEqual(sweepDoomLoops(root), 1, 'three new failures is a new loop');
  assert.strictEqual(isBlocked(root, 'T1'), true);
});

test('failures after a release are counted from the release, not from zero', () => {
  const todo = { history: [...failed(3), { event: 'doom_loop_blocked' }, ...failed(2)] };
  assert.strictEqual(countFailureEvents(todo), 2);
  assert.strictEqual(detectDoomLoop(todo).isLoop, false, 'two fresh failures is under the threshold');
});

test('only the most recent release resets the count', () => {
  const todo = {
    history: [
      ...failed(3), { event: 'doom_loop_blocked' },
      ...failed(3), { event: 'doom_loop_blocked' },
      ...failed(1),
    ],
  };
  assert.strictEqual(countFailureEvents(todo), 1);
});

test('a release with no failures after it counts zero', () => {
  const todo = { history: [...failed(5), { event: 'doom_loop_blocked' }] };
  assert.strictEqual(countFailureEvents(todo), 0);
  assert.strictEqual(detectDoomLoop(todo).isLoop, false);
});

test('a todo that has never been quarantined counts its whole history', () => {
  assert.strictEqual(countFailureEvents({ history: failed(3) }), 3);
  assert.strictEqual(detectDoomLoop({ history: failed(3) }).isLoop, true);
});

test('non-failure events after a release are still ignored', () => {
  const todo = {
    history: [
      ...failed(3), { event: 'doom_loop_blocked' },
      { event: 'claimed' }, { event: 'failed' }, { event: 'claim_expired' }, { event: 'unblocked' },
    ],
  };
  assert.strictEqual(countFailureEvents(todo), 1);
});

test('the doom_loop_blocked marker the sweep itself writes is the reset point', () => {
  const root = tmpRoot();
  put(root, 'failed', 'T1', failed(3));
  sweepDoomLoops(root);

  const meta = JSON.parse(fs.readFileSync(path.join(root, 'todo', 'blocked', 'T1', 'meta.json'), 'utf8'));
  assert.ok(meta.history.some((h) => h.event === 'doom_loop_blocked'), 'the sweep records its intervention');
  assert.strictEqual(countFailureEvents(meta), 0, 'and that intervention resets the tally');
});

test('history no longer accumulates repeated doom_loop_blocked entries', () => {
  const root = tmpRoot();
  put(root, 'triaged', 'T1', failed(3));
  sweepDoomLoops(root);
  unblock(root, 'T1');
  sweepDoomLoops(root);
  sweepDoomLoops(root);

  const meta = JSON.parse(fs.readFileSync(path.join(root, 'todo', 'triaged', 'T1', 'meta.json'), 'utf8'));
  const marks = meta.history.filter((h) => h.event === 'doom_loop_blocked');
  assert.strictEqual(marks.length, 1, 'one quarantine, one marker');
});

test('a still-looping todo in failed/ is quarantined as before', () => {
  const root = tmpRoot();
  put(root, 'failed', 'T9', failed(4));
  assert.strictEqual(sweepDoomLoops(root), 1);
  assert.strictEqual(isBlocked(root, 'T9'), true);
});
