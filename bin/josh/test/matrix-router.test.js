const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { selectCandidates } = require('../lib/matrix-router');

function makeRoot(routing) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-mr-'));
  fs.mkdirSync(path.join(root, 'orchestrator'), { recursive: true });
  fs.mkdirSync(path.join(root, 'agents'), { recursive: true });
  if (routing) {
    fs.writeFileSync(path.join(root, 'orchestrator', 'routing.json'), JSON.stringify(routing, null, 2));
  }
  return root;
}

function seedAgent(root, id, manifest = {}) {
  const dir = path.join(root, 'agents', id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
    schema: 1, id, source_path: '/dev/null', ...manifest,
  }, null, 2));
}

test('selectCandidates: single mode when verdict_mode is undefined and no risk', () => {
  const root = makeRoot();
  seedAgent(root, 'A01');
  const r = selectCandidates(root, { primary_role: 'A01' });
  assert.equal(r.mode, 'single');
  assert.deepEqual(r.candidates, ['A01']);
  fs.rmSync(root, { recursive: true, force: true });
});

test('selectCandidates: matrix mode when verdict_mode = matrix', () => {
  const root = makeRoot({
    schema: 1, rules: [],
    matrix_rules: [{ if_phase: 1, candidates: ['A01', 'A03', 'A07'] }],
  });
  ['A01', 'A03', 'A07'].forEach((id) => seedAgent(root, id));
  const r = selectCandidates(root, { verdict_mode: 'matrix', phase: 1, primary_role: 'A01' });
  assert.equal(r.mode, 'matrix');
  assert.deepEqual(r.candidates.sort(), ['A01', 'A03', 'A07']);
  assert.match(r.reason, /matrix_rules/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('selectCandidates: matrix mode when risk = high (auto)', () => {
  const root = makeRoot({
    schema: 1, rules: [],
    default_matrix_candidates: ['A01', 'A03', 'E08'],
  });
  ['A01', 'A03', 'E08'].forEach((id) => seedAgent(root, id));
  const r = selectCandidates(root, { primary_role: 'A03', risk: 'high' });
  assert.equal(r.mode, 'matrix');
  assert.deepEqual(r.candidates.sort(), ['A01', 'A03', 'E08']);
  fs.rmSync(root, { recursive: true, force: true });
});

test('selectCandidates: label-based matrix_rules takes precedence', () => {
  const root = makeRoot({
    schema: 1, rules: [],
    matrix_rules: [
      { if_labels: ['legal'], candidates: ['A03', 'A07', 'A09'] },
      { if_phase: 1, candidates: ['A01', 'A02', 'A03'] },
    ],
  });
  ['A01', 'A02', 'A03', 'A07', 'A09'].forEach((id) => seedAgent(root, id));
  const r = selectCandidates(root, {
    verdict_mode: 'matrix', phase: 1, primary_role: 'A03', labels: ['legal'],
  });
  assert.deepEqual(r.candidates.sort(), ['A03', 'A07', 'A09']);
  fs.rmSync(root, { recursive: true, force: true });
});

test('selectCandidates: ceiling pruning when budget would be blown', () => {
  const root = makeRoot({
    schema: 1, rules: [],
    matrix_rules: [{ if_phase: 1, candidates: ['A_OPUS', 'A_SONNET', 'A_HAIKU'] }],
  });
  seedAgent(root, 'A_OPUS',  { budget: { preferred_model: 'opus' } });
  seedAgent(root, 'A_SONNET', { budget: { preferred_model: 'sonnet' } });
  seedAgent(root, 'A_HAIKU',  { budget: { preferred_model: 'haiku' } });
  const r = selectCandidates(root, {
    verdict_mode: 'matrix', phase: 1, primary_role: 'A_OPUS', target_minutes: 60,
  }, { ceiling: 5000 });
  assert.ok(!r.candidates.includes('A_OPUS'));
  assert.ok(r.pruned.length > 0);
  fs.rmSync(root, { recursive: true, force: true });
});
