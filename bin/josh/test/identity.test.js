const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const {
  mintAgentIdentity,
  loadAgentKeys,
  agentBriefHash,
  derivedDID,
  ED25519_PKCS8_PREFIX,
} = require('../lib/identity');

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-id-'));
  fs.mkdirSync(path.join(root, 'agents', 'A03'), { recursive: true });
  return root;
}

test('mintAgentIdentity: writes identity.key (32B raw) + pubkey.jwk + manifest patch', () => {
  const root = makeRoot();
  const briefPath = path.join(root, 'agents', 'A03', 'brief.md');
  fs.writeFileSync(briefPath, '# A03\n');
  fs.writeFileSync(path.join(root, 'agents', 'A03', 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A03', source_path: briefPath,
  }, null, 2));

  const r = mintAgentIdentity(root, 'A03');
  // Files exist with expected sizes/shape.
  const idKey = fs.readFileSync(path.join(root, 'agents', 'A03', 'identity.key'));
  assert.equal(idKey.length, 32);
  const pubJwk = JSON.parse(fs.readFileSync(path.join(root, 'agents', 'A03', 'pubkey.jwk'), 'utf8'));
  assert.equal(pubJwk.kty, 'OKP');
  assert.equal(pubJwk.crv, 'Ed25519');
  assert.match(pubJwk.x, /^[A-Za-z0-9_-]+$/);
  assert.match(r.did, /^did:key:z/);
  // Manifest patched.
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'agents', 'A03', 'manifest.json'), 'utf8'));
  assert.equal(manifest.did, r.did);
  assert.equal(manifest.pubkey_path, 'pubkey.jwk');

  fs.rmSync(root, { recursive: true, force: true });
});

test('loadAgentKeys: returns matching public/private KeyObjects', () => {
  const root = makeRoot();
  const briefPath = path.join(root, 'agents', 'A03', 'brief.md');
  fs.writeFileSync(briefPath, '# A03\n');
  fs.writeFileSync(path.join(root, 'agents', 'A03', 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A03', source_path: briefPath,
  }, null, 2));
  mintAgentIdentity(root, 'A03');

  const k = loadAgentKeys(root, 'A03');
  // Sign + verify using the loaded keys.
  const msg = Buffer.from('hello world');
  const sig = crypto.sign(null, msg, k.privateKey);
  assert.equal(crypto.verify(null, msg, k.publicKey, sig), true);

  fs.rmSync(root, { recursive: true, force: true });
});

test('agentBriefHash: stable sha256 of source brief', () => {
  const root = makeRoot();
  const briefPath = path.join(root, 'agents', 'A03', 'brief.md');
  fs.writeFileSync(briefPath, '# A03\nhello\n');
  fs.writeFileSync(path.join(root, 'agents', 'A03', 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A03', source_path: briefPath,
  }, null, 2));
  const h = agentBriefHash(root, 'A03');
  const expected = crypto.createHash('sha256').update(fs.readFileSync(briefPath)).digest('hex');
  assert.equal(h, expected);
  fs.rmSync(root, { recursive: true, force: true });
});

test('derivedDID: did:key:z + base64url(pubkey raw)', () => {
  const pub = Buffer.from('a'.repeat(64), 'hex');
  const did = derivedDID(pub);
  assert.match(did, /^did:key:z/);
  assert.equal(did.length > 'did:key:z'.length, true);
});

test('mintAgentIdentity: idempotent — second mint refuses without --rotate', () => {
  const root = makeRoot();
  const briefPath = path.join(root, 'agents', 'A03', 'brief.md');
  fs.writeFileSync(briefPath, '# A03\n');
  fs.writeFileSync(path.join(root, 'agents', 'A03', 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A03', source_path: briefPath,
  }, null, 2));
  mintAgentIdentity(root, 'A03');
  assert.throws(() => mintAgentIdentity(root, 'A03'));
  // With rotate: succeeds and writes new keys.
  const original = fs.readFileSync(path.join(root, 'agents', 'A03', 'identity.key'));
  const rotated = mintAgentIdentity(root, 'A03', { rotate: true });
  const next = fs.readFileSync(path.join(root, 'agents', 'A03', 'identity.key'));
  assert.notEqual(original.toString('hex'), next.toString('hex'));
  assert.match(rotated.did, /^did:key:z/);
  fs.rmSync(root, { recursive: true, force: true });
});
