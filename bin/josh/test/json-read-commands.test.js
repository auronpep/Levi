// Three read commands had no --json. One of them, `matrix pending`, took no
// parameters at all, so it never parsed its argv: `--json` was silently ignored
// and the human list was printed with exit 0.

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

function tryRun(root, args) {
  try { return { code: 0, stdout: run(root, args), stderr: '' }; }
  catch (e) { return { code: e.status, stdout: String(e.stdout || ''), stderr: String(e.stderr || '') }; }
}

function initRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-jr-'));
  run(root, ['init']);
  return root;
}

// An in-flight matrix: one in_progress todo with two verdict envelopes.
function withMatrix(root) {
  const id = '01MATRIX000000000000000A';
  const d = path.join(root, 'todo', 'in_progress', id, 'verdicts');
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(root, 'todo', 'in_progress', id, 'meta.json'), JSON.stringify({
    schema: 1, id, display_id: 'D1-007', matrix_candidates: ['A01', 'A03', 'A07'],
  }));
  for (const a of ['A01', 'A03']) {
    fs.writeFileSync(path.join(d, `${a}.json`), JSON.stringify({ schema: 1, agent_id: a, payload: { status: 'approve' } }));
  }
  return id;
}

test('matrix pending: --json is no longer silently ignored', () => {
  const root = initRoot();
  const out = run(root, ['matrix', 'pending', '--json']);
  assert.doesNotThrow(() => JSON.parse(out));
  assert.ok(!out.includes('no pending adjudications'), 'the human line must not leak into JSON');
});

test('matrix pending: an unknown flag now errors instead of being swallowed', () => {
  const root = initRoot();
  const r = tryRun(root, ['matrix', 'pending', '--nope']);
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /Unknown option/);
});

test('matrix pending: --json lists queued adjudications', () => {
  const root = initRoot();
  const { enqueueAdjudication } = require('../lib/adjudicator');
  const id = withMatrix(root);
  enqueueAdjudication(root, id, ['A01', 'A03']);

  const j = JSON.parse(run(root, ['matrix', 'pending', '--json']));
  assert.strictEqual(j.length, 1);
  assert.strictEqual(j[0].todo_id, id);
  assert.strictEqual(j[0].candidate_count, 2);
});

test('matrix status: --json reports candidates and envelope counts', () => {
  const root = initRoot();
  const id = withMatrix(root);

  const j = JSON.parse(run(root, ['matrix', 'status', '--json']));
  const row = j.find((r) => r.todo_id === id);
  assert.ok(row, 'the in-flight matrix is present');
  assert.deepStrictEqual(row.candidates, ['A01', 'A03', 'A07']);
  assert.strictEqual(row.envelope_count, 2);
  assert.strictEqual(row.candidate_count, 3);
  assert.strictEqual(row.winner, false);
  assert.strictEqual(row.display_id, 'D1-007');
});

test('matrix status: the text output still renders the same fields', () => {
  const root = initRoot();
  withMatrix(root);
  const out = run(root, ['matrix', 'status']);
  assert.match(out, /D1-007/);
  assert.match(out, /envelopes=2\/3/);
  assert.match(out, /winner=—/);
});

test('matrix status: an empty root is an empty array, not the human line', () => {
  const root = initRoot();
  assert.deepStrictEqual(JSON.parse(run(root, ['matrix', 'status', '--json'])), []);
  assert.match(run(root, ['matrix', 'status']), /no in-flight matrices/);
});

test('evolve list: --json emits an array', () => {
  const root = initRoot();
  assert.deepStrictEqual(JSON.parse(run(root, ['evolve', 'list', '--json'])), []);
  assert.match(run(root, ['evolve', 'list']), /\(none\)/);
});

test('evolve list: --state still works alongside --json', () => {
  const root = initRoot();
  assert.doesNotThrow(() => JSON.parse(run(root, ['evolve', 'list', '--state', 'active', '--json'])));
});

test('all three emit valid JSON on an empty root', () => {
  const root = initRoot();
  for (const args of [['matrix', 'status'], ['matrix', 'pending'], ['evolve', 'list']]) {
    const out = run(root, [...args, '--json']);
    assert.doesNotThrow(() => JSON.parse(out), `${args.join(' ')} produced non-JSON: ${out}`);
  }
});

test('the default text output of each is unchanged', () => {
  const root = initRoot();
  assert.match(run(root, ['matrix', 'pending']), /no pending adjudications/);
  assert.match(run(root, ['matrix', 'status']), /no in-flight matrices/);
  assert.match(run(root, ['evolve', 'list']), /\(none\)/);
});
