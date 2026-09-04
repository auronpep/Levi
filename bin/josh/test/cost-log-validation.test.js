// `parseFloat('abc')` is NaN, and appendCost's Number.isFinite guard turned that
// into 0. A mistyped amount was accepted, reported as "logged", and recorded as
// costing nothing - so the spend report read $0 for a run that cost money. A bare
// `cost log` with no arguments wrote an all-null row that still counted as a run.

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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-cl-'));
  run(root, ['init']);
  return root;
}

function rows(root) {
  const dir = path.join(root, 'cost');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap((f) =>
    fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean).map(JSON.parse));
}

test('an unparseable --usd is refused, not recorded as zero', () => {
  const root = initRoot();
  const r = tryRun(root, ['cost', 'log', '--todo', 'T1', '--agent', 'claude', '--usd', 'abc']);

  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /--usd must be a non-negative number, got 'abc'/);
  assert.deepStrictEqual(rows(root), [], 'nothing may be written');
});

test('a valid --usd is still recorded exactly', () => {
  const root = initRoot();
  run(root, ['cost', 'log', '--todo', 'T1', '--agent', 'claude', '--usd', '12.50']);
  assert.strictEqual(rows(root)[0].usd, 12.5);
});

test('every numeric flag is validated', () => {
  for (const [flag, bad] of [['tokens-in', 'x'], ['tokens-out', 'y'], ['wall', 'z'], ['usd', 'q'], ['phase', 'p']]) {
    const root = initRoot();
    const r = tryRun(root, ['cost', 'log', '--todo', 'T1', `--${flag}`, bad]);
    assert.strictEqual(r.code, 1, `--${flag} should be validated`);
    assert.match(r.stderr, new RegExp(`--${flag} must be a non-negative number`));
  }
});

test('negative numbers are refused', () => {
  const root = initRoot();
  const r = tryRun(root, ['cost', 'log', '--todo', 'T1', '--usd=-5']);
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /non-negative/);
});

test('omitted numeric flags still default to zero', () => {
  const root = initRoot();
  run(root, ['cost', 'log', '--todo', 'T1', '--agent', 'claude']);
  const row = rows(root)[0];
  assert.strictEqual(row.usd, 0);
  assert.strictEqual(row.tokens_in, 0);
  assert.strictEqual(row.tokens_out, 0);
  assert.strictEqual(row.wall_seconds, 0);
  assert.strictEqual(row.phase, null, 'phase stays null rather than becoming 0');
});

test('a bare cost log writes nothing', () => {
  const root = initRoot();
  const r = tryRun(root, ['cost', 'log']);
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /at least --todo <id> or --agent <id>/);
  assert.deepStrictEqual(rows(root), []);
});

test('--agent alone is enough attribution', () => {
  const root = initRoot();
  assert.strictEqual(tryRun(root, ['cost', 'log', '--agent', 'claude', '--usd', '1']).code, 0);
});

test('--todo alone is enough attribution', () => {
  const root = initRoot();
  assert.strictEqual(tryRun(root, ['cost', 'log', '--todo', 'T1', '--usd', '1']).code, 0);
});

test('the summary no longer counts rows that were never valid', () => {
  const root = initRoot();
  run(root, ['cost', 'log', '--todo', 'T1', '--agent', 'claude', '--usd', '12.50']);
  tryRun(root, ['cost', 'log', '--todo', 'T2', '--agent', 'claude', '--usd', 'abc']);
  tryRun(root, ['cost', 'log']);

  const out = run(root, ['cost', 'summary']);
  assert.match(out, /runs:\s+1/, 'only the one real row counts');
  assert.match(out, /usd:\s+12\.5/i);
});

test('all fields round-trip through a full log', () => {
  const root = initRoot();
  run(root, ['cost', 'log', '--todo', 'T1', '--agent', 'claude', '--model', 'opus',
    '--tokens-in', '100', '--tokens-out', '50', '--wall', '12', '--usd', '1.25',
    '--phase', '3', '--sentinel', 'S']);
  const row = rows(root)[0];
  assert.strictEqual(row.todo_id, 'T1');
  assert.strictEqual(row.agent_id, 'claude');
  assert.strictEqual(row.model, 'opus');
  assert.strictEqual(row.tokens_in, 100);
  assert.strictEqual(row.tokens_out, 50);
  assert.strictEqual(row.wall_seconds, 12);
  assert.strictEqual(row.usd, 1.25);
  assert.strictEqual(row.phase, 3);
  assert.strictEqual(row.sentinel, 'S');
});
