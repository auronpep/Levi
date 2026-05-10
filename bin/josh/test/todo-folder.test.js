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
