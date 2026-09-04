// A `did:key:z...` DID contains the public key. `verifyDelegation` derived the
// verification key from the token's own `kid`, so the signature check was
// circular: it proved the token was signed by whoever wrote it. Any keypair -
// registered or not - could mint a valid delegation for any scope.

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { issueDelegation, verifyDelegation } = require('../lib/delegation');
const identity = require('../lib/identity');

function freshKeys() {
  const kp = crypto.generateKeyPairSync('ed25519');
  const pub = kp.publicKey.export({ format: 'der', type: 'spki' }).slice(-32);
  return { privateKey: kp.privateKey, did: identity.derivedDID(pub) };
}

function vcFrom(keys, over = {}) {
  return issueDelegation({
    parentKeys: keys,
    ephemeralDID: 'did:key:zEPHEMERAL',
    scope: ['claim:01HTODO', 'verdict:produce'],
    expiresAt: new Date(Date.now() + 3600e3).toISOString(),
    ...over,
  });
}

test('an unregistered issuer is rejected when a trust anchor is supplied', () => {
  const attacker = freshKeys();
  const registered = freshKeys();

  const forged = vcFrom(attacker);
  const r = verifyDelegation(forged, { trustedDids: [registered.did] });

  assert.strictEqual(r.valid, false);
  assert.match(r.reason, /untrusted issuer/);
});

test('the same forged token is accepted without a trust anchor - the default is unchanged', () => {
  const attacker = freshKeys();
  assert.strictEqual(verifyDelegation(vcFrom(attacker)).valid, true);
});

test('a registered issuer is accepted', () => {
  const parent = freshKeys();
  const r = verifyDelegation(vcFrom(parent), { trustedDids: [parent.did] });
  assert.strictEqual(r.valid, true, r.reason);
  assert.strictEqual(r.payload.act, parent.did);
});

test('one trusted issuer among several still matches', () => {
  const parent = freshKeys();
  const others = [freshKeys().did, freshKeys().did];
  const r = verifyDelegation(vcFrom(parent), { trustedDids: [...others, parent.did] });
  assert.strictEqual(r.valid, true, r.reason);
});

test('an empty trust list trusts nobody', () => {
  const parent = freshKeys();
  const r = verifyDelegation(vcFrom(parent), { trustedDids: [] });
  assert.strictEqual(r.valid, false);
  assert.match(r.reason, /untrusted issuer/);
});

test('a non-array trustedDids trusts nobody rather than everybody', () => {
  const parent = freshKeys();
  for (const junk of [null, 'did:key:zX', 42, {}]) {
    const r = verifyDelegation(vcFrom(parent), { trustedDids: junk });
    assert.strictEqual(r.valid, false, `${JSON.stringify(junk)} must not act as a wildcard`);
  }
});

test('trust is checked against the signing key, not against the claimed subject', () => {
  const attacker = freshKeys();
  const victim = freshKeys();
  // Attacker names the victim as `sub`, hoping the subject is what gets trusted.
  const forged = vcFrom(attacker, { subjectDID: victim.did });
  const r = verifyDelegation(forged, { trustedDids: [victim.did] });
  assert.strictEqual(r.valid, false);
  assert.match(r.reason, /untrusted issuer/);
});

test('a token whose act does not match its signing key is rejected', () => {
  const attacker = freshKeys();
  const victim = freshKeys();

  // Hand-assemble a token: signed by the attacker, but claiming to act as the victim.
  const { encodeJws } = require('../lib/jws');
  const payload = {
    sub: victim.did,
    act: victim.did,                       // <- the lie
    delegate_to: 'did:key:zEPHEMERAL',
    scope: ['verdict:produce'],
    iat: new Date().toISOString(),
    expires_at: new Date(Date.now() + 3600e3).toISOString(),
  };
  const forged = encodeJws({ payloadObj: payload, privateKey: attacker.privateKey, did: attacker.did });

  const r = verifyDelegation(forged);
  assert.strictEqual(r.valid, false, 'act must be the key that signed the token');
  assert.match(r.reason, /does not match signing key/);
});

test('a tampered payload still fails the signature check', () => {
  const parent = freshKeys();
  const vc = vcFrom(parent);
  const [h, p, s] = vc.split('.');
  const body = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
  body.scope.push('admin:everything');
  const tampered = [h, Buffer.from(JSON.stringify(body)).toString('base64url'), s].join('.');

  const r = verifyDelegation(tampered, { trustedDids: [parent.did] });
  assert.strictEqual(r.valid, false);
  assert.match(r.reason, /signature invalid/);
});

test('expiry and scope checks still apply on top of the trust check', () => {
  const parent = freshKeys();

  const expired = vcFrom(parent, { expiresAt: new Date(Date.now() - 1000).toISOString() });
  assert.match(verifyDelegation(expired, { trustedDids: [parent.did] }).reason, /expired/);

  const scoped = verifyDelegation(vcFrom(parent), { trustedDids: [parent.did], requiredScope: ['admin:everything'] });
  assert.strictEqual(scoped.valid, false);
  assert.match(scoped.reason, /missing scope/);
});
