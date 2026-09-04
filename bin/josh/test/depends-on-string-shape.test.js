// `depends_on` has two producers writing two different shapes:
//
//   project-importer / project-sync   ->  [{ id, kind: 'hard' }]
//   josh push todo --depends-on
//   josh block --depends-on           ->  ['01H...']  (bare strings)
//
// Only the object shape was read, so `dep.id` was undefined for a CLI-created
// dependency and path.join threw. `josh claim` on any todo made with the
// documented --depends-on flag died with
// `The "path" argument must be of type string`.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { checkDependencies, normalizeDep } = require('../lib/dependency-checker');

const JOSH = path.join(__dirname, '..', 'josh.js');

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'josh-deps-'));
}

function putTodo(root, state, id) {
  const d = path.join(root, 'todo', state, id);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'meta.json'), JSON.stringify({ id, display_id: `D-${id.slice(-3)}` }));
  return d;
}

test('a bare-string dependency is understood, not a crash', () => {
  const root = tmpRoot();
  putTodo(root, 'triaged', 'DEP1');
  const r = checkDependencies(root, { depends_on: ['DEP1'] });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.blocked_by.length, 1);
  assert.strictEqual(r.blocked_by[0].id, 'DEP1');
  assert.strictEqual(r.blocked_by[0].state, 'triaged');
});

test('a bare-string dependency that is done no longer blocks', () => {
  const root = tmpRoot();
  putTodo(root, 'done', 'DEP1');
  assert.deepStrictEqual(checkDependencies(root, { depends_on: ['DEP1'] }), { ok: true, blocked_by: [] });
});

test('the object shape still works exactly as before', () => {
  const root = tmpRoot();
  putTodo(root, 'in_progress', 'DEP1');
  const r = checkDependencies(root, { depends_on: [{ id: 'DEP1', kind: 'hard' }] });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.blocked_by[0].state, 'in_progress');
});

test('both shapes can coexist in one todo', () => {
  const root = tmpRoot();
  putTodo(root, 'done', 'DONE1');
  putTodo(root, 'triaged', 'OPEN1');
  const r = checkDependencies(root, { depends_on: ['DONE1', { id: 'OPEN1', kind: 'hard' }] });
  assert.strictEqual(r.ok, false);
  assert.deepStrictEqual(r.blocked_by.map((b) => b.id), ['OPEN1']);
});

test('a soft object dependency is still skipped', () => {
  const root = tmpRoot();
  putTodo(root, 'triaged', 'DEP1');
  assert.strictEqual(checkDependencies(root, { depends_on: [{ id: 'DEP1', kind: 'soft' }] }).ok, true);
});

test('a bare string is treated as a hard dependency', () => {
  assert.deepStrictEqual(normalizeDep('01H'), { id: '01H', kind: 'hard' });
});

test('a missing dependency is reported as missing, not as a crash', () => {
  const root = tmpRoot();
  const r = checkDependencies(root, { depends_on: ['NOPE'] });
  assert.strictEqual(r.blocked_by[0].state, 'missing');
  assert.strictEqual(r.blocked_by[0].display_id, 'NOPE'.slice(-6));
});

test('an entry with no usable id blocks visibly rather than being dropped', () => {
  const root = tmpRoot();
  for (const junk of [{ kind: 'hard' }, { id: 42 }, { id: '' }, 7, true]) {
    const r = checkDependencies(root, { depends_on: [junk] });
    assert.strictEqual(r.ok, false, `${JSON.stringify(junk)} must not silently release the dependency`);
    assert.strictEqual(r.blocked_by[0].state, 'malformed');
  }
});

test('empty and whitespace entries are ignored as before', () => {
  const root = tmpRoot();
  assert.strictEqual(checkDependencies(root, { depends_on: ['', null, undefined] }).ok, true);
});

test('no dependencies at all is still ok', () => {
  const root = tmpRoot();
  assert.deepStrictEqual(checkDependencies(root, {}), { ok: true, blocked_by: [] });
  assert.deepStrictEqual(checkDependencies(root, { depends_on: [] }), { ok: true, blocked_by: [] });
});

test('CLI: claim on a --depends-on todo blocks cleanly instead of throwing', () => {
  const root = tmpRoot();
  const env = { ...process.env, JOSH_ROOT: root };
  const run = (args) => execFileSync(process.execPath, [JOSH, ...args], { env, encoding: 'utf8' });

  run(['init']);
  const a = run(['push', 'todo', 'dependency A']).match(/[0-9A-HJKMNP-TV-Z]{26}/)[0];
  const b = run(['push', 'todo', 'needs A', '--depends-on', a]).match(/[0-9A-HJKMNP-TV-Z]{26}/)[0];
  run(['tick']);

  let code = 0;
  let stderr = '';
  try {
    run(['claim', b, '--as', 'worker']);
  } catch (e) {
    code = e.status;
    stderr = String(e.stderr || '');
  }

  assert.doesNotMatch(stderr, /must be of type string/, 'the raw path TypeError must be gone');
  assert.notStrictEqual(code, 4, 'a blocked claim is not an internal fs error');
  if (code !== 0) assert.match(stderr, /depend|block/i, `unexpected failure: ${stderr}`);
});

test('CLI: claim succeeds once the dependency is done', () => {
  const root = tmpRoot();
  const env = { ...process.env, JOSH_ROOT: root };
  const run = (args) => execFileSync(process.execPath, [JOSH, ...args], { env, encoding: 'utf8' });

  run(['init']);
  const a = run(['push', 'todo', 'dependency A']).match(/[0-9A-HJKMNP-TV-Z]{26}/)[0];
  const b = run(['push', 'todo', 'needs A', '--depends-on', a]).match(/[0-9A-HJKMNP-TV-Z]{26}/)[0];
  run(['tick']);
  run(['claim', a, '--as', 'worker']);
  run(['complete', a, '--as', 'worker', '--skip-handoff']);

  const out = run(['claim', b, '--as', 'worker']);
  assert.match(out, new RegExp(b.slice(-6)), 'the dependent todo can now be claimed');
});
