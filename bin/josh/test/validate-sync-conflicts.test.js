// A Syncthing conflict copy is usually valid JSON - it is a byte copy of a good
// file - so it passed validation and was counted as another healthy artifact.
// On a one-todo root with one conflict copy, validate reported "todo ok: 2" and
// "✓ all files valid".

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const JOSH = path.join(__dirname, '..', 'josh.js');
const MARKER = 'sync-conflict-20260510-150000-KUDBLQD';

function run(root, args) {
  return execFileSync(process.execPath, [JOSH, ...args], {
    env: { ...process.env, JOSH_ROOT: root }, encoding: 'utf8',
  });
}

function tryRun(root, args) {
  try { return { code: 0, stdout: run(root, args) }; }
  catch (e) { return { code: e.status, stdout: String(e.stdout || '') }; }
}

// A root with one real todo; `conflicted` adds a conflict copy of its meta.
function seeded({ conflicted = false, conflictedFolder = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-vc-'));
  run(root, ['init']);
  const id = run(root, ['push', 'todo', 'a task']).match(/[0-9A-HJKMNP-TV-Z]{26}/)[0];
  run(root, ['tick']);
  const d = path.join(root, 'todo', 'triaged', id);
  if (conflicted) fs.copyFileSync(path.join(d, 'meta.json'), path.join(d, `meta.${MARKER}.json`));
  if (conflictedFolder) fs.cpSync(d, path.join(root, 'todo', 'triaged', `${id}.${MARKER}`), { recursive: true });
  return { root, id };
}

test('a clean root still reports all files valid', () => {
  const { root } = seeded();
  const out = run(root, ['validate']);
  assert.match(out, /✓ all files valid/);
  assert.ok(!out.includes('sync conflicts'));
});

test('a conflict copy is reported rather than certified', () => {
  const { root } = seeded({ conflicted: true });
  const out = run(root, ['validate']);
  assert.match(out, /sync conflicts: 1/);
  assert.ok(!out.includes('✓ all files valid'), 'a root with conflicts is not clean');
});

test('a conflict copy is no longer counted as a real todo', () => {
  const clean = run(seeded().root, ['validate']);
  const dirty = run(seeded({ conflicted: true }).root, ['validate']);

  const todoCount = (s) => Number(s.match(/todo\s+ok:\s+(\d+)/)[1]);
  assert.strictEqual(todoCount(clean), 1);
  assert.strictEqual(todoCount(dirty), 1, 'the conflict copy must not inflate the todo count');
});

test('the offending paths are named', () => {
  const { root, id } = seeded({ conflicted: true });
  const out = run(root, ['validate']);
  assert.match(out, new RegExp(`todo/triaged/${id}/meta\\.${MARKER}\\.json`));
  assert.match(out, /josh sync resolve/);
});

test('an entire conflicted todo folder is detected too', () => {
  const { root } = seeded({ conflictedFolder: true });
  const out = run(root, ['validate']);
  assert.match(out, /sync conflicts: [1-9]/);
});

test('--strict exits non-zero when conflicts are present', () => {
  const clean = tryRun(seeded().root, ['validate', '--strict']);
  const dirty = tryRun(seeded({ conflicted: true }).root, ['validate', '--strict']);

  assert.strictEqual(clean.code, 0);
  assert.strictEqual(dirty.code, 1, 'an unresolved conflict needs an action');
});

test('without --strict the exit code is still 0', () => {
  assert.strictEqual(tryRun(seeded({ conflicted: true }).root, ['validate']).code, 0);
});

test('--json reports the count and the paths', () => {
  const { root } = seeded({ conflicted: true });
  const j = JSON.parse(run(root, ['validate', '--json']));
  assert.strictEqual(j.sync_conflicts, 1);
  assert.strictEqual(j.conflicts.length, 1);
  assert.match(j.conflicts[0], new RegExp(MARKER));
  assert.strictEqual(j.error_count, 0, 'a conflict is not a schema error');
});

test('--json on a clean root reports zero conflicts', () => {
  const j = JSON.parse(run(seeded().root, ['validate', '--json']));
  assert.strictEqual(j.sync_conflicts, 0);
  assert.deepStrictEqual(j.conflicts, []);
});

test('a genuinely malformed file is still reported as an error', () => {
  const { root, id } = seeded();
  fs.writeFileSync(path.join(root, 'todo', 'triaged', id, 'meta.json'), '{ broken');
  const out = run(root, ['validate']);
  assert.match(out, /malformed JSON/);
  assert.match(out, /errors:/);
});
