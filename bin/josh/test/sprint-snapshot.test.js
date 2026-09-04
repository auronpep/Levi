// A snapshot is a historical record. Before the fix the filename stopped at the
// minute, so a second capture inside the same minute silently overwrote the
// first one - and snapshot() still returned a path, as if both had been saved.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sprint = require('../lib/sprint');

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'josh-sprint-'));
}

function seed(root, incoming) {
  for (let i = 0; i < incoming; i++) {
    fs.mkdirSync(path.join(root, 'todo', 'incoming', `T${i}`), { recursive: true });
  }
}

test('snapshot: two captures in the same minute both survive', () => {
  const root = tmpRoot();
  seed(root, 1);
  const first = sprint.snapshot(root, { host: 'PC1' });

  seed(root, 3);
  const second = sprint.snapshot(root, { host: 'PC1' });

  assert.notStrictEqual(first.path, second.path, 'the second capture must not reuse the first path');
  assert.ok(fs.existsSync(first.path), 'the first snapshot file must still exist');
  assert.ok(fs.existsSync(second.path), 'the second snapshot file must exist');
  assert.strictEqual(sprint.listSnapshots(root).length, 2);
});

test('snapshot: the earlier capture keeps its own numbers', () => {
  const root = tmpRoot();
  seed(root, 1);
  const first = sprint.snapshot(root, { host: 'PC1' });
  seed(root, 3);
  sprint.snapshot(root, { host: 'PC1' });

  const reloaded = JSON.parse(fs.readFileSync(first.path, 'utf8'));
  assert.strictEqual(reloaded.queue.incoming, 1, 'the first snapshot must not be rewritten with later counts');
});

test('snapshot: names sort chronologically as plain strings', () => {
  const root = tmpRoot();
  seed(root, 1);
  const paths = [];
  for (let i = 0; i < 4; i++) paths.push(path.basename(sprint.snapshot(root, { host: 'PC1' }).path));

  const listed = sprint.listSnapshots(root);
  assert.deepStrictEqual(listed, [...listed].sort(), 'listSnapshots is a plain lexicographic sort');
  assert.strictEqual(listed.length, 4);
  // Capture order is the order they appear in the listing.
  assert.deepStrictEqual(listed, paths.slice(0, listed.length).sort());
});

test('snapshot: a label still lands in the filename and stays unique', () => {
  const root = tmpRoot();
  seed(root, 1);
  const a = sprint.snapshot(root, { label: 'before', host: 'PC1' });
  const b = sprint.snapshot(root, { label: 'before', host: 'PC1' });

  assert.ok(path.basename(a.path).includes('-before'), 'label belongs in the name');
  assert.ok(path.basename(b.path).includes('-before'));
  assert.notStrictEqual(a.path, b.path);
  assert.strictEqual(sprint.listSnapshots(root).length, 2);
});

test('snapshot: differently labelled captures do not collide with each other', () => {
  const root = tmpRoot();
  seed(root, 1);
  sprint.snapshot(root, { label: 'before', host: 'PC1' });
  sprint.snapshot(root, { label: 'after', host: 'PC1' });
  sprint.snapshot(root, { host: 'PC1' });
  assert.strictEqual(sprint.listSnapshots(root).length, 3);
});

test('snapshot: no .tmp file is left behind', () => {
  const root = tmpRoot();
  seed(root, 2);
  sprint.snapshot(root, { host: 'PC1' });
  const leftovers = fs.readdirSync(sprint.sprintsDir(root)).filter((f) => f.includes('.tmp'));
  assert.deepStrictEqual(leftovers, []);
});

test('snapshot: listSnapshots only reports .json captures', () => {
  const root = tmpRoot();
  seed(root, 1);
  sprint.snapshot(root, { host: 'PC1' });
  fs.writeFileSync(path.join(sprint.sprintsDir(root), 'notes.md'), 'scratch');
  fs.writeFileSync(path.join(sprint.sprintsDir(root), '2026-01-01-000000.json.4242.tmp'), '{}');
  assert.strictEqual(sprint.listSnapshots(root).length, 1);
});

test('snapshot: the body still records queue, host and cost fields', () => {
  const root = tmpRoot();
  seed(root, 2);
  fs.mkdirSync(path.join(root, 'todo', 'done', 'D1'), { recursive: true });
  const { snapshot } = sprint.snapshot(root, { label: 'x', host: 'PC9' });

  assert.strictEqual(snapshot.schema, 1);
  assert.strictEqual(snapshot.label, 'x');
  assert.strictEqual(snapshot.host, 'PC9');
  assert.strictEqual(snapshot.queue.incoming, 2);
  assert.strictEqual(snapshot.queue.done, 1);
  assert.strictEqual(snapshot.cost_run_count, 0);
  assert.ok(typeof snapshot.captured_at === 'string');
});

test('loadSnapshot: round-trips a capture by name', () => {
  const root = tmpRoot();
  seed(root, 5);
  const { path: p } = sprint.snapshot(root, { host: 'PC1' });
  const loaded = sprint.loadSnapshot(root, path.basename(p));
  assert.strictEqual(loaded.queue.incoming, 5);
});

test('loadSnapshot: a missing name throws instead of returning empty', () => {
  const root = tmpRoot();
  seed(root, 1);
  sprint.snapshot(root, { host: 'PC1' });
  assert.throws(() => sprint.loadSnapshot(root, 'nope.json'), /snapshot not found/);
});
