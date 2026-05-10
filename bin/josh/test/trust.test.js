const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { readTrust, updateTrust } = require('../lib/trust');

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-trust-'));
  fs.mkdirSync(path.join(root, 'agents', 'A03'), { recursive: true });
  return root;
}

test('readTrust: defaults when absent', () => {
  const root = makeRoot();
  const t = readTrust(root, 'A03');
  assert.equal(t.agent_id, 'A03');
  assert.equal(t.matrix_runs, 0);
  assert.deepEqual(t.dimensions, {});
  fs.rmSync(root, { recursive: true, force: true });
});

test('updateTrust: increments total + agreed for matching dims', () => {
  const root = makeRoot();
  const t1 = updateTrust(root, 'A03', ['legal_accuracy', 'source_safety'], ['legal_accuracy']);
  assert.equal(t1.matrix_runs, 1);
  assert.equal(t1.dimensions.legal_accuracy.agreed, 1);
  assert.equal(t1.dimensions.legal_accuracy.total, 1);
  assert.equal(t1.dimensions.legal_accuracy.rate, 1.0);
  assert.equal(t1.dimensions.source_safety.agreed, 0);
  assert.equal(t1.dimensions.source_safety.total, 1);
  assert.equal(t1.dimensions.source_safety.rate, 0.0);
  fs.rmSync(root, { recursive: true, force: true });
});

test('updateTrust: cumulative across calls', () => {
  const root = makeRoot();
  updateTrust(root, 'A03', ['legal_accuracy'], ['legal_accuracy']);
  updateTrust(root, 'A03', ['legal_accuracy'], []);
  const t = readTrust(root, 'A03');
  assert.equal(t.matrix_runs, 2);
  assert.equal(t.dimensions.legal_accuracy.total, 2);
  assert.equal(t.dimensions.legal_accuracy.agreed, 1);
  assert.equal(t.dimensions.legal_accuracy.rate, 0.5);
  fs.rmSync(root, { recursive: true, force: true });
});

test('updateTrust: writes last_updated timestamp', () => {
  const root = makeRoot();
  const t = updateTrust(root, 'A03', ['x'], ['x']);
  assert.match(t.last_updated, /^\d{4}-\d{2}-\d{2}T/);
  fs.rmSync(root, { recursive: true, force: true });
});
