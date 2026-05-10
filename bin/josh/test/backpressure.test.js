const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  readBackpressureConfig,
  checkBackpressure,
  countInProgress,
  countInProgressForPhase,
  countInProgressForAgent,
  DEFAULTS,
} = require('../lib/backpressure');

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-bp-'));
  fs.mkdirSync(path.join(root, 'orchestrator'), { recursive: true });
  fs.mkdirSync(path.join(root, 'todo', 'in_progress'), { recursive: true });
  return root;
}

function seedInProgress(root, id, meta = {}) {
  const dir = path.join(root, 'todo', 'in_progress', id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ id, ...meta }, null, 2));
}

test('readBackpressureConfig: defaults when file absent', () => {
  const root = makeRoot();
  const cfg = readBackpressureConfig(root);
  assert.equal(cfg.max_concurrent, DEFAULTS.max_concurrent);
  assert.equal(cfg.max_concurrent_per_phase, DEFAULTS.max_concurrent_per_phase);
  assert.equal(cfg.max_concurrent_per_agent, DEFAULTS.max_concurrent_per_agent);
  fs.rmSync(root, { recursive: true, force: true });
});

test('readBackpressureConfig: file overrides defaults', () => {
  const root = makeRoot();
  fs.writeFileSync(
    path.join(root, 'orchestrator', 'backpressure.json'),
    JSON.stringify({ schema: 1, max_concurrent: 99, max_concurrent_per_phase: 7 })
  );
  const cfg = readBackpressureConfig(root);
  assert.equal(cfg.max_concurrent, 99);
  assert.equal(cfg.max_concurrent_per_phase, 7);
  assert.equal(cfg.max_concurrent_per_agent, DEFAULTS.max_concurrent_per_agent);
  fs.rmSync(root, { recursive: true, force: true });
});

test('countInProgress: counts top-level folders only', () => {
  const root = makeRoot();
  seedInProgress(root, '01A');
  seedInProgress(root, '01B');
  seedInProgress(root, '01C');
  assert.equal(countInProgress(root), 3);
  fs.rmSync(root, { recursive: true, force: true });
});

test('countInProgressForPhase: filters by meta.phase', () => {
  const root = makeRoot();
  seedInProgress(root, '01A', { phase: 1 });
  seedInProgress(root, '01B', { phase: 1 });
  seedInProgress(root, '01C', { phase: 2 });
  assert.equal(countInProgressForPhase(root, 1), 2);
  assert.equal(countInProgressForPhase(root, 2), 1);
  fs.rmSync(root, { recursive: true, force: true });
});

test('countInProgressForAgent: filters by meta.primary_role', () => {
  const root = makeRoot();
  seedInProgress(root, '01A', { primary_role: 'A01' });
  seedInProgress(root, '01B', { primary_role: 'A01' });
  seedInProgress(root, '01C', { primary_role: 'A03' });
  assert.equal(countInProgressForAgent(root, 'A01'), 2);
  assert.equal(countInProgressForAgent(root, 'A03'), 1);
  fs.rmSync(root, { recursive: true, force: true });
});

test('checkBackpressure: ok under all caps', () => {
  const root = makeRoot();
  seedInProgress(root, '01A', { phase: 1, primary_role: 'A01' });
  const r = checkBackpressure(root, { phase: 1, primary_role: 'A01' });
  assert.equal(r.ok, true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('checkBackpressure: hits global cap', () => {
  const root = makeRoot();
  fs.writeFileSync(
    path.join(root, 'orchestrator', 'backpressure.json'),
    JSON.stringify({ schema: 1, max_concurrent: 2 })
  );
  seedInProgress(root, '01A');
  seedInProgress(root, '01B');
  const r = checkBackpressure(root, { phase: 1, primary_role: 'A01' });
  assert.equal(r.ok, false);
  assert.equal(r.scope, 'global');
  assert.equal(r.current, 2);
  assert.equal(r.max, 2);
  fs.rmSync(root, { recursive: true, force: true });
});

test('checkBackpressure: hits per-phase cap', () => {
  const root = makeRoot();
  fs.writeFileSync(
    path.join(root, 'orchestrator', 'backpressure.json'),
    JSON.stringify({ schema: 1, max_concurrent_per_phase: 1 })
  );
  seedInProgress(root, '01A', { phase: 1 });
  const r = checkBackpressure(root, { phase: 1, primary_role: 'A01' });
  assert.equal(r.ok, false);
  assert.equal(r.scope, 'phase');
  assert.equal(r.current, 1);
  assert.equal(r.max, 1);
  fs.rmSync(root, { recursive: true, force: true });
});

test('checkBackpressure: hits per-agent cap', () => {
  const root = makeRoot();
  fs.writeFileSync(
    path.join(root, 'orchestrator', 'backpressure.json'),
    JSON.stringify({ schema: 1, max_concurrent_per_agent: 1 })
  );
  seedInProgress(root, '01A', { phase: 2, primary_role: 'A01' });
  const r = checkBackpressure(root, { phase: 1, primary_role: 'A01' });
  assert.equal(r.ok, false);
  assert.equal(r.scope, 'agent');
  fs.rmSync(root, { recursive: true, force: true });
});
