const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  mintAuditKey, loadAuditKey, listAuditKeys, rotateAuditKey, currentKeyId,
} = require('../lib/audit-key');

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'josh-akey-'));
}

test('mintAuditKey: writes 32 random bytes to ~/.josh/keys/audit-<id>.key', () => {
  const root = makeRoot();
  const r = mintAuditKey(root, '2026-05');
  const buf = fs.readFileSync(r.path);
  assert.equal(buf.length, 32);
  assert.equal(r.key_id, '2026-05');
  fs.rmSync(root, { recursive: true, force: true });
});

test('mintAuditKey: refuses to clobber existing', () => {
  const root = makeRoot();
  mintAuditKey(root, '2026-05');
  assert.throws(() => mintAuditKey(root, '2026-05'));
  fs.rmSync(root, { recursive: true, force: true });
});

test('loadAuditKey: returns the same bytes', () => {
  const root = makeRoot();
  const m = mintAuditKey(root, '2026-05');
  const a = fs.readFileSync(m.path);
  const b = loadAuditKey(root, '2026-05');
  assert.equal(a.toString('hex'), b.toString('hex'));
  fs.rmSync(root, { recursive: true, force: true });
});

test('rotateAuditKey: mints new key + reports previous', () => {
  const root = makeRoot();
  mintAuditKey(root, '2026-05');
  const r = rotateAuditKey(root, { newId: '2026-06' });
  assert.equal(r.previous_key_id, '2026-05');
  assert.equal(r.current_key_id, '2026-06');
  assert.deepEqual(listAuditKeys(root), ['2026-05', '2026-06']);
  fs.rmSync(root, { recursive: true, force: true });
});

test('currentKeyId: matches YYYY-MM of current UTC', () => {
  const id = currentKeyId();
  assert.match(id, /^\d{4}-\d{2}$/);
});
