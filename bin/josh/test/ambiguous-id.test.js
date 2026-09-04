// `locateTodo` computed a `collision` flag and then discarded it. Every caller of
// it is a state change - claim, complete, fail, block, unblock, cancel - so an
// ambiguous id suffix meant operating on an arbitrary one of the matching todos.
// `josh show` warns about exactly this case; the destructive paths did not.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const JOSH = path.join(__dirname, '..', 'josh.js');
const A = '01AAAAAAAAAAAAAAAAAACOLIDE';
const B = '01BBBBBBBBBBBBBBBBBBCOLIDE';

function run(root, args) {
  return execFileSync(process.execPath, [JOSH, ...args], {
    env: { ...process.env, JOSH_ROOT: root }, encoding: 'utf8',
  });
}

function tryRun(root, args) {
  try {
    return { code: 0, stdout: run(root, args), stderr: '' };
  } catch (e) {
    return { code: e.status, stdout: String(e.stdout || ''), stderr: String(e.stderr || '') };
  }
}

function seed(root, ids, state = 'triaged') {
  for (const id of ids) {
    const d = path.join(root, 'todo', state, id);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'meta.json'), JSON.stringify({
      schema: 1, id, title: `task ${id}`, state, priority: 'p2',
      created_at: '2026-09-01T00:00:00.000Z', history: [],
    }));
    fs.writeFileSync(path.join(d, 'state'), `${state}\n`);
  }
}

function initRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-ambig-'));
  run(root, ['init']);
  return root;
}

const inState = (root, s) => {
  try { return fs.readdirSync(path.join(root, 'todo', s)); } catch (e) { return []; }
};

test('cancel refuses an ambiguous suffix instead of picking one', () => {
  const root = initRoot();
  seed(root, [A, B]);

  const r = tryRun(root, ['cancel', 'COLIDE', '--as', 'worker', '--reason', 'x']);

  assert.strictEqual(r.code, 1, 'ambiguity is a validation error');
  assert.match(r.stderr, /ambiguous/);
  assert.deepStrictEqual(inState(root, 'cancelled'), [], 'nothing may be cancelled');
  assert.strictEqual(inState(root, 'triaged').length, 2, 'both todos stay put');
});

test('the error names every candidate', () => {
  const root = initRoot();
  seed(root, [A, B]);
  const r = tryRun(root, ['cancel', 'COLIDE', '--as', 'worker', '--reason', 'x']);
  assert.match(r.stderr, new RegExp(A));
  assert.match(r.stderr, new RegExp(B));
  assert.match(r.stderr, /Use the full id/);
});

test('the full id still works and acts on exactly that todo', () => {
  const root = initRoot();
  seed(root, [A, B]);

  run(root, ['cancel', A, '--as', 'worker', '--reason', 'x']);

  assert.deepStrictEqual(inState(root, 'cancelled'), [A]);
  assert.deepStrictEqual(inState(root, 'triaged'), [B]);
});

test('an unambiguous suffix still works', () => {
  const root = initRoot();
  seed(root, [A, '01CCCCCCCCCCCCCCCCCCDIFFER']);

  run(root, ['cancel', 'DIFFER', '--as', 'worker', '--reason', 'x']);

  assert.deepStrictEqual(inState(root, 'cancelled'), ['01CCCCCCCCCCCCCCCCCCDIFFER']);
});

test('block and fail refuse the same way', () => {
  for (const args of [
    ['block', 'COLIDE', '--as', 'worker', '--depends-on', 'X'],
    ['fail', 'COLIDE', '--as', 'worker', '--reason', 'x'],
  ]) {
    const root = initRoot();
    seed(root, [A, B], 'in_progress');
    const r = tryRun(root, args);
    assert.strictEqual(r.code, 1, `${args[0]} should refuse`);
    assert.match(r.stderr, /ambiguous/, `${args[0]} should say why`);
    assert.strictEqual(inState(root, 'in_progress').length, 2, `${args[0]} must not move anything`);
  }
});

test('claim refuses an ambiguous suffix', () => {
  const root = initRoot();
  seed(root, [A, B]);
  const r = tryRun(root, ['claim', 'COLIDE', '--as', 'worker']);
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /ambiguous/);
  assert.strictEqual(inState(root, 'in_progress').length, 0);
});

test('a suffix matching nothing is still not-found, not ambiguous', () => {
  const root = initRoot();
  seed(root, [A, B]);
  const r = tryRun(root, ['cancel', 'ZZZZZZ', '--as', 'worker', '--reason', 'x']);
  assert.strictEqual(r.code, 2, 'not-found keeps its own exit code');
  assert.match(r.stderr, /not found/);
});

test('ambiguity is detected across different states, not just within one', () => {
  const root = initRoot();
  seed(root, [A], 'triaged');
  seed(root, [B], 'blocked');
  const r = tryRun(root, ['cancel', 'COLIDE', '--as', 'worker', '--reason', 'x']);
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /ambiguous/);
});

test('an exact id wins even when it is also a suffix of another', () => {
  const root = initRoot();
  const short = 'AAAACOLIDE';
  seed(root, [short, A]);

  run(root, ['cancel', short, '--as', 'worker', '--reason', 'x']);

  assert.deepStrictEqual(inState(root, 'cancelled'), [short], 'the exact match is unambiguous');
  assert.deepStrictEqual(inState(root, 'triaged'), [A]);
});
