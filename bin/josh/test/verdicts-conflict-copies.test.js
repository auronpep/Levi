// `verdicts/` is a directory two machines both write to, so Syncthing drops
// `A01.sync-conflict-<stamp>-<host>.json` beside `A01.json` routinely. That name
// ends in `.json` and is not `winner.json`, so listVerdicts returned it as an
// agent id - a third "agent" that is really a duplicate of the first.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { listVerdicts } = require('../lib/verdict-envelope');

const TODO = '01TODO0000000000000000000A';
const MARKER = 'sync-conflict-20260510-150000-KUDBLQD';

function rootWith(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-lv-'));
  const dir = path.join(root, 'todo', 'in_progress', TODO, 'verdicts');
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, agentId] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), JSON.stringify({ schema: 1, agent_id: agentId }));
  }
  return root;
}

test('a conflict copy is not reported as an agent', () => {
  const root = rootWith({
    'A01.json': 'A01',
    'A03.json': 'A03',
    [`A01.${MARKER}.json`]: 'A01',
  });
  assert.deepStrictEqual(listVerdicts(root, TODO).sort(), ['A01', 'A03']);
});

test('the envelope count is not inflated past the real responders', () => {
  const root = rootWith({
    'A01.json': 'A01',
    'A03.json': 'A03',
    [`A01.${MARKER}.json`]: 'A01',
  });
  // matrix_candidates = [A01, A03, A07] means N = 3; only two agents answered.
  assert.strictEqual(listVerdicts(root, TODO).length, 2, 'the gate must not fire before A07 answers');
});

test('conflict copies from several hosts are all excluded', () => {
  const root = rootWith({
    'A01.json': 'A01',
    'A01.sync-conflict-20260510-150000-AAAAAAA.json': 'A01',
    'A01.sync-conflict-20260511-090000-BBBBBBB.json': 'A01',
  });
  assert.deepStrictEqual(listVerdicts(root, TODO), ['A01']);
});

test('a conflict copy alone yields no agents rather than a phantom one', () => {
  const root = rootWith({ [`A01.${MARKER}.json`]: 'A01' });
  assert.deepStrictEqual(listVerdicts(root, TODO), []);
});

test('winner.json is still excluded', () => {
  const root = rootWith({ 'A01.json': 'A01', 'winner.json': 'A01' });
  assert.deepStrictEqual(listVerdicts(root, TODO), ['A01']);
});

test('ordinary agent ids are unaffected', () => {
  const root = rootWith({ 'A01.json': 'A01', 'A03.json': 'A03', 'A07.json': 'A07' });
  assert.deepStrictEqual(listVerdicts(root, TODO).sort(), ['A01', 'A03', 'A07']);
});

test('an agent id that merely contains "conflict" is not excluded', () => {
  const root = rootWith({ 'conflict-resolver.json': 'conflict-resolver' });
  assert.deepStrictEqual(listVerdicts(root, TODO), ['conflict-resolver'],
    'only the full sync-conflict marker is filtered, not the word');
});

test('a missing verdicts directory is still an empty list', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-lv-'));
  fs.mkdirSync(path.join(root, 'todo', 'in_progress', TODO), { recursive: true });
  assert.deepStrictEqual(listVerdicts(root, TODO), []);
});

test('an unknown todo is still an empty list', () => {
  assert.deepStrictEqual(listVerdicts(rootWith({ 'A01.json': 'A01' }), 'NOPE'), []);
});
