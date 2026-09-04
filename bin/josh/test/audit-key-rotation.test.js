// "Which key do we sign with" was inferred as the lexicographically last
// filename. That matches "most recently rotated to" only while every id is a
// zero-padded date. A single id that sorts high - `emergency` - beats every
// future `YYYY-MM`, so it stays current forever and every later rotation mints
// a key that is never used, while reporting success.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const keys = require('../lib/audit-key');
const { appendChainedAudit, verifyChain } = require('../lib/audit-chain');

const DATE = '2026-09-04';

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'josh-akey-'));
}

const signWith = (root) => appendChainedAudit(root, { event: 'x' }, { date: DATE }).key_id;

test('rotating to a lower-sorting id actually takes effect', () => {
  const root = tmpRoot();
  keys.mintAuditKey(root, 'emergency');
  assert.strictEqual(signWith(root), 'emergency');

  keys.rotateAuditKey(root, { newId: '2026-10' });
  assert.strictEqual(signWith(root), '2026-10', 'the rotation must change the signing key');
});

test('a non-date id no longer pins the key against all future rotations', () => {
  const root = tmpRoot();
  keys.mintAuditKey(root, '2026-08');
  keys.rotateAuditKey(root, { newId: 'emergency' });
  keys.rotateAuditKey(root, { newId: '2026-10' });
  keys.rotateAuditKey(root, { newId: '2026-11' });
  assert.strictEqual(signWith(root), '2026-11');
});

test('ordinary monthly rotation still works', () => {
  const root = tmpRoot();
  keys.mintAuditKey(root, '2026-08');
  assert.strictEqual(signWith(root), '2026-08');
  keys.rotateAuditKey(root, { newId: '2026-09' });
  assert.strictEqual(signWith(root), '2026-09');
});

test('rotateAuditKey reports the key it actually replaced', () => {
  const root = tmpRoot();
  keys.mintAuditKey(root, 'emergency');
  const r = keys.rotateAuditKey(root, { newId: '2026-10' });
  assert.strictEqual(r.previous_key_id, 'emergency');
  assert.strictEqual(r.current_key_id, '2026-10');
});

test('rotating to the id already in use is still refused', () => {
  const root = tmpRoot();
  keys.mintAuditKey(root, '2026-08');
  assert.throws(() => keys.rotateAuditKey(root, { newId: '2026-08' }), /already/);
});

test('a chain spanning a rotation still verifies', () => {
  const root = tmpRoot();
  keys.mintAuditKey(root, 'emergency');
  appendChainedAudit(root, { event: 'before' }, { date: DATE });
  keys.rotateAuditKey(root, { newId: '2026-10' });
  appendChainedAudit(root, { event: 'after' }, { date: DATE });

  const r = verifyChain(root, DATE);
  assert.strictEqual(r.valid, true, JSON.stringify(r.errors));
  assert.strictEqual(r.chained, 2);
});

test('currentAuditKeyId falls back to the old behaviour when no pointer exists', () => {
  const root = tmpRoot();
  keys.mintAuditKey(root, '2026-08');
  keys.mintAuditKey(root, '2026-09');
  fs.rmSync(path.join(keys.keysDir(root), 'current'), { force: true });

  assert.strictEqual(keys.currentAuditKeyId(root), '2026-09', 'pre-existing roots keep working');
});

test('a pointer naming a deleted key falls back rather than breaking', () => {
  const root = tmpRoot();
  keys.mintAuditKey(root, '2026-08');
  keys.mintAuditKey(root, '2026-09');
  fs.rmSync(keys.keyPath(root, '2026-09'));

  assert.strictEqual(keys.currentAuditKeyId(root), '2026-08');
});

test('currentAuditKeyId is null on a root with no keys at all', () => {
  assert.strictEqual(keys.currentAuditKeyId(tmpRoot()), null);
});

test('the pointer file is not mistaken for a key', () => {
  const root = tmpRoot();
  keys.mintAuditKey(root, '2026-08');
  assert.deepStrictEqual(keys.listAuditKeys(root), ['2026-08']);
});

test('appendChainedAudit still mints a key when the root has none', () => {
  const root = tmpRoot();
  const r = appendChainedAudit(root, { event: 'first' }, { date: DATE });
  assert.strictEqual(r.key_id, keys.currentKeyId());
  assert.strictEqual(verifyChain(root, DATE).valid, true);
});

test('an explicit opts.key_id still overrides the current key', () => {
  const root = tmpRoot();
  keys.mintAuditKey(root, '2026-08');
  keys.mintAuditKey(root, '2026-09');
  assert.strictEqual(appendChainedAudit(root, { event: 'x' }, { date: DATE, key_id: '2026-08' }).key_id, '2026-08');
});
