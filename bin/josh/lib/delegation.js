'use strict';

const crypto = require('node:crypto');
const { encodeJws, verifyJws } = require('./jws');
const { rawPublicToKeyObject, fromB64url } = require('./identity');

// VC shape per spec §9.3:
//   { "sub": <owner-DID>, "act": <parent-DID>, "delegate_to": <ephemeral-DID>,
//     "scope": ["claim:<todo-id>", "verdict:produce"], "expires_at": <ISO> }
// Issued as a JWS-compact signed by the parent agent.

function issueDelegation({ parentKeys, subjectDID, ephemeralDID, scope, expiresAt }) {
  if (!parentKeys || !parentKeys.privateKey || !parentKeys.did) {
    throw new Error('issueDelegation: parentKeys with did + privateKey required');
  }
  if (!ephemeralDID) throw new Error('issueDelegation: ephemeralDID required');
  if (!Array.isArray(scope) || scope.length === 0) {
    throw new Error('issueDelegation: scope must be non-empty array');
  }
  const payload = {
    sub: subjectDID || parentKeys.did,
    act: parentKeys.did,
    delegate_to: ephemeralDID,
    scope: scope.slice(),
    iat: new Date().toISOString(),
    expires_at: expiresAt || new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
  };
  return encodeJws({ payloadObj: payload, privateKey: parentKeys.privateKey, did: parentKeys.did });
}

function didToPublicKey(did) {
  if (!did || !did.startsWith('did:key:z')) throw new Error('didToPublicKey: invalid DID');
  const raw = fromB64url(did.slice('did:key:z'.length));
  return rawPublicToKeyObject(raw);
}

function verifyDelegation(vcJws, opts = {}) {
  let parts;
  try { parts = require('./jws').decodeJwsParts(vcJws); }
  catch (e) { return { valid: false, reason: e.message }; }
  // The signing key is derived from the token's own `kid`, and a `did:key:z...`
  // DID *contains* the public key. So the signature check alone proves only
  // "whoever wrote this token also signed it" - self-attestation, not
  // authorisation. Anyone can generate a keypair, name themselves in `kid`, and
  // mint a VC for any scope they like.
  //
  // `opts.trustedDids` is the anchor that turns the signature into evidence:
  // the issuer must be a DID the caller already knows (the `did` fields of the
  // registered agent manifests). Any caller making an authorisation decision on
  // a delegation MUST pass it - without it this function answers "is this
  // internally consistent", not "may the bearer do this".
  const parentDid = parts.header.kid;
  if (opts.trustedDids !== undefined) {
    const trusted = Array.isArray(opts.trustedDids) ? opts.trustedDids : [];
    if (!trusted.includes(parentDid)) {
      return { valid: false, reason: `untrusted issuer: ${parentDid}`, parts };
    }
  }
  let parentPub;
  try { parentPub = didToPublicKey(parentDid); }
  catch (e) { return { valid: false, reason: e.message }; }
  const v = verifyJws(vcJws, parentPub);
  if (!v.valid) return { valid: false, reason: 'parent signature invalid', parts };
  const p = v.parts.payload;
  // Required fields
  for (const f of ['sub', 'act', 'delegate_to', 'scope', 'expires_at']) {
    if (p[f] == null) return { valid: false, reason: `missing field: ${f}`, parts: v.parts };
  }
  // `act` is the DID the token claims to be acting as. It must be the DID that
  // actually signed it, or a token signed by one key could name a different,
  // trusted agent in `act` and any caller reading `payload.act` as the actor
  // would be reading the attacker's assertion rather than a verified fact.
  // issueDelegation always sets both from the same key, so this only rejects
  // tokens that were assembled by hand.
  if (p.act !== parentDid) {
    return { valid: false, reason: `act (${p.act}) does not match signing key (${parentDid})`, parts: v.parts };
  }
  // Expiry check
  const exp = Date.parse(p.expires_at);
  if (!Number.isFinite(exp)) return { valid: false, reason: 'malformed expires_at', parts: v.parts };
  if (Date.now() > exp) return { valid: false, reason: 'expired', parts: v.parts };
  // Scope check, if requiredScope passed
  if (Array.isArray(opts.requiredScope)) {
    for (const s of opts.requiredScope) {
      if (!p.scope.includes(s)) return { valid: false, reason: `missing scope: ${s}`, parts: v.parts };
    }
  }
  return { valid: true, payload: p, parts: v.parts };
}

module.exports = { issueDelegation, verifyDelegation, didToPublicKey };
