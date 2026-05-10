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
  return { key_id: id, path: p };
}

function loadAuditKey(joshRoot, keyId) {
  const p = keyPath(joshRoot, keyId);
  if (!fs.existsSync(p)) throw new Error(`audit key ${keyId} not found at ${p}`);
  return fs.readFileSync(p);
}

function rotateAuditKey(joshRoot, opts = {}) {
  const newId = opts.newId || currentKeyId();
  const all = listAuditKeys(joshRoot);
  const oldId = all[all.length - 1] || null;
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
  mintAuditKey,
  loadAuditKey,
  rotateAuditKey,
};
