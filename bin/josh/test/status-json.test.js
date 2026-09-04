// `cmdStatus` took no arguments, so it never parsed its argv and every flag was
// silently ignored. `josh status --json` exited 0 and printed the human table -
// the worst answer for a caller that asked for JSON, because it looks like it
// worked.

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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-sj-'));
  run(root, ['init']);
  return root;
}

test('--json emits parseable JSON, not the human table', () => {
  const root = initRoot();
  const out = run(root, ['status', '--json']);
  assert.doesNotThrow(() => JSON.parse(out));
  assert.ok(!out.includes('josh status —'), 'the table must not be mixed into JSON output');
});

test('the JSON carries the queue board', () => {
  const root = initRoot();
  run(root, ['push', 'todo', 'a']);
  run(root, ['push', 'todo', 'b']);

  const j = JSON.parse(run(root, ['status', '--json']));
  assert.strictEqual(j.queue.incoming, 2);
  assert.strictEqual(typeof j.queue.in_progress, 'number');
});

test('the JSON carries the agent board and the root path', () => {
  const root = initRoot();
  const j = JSON.parse(run(root, ['status', '--json']));
  assert.ok(j.agents, 'agents present');
  assert.ok(Object.prototype.hasOwnProperty.call(j.agents, 'orchestrator'));
  assert.strictEqual(j.josh_root, root);
});

test('the counts match the text output', () => {
  const root = initRoot();
  run(root, ['push', 'todo', 'a']);

  const text = run(root, ['status']);
  const j = JSON.parse(run(root, ['status', '--json']));
  const incomingFromText = Number(text.match(/incoming\s+(\d+)/)[1]);
  assert.strictEqual(j.queue.incoming, incomingFromText);
});

test('the counts are refreshed from disk, not read stale from status.json', () => {
  const root = initRoot();
  const id = '01DIRECT00000000000000000A';
  const d = path.join(root, 'todo', 'triaged', id);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'meta.json'), JSON.stringify({ id }));

  assert.strictEqual(JSON.parse(run(root, ['status', '--json'])).queue.triaged, 1);
});

test('the default text output is unchanged', () => {
  const root = initRoot();
  const out = run(root, ['status']);
  assert.match(out, /josh status —/);
  assert.match(out, /agents:/);
  assert.match(out, /queue:/);
});

test('an unknown flag is now an error instead of being ignored', () => {
  const root = initRoot();
  const r = tryRun(root, ['status', '--nope']);
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /Unknown option/);
});

test('a positional argument is rejected', () => {
  const root = initRoot();
  assert.notStrictEqual(tryRun(root, ['status', 'extra']).code, 0);
});

test('an uninitialised root still reports not-found in both modes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-sj-'));
  assert.strictEqual(tryRun(root, ['status']).code, 2);
  assert.strictEqual(tryRun(root, ['status', '--json']).code, 2);
});

test('help mentions --json', () => {
  assert.match(run(initRoot(), ['help']), /status \[--json\]/);
});
