const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const tf = require('../lib/todo-folder');

function tmpRoot() {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-tf-'));
  for (const s of ['triaged', 'claimed', 'planning', 'awaiting_approval', 'approved', 'rejected', 'revised', 'in_progress', 'done', 'blocked', 'failed', 'cancelled', 'incoming']) {
    fs.mkdirSync(path.join(r, 'todo', s), { recursive: true });
  }
  fs.mkdirSync(path.join(r, 'audit'), { recursive: true });
  return r;
}

test('writeMeta + readMeta: round-trip in folder layout', () => {
  const root = tmpRoot();
  const id = '01HXTEST0000000000000001';
  tf.ensureFolder(root, 'triaged', id);
  tf.writeMeta(root, 'triaged', id, { schema: 1, id, title: 'hello' });
  const meta = tf.readMeta(root, 'triaged', id);
  assert.equal(meta.id, id);
  assert.equal(meta.title, 'hello');
  // state file written
  const stateFile = path.join(root, 'todo', 'triaged', id, 'state');
  assert.equal(fs.readFileSync(stateFile, 'utf8').trim(), 'triaged');
  fs.rmSync(root, { recursive: true, force: true });
});

test('readMeta: returns null when folder absent', () => {
  const root = tmpRoot();
  const meta = tf.readMeta(root, 'triaged', '01HXMISSING0000000000001');
  assert.equal(meta, null);
  fs.rmSync(root, { recursive: true, force: true });
});

test('ensureFolder: idempotent', () => {
  const root = tmpRoot();
  const id = '01HXTEST0000000000000002';
  tf.ensureFolder(root, 'triaged', id);
  tf.ensureFolder(root, 'triaged', id); // second call must not throw
  assert.equal(fs.existsSync(path.join(root, 'todo', 'triaged', id)), true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('listTodosInState: returns metas with their state', () => {
  const root = tmpRoot();
  tf.writeMeta(root, 'triaged', '01HXTEST0000000000000010', { schema: 1, id: '01HXTEST0000000000000010', title: 'a' });
  tf.writeMeta(root, 'triaged', '01HXTEST0000000000000011', { schema: 1, id: '01HXTEST0000000000000011', title: 'b' });
  tf.writeMeta(root, 'in_progress', '01HXTEST0000000000000012', { schema: 1, id: '01HXTEST0000000000000012', title: 'c' });
  const triaged = tf.listTodosInState(root, 'triaged');
  assert.equal(triaged.length, 2);
  assert.equal(triaged[0]._state, 'triaged');
  const ip = tf.listTodosInState(root, 'in_progress');
  assert.equal(ip.length, 1);
  assert.equal(ip[0].id, '01HXTEST0000000000000012');
  fs.rmSync(root, { recursive: true, force: true });
});

test('listTodosInState: returns empty for missing dir', () => {
  const root = tmpRoot();
  fs.rmSync(path.join(root, 'todo', 'triaged'), { recursive: true });
  const r = tf.listTodosInState(root, 'triaged');
  assert.deepEqual(r, []);
  fs.rmSync(root, { recursive: true, force: true });
});

test('findFolderById: locates folder by full id', () => {
  const root = tmpRoot();
  const id = '01HXTEST0000000000000020';
  tf.writeMeta(root, 'planning', id, { schema: 1, id, title: 'x' });
  const found = tf.findFolderById(root, id);
  assert.equal(found.state, 'planning');
  assert.equal(found.id, id);
  fs.rmSync(root, { recursive: true, force: true });
});

test('findFolderById: locates folder by 6-char suffix', () => {
  const root = tmpRoot();
  const id = '01HXTEST0000000000ABC123';
  tf.writeMeta(root, 'triaged', id, { schema: 1, id, title: 'y' });
  const found = tf.findFolderById(root, 'ABC123');
  assert.equal(found.state, 'triaged');
  assert.equal(found.id, id);
  fs.rmSync(root, { recursive: true, force: true });
});

test('findFolderById: returns null when not found', () => {
  const root = tmpRoot();
  assert.equal(tf.findFolderById(root, '01HXMISSING0000000000999'), null);
  fs.rmSync(root, { recursive: true, force: true });
});

test('transitionFolder: moves entire folder atomically + updates state file', () => {
  const root = tmpRoot();
  const id = '01HXTEST0000000000000030';
  tf.writeMeta(root, 'triaged', id, { schema: 1, id, title: 'm' });
  // Add a sibling that must move too
  fs.writeFileSync(path.join(root, 'todo', 'triaged', id, 'plan.md'), 'plan body');
  const r = tf.transitionFolder(root, 'triaged', 'planning', id);
  assert.equal(r.error, undefined);
  assert.equal(fs.existsSync(path.join(root, 'todo', 'triaged', id)), false);
  assert.equal(fs.existsSync(path.join(root, 'todo', 'planning', id, 'meta.json')), true);
  assert.equal(fs.existsSync(path.join(root, 'todo', 'planning', id, 'plan.md')), true);
  // state file matches new dir
  assert.equal(
    fs.readFileSync(path.join(root, 'todo', 'planning', id, 'state'), 'utf8').trim(),
    'planning'
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test('transitionFolder: returns code=3 when src missing (race)', () => {
  const root = tmpRoot();
  const r = tf.transitionFolder(root, 'triaged', 'planning', '01HXMISSING0000000000777');
  assert.equal(r.code, 3);
  assert.match(r.error, /no longer in triaged/);
  fs.rmSync(root, { recursive: true, force: true });
});
