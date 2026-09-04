// updateTrust does read -> modify -> write. readTrust swallowed parse errors and
// returned a fresh zeroed record, so a corrupt trust.json was overwritten on the
// next matrix run and the agent's accumulated agreement history was erased with
// no error. A file that parsed but had no `dimensions` key crashed instead.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readTrust, updateTrust } = require('../lib/trust');

function rootWith(body) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-trust-'));
  const dir = path.join(root, 'agents', 'A01');
  fs.mkdirSync(dir, { recursive: true });
  if (body !== undefined) {
    fs.writeFileSync(path.join(dir, 'trust.json'), typeof body === 'string' ? body : JSON.stringify(body));
  }
  return root;
}

const trustFile = (root) => path.join(root, 'agents', 'A01', 'trust.json');

test('a corrupt trust store is not silently replaced with a blank one', () => {
  const root = rootWith(undefined);
  updateTrust(root, 'A01', ['accuracy', 'rigor'], ['accuracy']);
  updateTrust(root, 'A01', ['accuracy', 'rigor'], ['accuracy']);
  assert.strictEqual(readTrust(root, 'A01').dimensions.accuracy.total, 2);

  fs.writeFileSync(trustFile(root), '{ truncated');

  assert.throws(() => updateTrust(root, 'A01', ['accuracy'], ['accuracy']), /unreadable/i);
  assert.strictEqual(fs.readFileSync(trustFile(root), 'utf8'), '{ truncated', 'the damaged file is left alone');
});

test('readTrust throws on corrupt JSON rather than reporting no history', () => {
  const root = rootWith('{ nope');
  assert.throws(() => readTrust(root, 'A01'), /unreadable/i);
});

test('readTrust throws when the store is not a JSON object', () => {
  for (const body of ['[]', '42', '"str"', 'null']) {
    assert.throws(() => readTrust(rootWith(body), 'A01'), /not a JSON object|unreadable/i, `body ${body}`);
  }
});

test('a store with no dimensions key no longer crashes updateTrust', () => {
  const root = rootWith({ schema: 1, agent_id: 'A01' });
  const t = updateTrust(root, 'A01', ['accuracy'], ['accuracy']);
  assert.strictEqual(t.dimensions.accuracy.total, 1);
  assert.strictEqual(t.dimensions.accuracy.agreed, 1);
});

test('a non-object dimensions value is normalised, not crashed on', () => {
  for (const dims of [null, [], 'nope', 7]) {
    const root = rootWith({ schema: 1, agent_id: 'A01', dimensions: dims });
    const t = updateTrust(root, 'A01', ['accuracy'], []);
    assert.strictEqual(t.dimensions.accuracy.total, 1, `dimensions=${JSON.stringify(dims)}`);
  }
});

test('a dimension record with non-numeric counters restarts instead of writing NaN', () => {
  const root = rootWith({ schema: 1, agent_id: 'A01', dimensions: { accuracy: { agreed: null, total: 'x' } } });
  const t = updateTrust(root, 'A01', ['accuracy'], ['accuracy']);
  assert.strictEqual(t.dimensions.accuracy.total, 1);
  assert.strictEqual(t.dimensions.accuracy.agreed, 1);
  assert.strictEqual(t.dimensions.accuracy.rate, 1);
});

test('a missing matrix_runs is treated as zero', () => {
  const root = rootWith({ schema: 1, agent_id: 'A01', dimensions: {} });
  assert.strictEqual(updateTrust(root, 'A01', ['accuracy'], []).matrix_runs, 1);
});

test('an absent store still yields defaults - that path is unchanged', () => {
  const t = readTrust(rootWith(undefined), 'A01');
  assert.deepStrictEqual(t, { schema: 1, agent_id: 'A01', dimensions: {}, matrix_runs: 0, last_updated: null });
});

test('existing history is preserved and added to', () => {
  const root = rootWith({
    schema: 1, agent_id: 'A01', matrix_runs: 5,
    dimensions: { accuracy: { agreed: 3, total: 5, rate: 0.6 } },
  });
  const t = updateTrust(root, 'A01', ['accuracy'], ['accuracy']);
  assert.strictEqual(t.dimensions.accuracy.total, 6);
  assert.strictEqual(t.dimensions.accuracy.agreed, 4);
  assert.strictEqual(t.matrix_runs, 6);
});

test('unknown fields in the store survive a round-trip', () => {
  const root = rootWith({ schema: 1, agent_id: 'A01', dimensions: {}, note: 'keep me' });
  updateTrust(root, 'A01', ['accuracy'], []);
  assert.strictEqual(readTrust(root, 'A01').note, 'keep me');
});
