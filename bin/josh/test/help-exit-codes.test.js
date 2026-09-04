// Exit codes were documented only in a comment at the top of josh.js. This CLI
// is driven by agents and cron, and the code is the only way a caller can tell
// "no such todo" from "someone else holds it" from "the disk failed" — which is
// the difference between giving up, retrying, and escalating.
//
// These tests also pin the codes themselves, so `help` cannot drift from what
// the commands actually return.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const JOSH = path.join(__dirname, '..', 'josh.js');

function run(root, args) {
  return execFileSync(process.execPath, [JOSH, ...args], {
    env: { ...process.env, JOSH_ROOT: root }, encoding: 'utf8',
  });
}

function code(root, args) {
  return spawnSync(process.execPath, [JOSH, ...args], {
    env: { ...process.env, JOSH_ROOT: root }, encoding: 'utf8',
  }).status;
}

function initRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-ec-'));
  run(root, ['init']);
  return root;
}

test('help documents an exit codes section', () => {
  const out = run(initRoot(), ['help']);
  assert.match(out, /exit codes:/);
});

test('every code the CLI returns is listed', () => {
  const out = run(initRoot(), ['help']);
  for (const [n, word] of [[0, 'success'], [1, 'validation'], [2, 'not found'], [3, 'conflict'], [4, 'filesystem']]) {
    assert.match(out, new RegExp(`\\s${n}\\s+${word}`, 'i'), `code ${n} should be documented`);
  }
});

test('0 — a successful command', () => {
  const root = initRoot();
  assert.strictEqual(code(root, ['status']), 0);
});

test('1 — a validation failure', () => {
  const root = initRoot();
  assert.strictEqual(code(root, ['push', 'todo', 'x', '--priority', 'bogus']), 1);
});

test('2 — not found', () => {
  const root = initRoot();
  assert.strictEqual(code(root, ['show', 'ZZZZZZ']), 2);
  assert.strictEqual(code(root, ['lock', 'release', 'nope', '--as', 'a']), 2);
});

test('3 — conflict', () => {
  const root = initRoot();
  run(root, ['lock', 'acquire', 'res1', '--as', 'alice']);
  assert.strictEqual(code(root, ['lock', 'acquire', 'res1', '--as', 'bob']), 3);
});

test('the rest of help is unchanged', () => {
  const out = run(initRoot(), ['help']);
  assert.match(out, /josh — CLI for the ~\/\.josh\/ shared agent runtime/);
  assert.match(out, /agent mutate ops/);
  assert.match(out, /control actions:/);
  assert.match(out, /spec: /);
  assert.match(out, /env:  JOSH_ROOT=/);
});

test('help still exits 0 and works via --help and -h', () => {
  const root = initRoot();
  for (const flag of ['help', '--help', '-h']) {
    assert.strictEqual(code(root, [flag]), 0, `${flag} should exit 0`);
    assert.match(run(root, [flag]), /exit codes:/, `${flag} should show the section`);
  }
});

test('the source comment and the help text agree', () => {
  const src = fs.readFileSync(JOSH, 'utf8');
  const comment = src.match(/\/\/ Exit codes per spec: (.+)/)[1];
  const out = run(initRoot(), ['help']);
  // Every numbered code named in the comment appears in the rendered section.
  for (const n of comment.match(/\d/g)) {
    assert.match(out, new RegExp(`\\s${n}\\s+\\S`), `code ${n} from the spec comment is missing from help`);
  }
});
