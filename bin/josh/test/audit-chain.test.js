const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { mintAuditKey, rotateAuditKey, listAuditKeys } = require('../lib/audit-key');
const { appendChainedAudit, verifyChain, chainFile } = require('../lib/audit-chain');

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-chain-'));
  fs.mkdirSync(path.join(root, 'keys'), { recursive: true });
  fs.mkdirSync(path.join(root, 'audit'), { recursive: true });
  return root;
}

test('mintAuditKey + listAuditKeys: round-trip', () => {
  const root = makeRoot();
  mintAuditKey(root, '2026-05');
  mintAuditKey(root, '2026-06');
  assert.deepEqual(listAuditKeys(root), ['2026-05', '2026-06']);
  fs.rmSync(root, { recursive: true, force: true });
});

test('appendChainedAudit + verifyChain: 50-event chain verifies', () => {
  const root = makeRoot();
  mintAuditKey(root, 'KX');
  for (let i = 0; i < 50; i++) {
    appendChainedAudit(root, { event: 'noop', id: `T${i}`, details: { i } }, { date: '2026-05-10', key_id: 'KX' });
  }
  const r = verifyChain(root, '2026-05-10');
  assert.equal(r.valid, true, `errors: ${JSON.stringify(r.errors)}`);
  assert.equal(r.chain_length, 50);
  fs.rmSync(root, { recursive: true, force: true });
});

test('verifyChain: detects tamper at exact line', () => {
  const root = makeRoot();
  mintAuditKey(root, 'KX');
  for (let i = 0; i < 5; i++) {
    appendChainedAudit(root, { event: 'noop', id: `T${i}` }, { date: '2026-05-10', key_id: 'KX' });
  }
  // Tamper line 3 (1-indexed) by replacing one char in details.
  const file = chainFile(root, '2026-05-10');
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  lines[2] = lines[2].replace('"T2"', '"X2"');
  fs.writeFileSync(file, lines.join('\n') + '\n');

  const r = verifyChain(root, '2026-05-10');
  assert.equal(r.valid, false);
  // Tamper on line 3 propagates: line 3 hmac mismatches AND line 4 sees stale prev_hmac.
  assert.ok(r.errors.length >= 1);
  assert.ok(r.errors.some((e) => e.position === 3), `expected error at position 3, got ${JSON.stringify(r.errors)}`);
  fs.rmSync(root, { recursive: true, force: true });
});

test('verifyChain: rotation across keys works', () => {
  const root = makeRoot();
  mintAuditKey(root, '2026-05');
  for (let i = 0; i < 3; i++) {
    appendChainedAudit(root, { event: 'noop', id: `T${i}` }, { date: '2026-05-10', key_id: '2026-05' });
  }
  // Rotate to a new key mid-day; emit a key_rotated marker, then more events with the new key.
  rotateAuditKey(root, { newId: '2026-06' });
  appendChainedAudit(root, { event: 'audit.key_rotated', id: null, details: { from: '2026-05', to: '2026-06' } },
                     { date: '2026-05-10', key_id: '2026-06' });
  for (let i = 0; i < 3; i++) {
    appendChainedAudit(root, { event: 'noop', id: `U${i}` }, { date: '2026-05-10', key_id: '2026-06' });
  }
  const r = verifyChain(root, '2026-05-10');
  assert.equal(r.valid, true, `errors: ${JSON.stringify(r.errors)}`);
  assert.equal(r.chain_length, 7);
  fs.rmSync(root, { recursive: true, force: true });
});

test('verifyChain: valid=false when file missing', () => {
  const root = makeRoot();
  const r = verifyChain(root, '2099-01-01');
  assert.equal(r.valid, false);
  assert.equal(r.chain_length, 0);
  fs.rmSync(root, { recursive: true, force: true });
});
