'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// PKCS#8 prefix for Ed25519 (RFC 8410). 16 bytes followed by the 32-byte raw seed.
//   30 2e               SEQUENCE (46 bytes)
//   02 01 00            version 0
//   30 05               AlgorithmIdentifier
//   06 03 2b 65 70      OID 1.3.101.112 (Ed25519)
//   04 22 04 20         OCTET STRING (34 bytes) wrapping OCTET STRING (32 bytes)
const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4 !== 0) s += '=';
  return Buffer.from(s, 'base64');
}

function derivedDID(pubRaw32) {
  if (!Buffer.isBuffer(pubRaw32) || pubRaw32.length !== 32) {
    throw new Error('derivedDID: expected 32-byte Buffer');
  }
  return 'did:key:z' + b64url(pubRaw32);
}

function rawPrivateToKeyObject(seed32) {
  if (!Buffer.isBuffer(seed32) || seed32.length !== 32) {
    throw new Error('rawPrivateToKeyObject: expected 32-byte Buffer');
  }
  return crypto.createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, seed32]),
    format: 'der',
    type: 'pkcs8',
  });
}

function rawPublicToKeyObject(pub32) {
  if (!Buffer.isBuffer(pub32) || pub32.length !== 32) {
    throw new Error('rawPublicToKeyObject: expected 32-byte Buffer');
  }
  // SPKI prefix for Ed25519: 12 bytes
  const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
  return crypto.createPublicKey({
    key: Buffer.concat([SPKI_PREFIX, pub32]),
    format: 'der',
    type: 'spki',
  });
}

function pubKeyToJwk(pub32) {
  return {
    kty: 'OKP',
    crv: 'Ed25519',
    x: b64url(pub32),
  };
}

function jwkToPubBuffer(jwk) {
  if (!jwk || jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519' || !jwk.x) {
    throw new Error('jwkToPubBuffer: invalid Ed25519 JWK');
  }
  return fromB64url(jwk.x);
}

function readManifest(joshRoot, agentId) {
  const p = path.join(joshRoot, 'agents', agentId, 'manifest.json');
  if (!fs.existsSync(p)) throw new Error(`agent ${agentId} not found at ${p}`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeManifest(joshRoot, agentId, manifest) {
  const p = path.join(joshRoot, 'agents', agentId, 'manifest.json');
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2) + '\n');
  fs.renameSync(tmp, p);
}

function mintAgentIdentity(joshRoot, agentId, opts = {}) {
  const dir = path.join(joshRoot, 'agents', agentId);
  if (!fs.existsSync(dir)) throw new Error(`agent ${agentId} not found`);
  const idPath = path.join(dir, 'identity.key');
  const pubPath = path.join(dir, 'pubkey.jwk');
  if (fs.existsSync(idPath) && !opts.rotate) {
    throw new Error(`agent ${agentId} already has identity; pass {rotate: true} to overwrite`);
  }
  // Generate keypair, extract raw 32-byte seed + raw 32-byte pub.
  const kp = crypto.generateKeyPairSync('ed25519');
  const privDer = kp.privateKey.export({ format: 'der', type: 'pkcs8' });
  const pubDer  = kp.publicKey.export({ format: 'der', type: 'spki' });
  const seed = privDer.slice(-32);
  const pub  = pubDer.slice(-32);

  fs.writeFileSync(idPath, seed, { mode: 0o600 });
  try { fs.chmodSync(idPath, 0o600); } catch (e) { /* on some Windows FS this errors silently */ }
  fs.writeFileSync(pubPath, JSON.stringify(pubKeyToJwk(pub), null, 2) + '\n');

  // Patch manifest with did + pubkey_path + (optionally) version bump.
  const did = derivedDID(pub);
  const manifest = readManifest(joshRoot, agentId);
  manifest.did = did;
  manifest.pubkey_path = 'pubkey.jwk';
  if (opts.rotate) manifest.version = (manifest.version || 1) + 1;
  writeManifest(joshRoot, agentId, manifest);

  return { did, pubkey_path: 'pubkey.jwk', version: manifest.version || 1 };
}

function loadAgentKeys(joshRoot, agentId) {
  const dir = path.join(joshRoot, 'agents', agentId);
  const idPath = path.join(dir, 'identity.key');
  const pubPath = path.join(dir, 'pubkey.jwk');
  if (!fs.existsSync(idPath)) throw new Error(`agent ${agentId} has no identity.key`);
  if (!fs.existsSync(pubPath)) throw new Error(`agent ${agentId} has no pubkey.jwk`);
  const seed = fs.readFileSync(idPath);
  const jwk = JSON.parse(fs.readFileSync(pubPath, 'utf8'));
  const pub = jwkToPubBuffer(jwk);
  return {
    privateKey: rawPrivateToKeyObject(seed),
    publicKey:  rawPublicToKeyObject(pub),
    did: derivedDID(pub),
    pub_raw: pub,
    seed_raw: seed,
  };
}

function agentBriefHash(joshRoot, agentId) {
  const manifest = readManifest(joshRoot, agentId);
  if (!manifest.source_path) throw new Error(`agent ${agentId} manifest has no source_path`);
  if (!fs.existsSync(manifest.source_path)) {
    throw new Error(`source brief missing: ${manifest.source_path}`);
  }
  return crypto.createHash('sha256').update(fs.readFileSync(manifest.source_path)).digest('hex');
}

module.exports = {
  ED25519_PKCS8_PREFIX,
  derivedDID,
  pubKeyToJwk,
  jwkToPubBuffer,
  mintAgentIdentity,
  loadAgentKeys,
  agentBriefHash,
  rawPrivateToKeyObject,
  rawPublicToKeyObject,
  b64url,
  fromB64url,
};
