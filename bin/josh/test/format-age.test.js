// `formatAge` feeds the age column of `list todo`, `list handoffs`,
// `list approvals` and `list reviews`. An artifact with no usable `created_at`
// - an older schema, a hand-written file, a partially synced one - rendered as
// `NaNd`, or, when the field was explicitly null, as a confident `20789d`
// (the epoch).

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

function initRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-age-'));
  run(root, ['init']);
  return root;
}

function putTodo(root, id, meta) {
  const d = path.join(root, 'todo', 'incoming', id);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'meta.json'), JSON.stringify({
    schema: 1, id, title: `todo ${id}`, state: 'incoming', priority: 'p2', ...meta,
  }));
}

// The age column for the row containing `title`.
function ageOf(out, title) {
  const line = out.split('\n').find((l) => l.includes(title));
  assert.ok(line, `no row for ${title} in:\n${out}`);
  const cols = line.trim().split(/\s{2,}/);
  return cols[4];
}

test('a todo with no created_at shows a placeholder, not NaN', () => {
  const root = initRoot();
  putTodo(root, '01NOCREATEDAT000000000000A', {});
  const out = run(root, ['list', 'todo']);
  assert.ok(!out.includes('NaN'), `age column still shows NaN:\n${out}`);
  assert.strictEqual(ageOf(out, '01NOCREATEDAT000000000000A'.slice(-6)), '—');
});

test('a null created_at is not rendered as decades of age', () => {
  const root = initRoot();
  putTodo(root, '01NULLCREATED00000000000A', { created_at: null });
  const out = run(root, ['list', 'todo']);
  assert.strictEqual(ageOf(out, '01NULLCREATED00000000000A'.slice(-6)), '—');
  assert.ok(!/\b\d{4,}d\b/.test(out), 'no four-digit day count should appear');
});

test('an unparseable created_at shows the placeholder', () => {
  const root = initRoot();
  putTodo(root, '01BADCREATED000000000000A', { created_at: 'not a date' });
  assert.strictEqual(ageOf(run(root, ['list', 'todo']), '01BADCREATED000000000000A'.slice(-6)), '—');
});

test('a real created_at still renders a real age', () => {
  const root = initRoot();
  putTodo(root, '01RECENT000000000000RECENT', { created_at: new Date().toISOString() });
  putTodo(root, '01OLD000000000000000OLDAAA', { created_at: '2026-01-01T00:00:00.000Z' });

  const out = run(root, ['list', 'todo']);
  assert.match(ageOf(out, '01RECENT000000000000RECENT'.slice(-6)), /^\d+s$/);
  assert.match(ageOf(out, '01OLD000000000000000OLDAAA'.slice(-6)), /^\d+d$/);
});

test('a normally created todo is unaffected', () => {
  const root = initRoot();
  run(root, ['push', 'todo', 'normal task']);
  const out = run(root, ['list', 'todo']);
  assert.match(ageOf(out, 'normal task'), /^\d+s$/);
});

test('a future created_at still clamps to zero rather than going negative', () => {
  const root = initRoot();
  const future = new Date(Date.now() + 3600e3).toISOString();
  putTodo(root, '01FUTURE00000000000000000A', { created_at: future });
  assert.strictEqual(ageOf(run(root, ['list', 'todo']), '01FUTURE00000000000000000A'.slice(-6)), '0s');
});

test('a mix of good and bad rows renders both correctly', () => {
  const root = initRoot();
  run(root, ['push', 'todo', 'normal task']);
  putTodo(root, '01LEGACY0000000000000000AA', {});

  const out = run(root, ['list', 'todo']);
  assert.match(ageOf(out, 'normal task'), /^\d+s$/);
  assert.strictEqual(ageOf(out, '0000AA'), '—');
  assert.ok(!out.includes('NaN'));
});
