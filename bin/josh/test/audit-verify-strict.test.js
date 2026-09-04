// The chain tolerates records with no `hmac` field so that pre-Phase-6 events
// written by the plain appendAudit() path do not fail the day. The cost is that
// omitting one field is enough to add a record the chain cannot attribute, and
// verifyChain still answers `valid: true`.
//
// `--strict` asks the other question: is every record in this file accounted
// for. Default behaviour is unchanged.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { appendChainedAudit, verifyChain, chainFile } = require('../lib/audit-chain');

const DATE = '2026-05-10';
const JOSH = path.join(__dirname, '..', 'josh.js');

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-strict-'));
  fs.mkdirSync(path.join(root, 'audit'), { recursive: true });
  return root;
}

function seedChain(root, n = 2) {
  for (let i = 0; i < n; i++) {
    appendChainedAudit(root, { event: 'claim', id: `T${i}`, actor: 'claude' }, { date: DATE });
  }
  return root;
}

function injectUnchained(root, details = { note: 'forged - never happened' }) {
  fs.appendFileSync(chainFile(root, DATE), JSON.stringify({
    schema: 1, ts: new Date().toISOString(), actor: 'human',
    kind: 'action', event: 'approved', id: 'T1', details,
  }) + '\n');
}

test('a clean chain is valid in both modes', () => {
  const root = seedChain(makeRoot());
  assert.strictEqual(verifyChain(root, DATE).valid, true);
  assert.strictEqual(verifyChain(root, DATE, { strict: true }).valid, true);
});

test('an injected hmac-less record is accepted by default', () => {
  const root = seedChain(makeRoot());
  injectUnchained(root);
  const r = verifyChain(root, DATE);
  assert.strictEqual(r.valid, true, 'default behaviour is deliberately unchanged');
  assert.strictEqual(r.unchained, 1);
});

test('strict mode rejects the injected record', () => {
  const root = seedChain(makeRoot());
  injectUnchained(root);
  const r = verifyChain(root, DATE, { strict: true });
  assert.strictEqual(r.valid, false);
  assert.strictEqual(r.unchained, 1);
  assert.strictEqual(r.errors.length, 1);
  assert.match(r.errors[0].message, /cannot be attributed/);
  assert.strictEqual(r.errors[0].position, 3, 'the error points at the offending line');
});

test('strict mode still reports the genuinely chained records', () => {
  const root = seedChain(makeRoot(), 4);
  injectUnchained(root);
  const r = verifyChain(root, DATE, { strict: true });
  assert.strictEqual(r.chained, 4);
  assert.strictEqual(r.chain_length, 5);
});

test('strict mode does not mask a real tamper', () => {
  const root = seedChain(makeRoot());
  const f = chainFile(root, DATE);
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('"claim"', '"cancelled"'));
  const r = verifyChain(root, DATE, { strict: true });
  assert.strictEqual(r.valid, false);
  assert.ok(r.errors.some((e) => /hmac mismatch|prev_hmac mismatch/.test(e.message)));
});

test('multiple injected records are each reported', () => {
  const root = seedChain(makeRoot());
  injectUnchained(root, { note: 'one' });
  injectUnchained(root, { note: 'two' });
  const r = verifyChain(root, DATE, { strict: true });
  assert.strictEqual(r.unchained, 2);
  assert.strictEqual(r.errors.length, 2);
});

test('the missing-file result keeps a consistent shape', () => {
  const root = makeRoot();
  const r = verifyChain(root, '2099-01-01');
  assert.strictEqual(r.valid, false, 'unchanged - an absent file is still not a verified chain');
  assert.strictEqual(r.chain_length, 0);
  assert.strictEqual(r.chained, 0, 'chained/unchained are always numbers, never undefined');
  assert.strictEqual(r.unchained, 0);
});

test('opts is optional and a non-strict opts object behaves as default', () => {
  const root = seedChain(makeRoot());
  injectUnchained(root);
  assert.strictEqual(verifyChain(root, DATE).valid, true);
  assert.strictEqual(verifyChain(root, DATE, {}).valid, true);
  assert.strictEqual(verifyChain(root, DATE, { strict: false }).valid, true);
});

test('CLI: josh audit verify passes without --strict and fails with it', () => {
  const root = seedChain(makeRoot());
  injectUnchained(root);
  const env = { ...process.env, JOSH_ROOT: root };

  const ok = execFileSync(process.execPath, [JOSH, 'audit', 'verify', DATE], { env, encoding: 'utf8' });
  assert.match(ok, /VALID/);

  let code = 0;
  let stderr = '';
  try {
    execFileSync(process.execPath, [JOSH, 'audit', 'verify', DATE, '--strict'], { env, encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    code = e.status;
    stderr = String(e.stderr || '');
  }
  assert.strictEqual(code, 1, '--strict must exit non-zero on an unattributable record');
  assert.match(stderr, /INVALID/);
  assert.match(stderr, /unattributable/);
});

test('CLI: audit help mentions --strict', () => {
  const out = execFileSync(process.execPath, [JOSH, 'audit', 'help'], { encoding: 'utf8' });
  assert.match(out, /--strict/);
});
