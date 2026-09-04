// A damaged registry.json must never be silently downgraded to "no servers",
// because every mutating call is read → modify → write. Before the fix, one
// truncated file caused the next `mcp register` to wipe every existing entry.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const reg = require('../lib/mcp-registry');

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'josh-mcp-'));
}

function seed(root) {
  reg.registerServer(root, { id: 'alpha', command: 'node' });
  reg.registerServer(root, { id: 'bravo', command: 'node' });
  reg.registerServer(root, { id: 'charlie', command: 'node' });
  return reg.registryPath(root);
}

test('registerServer: a truncated registry no longer destroys existing servers', () => {
  const root = tmpRoot();
  const p = seed(root);
  assert.deepStrictEqual(reg.listServers(root).map((s) => s.id), ['alpha', 'bravo', 'charlie']);

  // Simulate a crash/disk-full/sync-conflict half-write.
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').slice(0, 40));

  assert.throws(() => reg.registerServer(root, { id: 'delta' }), /corrupt/i,
    'registering against a corrupt registry must fail loudly');

  // The damaged bytes are still on disk, untouched — nothing was overwritten.
  const after = fs.readFileSync(p, 'utf8');
  assert.strictEqual(after.length, 40, 'the corrupt file must not be replaced');
});

test('readRegistry: throws on corrupt JSON instead of returning an empty registry', () => {
  const root = tmpRoot();
  const p = seed(root);
  fs.writeFileSync(p, '{ not json');
  assert.throws(() => reg.readRegistry(root), /corrupt/i);
});

test('readRegistry: throws when the file is a JSON array rather than an object', () => {
  const root = tmpRoot();
  const p = seed(root);
  fs.writeFileSync(p, '[]');
  assert.throws(() => reg.readRegistry(root), /not a JSON object/i);
});

test('readRegistry: throws when "servers" is present but not an array', () => {
  const root = tmpRoot();
  const p = seed(root);
  fs.writeFileSync(p, JSON.stringify({ schema: 1, servers: { alpha: {} } }));
  assert.throws(() => reg.readRegistry(root), /non-array/i);
});

test('unregisterServer: refuses to rewrite a corrupt registry', () => {
  const root = tmpRoot();
  const p = seed(root);
  fs.writeFileSync(p, '{{{');
  assert.throws(() => reg.unregisterServer(root, 'alpha'), /corrupt/i);
  assert.strictEqual(fs.readFileSync(p, 'utf8'), '{{{');
});

test('readRegistry: a missing registry is still an empty registry (not an error)', () => {
  const root = tmpRoot();
  const r = reg.readRegistry(root);
  assert.deepStrictEqual(r, { schema: 1, servers: [] });
  assert.deepStrictEqual(reg.listServers(root), []);
  assert.strictEqual(reg.getServer(root, 'nope'), null);
});

test('readRegistry: a valid registry missing "servers" normalises to []', () => {
  const root = tmpRoot();
  const p = reg.registryPath(root);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ schema: 1 }));
  assert.deepStrictEqual(reg.readRegistry(root).servers, []);
});

test('happy path is unchanged: register, list, get, unregister', () => {
  const root = tmpRoot();
  seed(root);
  assert.strictEqual(reg.getServer(root, 'bravo').command, 'node');
  assert.deepStrictEqual(reg.unregisterServer(root, 'bravo'), { removed: 1 });
  assert.deepStrictEqual(reg.listServers(root).map((s) => s.id), ['alpha', 'charlie']);
});
