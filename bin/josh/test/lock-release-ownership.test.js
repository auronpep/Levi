// `lock acquire` refuses a second holder with exit 3. `lock release` checked
// nothing, so any agent could free a resource another agent was working inside
// and immediately take it - the acquire guard was the only thing in the way, and
// one release call walked around it.

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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-lock-'));
  run(root, ['init']);
  return root;
}

const held = (root, res) => fs.existsSync(path.join(root, 'locks', `${res}.json`));

test('another actor cannot release a lock they do not hold', () => {
  const root = initRoot();
  run(root, ['lock', 'acquire', 'res1', '--as', 'alice']);

  const r = tryRun(root, ['lock', 'release', 'res1', '--as', 'mallory']);

  assert.strictEqual(r.code, 3, 'lock conflict is exit 3, same as a contended acquire');
  assert.match(r.stderr, /held by alice/);
  assert.strictEqual(held(root, 'res1'), true, "alice's lock must survive");
});

test('the holder can still release their own lock', () => {
  const root = initRoot();
  run(root, ['lock', 'acquire', 'res1', '--as', 'alice']);

  const r = tryRun(root, ['lock', 'release', 'res1', '--as', 'alice']);

  assert.strictEqual(r.code, 0);
  assert.strictEqual(held(root, 'res1'), false);
});

test('exclusion actually holds end to end', () => {
  const root = initRoot();
  run(root, ['lock', 'acquire', 'res1', '--as', 'alice']);

  assert.strictEqual(tryRun(root, ['lock', 'acquire', 'res1', '--as', 'mallory']).code, 3, 'acquire refused');
  assert.strictEqual(tryRun(root, ['lock', 'release', 'res1', '--as', 'mallory']).code, 3, 'release refused too');
  assert.strictEqual(held(root, 'res1'), true, 'mallory cannot get the resource by either route');
});

test('--force releases another holder lock, for the stuck-holder case', () => {
  const root = initRoot();
  run(root, ['lock', 'acquire', 'res1', '--as', 'alice']);

  const r = tryRun(root, ['lock', 'release', 'res1', '--as', 'operator', '--force']);

  assert.strictEqual(r.code, 0);
  assert.strictEqual(held(root, 'res1'), false);
});

test('a forced release is recorded as forced in the audit log', () => {
  const root = initRoot();
  run(root, ['lock', 'acquire', 'res1', '--as', 'alice']);
  run(root, ['lock', 'release', 'res1', '--as', 'operator', '--force']);

  const date = new Date().toISOString().slice(0, 10);
  const audit = fs.readFileSync(path.join(root, 'audit', `${date}.jsonl`), 'utf8');
  const ev = audit.split('\n').filter(Boolean).map(JSON.parse).find((e) => e.action === 'lock.released');
  assert.strictEqual(ev.details.forced, true);
  assert.strictEqual(ev.details.previous_holder, 'alice');
  assert.strictEqual(ev.actor, 'operator');
});

test('a self-release is not marked forced even with --force', () => {
  const root = initRoot();
  run(root, ['lock', 'acquire', 'res1', '--as', 'alice']);
  run(root, ['lock', 'release', 'res1', '--as', 'alice', '--force']);

  const date = new Date().toISOString().slice(0, 10);
  const audit = fs.readFileSync(path.join(root, 'audit', `${date}.jsonl`), 'utf8');
  const ev = audit.split('\n').filter(Boolean).map(JSON.parse).find((e) => e.action === 'lock.released');
  assert.strictEqual(ev.details.forced, false);
});

test('releasing a lock that does not exist is still not-found', () => {
  const root = initRoot();
  const r = tryRun(root, ['lock', 'release', 'nope', '--as', 'alice']);
  assert.strictEqual(r.code, 2);
  assert.match(r.stderr, /not found/);
});

test('after a legitimate release the resource can be acquired again', () => {
  const root = initRoot();
  run(root, ['lock', 'acquire', 'res1', '--as', 'alice']);
  run(root, ['lock', 'release', 'res1', '--as', 'alice']);
  assert.strictEqual(tryRun(root, ['lock', 'acquire', 'res1', '--as', 'bob']).code, 0);
});

test('lock help mentions --force', () => {
  const out = run(initRoot(), ['help']);
  assert.match(out, /lock release <resource> \[--force\]/);
});
