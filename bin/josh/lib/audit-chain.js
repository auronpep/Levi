'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { canonicalJson } = require('./canonical-json');
const { loadAuditKey, currentKeyId, listAuditKeys, mintAuditKey, currentAuditKeyId } = require('./audit-key');

const GENESIS_HMAC = Buffer.alloc(32, 0).toString('hex');

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function chainFile(joshRoot, dateStr) {
  return path.join(joshRoot, 'audit', `${dateStr}.jsonl`);
}

function lastHmacOnDate(joshRoot, dateStr) {
  const f = chainFile(joshRoot, dateStr);
  if (!fs.existsSync(f)) return null;
  const text = fs.readFileSync(f, 'utf8');
  const lines = text.split('\n').filter(Boolean);
  if (lines.length === 0) return null;
  // Walk backward to skip legacy/unchained tail lines (pre-Phase-6 plain audit events
  // written by appendAudit). Return the most-recent hmac found.
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const ev = JSON.parse(lines[i]);
      if (ev.hmac) return ev.hmac;
    } catch (e) {}
  }
  return null;
}

function appendChainedAudit(joshRoot, eventInput, opts = {}) {
  const date = opts.date || todayUTC();
  const file = chainFile(joshRoot, date);
  fs.mkdirSync(path.dirname(file), { recursive: true });

  // Resolve key id: use most-recent existing key, mint one if none.
  let keyId = opts.key_id;
  if (!keyId) {
    keyId = currentAuditKeyId(joshRoot);
    if (!keyId) {
      const m = mintAuditKey(joshRoot);
      keyId = m.key_id;
    }
  }
  const key = loadAuditKey(joshRoot, keyId);

  // Determine previous hmac. If file is empty, this is the genesis event.
  const prev = lastHmacOnDate(joshRoot, date) || GENESIS_HMAC;

  // Compose event with metadata; HMAC excludes the hmac field itself.
  const event = {
    schema: 1,
    ulid: eventInput.ulid || cryptoUlid(),
    ts: eventInput.ts || new Date().toISOString(),
    actor: eventInput.actor || 'orchestrator',
    kind: eventInput.kind || 'action',
    event: eventInput.event || 'noop',
    id: eventInput.id || null,
    details: eventInput.details || {},
    sig: eventInput.sig || null,
    key_id: keyId,
    prev_hmac: prev,
  };
  const canonical = canonicalJson(event);
  const hmac = crypto.createHmac('sha256', key).update(Buffer.from(prev, 'hex')).update(canonical).digest('hex');
  const finalEvent = { ...event, hmac };
  fs.appendFileSync(file, JSON.stringify(finalEvent) + '\n');
  return { hmac, key_id: keyId, date };
}

// opts.strict — treat records that carry no hmac as integrity errors.
//
// By default an hmac-less line is counted as `unchained` and tolerated, so that
// pre-Phase-6 events written by the plain appendAudit() path do not fail the
// day. The cost of that tolerance is that omitting the hmac field is enough to
// add a record the chain cannot attribute: a forged event lands in the file and
// verifyChain still answers `valid: true`. Strict mode is for the case where the
// question is "is every record in this file accounted for", not "is the chain
// self-consistent" - an audit or an incident review. Off by default, so no
// existing caller changes behaviour.
function verifyChain(joshRoot, dateStr, opts = {}) {
  const strict = !!opts.strict;
  const file = chainFile(joshRoot, dateStr);
  const errors = [];
  if (!fs.existsSync(file)) {
    return { valid: false, chain_length: 0, chained: 0, unchained: 0, errors: [{ position: 0, message: 'no chain file' }] };
  }
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  let prev = GENESIS_HMAC;
  let pos = 0;
  let chained = 0, unchained = 0;
  for (const line of lines) {
    pos++;
    let ev;
    try { ev = JSON.parse(line); }
    catch (e) { errors.push({ position: pos, message: `malformed line: ${e.message}` }); continue; }
    const stored = ev.hmac;
    // Pre-Phase-6 plain audit events have no `hmac` field. Count and skip them —
    // they're legacy, can't be cryptographically verified, but their presence is
    // NOT a chain integrity error. (Master design risk register noted this.)
    if (!stored) {
      unchained++;
      if (strict) {
        errors.push({ position: pos, message: `unchained record at line ${pos}: no hmac, cannot be attributed` });
      }
      continue;
    }
    const { hmac: _omit, ...rest } = ev;
    if (rest.prev_hmac !== prev) {
      errors.push({ position: pos, message: `prev_hmac mismatch at line ${pos}: expected ${prev.slice(0, 12)}... got ${(rest.prev_hmac || '').slice(0, 12)}...` });
    }
    let key;
    try { key = loadAuditKey(joshRoot, rest.key_id); }
    catch (e) { errors.push({ position: pos, message: `missing audit key ${rest.key_id}` }); prev = stored; chained++; continue; }
    const canonical = canonicalJson(rest);
    const computed = crypto.createHmac('sha256', key).update(Buffer.from(prev, 'hex')).update(canonical).digest('hex');
    if (computed !== stored) {
      errors.push({ position: pos, message: `hmac mismatch at line ${pos}: expected ${computed.slice(0, 12)}... got ${stored.slice(0, 12)}...` });
    }
    prev = stored;
    chained++;
  }
  return { valid: errors.length === 0, chain_length: lines.length, chained, unchained, errors };
}

// Lightweight ULID that avoids depending on josh.js.
const ULID_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function cryptoUlid(now = Date.now()) {
  let timePart = '';
  let t = now;
  for (let i = 0; i < 10; i++) { timePart = ULID_CHARS[t % 32] + timePart; t = Math.floor(t / 32); }
  let bigInt = 0n;
  for (const b of crypto.randomBytes(10)) bigInt = (bigInt << 8n) | BigInt(b);
  let randPart = '';
  for (let i = 0; i < 16; i++) { randPart = ULID_CHARS[Number(bigInt & 31n)] + randPart; bigInt >>= 5n; }
  return timePart + randPart;
}

module.exports = {
  GENESIS_HMAC,
  todayUTC,
  chainFile,
  lastHmacOnDate,
  appendChainedAudit,
  verifyChain,
};
