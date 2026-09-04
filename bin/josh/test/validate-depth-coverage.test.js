// Two things kept malformed files out of `josh validate`:
//   1. walkTree capped recursion at 4 directories, so artifacts that legitimately
//      live deeper were never visited at all.
//   2. a .json file with no known validator was counted as "skipped" without ever
//      being parsed, so the command's own `malformed JSON` counter never saw it.

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
  try { return { code: 0, stdout: run(root, args) }; }
  catch (e) { return { code: e.status, stdout: String(e.stdout || '') }; }
}

function seeded() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-dc-'));
  run(root, ['init']);
  const id = run(root, ['push', 'todo', 'a task']).match(/[0-9A-HJKMNP-TV-Z]{26}/)[0];
  run(root, ['tick']);
  return { root, id };
}

function put(root, rel, body) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
}

test('a malformed file five directories deep is reported', () => {
  const { root, id } = seeded();
  put(root, `todo/triaged/${id}/verdicts/dissent/A03.json`, '{ MALFORMED');

  const out = run(root, ['validate']);
  assert.match(out, /malformed JSON/);
  assert.match(out, /verdicts\/dissent\/A03\.json/);
});

test('a malformed file under agents/<id>/evolve/... is reported', () => {
  const { root } = seeded();
  put(root, 'agents/A01/evolve/ev-1/round-1/gaps.json', '{ MALFORMED');

  const out = run(root, ['validate']);
  assert.match(out, /evolve\/ev-1\/round-1\/gaps\.json/);
});

test('all three depths are counted', () => {
  const { root, id } = seeded();
  put(root, `todo/triaged/${id}/verdicts/A01.json`, '{ MALFORMED');
  put(root, `todo/triaged/${id}/verdicts/dissent/A03.json`, '{ MALFORMED');
  put(root, 'agents/A01/evolve/ev-1/round-1/gaps.json', '{ MALFORMED');

  const out = run(root, ['validate']);
  assert.match(out, /3 malformed JSON/);
  assert.ok(!out.includes('✓ all files valid'));
});

test('a git worktree inside a todo folder is not walked', () => {
  const { root, id } = seeded();
  // A worktree is a whole repo checkout; walking it would be slow and noisy.
  put(root, `todo/triaged/${id}/worktree/package.json`, '{ MALFORMED');
  put(root, `todo/triaged/${id}/worktree/deep/a/b/c/thing.json`, '{ MALFORMED');
  put(root, `todo/triaged/${id}/worktree-2/package.json`, '{ MALFORMED');

  const out = run(root, ['validate']);
  assert.match(out, /0 malformed JSON/, 'worktree contents are not josh artifacts');
  assert.match(out, /✓ all files valid/);
});

test('.git and node_modules are skipped too', () => {
  const { root, id } = seeded();
  put(root, `todo/triaged/${id}/.git/config.json`, '{ MALFORMED');
  put(root, `todo/triaged/${id}/node_modules/x/package.json`, '{ MALFORMED');

  assert.match(run(root, ['validate']), /0 malformed JSON/);
});

test('a clean root still reports all files valid', () => {
  const { root } = seeded();
  assert.match(run(root, ['validate']), /✓ all files valid/);
});

test('known-schema files are still validated as before', () => {
  const { root, id } = seeded();
  fs.writeFileSync(path.join(root, 'todo', 'triaged', id, 'meta.json'), '{ broken');
  const out = run(root, ['validate']);
  assert.match(out, /1 malformed JSON/);
  assert.match(out, /\[todo\]/);
});

test('--strict exits non-zero for a deep malformed file', () => {
  const { root, id } = seeded();
  put(root, `todo/triaged/${id}/verdicts/dissent/A03.json`, '{ MALFORMED');
  assert.strictEqual(tryRun(root, ['validate', '--strict']).code, 1);
});

test('--json reports the deep file in errors', () => {
  const { root, id } = seeded();
  put(root, `todo/triaged/${id}/verdicts/dissent/A03.json`, '{ MALFORMED');

  const j = JSON.parse(run(root, ['validate', '--json']));
  assert.strictEqual(j.malformed_json, 1);
  assert.ok(j.errors.some((e) => e.file.includes('dissent/A03.json')));
});

test('josh show can find an artifact deeper than four directories', () => {
  const { root, id } = seeded();
  put(root, `todo/triaged/${id}/verdicts/dissent/DEEPARTIFACT.json`, JSON.stringify({ ok: true }));

  const out = run(root, ['show', 'DEEPARTIFACT']);
  assert.match(out, /dissent\/DEEPARTIFACT\.json/);
});
