'use strict';

const crypto = require('node:crypto');
const { b64url, fromB64url } = require('./identity');

// JWS-compact for alg=EdDSA. Header always includes {alg:"EdDSA", kid:<did>}.
// Payload is canonical JSON of the application object — caller responsible.

function encodeJws({ payloadObj, privateKey, did, payloadJson }) {
  if (!privateKey) throw new Error('encodeJws: privateKey required');
  if (!did) throw new Error('encodeJws: did required');
  const header = { alg: 'EdDSA', kid: did };
  const headerB64 = b64url(JSON.stringify(header));
  const payload = (payloadJson != null) ? payloadJson : JSON.stringify(payloadObj || {});
  const payloadB64 = b64url(payload);
  const signingInput = `${headerB64}.${payloadB64}`;
  const sig = crypto.sign(null, Buffer.from(signingInput), privateKey);
  return `${signingInput}.${b64url(sig)}`;
}

function decodeJwsParts(jws) {
  if (typeof jws !== 'string') throw new Error('decodeJwsParts: jws must be string');
  const parts = jws.split('.');
  if (parts.length !== 3) throw new Error('decodeJwsParts: expected 3 parts');
  const [headerB64, payloadB64, sigB64] = parts;
  let header;
  try { header = JSON.parse(fromB64url(headerB64).toString('utf8')); }
  catch (e) { throw new Error('decodeJwsParts: malformed header'); }
  let payload;
  try { payload = JSON.parse(fromB64url(payloadB64).toString('utf8')); }
  catch (e) { throw new Error('decodeJwsParts: malformed payload'); }
  return {
    header,
    payload,
    signingInput: `${headerB64}.${payloadB64}`,
    signature: fromB64url(sigB64),
  };
}

function verifyJws(jws, publicKey) {
  if (!publicKey) throw new Error('verifyJws: publicKey required');
  let parts;
  try { parts = decodeJwsParts(jws); }
  catch (e) { return { valid: false, reason: e.message }; }
  if (parts.header.alg !== 'EdDSA') {
    return { valid: false, reason: `unsupported alg ${parts.header.alg}`, parts };
  }
  let ok = false;
  try { ok = crypto.verify(null, Buffer.from(parts.signingInput), publicKey, parts.signature); }
  catch (e) { return { valid: false, reason: 'signature verification threw: ' + e.message, parts }; }
  return { valid: ok, parts };
}

module.exports = { encodeJws, verifyJws, decodeJwsParts };
