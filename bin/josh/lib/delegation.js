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
  // Verify signature against the kid (parent DID) in the header.
  const parentDid = parts.header.kid;
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
