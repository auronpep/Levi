// writeCapacity must create JOSH_ROOT if it is not there yet, the way every
// other writer in lib/ does. Before the fix it threw a raw ENOENT.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const host = require('../lib/host');

function unborn() {
  // A path whose parent exists but which has not been created yet.
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'josh-host-')), 'josh-root');
}

test('writeCapacity: creates JOSH_ROOT when it does not exist yet', () => {
  const root = unborn();
  assert.strictEqual(fs.existsSync(root), false, 'precondition: root is absent');

  const p = host.writeCapacity(root, 'pc1', { max_concurrent: 4 });

  assert.ok(fs.existsSync(p), 'capacity file should exist after write');
  assert.strictEqual(host.readCapacity(root, 'pc1').max_concurrent, 4);
});

test('writeCapacity: creates nested JOSH_ROOT paths', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-host-'));
  const root = path.join(base, 'a', 'b', 'c');

  host.writeCapacity(root, 'pc2', { max_concurrent: 1 });

  assert.strictEqual(host.readCapacity(root, 'pc2').max_concurrent, 1);
});

test('writeCapacity: still idempotent on an existing root', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-host-'));
  host.writeCapacity(root, 'pc3', { max_concurrent: 2 });
  host.writeCapacity(root, 'pc3', { max_concurrent: 8 });

  assert.strictEqual(host.readCapacity(root, 'pc3').max_concurrent, 8);
  assert.deepStrictEqual(host.listHostCapacities(root), ['pc3']);
});

test('writeCapacity: leaves no .tmp file behind', () => {
  const root = unborn();
  host.writeCapacity(root, 'pc4', { max_concurrent: 3 });

  const leftovers = fs.readdirSync(root).filter((f) => f.endsWith('.tmp'));
  assert.deepStrictEqual(leftovers, []);
});

test('readCapacity: fills in CAPACITY_DEFAULTS for unset fields', () => {
  const root = unborn();
  host.writeCapacity(root, 'pc5', { max_concurrent: 6 });

  const cap = host.readCapacity(root, 'pc5');
  assert.strictEqual(cap.schema, 1);
  assert.strictEqual(cap.host, 'pc5');
  assert.strictEqual(cap.max_concurrent, 6);
  assert.strictEqual(cap.max_concurrent_per_phase, null);
  assert.strictEqual(cap.max_concurrent_per_agent, null);
});

test('listHostCapacities: returns sorted host names and ignores other files', () => {
  const root = unborn();
  host.writeCapacity(root, 'zulu', {});
  host.writeCapacity(root, 'alpha', {});
  fs.writeFileSync(path.join(root, 'status.json'), '{}');

  assert.deepStrictEqual(host.listHostCapacities(root), ['alpha', 'zulu']);
});
