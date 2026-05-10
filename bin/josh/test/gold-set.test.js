const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { readGold, replayGold, writeGoldItem } = require('../lib/gold-set');

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-gs-'));
  fs.mkdirSync(path.join(root, 'agents', 'A03', 'gold'), { recursive: true });
  return root;
}

function goldItem(id, status, claim_text, rubric = '') {
  return {
    schema: 1,
    id,
    todo_minimal: { title: 't', labels: [] },
    expected_verdict: { status, claim_text },
    rubric,
  };
}

test('writeGoldItem + readGold: round-trips items', () => {
  const root = makeRoot();
  writeGoldItem(root, 'A03', goldItem('g01', 'approve', 'looks good'));
  writeGoldItem(root, 'A03', goldItem('g02', 'reject', 'has cited claim X'));
  const list = readGold(root, 'A03');
  assert.equal(list.length, 2);
  assert.deepEqual(list.map((i) => i.id).sort(), ['g01', 'g02']);
  fs.rmSync(root, { recursive: true, force: true });
});

test('readGold: returns empty array when no gold dir', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-gs-empty-'));
  fs.mkdirSync(path.join(root, 'agents', 'A03'), { recursive: true });
  assert.deepEqual(readGold(root, 'A03'), []);
  fs.rmSync(root, { recursive: true, force: true });
});

test('replayGold: pass when status matches and rubric is fuzzy', () => {
  const root = makeRoot();
  writeGoldItem(root, 'A03', goldItem('g01', 'approve', 'should approve'));
  const produced = { g01: { status: 'approve', claim_text: 'After review I approve.' } };
  const r = replayGold(root, 'A03', produced);
  assert.equal(r.pass, 1);
  assert.equal(r.fail, 0);
  fs.rmSync(root, { recursive: true, force: true });
});

test('replayGold: fail when status mismatches', () => {
  const root = makeRoot();
  writeGoldItem(root, 'A03', goldItem('g01', 'approve', 'x'));
  const produced = { g01: { status: 'reject', claim_text: 'no' } };
  const r = replayGold(root, 'A03', produced);
  assert.equal(r.pass, 0);
  assert.equal(r.fail, 1);
  fs.rmSync(root, { recursive: true, force: true });
});

test('replayGold: strict_text rubric requires exact text match', () => {
  const root = makeRoot();
  writeGoldItem(root, 'A03', goldItem('g01', 'approve', 'EXACT', 'strict_text'));
  const fuzzy = replayGold(root, 'A03', { g01: { status: 'approve', claim_text: 'approximately EXACT here' } });
  assert.equal(fuzzy.fail, 1);
  const strict = replayGold(root, 'A03', { g01: { status: 'approve', claim_text: 'EXACT' } });
  assert.equal(strict.pass, 1);
  fs.rmSync(root, { recursive: true, force: true });
});

test('replayGold: regression_count counts items where prior pass became fail', () => {
  const root = makeRoot();
  writeGoldItem(root, 'A03', goldItem('g01', 'approve', 'x'));
  writeGoldItem(root, 'A03', goldItem('g02', 'approve', 'y'));
  const prior   = { g01: 'pass', g02: 'pass' };
  const produced = { g01: { status: 'approve', claim_text: 'x' }, g02: { status: 'reject', claim_text: 'no' } };
  const r = replayGold(root, 'A03', produced, prior);
  assert.equal(r.regression_count, 1);
  fs.rmSync(root, { recursive: true, force: true });
});

test('replayGold: missing produced verdict counts as fail', () => {
  const root = makeRoot();
  writeGoldItem(root, 'A03', goldItem('g01', 'approve', 'x'));
  const r = replayGold(root, 'A03', {});
  assert.equal(r.fail, 1);
  fs.rmSync(root, { recursive: true, force: true });
});
