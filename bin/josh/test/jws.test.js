const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { encodeJws, verifyJws, decodeJwsParts } = require('../lib/jws');
const { mintAgentIdentity, loadAgentKeys } = require('../lib/identity');

function setupAgent() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-jws-'));
  const dir = path.join(root, 'agents', 'A03');
  fs.mkdirSync(dir, { recursive: true });
  const briefPath = path.join(dir, 'brief.md');
  fs.writeFileSync(briefPath, '# A03\n');
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A03', source_path: briefPath,
  }, null, 2));
  mintAgentIdentity(root, 'A03');
  return { root, keys: loadAgentKeys(root, 'A03') };
}

test('encodeJws + verifyJws: round-trip with EdDSA', () => {
  const { root, keys } = setupAgent();
  const payload = { iss: keys.did, aud: 'josh:audit', iat: 1000, brief_hash: 'a'.repeat(64), claim: 'approve' };
  const jws = encodeJws({ payloadObj: payload, privateKey: keys.privateKey, did: keys.did });
  assert.equal(jws.split('.').length, 3);

  const { valid, parts } = verifyJws(jws, keys.publicKey);
  assert.equal(valid, true);
  assert.equal(parts.header.alg, 'EdDSA');
  assert.equal(parts.header.kid, keys.did);
  assert.equal(parts.payload.iss, keys.did);
  assert.equal(parts.payload.aud, 'josh:audit');

  fs.rmSync(root, { recursive: true, force: true });
});

test('verifyJws: rejects tampered payload', () => {
  const { root, keys } = setupAgent();
  const jws = encodeJws({ payloadObj: { x: 1 }, privateKey: keys.privateKey, did: keys.did });
  const parts = jws.split('.');
  // Flip a bit in the payload section.
  parts[1] = parts[1].slice(0, -1) + (parts[1].slice(-1) === 'A' ? 'B' : 'A');
  const tampered = parts.join('.');
  const r = verifyJws(tampered, keys.publicKey);
  assert.equal(r.valid, false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('verifyJws: rejects unsupported alg', () => {
  const { root, keys } = setupAgent();
  const fakeJws = 'eyJhbGciOiJSUzI1NiJ9.e30.aaaaaa';
  const r = verifyJws(fakeJws, keys.publicKey);
  assert.equal(r.valid, false);
  assert.match(r.reason, /unsupported alg/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('decodeJwsParts: throws on malformed input', () => {
  assert.throws(() => decodeJwsParts('not-a-jws'));
  assert.throws(() => decodeJwsParts('a.b'));
});

test('verifyJws: rejects when verified with wrong key', () => {
  const a = setupAgent();
  const b = setupAgent();
  const jws = encodeJws({ payloadObj: { x: 1 }, privateKey: a.keys.privateKey, did: a.keys.did });
  const r = verifyJws(jws, b.keys.publicKey);
  assert.equal(r.valid, false);
  fs.rmSync(a.root, { recursive: true, force: true });
  fs.rmSync(b.root, { recursive: true, force: true });
});
