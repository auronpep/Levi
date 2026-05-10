'use strict';

const fs = require('node:fs');
const path = require('node:path');

const STATUSES = ['approve', 'hold', 'rewrite', 'reject'];
const ALL_LIVE_STATES = [
  'incoming', 'triaged', 'claimed', 'planning', 'awaiting_approval',
  'approved', 'rejected', 'revised', 'in_progress', 'done',
  'blocked', 'failed', 'cancelled',
];

function isString(v) { return typeof v === 'string'; }
function isNumber(v) { return typeof v === 'number' && Number.isFinite(v); }
function isBool(v)   { return typeof v === 'boolean'; }
function isObject(v) { return v != null && typeof v === 'object' && !Array.isArray(v); }
function isArray(v)  { return Array.isArray(v); }

function validateEnvelope(env) {
  const errors = [];
  if (!isObject(env)) return { ok: false, errors: ['envelope must be an object'] };

  if (env.schema !== 1) errors.push('schema must be 1');
  if (!isString(env.id)) errors.push('id must be string');
  if (!isString(env.todo_id)) errors.push('todo_id must be string');
  if (!isString(env.agent_id)) errors.push('agent_id must be string');
  if (!Number.isInteger(env.agent_version)) errors.push('agent_version must be integer');
  if (!isString(env.brief_hash) || !/^[a-f0-9]{64}$/.test(env.brief_hash)) {
    errors.push('brief_hash must be sha256 hex (64 chars)');
  }
  if (!isString(env.produced_at)) errors.push('produced_at must be ISO string');

  if (!isObject(env.payload)) {
    errors.push('payload must be object');
  } else {
    const p = env.payload;
    if (!isString(p.claim_text)) errors.push('payload.claim_text must be string');
    if (!isString(p.status) || !STATUSES.includes(p.status)) {
      errors.push(`payload.status must be one of ${STATUSES.join('|')}`);
    }
    if (!isString(p.evidence_basis)) errors.push('payload.evidence_basis must be string');
    if (!isString(p.risk_if_accepted)) errors.push('payload.risk_if_accepted must be string');
    if (!isString(p.risk_if_rejected)) errors.push('payload.risk_if_rejected must be string');
    if (!isString(p.verification_required)) errors.push('payload.verification_required must be string');
    if (!isBool(p.human_review_needed)) errors.push('payload.human_review_needed must be bool');
    if (!isArray(p.blockers)) errors.push('payload.blockers must be array');
    if (!isArray(p.trust_dimensions)) errors.push('payload.trust_dimensions must be array');
  }

  if (!isNumber(env.confidence) || env.confidence < 0 || env.confidence > 1) {
    errors.push('confidence must be number in [0, 1]');
  }
  if (!isObject(env.cost)) errors.push('cost must be object');

  return { ok: errors.length === 0, errors };
}

function findTodoFolder(joshRoot, todoId) {
  for (const s of ALL_LIVE_STATES) {
    const p = path.join(joshRoot, 'todo', s, todoId);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function envelopePath(joshRoot, todoId, agentId) {
  const folder = findTodoFolder(joshRoot, todoId);
  if (!folder) throw new Error(`todo ${todoId} not found`);
  const dir = path.join(folder, 'verdicts');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${agentId}.json`);
}

function writeEnvelope(joshRoot, todoId, envelope) {
  const v = validateEnvelope(envelope);
  if (!v.ok) {
    const err = new Error(`invalid envelope: ${v.errors.join('; ')}`);
    err.code = 'EINVAL';
    throw err;
  }
  const p = envelopePath(joshRoot, todoId, envelope.agent_id);
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(envelope, null, 2) + '\n');
  fs.renameSync(tmp, p);
  return p;
}

function readEnvelope(joshRoot, todoId, agentId) {
  const p = envelopePath(joshRoot, todoId, agentId);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function listVerdicts(joshRoot, todoId) {
  const folder = findTodoFolder(joshRoot, todoId);
  if (!folder) return [];
  const dir = path.join(folder, 'verdicts');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.json') && e.name !== 'winner.json')
    .map((e) => e.name.replace(/\.json$/, ''));
}

module.exports = {
  STATUSES,
  validateEnvelope,
  writeEnvelope,
  readEnvelope,
  listVerdicts,
  findTodoFolder,
};
