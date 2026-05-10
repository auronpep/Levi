const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { mintAgentIdentity, loadAgentKeys, derivedDID } = require('../lib/identity');
const { issueDelegation, verifyDelegation } = require('../lib/delegation');

function setupAgent(id) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `josh-deleg-${id}-`));
  const dir = path.join(root, 'agents', id);
  fs.mkdirSync(dir, { recursive: true });
  const briefPath = path.join(dir, 'brief.md');
  fs.writeFileSync(briefPath, `# ${id}\n`);
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
    schema: 1, id, source_path: briefPath,
  }, null, 2));
  mintAgentIdentity(root, id);
  return { root, keys: loadAgentKeys(root, id) };
}

function genEphemeral() {
  const kp = crypto.generateKeyPairSync('ed25519');
  const pub = kp.publicKey.export({ format: 'der', type: 'spki' }).slice(-32);
  return derivedDID(pub);
}

test('issueDelegation + verifyDelegation: parent signs, verifier accepts', () => {
  const parent = setupAgent('A01');
  const ephemeralDid = genEphemeral();
  const vc = issueDelegation({
    parentKeys: parent.keys,
    ephemeralDID: ephemeralDid,
    scope: ['claim:01TODO', 'verdict:produce'],
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  const r = verifyDelegation(vc);
  assert.equal(r.valid, true, `errors: ${r.reason}`);
  assert.equal(r.payload.act, parent.keys.did);
  assert.equal(r.payload.delegate_to, ephemeralDid);
  fs.rmSync(parent.root, { recursive: true, force: true });
});

test('verifyDelegation: rejects expired VC', () => {
  const parent = setupAgent('A01');
  const ephemeralDid = genEphemeral();
  const vc = issueDelegation({
    parentKeys: parent.keys,
    ephemeralDID: ephemeralDid,
    scope: ['verdict:produce'],
    expiresAt: '2020-01-01T00:00:00Z',
  });
  const r = verifyDelegation(vc);
  assert.equal(r.valid, false);
  assert.match(r.reason, /expired/);
  fs.rmSync(parent.root, { recursive: true, force: true });
});

test('verifyDelegation: rejects when required scope missing', () => {
  const parent = setupAgent('A01');
  const ephemeralDid = genEphemeral();
  const vc = issueDelegation({
    parentKeys: parent.keys, ephemeralDID: ephemeralDid,
    scope: ['verdict:produce'],
  });
  const r = verifyDelegation(vc, { requiredScope: ['claim:01TODO'] });
  assert.equal(r.valid, false);
  assert.match(r.reason, /missing scope/);
  fs.rmSync(parent.root, { recursive: true, force: true });
});

test('verifyDelegation: rejects forged signature (different parent key)', () => {
  const real = setupAgent('A01');
  const forger = setupAgent('A99');
  const ephemeralDid = genEphemeral();
  // Use forger's key but claim real's DID as kid — parsing succeeds, signature won't.
  // Easiest path: forger issues a VC. Verifier resolves the (forger's) parent DID from kid → forger's pubkey → succeeds. So that's not a forgery test exactly.
  // Real forgery test: forger creates a VC under real's DID (impossible without real's private key). We prove that by showing real's DID doesn't accept a VC whose payload claims act=real but signature was made by forger.
  // We can't construct that directly without low-level JWS rebuild — verify protected the VC: kid=forger.did → resolver pulls forger's pubkey → verifies fine BUT payload.act=forger.did.
  // The actual security property: verifier pulls public key from header.kid. If A03 uses a delegation tagged by A01's DID, but signature was actually made by A99, kid="A01-did" but pubkey resolution from kid won't match A99's signature → verify fails.
  // We can simulate by re-encoding header to claim real's did while signed with forger's key.
  const { encodeJws } = require('../lib/jws');
  const forgedVc = encodeJws({
    payloadObj: {
      sub: real.keys.did, act: real.keys.did, delegate_to: ephemeralDid,
      scope: ['verdict:produce'],
      iat: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    },
    privateKey: forger.keys.privateKey,
    did: real.keys.did,  // ← lying about the kid
  });
  const r = verifyDelegation(forgedVc);
  assert.equal(r.valid, false);
  assert.match(r.reason, /signature invalid/);
  fs.rmSync(real.root, { recursive: true, force: true });
  fs.rmSync(forger.root, { recursive: true, force: true });
});
