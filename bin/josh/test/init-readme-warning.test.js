// `josh init` warned about a missing README.md every single time it created a
// new root — immediately after creating the directory the README would live in.
// Nothing creates one, no command tells you to, and it went to stderr, so the
// primary setup command emitted an unresolvable warning into scripted output.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const JOSH = path.join(__dirname, '..', 'josh.js');

// Returns { stdout, stderr } for a josh run.
function run(root, args) {
  const r = execFileSync(process.execPath, [JOSH, ...args], {
    env: { ...process.env, JOSH_ROOT: root }, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
  });
  return r;
}

function runCapture(root, args) {
  const res = require('node:child_process').spawnSync(process.execPath, [JOSH, ...args], {
    env: { ...process.env, JOSH_ROOT: root }, encoding: 'utf8',
  });
  return { code: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

// A path that does not exist yet.
function unborn() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'josh-init-')), 'josh-root');
}

test('a fresh root initialises without a spurious warning', () => {
  const root = unborn();
  const r = runCapture(root, ['init']);

  assert.strictEqual(r.code, 0);
  assert.ok(!r.stderr.includes('no README.md'), `stderr was: ${r.stderr}`);
});

test('a fresh init writes nothing at all to stderr', () => {
  const root = unborn();
  assert.strictEqual(runCapture(root, ['init']).stderr.trim(), '');
});

test('the tree is still created', () => {
  const root = unborn();
  run(root, ['init']);
  for (const d of ['todo/incoming', 'todo/awaiting_approval', 'approvals/pending', 'audit', 'locks']) {
    assert.ok(fs.existsSync(path.join(root, ...d.split('/'))), `missing ${d}`);
  }
  assert.ok(fs.existsSync(path.join(root, 'status.json')));
});

test('an established root with no spec still warns', () => {
  const root = unborn();
  fs.mkdirSync(root, { recursive: true });      // the root exists before init
  const r = runCapture(root, ['init']);

  assert.strictEqual(r.code, 0);
  assert.match(r.stderr, /no README\.md/, 'a pre-existing root without a spec is worth flagging');
});

test('re-running init on an initialised root warns once the root exists', () => {
  const root = unborn();
  runCapture(root, ['init']);                    // fresh — silent
  const second = runCapture(root, ['init']);     // root now exists
  assert.match(second.stderr, /no README\.md/);
});

test('a root that has a README never warns', () => {
  const root = unborn();
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'README.md'), '# spec\n');

  const r = runCapture(root, ['init']);
  assert.ok(!r.stderr.includes('no README.md'));
});

test('init is still idempotent', () => {
  const root = unborn();
  run(root, ['init']);
  const before = fs.readdirSync(root).sort();
  run(root, ['init']);
  assert.deepStrictEqual(fs.readdirSync(root).sort(), before);
});

test('a fresh init reports the directories it created on stdout', () => {
  const root = unborn();
  const r = runCapture(root, ['init']);
  assert.match(r.stdout, /created\s+todo\/incoming\//);
});
