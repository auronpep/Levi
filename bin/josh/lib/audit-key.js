'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function keysDir(joshRoot) {
  return path.join(joshRoot, 'keys');
}

function keyPath(joshRoot, keyId) {
  return path.join(keysDir(joshRoot), `audit-${keyId}.key`);
}

function listAuditKeys(joshRoot) {
  const dir = keysDir(joshRoot);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => /^audit-[A-Za-z0-9-]+\.key$/.test(f))
    .map((f) => f.replace(/^audit-/, '').replace(/\.key$/, ''))
    .sort();
}

function currentKeyId() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function currentPointerPath(joshRoot) {
  return path.join(keysDir(joshRoot), 'current');
}

// Which key new events are signed with.
//
// This used to be inferred as `listAuditKeys().pop()` - the lexicographically
// last filename. That only coincides with "most recently rotated to" while every
// id is a zero-padded date. One id that sorts high, such as `emergency`, wins
// that comparison against every future `YYYY-MM`, so it stays current forever
// and every later rotation mints a key that is never used while reporting
// success. Rotation is a security control; silently not rotating is the failure.
//
// The pointer records the rotation explicitly. Roots written before this change
// have no pointer, so the old behaviour remains as the fallback.
function currentAuditKeyId(joshRoot) {
  const p = currentPointerPath(joshRoot);
  try {
    const id = fs.readFileSync(p, 'utf8').trim();
    if (id && fs.existsSync(keyPath(joshRoot, id))) return id;
  } catch (e) { /* no pointer yet */ }
  const all = listAuditKeys(joshRoot);
  return all[all.length - 1] || null;
}

function setCurrentAuditKeyId(joshRoot, keyId) {
  const p = currentPointerPath(joshRoot);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${keyId}\n`, 'utf8');
  fs.renameSync(tmp, p);
  return keyId;
}

function mintAuditKey(joshRoot, keyId) {
  const id = keyId || currentKeyId();
  const dir = keysDir(joshRoot);
  fs.mkdirSync(dir, { recursive: true });
  const p = keyPath(joshRoot, id);
  if (fs.existsSync(p)) {
    throw new Error(`audit key ${id} already exists at ${p}`);
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(p, key, { mode: 0o600 });
  try { fs.chmodSync(p, 0o600); } catch (e) {}
  setCurrentAuditKeyId(joshRoot, id);
  return { key_id: id, path: p };
}

function loadAuditKey(joshRoot, keyId) {
  const p = keyPath(joshRoot, keyId);
  if (!fs.existsSync(p)) throw new Error(`audit key ${keyId} not found at ${p}`);
  return fs.readFileSync(p);
}

function rotateAuditKey(joshRoot, opts = {}) {
  const newId = opts.newId || currentKeyId();
  const oldId = currentAuditKeyId(joshRoot);
  if (newId === oldId) {
    throw new Error(`audit key ${newId} already current`);
  }
  if (fs.existsSync(keyPath(joshRoot, newId))) {
    throw new Error(`audit key ${newId} already exists`);
  }
  const minted = mintAuditKey(joshRoot, newId);
  return { previous_key_id: oldId, current_key_id: newId, path: minted.path };
}

module.exports = {
  keysDir,
  keyPath,
  listAuditKeys,
  currentKeyId,
  currentAuditKeyId,
  setCurrentAuditKeyId,
  mintAuditKey,
  loadAuditKey,
  rotateAuditKey,
};
