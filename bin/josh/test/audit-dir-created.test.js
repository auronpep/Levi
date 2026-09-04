// `josh init` creates audit/, but a root can outlive that: a tree created before
// audit/ was in SUBDIRS, a partially synced root, or a cleanup that removed an
// empty directory. appendAudit did not create it, so every command succeeded
// while its audit line went nowhere - the trail simply had holes in it.

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

// An initialised root whose audit/ has since disappeared.
function rootWithoutAudit() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-ad-'));
  run(root, ['init']);
  fs.rmSync(path.join(root, 'audit'), { recursive: true, force: true });
  return root;
}

function auditLines(root) {
  const dir = path.join(root, 'audit');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .flatMap((f) => fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean).map(JSON.parse));
}

test('an audit event recreates the directory instead of being lost', () => {
  const root = rootWithoutAudit();
  assert.strictEqual(fs.existsSync(path.join(root, 'audit')), false, 'precondition');

  run(root, ['push', 'todo', 'something important']);

  assert.strictEqual(fs.existsSync(path.join(root, 'audit')), true);
  assert.ok(auditLines(root).some((e) => e.action === 'todo.created'), 'the event is on disk');
});

test('no warning is printed when the directory simply had to be created', () => {
  const root = rootWithoutAudit();
  const out = execFileSync(process.execPath, [JOSH, 'push', 'todo', 't'], {
    env: { ...process.env, JOSH_ROOT: root }, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
  });
  assert.ok(!out.includes('audit write failed'));
});

test('several commands each land in the trail', () => {
  const root = rootWithoutAudit();
  run(root, ['push', 'todo', 'a']);
  run(root, ['lock', 'acquire', 'res1', '--as', 'alice']);
  run(root, ['lock', 'release', 'res1', '--as', 'alice']);

  const actions = auditLines(root).map((e) => e.action);
  assert.ok(actions.includes('todo.created'));
  assert.ok(actions.includes('lock.acquired'));
  assert.ok(actions.includes('lock.released'));
});

test('a normal root is unaffected', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-ad-'));
  run(root, ['init']);
  run(root, ['push', 'todo', 'a']);
  assert.ok(auditLines(root).some((e) => e.action === 'todo.created'));
});

test('the events are written to the UTC-dated file', () => {
  const root = rootWithoutAudit();
  run(root, ['push', 'todo', 'a']);
  const date = new Date().toISOString().slice(0, 10);
  assert.ok(fs.existsSync(path.join(root, 'audit', `${date}.jsonl`)));
});

test('each line is one complete JSON object with a timestamp', () => {
  const root = rootWithoutAudit();
  run(root, ['push', 'todo', 'a']);
  for (const e of auditLines(root)) {
    assert.strictEqual(typeof e.at, 'string');
    assert.ok(Number.isFinite(Date.parse(e.at)));
    assert.strictEqual(typeof e.action, 'string');
  }
});

test('repeated commands append rather than replace', () => {
  const root = rootWithoutAudit();
  run(root, ['push', 'todo', 'a']);
  const first = auditLines(root).length;
  run(root, ['push', 'todo', 'b']);
  assert.ok(auditLines(root).length > first);
});

test('audit verify can read a trail written into a recreated directory', () => {
  const root = rootWithoutAudit();
  run(root, ['push', 'todo', 'a']);
  const date = new Date().toISOString().slice(0, 10);
  // These are plain (unchained) events, so the chain reports them as unchained
  // rather than as errors - the point here is that the file is readable at all.
  const out = execFileSync(process.execPath, [JOSH, 'audit', 'verify', date], {
    env: { ...process.env, JOSH_ROOT: root }, encoding: 'utf8',
  });
  assert.match(out, /VALID/);
});
