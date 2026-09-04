#!/usr/bin/env node
// josh — CLI for the ~/.josh/ shared agent runtime.
// Spec: ~/.josh/README.md
//
// v0.5.0 commands:
//   josh init                — create the directory tree + initial status.json (idempotent)
//   josh status              — pretty-print status.json
//   josh push todo "title"   — drop a todo into incoming/
//   josh list todo           — list todos with filtering
//   josh show <id>           — print any artifact by ID (full or last-6 suffix)
//   josh tick                — one orchestrator heartbeat (intended for cron)
//   josh control <action>    — send a control command to the orchestrator
//   josh claim <id>          — triaged → in_progress (atomic, sets claim TTL)
//   josh complete <id>       — in_progress → done (runs verify command if defined)
//   josh fail <id>           — in_progress|triaged → failed (requires --reason)
//   josh block <id>          — in_progress|triaged → blocked (requires --depends-on)
//   josh unblock <id>        — blocked → triaged
//   josh cancel <id>         — any live state → cancelled
//   josh push handoff        — drop a message in another agent's incoming/
//   josh reply <id>          — answer a handoff; moves original to processed/
//   josh ack <id>            — mark a handoff handled without replying
//   josh list handoffs       — list handoffs (per agent, by state)
//   josh push approval       — request human-gated decision
//   josh approve <id>        — pending → done (decision=approve)
//   josh deny <id>           — pending → done (decision=deny)
//   josh list approvals      — list pending/done approvals
//
// Exit codes per spec: 0 success, 1 validation, 2 not-found, 3 lock-conflict, 4 fs-error.

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { parseArgs } = require('util');
const ew = require('./lib/events-writer');

// ─── Paths ───────────────────────────────────────────────────────────────────

const JOSH_ROOT = process.env.JOSH_ROOT || path.join(os.homedir(), '.josh');

const SUBDIRS = [
  'claude/incoming',
  'claude/outgoing',
  'claude/processed',
  'codex/incoming',
  'codex/outgoing',
  'codex/processed',
  'orchestrator/incoming',
  'orchestrator/processed',
  'todo/incoming',
  'todo/triaged',
  'todo/claimed',
  'todo/planning',
  'todo/awaiting_approval',
  'todo/approved',
  'todo/rejected',
  'todo/revised',
  'todo/in_progress',
  'todo/done',
  'todo/blocked',
  'todo/failed',
  'todo/cancelled',
  'approvals/pending',
  'approvals/done',
  'reviews/pending',
  'reviews/done',
  'locks',
  'audit',
  'shared'
];

const KNOWN_AGENTS = ['claude', 'codex', 'orchestrator'];
const HANDOFF_KINDS = ['request', 'answer', 'note'];

const VALID_PRIORITIES = ['p0', 'p1', 'p2', 'p3'];

// ─── Logging ─────────────────────────────────────────────────────────────────

function log(line) { process.stdout.write(line + '\n'); }
function err(line) { process.stderr.write(line + '\n'); }

// ─── Atomic JSON I/O ─────────────────────────────────────────────────────────

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

function writeJsonAtomic(p, obj) {
  const tmp = p + '.tmp';
  const content = JSON.stringify(obj, null, 2) + '\n';
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, p);
}

// ─── ULID ────────────────────────────────────────────────────────────────────
// Crockford base32, 26 chars, time-sortable. 48-bit time + 80-bit random.

const ULID_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function ulid(now = Date.now()) {
  let timePart = '';
  let t = now;
  for (let i = 0; i < 10; i++) {
    timePart = ULID_CHARS[t % 32] + timePart;
    t = Math.floor(t / 32);
  }
  let bigInt = 0n;
  for (const b of crypto.randomBytes(10)) bigInt = (bigInt << 8n) | BigInt(b);
  let randPart = '';
  for (let i = 0; i < 16; i++) {
    randPart = ULID_CHARS[Number(bigInt & 31n)] + randPart;
    bigInt >>= 5n;
  }
  return timePart + randPart;
}

// ─── Audit log ───────────────────────────────────────────────────────────────

function appendAudit(event) {
  try {
    const date = new Date().toISOString().slice(0, 10);
    const auditFile = path.join(JOSH_ROOT, 'audit', `${date}.jsonl`);
    const line = JSON.stringify({ at: new Date().toISOString(), ...event }) + '\n';
    fs.appendFileSync(auditFile, line, 'utf8');
  } catch (e) {
    // Don't fail the operation if audit write breaks.
    err(`warn: audit write failed: ${e.message}`);
  }
}

// ─── Counters & status board ─────────────────────────────────────────────────

function countDir(p) {
  try { return fs.readdirSync(p).filter(f => !f.startsWith('.') && !f.endsWith('.tmp')).length; }
  catch (e) { return 0; }
}

function refreshQueueCounts(status) {
  status.queue = {
    incoming:           countDir(path.join(JOSH_ROOT, 'todo', 'incoming')),
    triaged:            countDir(path.join(JOSH_ROOT, 'todo', 'triaged')),
    in_progress:        countDir(path.join(JOSH_ROOT, 'todo', 'in_progress')),
    blocked:            countDir(path.join(JOSH_ROOT, 'todo', 'blocked')),
    failed:             countDir(path.join(JOSH_ROOT, 'todo', 'failed')),
    approvals_pending:  countDir(path.join(JOSH_ROOT, 'approvals', 'pending')),
    reviews_pending:    countDir(path.join(JOSH_ROOT, 'reviews', 'pending'))
  };
  return status;
}

function emptyStatus() {
  return {
    schema: 1,
    updated_at: new Date().toISOString(),
    agents: {
      claude_code:  { alive: false, last_seen: null, current_task: null },
      codex:        { alive: false, last_seen: null, current_task: null },
      orchestrator: { alive: false, last_tick: null, tick_count: 0, interval_sec: 300 }
    },
    queue: {
      incoming: 0, triaged: 0, in_progress: 0, blocked: 0, failed: 0,
      approvals_pending: 0, reviews_pending: 0
    }
  };
}

// ─── Helpers: age, find by id ────────────────────────────────────────────────

function formatAge(isoString) {
  const d = Date.now() - new Date(isoString).getTime();
  const sec = Math.max(0, Math.floor(d / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function* walkTree(dir, depth = 0, maxDepth = 4) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && depth < maxDepth) yield* walkTree(full, depth + 1, maxDepth);
    else if (e.isFile()) yield full;
  }
}

function findById(id) {
  // Match exact `<id>.json|md` OR last-N-char suffix (e.g. `josh show ABC123`).
  const exactJson = `${id}.json`;
  const exactMd = `${id}.md`;
  let suffixHit = null;
  for (const file of walkTree(JOSH_ROOT)) {
    const base = path.basename(file);
    if (base === exactJson || base === exactMd) {
      return { path: file, relative: path.relative(JOSH_ROOT, file).replace(/\\/g, '/') };
    }
    if (id.length >= 4 && id.length < 26) {
      const noExt = base.replace(/\.(json|md)$/, '');
      if (noExt.endsWith(id) && (base.endsWith('.json') || base.endsWith('.md'))) {
        // Keep first hit; if multiple, that's a collision worth reporting.
        if (!suffixHit) suffixHit = { path: file, relative: path.relative(JOSH_ROOT, file).replace(/\\/g, '/') };
        else suffixHit.collision = true;
      }
    }
  }
  return suffixHit;
}

function findTodoFolderById(idOrSuffix) {
  // Returns { path, folder, relative } where path → meta.json, OR null.
  const ALL_STATES = [
    'incoming', 'triaged', 'claimed', 'planning', 'awaiting_approval',
    'approved', 'rejected', 'revised', 'in_progress', 'done',
    'blocked', 'failed', 'cancelled',
  ];
  let exactHit = null;
  let suffixHit = null;
  for (const state of ALL_STATES) {
    const dir = path.join(JOSH_ROOT, 'todo', state);
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { continue; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name === idOrSuffix) {
        exactHit = { state, id: e.name };
        break;
      }
      if (idOrSuffix.length >= 4 && idOrSuffix.length < 26 && e.name.endsWith(idOrSuffix)) {
        if (!suffixHit) suffixHit = { state, id: e.name };
      }
    }
    if (exactHit) break;
  }
  const hit = exactHit || suffixHit;
  if (!hit) return null;
  return {
    path: path.join(JOSH_ROOT, 'todo', hit.state, hit.id, 'meta.json'),
    folder: path.join(JOSH_ROOT, 'todo', hit.state, hit.id),
    relative: `todo/${hit.state}/${hit.id}`,
  };
}

// ─── Default actor (for created_by when --created-by not given) ──────────────

function defaultActor() {
  if (process.env.JOSH_ACTOR) return process.env.JOSH_ACTOR;
  return `cli:${os.userInfo().username}`;
}

// Every mutate op accepts both --actor and --as. Pick whichever the caller
// passed (same field, different name; --as reads naturally for claim/complete).
function resolveActor(values) {
  return values.actor || values.as || defaultActor();
}

// ─── Handoff & approval locators ─────────────────────────────────────────────

function locateHandoff(idOrSuffix) {
  const found = findById(idOrSuffix);
  if (!found) return { error: 'not found', code: 2 };
  const rel = found.relative.replace(/\\/g, '/');
  const parts = rel.split('/');
  if (parts.length !== 3) return { error: `not an agent-inbox path: ${rel}`, code: 1 };
  const [agent, state, file] = parts;
  if (!KNOWN_AGENTS.includes(agent)) return { error: `not in an agent dir: ${rel}`, code: 1 };
  if (!['incoming', 'processed'].includes(state)) {
    return { error: `expected agent/incoming or agent/processed, got: ${rel}`, code: 1 };
  }
  return {
    path: found.path,
    agent,
    state,
    id: file.replace(/\.json$/, ''),
    relative: rel
  };
}

function locateApproval(idOrSuffix) {
  const found = findById(idOrSuffix);
  if (!found) return { error: 'not found', code: 2 };
  const rel = found.relative.replace(/\\/g, '/');
  const parts = rel.split('/');
  if (parts.length !== 3 || parts[0] !== 'approvals') {
    return { error: `not an approval: ${rel}`, code: 1 };
  }
  return {
    path: found.path,
    state: parts[1],
    id: parts[2].replace(/\.json$/, ''),
    relative: rel
  };
}

function locateReview(idOrSuffix) {
  const found = findById(idOrSuffix);
  if (!found) return { error: 'not found', code: 2 };
  const rel = found.relative.replace(/\\/g, '/');
  const parts = rel.split('/');
  if (parts.length !== 3 || parts[0] !== 'reviews') {
    return { error: `not a review: ${rel}`, code: 1 };
  }
  return {
    path: found.path,
    state: parts[1],
    id: parts[2].replace(/\.json$/, ''),
    relative: rel
  };
}

const VALID_REVIEW_VERDICTS = ['approve', 'request_changes', 'block'];
const VALID_SUBJECT_TYPES   = ['pr', 'file', 'approach', 'todo'];
const VALID_FRAMINGS        = ['regular', 'adversarial'];

// ─── Mutate-op helpers ───────────────────────────────────────────────────────

function errExit(msg, code) { err(`error: ${msg}`); return code; }

// Locate a todo by full ID or last-N suffix and return its current state.
// expectedStates: array of allowed states; if provided and not matched, returns error.
function locateTodo(idOrSuffix, expectedStates) {
  // Folder layout: ~/.josh/todo/<state>/<id>/meta.json
  const ALL_STATES = [
    'incoming', 'triaged', 'claimed', 'planning', 'awaiting_approval',
    'approved', 'rejected', 'revised', 'in_progress', 'done',
    'blocked', 'failed', 'cancelled',
  ];
  let exactHit = null;
  let suffixHit = null;
  for (const state of ALL_STATES) {
    const dir = path.join(JOSH_ROOT, 'todo', state);
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { continue; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name === idOrSuffix) {
        exactHit = { state, id: e.name };
        break;
      }
      if (idOrSuffix.length >= 4 && idOrSuffix.length < 26 && e.name.endsWith(idOrSuffix)) {
        if (!suffixHit) suffixHit = { state, id: e.name };
        else suffixHit.collision = true;
      }
    }
    if (exactHit) break;
  }
  const hit = exactHit || suffixHit;
  if (!hit) return { error: 'not found', code: 2 };
  if (expectedStates && !expectedStates.includes(hit.state)) {
    return { error: `todo is in state '${hit.state}', expected one of: ${expectedStates.join(', ')}`, code: 1 };
  }
  return {
    path: path.join(JOSH_ROOT, 'todo', hit.state, hit.id, 'meta.json'),
    folder: path.join(JOSH_ROOT, 'todo', hit.state, hit.id),
    state: hit.state,
    id: hit.id,
    relative: `todo/${hit.state}/${hit.id}`,
  };
}

// Atomic move from src state to dst state. Returns 0 on success or error code.
// On success, calls update(todo) to mutate the file in place (after move).
function transitionTodo({ src, dst, srcStates, idOrSuffix, actor, eventName, eventDetails, update, audit }) {
  const located = locateTodo(idOrSuffix, srcStates);
  if (located.error) return { code: located.code, error: located.error };

  const fromDir = located.folder;
  const toDir = path.join(JOSH_ROOT, 'todo', dst, located.id);
  if (fs.existsSync(toDir)) {
    return { code: 4, error: `target already exists: todo/${dst}/${located.id}` };
  }

  // Atomic rename of the entire folder = lock acquisition.
  try {
    fs.mkdirSync(path.dirname(toDir), { recursive: true });
    fs.renameSync(fromDir, toDir);
  } catch (e) {
    if (e.code === 'ENOENT') return { code: 3, error: `todo no longer in ${located.state} (race?)` };
    if (e.code === 'EEXIST' || e.code === 'EPERM' || e.code === 'EACCES') {
      return { code: 4, error: `rename failed: ${e.message}` };
    }
    throw e;
  }

  // We own the folder at toDir. Read meta, mutate, write.
  // If anything in this block fails (malformed meta, update() throws, write fails),
  // best-effort rename the folder back to fromDir so the state machine isn't
  // left with a todo physically in dst/ but no audit/event record of the move.
  const metaPath = path.join(toDir, 'meta.json');
  let todo;
  try {
    todo = readJson(metaPath);
    if (!todo) {
      const e = new Error(`malformed meta.json at ${dst}/${located.id}`);
      e.code = 4;
      throw e;
    }
    todo.history = todo.history || [];
    const now = new Date().toISOString();
    todo.history.push({ at: now, actor, event: eventName, details: eventDetails || {} });
    if (typeof update === 'function') update(todo, now);
    writeJsonAtomic(metaPath, todo);
    // Sync the one-line state file.
    try { fs.writeFileSync(path.join(toDir, 'state'), dst + '\n', 'utf8'); } catch (e) { /* non-fatal */ }
  } catch (e) {
    // Rollback: undo the rename so the todo isn't stranded in dst/.
    let rollbackErr = null;
    try { fs.renameSync(toDir, fromDir); } catch (re) { rollbackErr = re; }
    const msg = e && e.message ? e.message : String(e);
    if (rollbackErr) {
      err(`transitionTodo rollback also failed for ${located.id}: ${rollbackErr.message}`);
    }
    return { code: (e && e.code === 4) ? 4 : 4, error: msg };
  }

  // Lifecycle event: every transition emits a "start" event in the new state's folder.
  // Best-effort — never fail the transition over a missing event line.
  try {
    ew.appendEvent(JOSH_ROOT, dst, located.id, {
      kind: 'start',
      state: dst,
      from: located.state,
      actor,
      event: eventName,
    });
  } catch (e) { /* non-fatal */ }

  if (audit) appendAudit({ actor, action: audit.action, id: located.id, details: audit.details || {} });

  return { code: 0, id: located.id, todo };
}

// ─── Orchestrator helpers ────────────────────────────────────────────────────

const DEFAULT_INTERVAL_SEC = 300;
const PAUSED_FLAG  = () => path.join(JOSH_ROOT, 'orchestrator', '.paused');
const DRAIN_FLAG   = () => path.join(JOSH_ROOT, 'orchestrator', '.draining');
const LOCK_PATH    = () => path.join(JOSH_ROOT, 'orchestrator', 'orchestrator.lock');

function readStatus() {
  return readJson(path.join(JOSH_ROOT, 'status.json')) || emptyStatus();
}

function writeStatus(status) {
  writeJsonAtomic(path.join(JOSH_ROOT, 'status.json'), status);
}

function getInterval() {
  const s = readStatus();
  return s.agents?.orchestrator?.interval_sec || DEFAULT_INTERVAL_SEC;
}

function lockAcquire() {
  // Atomic create-if-not-exists. Returns true on success, false if held.
  const lockFile = LOCK_PATH();
  const interval = getInterval();
  const lockTtlMs = interval * 2 * 1000;
  const now = Date.now();

  // Stale-lock check (best-effort, then atomic-write).
  if (fs.existsSync(lockFile)) {
    const existing = readJson(lockFile);
    if (existing && existing.acquired_at) {
      const age = now - new Date(existing.acquired_at).getTime();
      if (age < lockTtlMs) return false; // fresh lock held by another tick
    }
    // Stale or unparseable; remove and try to acquire.
    try { fs.unlinkSync(lockFile); } catch (e) { /* race: someone else removed */ }
  }

  try {
    fs.writeFileSync(
      lockFile,
      JSON.stringify({
        pid: process.pid,
        acquired_at: new Date(now).toISOString(),
        host: os.hostname()
      }, null, 2),
      { flag: 'wx', mode: 0o600 }
    );
    return true;
  } catch (e) {
    // EEXIST means another tick won the race
    return false;
  }
}

function lockRelease() {
  try { fs.unlinkSync(LOCK_PATH()); } catch (e) { /* already gone */ }
}

function isPaused()   { return fs.existsSync(PAUSED_FLAG()); }
function isDraining() { return fs.existsSync(DRAIN_FLAG()); }

function listJsonIn(dir) {
  try {
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.json') && !f.endsWith('.tmp'))
      .map(f => ({ path: path.join(dir, f), name: f }));
  } catch (e) { return []; }
}

function moveTodo(fromMetaPath, toState, todo) {
  // fromMetaPath is a path to ~/.josh/todo/<state>/<id>/meta.json.
  const fromDir = path.dirname(fromMetaPath);
  const id = todo.id;
  const toDir = path.join(JOSH_ROOT, 'todo', toState, id);
  // Re-write meta with updated history first, then rename the folder.
  writeJsonAtomic(fromMetaPath, todo);
  fs.mkdirSync(path.dirname(toDir), { recursive: true });
  fs.renameSync(fromDir, toDir);
  try { fs.writeFileSync(path.join(toDir, 'state'), toState + '\n', 'utf8'); } catch (e) { /* non-fatal */ }
}

// Read routing config from ~/.josh/orchestrator/routing.json. Returns null if missing.
// Schema:
//   { "schema": 1, "rules": [ { "if_labels": ["test"], "agent": "codex" }, ... ] }
function readRoutingConfig() {
  const cfgPath = path.join(JOSH_ROOT, 'orchestrator', 'routing.json');
  if (!fs.existsSync(cfgPath)) return null;
  return readJson(cfgPath);
}

// If todo.agent is 'auto' AND routing rules match labels, suggest a better agent.
// Returns { agent, matched_rule } or { agent: 'auto' } if no rule matches.
function applyRouting(todo, cfg) {
  if (todo.agent && todo.agent !== 'auto') return { agent: todo.agent };
  if (!cfg || !Array.isArray(cfg.rules)) return { agent: 'auto' };
  const labels = new Set(todo.labels || []);
  for (const rule of cfg.rules) {
    if (!Array.isArray(rule.if_labels) || !rule.agent) continue;
    if (rule.if_labels.some((l) => labels.has(l))) {
      return { agent: rule.agent, matched_rule: rule.if_labels.join(',') };
    }
  }
  return { agent: cfg.default_agent || 'auto' };
}

function triageOne(folderEntry, opts, routingCfg) {
  // folderEntry: { dir, id }  where dir is full path to the per-todo folder under incoming/
  const metaPath = path.join(folderEntry.dir, 'meta.json');
  const todo = readJson(metaPath);
  if (!todo) {
    err(`warn: skipping malformed ${metaPath}; moving folder to failed/`);
    const failedDir = path.join(JOSH_ROOT, 'todo', 'failed', folderEntry.id);
    try {
      fs.mkdirSync(path.dirname(failedDir), { recursive: true });
      fs.renameSync(folderEntry.dir, failedDir);
    } catch (e) {}
    appendAudit({ actor: 'orchestrator', action: 'todo.malformed', id: folderEntry.id, details: {} });
    return { result: 'malformed' };
  }
  const now = new Date().toISOString();

  // Smart routing: if agent is 'auto', try to map labels → agent.
  const route = applyRouting(todo, routingCfg);
  let routedFrom = null;
  if (route.agent !== todo.agent) {
    routedFrom = todo.agent;
    todo.agent = route.agent;
  }

  todo.history = todo.history || [];
  todo.history.push({
    at: now,
    actor: 'orchestrator',
    event: 'triaged',
    ...(routedFrom !== null
      ? { details: { routed_from: routedFrom, routed_to: route.agent, matched_rule: route.matched_rule || null } }
      : {})
  });
  moveTodo(metaPath, 'triaged', todo);
  appendAudit({
    actor: 'orchestrator',
    action: 'todo.triaged',
    id: todo.id,
    details: {
      agent: todo.agent,
      priority: todo.priority,
      ...(routedFrom !== null ? { routed_from: routedFrom, matched_rule: route.matched_rule || null } : {})
    }
  });
  return { result: 'triaged', id: todo.id, routed: routedFrom !== null };
}

// Apply default decision to approvals whose default_after_sec has elapsed.
// Returns count of expired/decided.
function expireApprovals() {
  let expired = 0;
  const dir = path.join(JOSH_ROOT, 'approvals', 'pending');
  for (const file of listJsonIn(dir)) {
    const a = readJson(file.path);
    if (!a) continue;
    if (!a.default_after_sec || !a.default_choice || !a.created_at) continue;
    const expiresAt = new Date(a.created_at).getTime() + a.default_after_sec * 1000;
    if (Date.now() < expiresAt) continue;

    // Apply default decision: atomic move pending → done.
    const toPath = path.join(JOSH_ROOT, 'approvals', 'done', `${a.id}.json`);
    try { fs.renameSync(file.path, toPath); }
    catch (e) {
      if (e.code === 'ENOENT') continue; // someone else handled it
      err(`warn: expireApprovals failed for ${a.id}: ${e.message}`);
      continue;
    }

    const updated = readJson(toPath) || a;
    const now = new Date().toISOString();
    updated.decision = a.default_choice;
    updated.decided_at = now;
    updated.decided_by = 'orchestrator:auto-expired';
    updated.expired = true;
    updated.history = updated.history || [];
    updated.history.push({
      at: now,
      actor: 'orchestrator',
      event: 'auto_expired',
      details: { applied: a.default_choice, after_sec: a.default_after_sec }
    });
    writeJsonAtomic(toPath, updated);

    appendAudit({
      actor: 'orchestrator',
      action: 'approval.expired',
      id: a.id,
      details: { applied: a.default_choice, after_sec: a.default_after_sec }
    });
    expired++;
  }
  return expired;
}

function sweepStaleClaims(opts) {
  let swept = 0;
  const { currentHost } = require('./lib/host');
  const myHost = currentHost();
  const dir = path.join(JOSH_ROOT, 'todo', 'in_progress');
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) {}
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const metaPath = path.join(dir, e.name, 'meta.json');
    const todo = readJson(metaPath);
    if (!todo) continue;
    if (!todo.claim || !todo.claim.at || !todo.claim.ttl_sec) continue;
    // Phase 10: only sweep claims tagged with this host (cross-host claim hygiene).
    // Backward-compat: claims without `host` field are eligible (pre-Phase-10 data).
    if (todo.claim.host && todo.claim.host !== myHost) continue;
    const claimAt = new Date(todo.claim.at).getTime();
    const expiresAt = claimAt + todo.claim.ttl_sec * 1000;
    if (Date.now() < expiresAt) continue;
    const previousHolder = todo.claim.by;
    const previousTtl = todo.claim.ttl_sec;
    todo.claim = null;
    todo.history = todo.history || [];
    todo.history.push({
      at: new Date().toISOString(),
      actor: 'orchestrator',
      event: 'claim_expired',
      details: { previous_holder: previousHolder, ttl_sec: previousTtl }
    });
    moveTodo(metaPath, 'triaged', todo);
    appendAudit({
      actor: 'orchestrator',
      action: 'todo.claim_expired',
      id: todo.id,
      details: { previous_holder: previousHolder, ttl_sec: previousTtl }
    });
    swept++;
  }
  return swept;
}

function promoteApproved() {
  let promoted = 0;
  let throttled = 0;
  const dir = path.join(JOSH_ROOT, 'todo', 'approved');
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return { promoted, throttled }; }
  const { checkBackpressure } = require('./lib/backpressure');
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const id = e.name;
    const folder = path.join(dir, id);
    // Confirm approval signal == "approved" before promoting.
    const signalPath = path.join(folder, 'approval');
    let signal = '';
    try { signal = fs.readFileSync(signalPath, 'utf8').trim(); } catch (err) {}
    if (signal !== 'approved') continue;
    const metaPath = path.join(folder, 'meta.json');
    const todo = readJson(metaPath);
    if (!todo) continue;
    // Phase 3: backpressure gate.
    const bp = checkBackpressure(JOSH_ROOT, todo);
    if (!bp.ok) { throttled++; continue; }
    todo.history = todo.history || [];
    todo.history.push({
      at: new Date().toISOString(),
      actor: 'orchestrator',
      event: 'auto_promoted',
      details: { from: 'approved', to: 'in_progress' },
    });
    moveTodo(metaPath, 'in_progress', todo);
    appendAudit({
      actor: 'orchestrator',
      action: 'todo.auto_promoted',
      id: todo.id,
      details: { from: 'approved', to: 'in_progress' },
    });
    promoted++;
  }
  return { promoted, throttled };
}

// Phase 4: scan in_progress todos for matrix lifecycle work.
//   - For each todo with verdicts/<agent>.json files matching meta.matrix_candidates count,
//     if winner.json absent and not yet queued for adjudication, enqueueAdjudication().
//   - For each todo whose winner.json was just written (history lacks 'winner_materialized'),
//     materializeWinner() + updateTrust() per candidate + history mark.
//   - Auto-accept fast-path: if any envelope qualifies, materialize that agent as winner directly.
function sweepMatrix() {
  let queued = 0;
  let winners_materialized = 0;
  let auto_accepted = 0;
  const { listVerdicts, readEnvelope } = require('./lib/verdict-envelope');
  const { enqueueAdjudication, materializeWinner } = require('./lib/adjudicator');
  const { applyAutoAccept } = require('./lib/trigger-tokens');
  const { updateTrust } = require('./lib/trust');

  const inProgressDir = path.join(JOSH_ROOT, 'todo', 'in_progress');
  let entries = [];
  try { entries = fs.readdirSync(inProgressDir, { withFileTypes: true }); }
  catch (e) { return { queued, winners_materialized, auto_accepted }; }

  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const todoId = e.name;
    const folder = path.join(inProgressDir, todoId);
    const metaPath = path.join(folder, 'meta.json');
    const todo = readJson(metaPath);
    if (!todo) continue;
    const winnerFile = path.join(folder, 'verdicts', 'winner.json');
    const candidates = todo.matrix_candidates || [];

    // Step A: winner present but not yet materialized?
    if (fs.existsSync(winnerFile)) {
      const alreadyMaterialized = (todo.history || []).some((h) => h.event === 'winner_materialized');
      if (!alreadyMaterialized) {
        try {
          const w = JSON.parse(fs.readFileSync(winnerFile, 'utf8'));
          // winner.json may be the wrapper (Phase 4 shape) or a raw winnerJson from E08; handle both.
          const winnerJson = w.envelope ? { schema: 1, winner_id: w.winner_id, synthesis_notes: w.synthesis_notes, confidence: w.adjudicator_confidence }
                                        : w;
          // Only call materializeWinner if it hasn't already been (heuristic: dissent dir empty).
          const dissentDir = path.join(folder, 'verdicts', 'dissent');
          if (!fs.existsSync(dissentDir)) {
            materializeWinner(JOSH_ROOT, todoId, winnerJson);
          }
          // Trust update for every candidate.
          for (const agentId of candidates) {
            try {
              const env = readEnvelope(JOSH_ROOT, todoId, agentId);
              const dims = (env.payload && env.payload.trust_dimensions) || [];
              const agreed = (agentId === winnerJson.winner_id) ? dims : [];
              updateTrust(JOSH_ROOT, agentId, dims, agreed);
            } catch (err) { /* envelope missing — skip */ }
          }
          // Mark history.
          todo.history = todo.history || [];
          todo.history.push({
            at: new Date().toISOString(),
            actor: 'orchestrator',
            event: 'winner_materialized',
            details: { winner: winnerJson.winner_id },
          });
          writeJsonAtomic(metaPath, todo);
          appendAudit({
            actor: 'orchestrator',
            action: 'matrix.winner_picked',
            id: todoId,
            details: { winner: winnerJson.winner_id, candidates },
          });
          winners_materialized++;
        } catch (err) {
          err && err.message && process.stderr.write(`warn: matrix winner materialize for ${todoId}: ${err.message}\n`);
        }
      }
      continue;
    }

    // Step B: auto-accept fast path or N envelopes → enqueue adjudication.
    const have = listVerdicts(JOSH_ROOT, todoId);
    if (have.length === 0) continue;

    // Auto-accept: any single envelope that qualifies.
    let autoAcceptDone = false;
    for (const a of have) {
      try {
        const env = readEnvelope(JOSH_ROOT, todoId, a);
        const r = applyAutoAccept(env, todo);
        if (r.accept) {
          // Synthesize a winnerJson directly.
          const winnerJson = {
            schema: 1,
            winner_id: a,
            synthesis_notes: `auto-accepted: ${r.reason}`,
            confidence: env.confidence,
          };
          // Write winner.json wrapper now so the next iteration would materialize, but do it inline.
          fs.writeFileSync(winnerFile, JSON.stringify({
            schema: 1, winner_id: a,
            envelope: env,
            synthesis_notes: winnerJson.synthesis_notes,
            adjudicator_confidence: env.confidence,
            materialized_at: new Date().toISOString(),
          }, null, 2));
          materializeWinner(JOSH_ROOT, todoId, winnerJson);
          for (const agentId of (have)) {
            try {
              const e2 = readEnvelope(JOSH_ROOT, todoId, agentId);
              const dims = (e2.payload && e2.payload.trust_dimensions) || [];
              const agreed = (agentId === a) ? dims : [];
              updateTrust(JOSH_ROOT, agentId, dims, agreed);
            } catch (e2err) {}
          }
          todo.history = todo.history || [];
          todo.history.push({
            at: new Date().toISOString(),
            actor: 'orchestrator',
            event: 'winner_materialized',
            details: { winner: a, auto_accepted: true },
          });
          writeJsonAtomic(metaPath, todo);
          appendAudit({ actor: 'orchestrator', action: 'matrix.auto_accepted', id: todoId, details: { agent: a } });
          auto_accepted++;
          autoAcceptDone = true;
          break;
        }
      } catch (err) { /* skip */ }
    }
    if (autoAcceptDone) continue;

    // Standard: N envelopes (default 3) ready → enqueue.
    const N = (todo.matrix_n || candidates.length || 3);
    if (have.length >= N) {
      const alreadyQueued = (todo.history || []).some((h) => h.event === 'matrix_queued');
      if (alreadyQueued) continue;
      try {
        const r = enqueueAdjudication(JOSH_ROOT, todoId, have.slice(0, N));
        todo.history = todo.history || [];
        todo.history.push({
          at: new Date().toISOString(),
          actor: 'orchestrator',
          event: 'matrix_queued',
          details: { adjudication_id: r.adjudication_id, candidates: have.slice(0, N) },
        });
        writeJsonAtomic(metaPath, todo);
        appendAudit({ actor: 'orchestrator', action: 'matrix.adjudication_queued', id: todoId, details: { adj: r.adjudication_id } });
        queued++;
      } catch (err) {
        process.stderr.write(`warn: enqueueAdjudication for ${todoId}: ${err.message}\n`);
      }
    }
  }
  return { queued, winners_materialized, auto_accepted };
}

function processControlOne(file) {
  const ctrl = readJson(file.path);
  // Always remove the file, even on parse error.
  try { fs.unlinkSync(file.path); } catch (e) {}
  if (!ctrl || !ctrl.action) {
    appendAudit({ actor: 'orchestrator', action: 'control.malformed', id: file.name, details: {} });
    return;
  }
  const action = ctrl.action;
  switch (action) {
    case 'pause':
      try { fs.writeFileSync(PAUSED_FLAG(), new Date().toISOString()); } catch (e) {}
      appendAudit({ actor: 'orchestrator', action: 'control.paused', id: ctrl.id, details: {} });
      return;
    case 'resume':
      try { fs.unlinkSync(PAUSED_FLAG()); } catch (e) {}
      appendAudit({ actor: 'orchestrator', action: 'control.resumed', id: ctrl.id, details: {} });
      return;
    case 'drain':
      try { fs.writeFileSync(DRAIN_FLAG(), new Date().toISOString()); } catch (e) {}
      appendAudit({ actor: 'orchestrator', action: 'control.draining', id: ctrl.id, details: {} });
      return;
    case 'undrain':
      try { fs.unlinkSync(DRAIN_FLAG()); } catch (e) {}
      appendAudit({ actor: 'orchestrator', action: 'control.undrained', id: ctrl.id, details: {} });
      return;
    case 'sweep_now':
      // Already swept by main tick; nothing to do here.
      appendAudit({ actor: 'orchestrator', action: 'control.sweep_now', id: ctrl.id, details: {} });
      return;
    case 'set_interval': {
      const sec = parseInt(ctrl.interval_sec, 10);
      if (!Number.isFinite(sec) || sec < 10 || sec > 86400) {
        appendAudit({ actor: 'orchestrator', action: 'control.invalid', id: ctrl.id, details: { reason: 'interval out of range', value: ctrl.interval_sec } });
        return;
      }
      const status = readStatus();
      status.agents.orchestrator.interval_sec = sec;
      writeStatus(status);
      appendAudit({ actor: 'orchestrator', action: 'control.set_interval', id: ctrl.id, details: { interval_sec: sec } });
      return;
    }
    case 'reorder': {
      // Find the todo by id and update priority. Search all live states.
      const todoId = ctrl.todo_id;
      const newPri = ctrl.new_priority;
      if (!todoId || !VALID_PRIORITIES.includes(newPri)) {
        appendAudit({ actor: 'orchestrator', action: 'control.invalid', id: ctrl.id, details: { reason: 'bad reorder args' } });
        return;
      }
      let touched = false;
      for (const state of ['incoming', 'triaged', 'blocked']) {
        const metaPath = path.join(JOSH_ROOT, 'todo', state, todoId, 'meta.json');
        if (!fs.existsSync(metaPath)) continue;
        const todo = readJson(metaPath);
        if (!todo) continue;
        const oldPri = todo.priority;
        todo.priority = newPri;
        todo.history.push({ at: new Date().toISOString(), actor: 'orchestrator', event: 'reordered', details: { from: oldPri, to: newPri } });
        writeJsonAtomic(metaPath, todo);
        touched = true;
        appendAudit({ actor: 'orchestrator', action: 'todo.reordered', id: todoId, details: { from: oldPri, to: newPri } });
        break;
      }
      if (!touched) {
        appendAudit({ actor: 'orchestrator', action: 'control.invalid', id: ctrl.id, details: { reason: 'todo not found in live states', todo_id: todoId } });
      }
      return;
    }
    default:
      appendAudit({ actor: 'orchestrator', action: 'control.unknown', id: ctrl.id, details: { action } });
  }
}

function processAllControls() {
  let count = 0;
  for (const f of listJsonIn(path.join(JOSH_ROOT, 'orchestrator', 'incoming'))) {
    processControlOne(f);
    count++;
  }
  return count;
}

// ─── Commands ────────────────────────────────────────────────────────────────

function cmdInit() {
  if (!fs.existsSync(JOSH_ROOT)) {
    fs.mkdirSync(JOSH_ROOT, { recursive: true });
    log(`created  ${JOSH_ROOT}`);
  }

  const readmePath = path.join(JOSH_ROOT, 'README.md');
  if (!fs.existsSync(readmePath)) {
    err(`warn: no README.md at ${readmePath} — initializing tree without spec.`);
  }

  let created = 0, existed = 0;
  for (const sub of SUBDIRS) {
    const full = path.join(JOSH_ROOT, sub);
    if (fs.existsSync(full)) { existed++; }
    else {
      fs.mkdirSync(full, { recursive: true });
      log(`created  ${path.relative(JOSH_ROOT, full).replace(/\\/g, '/')}/`);
      created++;
    }
  }

  const statusPath = path.join(JOSH_ROOT, 'status.json');
  if (!fs.existsSync(statusPath)) {
    writeJsonAtomic(statusPath, emptyStatus());
    log(`created  status.json`);
  } else {
    log(`existed  status.json`);
  }

  for (const agent of ['claude', 'codex', 'orchestrator']) {
    const p = path.join(JOSH_ROOT, agent, 'status.json');
    if (!fs.existsSync(p)) {
      writeJsonAtomic(p, {
        schema: 1, agent, alive: false, last_seen: null, current_task: null, session_id: null
      });
      log(`created  ${agent}/status.json`);
    }
  }

  log('');
  log(`done. ${created} created, ${existed} already existed. root: ${JOSH_ROOT}`);
  return 0;
}

function cmdStatus() {
  const statusPath = path.join(JOSH_ROOT, 'status.json');
  const status = readJson(statusPath);
  if (!status) {
    err(`error: ${statusPath} not found or invalid. run 'josh init' first.`);
    return 2;
  }
  refreshQueueCounts(status);

  log(`josh status — ${JOSH_ROOT}`);
  log(`updated: ${status.updated_at}`);
  log('');
  log('agents:');
  for (const [name, a] of Object.entries(status.agents)) {
    const alive = a.alive ? 'alive' : 'idle';
    const seen = a.last_seen || a.last_tick || '—';
    const task = a.current_task ? ` :: ${a.current_task}` : '';
    log(`  ${name.padEnd(15)} ${alive.padEnd(6)} ${seen}${task}`);
  }
  log('');
  log('queue:');
  for (const [k, v] of Object.entries(status.queue)) {
    log(`  ${k.padEnd(18)} ${v}`);
  }
  return 0;
}

function cmdPush(args) {
  const subtype = args[0];
  if (!subtype) {
    err('error: artifact type required. usage: josh push <todo> [args]');
    return 1;
  }
  const subArgs = args.slice(1);
  switch (subtype) {
    case 'todo':     return cmdPushTodo(subArgs);
    case 'handoff':  return cmdPushHandoff(subArgs);
    case 'approval': return cmdPushApproval(subArgs);
    case 'review':   return cmdPushReview(subArgs);
    default:
      err(`unknown artifact type: ${subtype}`);
      err(`supported: todo, handoff, approval, review`);
      return 1;
  }
}

function cmdPushTodo(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        priority:     { type: 'string' },
        agent:        { type: 'string' },
        label:        { type: 'string' },
        due:          { type: 'string' },
        verify:       { type: 'string' },
        description:  { type: 'string' },
        repo:         { type: 'string' },
        branch:       { type: 'string' },
        'created-by': { type: 'string' },
        'depends-on': { type: 'string' }
      },
      allowPositionals: true,
      strict: true
    });
  } catch (e) {
    err(`error: ${e.message}`);
    return 1;
  }

  const title = parsed.positionals.join(' ').trim();
  if (!title) {
    err('error: title required. usage: josh push todo "title" [flags]');
    return 1;
  }

  const priority = parsed.values.priority || 'p2';
  if (!VALID_PRIORITIES.includes(priority)) {
    err(`error: invalid priority '${priority}'. allowed: ${VALID_PRIORITIES.join(', ')}`);
    return 1;
  }

  const agent = parsed.values.agent || 'auto';
  const knownAgents = ['auto', 'claude', 'codex'];
  if (!knownAgents.includes(agent) && !agent.startsWith('claude-code:') && !agent.startsWith('codex:')) {
    err(`error: invalid agent '${agent}'. allowed: ${knownAgents.join(', ')}, claude-code:<id>, codex:<id>`);
    return 1;
  }

  const id = ulid();
  const now = new Date().toISOString();
  const createdBy = parsed.values['created-by'] || defaultActor();

  const todo = {
    schema: 1,
    id,
    title,
    description: parsed.values.description || '',
    created_at: now,
    created_by: createdBy,
    priority,
    due: parsed.values.due || null,
    labels: parsed.values.label
      ? parsed.values.label.split(',').map(s => s.trim()).filter(Boolean)
      : [],
    agent,
    context: {
      repo: parsed.values.repo || null,
      branch: parsed.values.branch || null,
      files: []
    },
    depends_on: parsed.values['depends-on']
      ? parsed.values['depends-on'].split(',').map(s => s.trim()).filter(Boolean)
      : [],
    verify: parsed.values.verify
      ? { type: 'command', value: parsed.values.verify, expect: 'exit_zero' }
      : null,
    claim: null,
    history: [{ at: now, actor: createdBy, event: 'created' }]
  };

  const incomingDir = path.join(JOSH_ROOT, 'todo', 'incoming');
  if (!fs.existsSync(incomingDir)) {
    err(`error: ${incomingDir} does not exist. run 'josh init' first.`);
    return 4;
  }
  const todoDir = path.join(incomingDir, id);
  fs.mkdirSync(todoDir, { recursive: true });
  writeJsonAtomic(path.join(todoDir, 'meta.json'), todo);
  fs.writeFileSync(path.join(todoDir, 'state'), 'incoming\n', 'utf8');
  fs.writeFileSync(path.join(todoDir, 'events.ndjson'), '', 'utf8');

  appendAudit({
    actor: createdBy,
    action: 'todo.created',
    id,
    details: { title, priority, agent }
  });

  log(id);
  return 0;
}

function cmdList(args) {
  const subtype = args[0];
  if (!subtype) {
    err('error: artifact type required. usage: josh list <todo>');
    return 1;
  }
  const subArgs = args.slice(1);
  switch (subtype) {
    case 'todo':      return cmdListTodo(subArgs);
    case 'handoffs':
    case 'handoff':   return cmdListHandoffs(subArgs);
    case 'approvals':
    case 'approval':  return cmdListApprovals(subArgs);
    case 'reviews':
    case 'review':    return cmdListReviews(subArgs);
    case 'locks':
    case 'lock':      return cmdLockList(subArgs);
    default:
      err(`unknown artifact type: ${subtype}`);
      err(`supported: todo, handoff(s), approval(s), review(s), lock(s)`);
      return 1;
  }
}

function cmdListTodo(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        state:    { type: 'string' },
        agent:    { type: 'string' },
        priority: { type: 'string' },
        json:     { type: 'boolean' }
      },
      allowPositionals: false,
      strict: true
    });
  } catch (e) {
    err(`error: ${e.message}`);
    return 1;
  }

  const allStates = [
    'incoming', 'triaged', 'claimed', 'planning', 'awaiting_approval',
    'approved', 'rejected', 'revised', 'in_progress', 'done',
    'blocked', 'failed', 'cancelled',
  ];
  const liveStates = [
    'incoming', 'triaged', 'claimed', 'planning', 'awaiting_approval',
    'approved', 'in_progress', 'blocked',
  ];
  const states = parsed.values.state
    ? (parsed.values.state === 'all' ? allStates : [parsed.values.state])
    : liveStates;

  for (const s of states) {
    if (!allStates.includes(s)) {
      err(`error: invalid state '${s}'. allowed: ${allStates.join(', ')}, all`);
      return 1;
    }
  }

  const todos = [];
  for (const state of states) {
    const dir = path.join(JOSH_ROOT, 'todo', state);
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { continue; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const todo = readJson(path.join(dir, e.name, 'meta.json'));
      if (!todo) continue;
      if (parsed.values.agent && todo.agent !== parsed.values.agent) continue;
      if (parsed.values.priority && todo.priority !== parsed.values.priority) continue;
      todos.push({ ...todo, _state: state });
    }
  }

  const rank = { p0: 0, p1: 1, p2: 2, p3: 3 };
  todos.sort((a, b) => {
    const pa = rank[a.priority] ?? 99, pb = rank[b.priority] ?? 99;
    if (pa !== pb) return pa - pb;
    return a.created_at.localeCompare(b.created_at);
  });

  if (parsed.values.json) {
    log(JSON.stringify(todos, null, 2));
    return 0;
  }

  if (todos.length === 0) {
    log('(no todos match)');
    return 0;
  }

  log(`id (last 6)  state         pri  agent        age      title`);
  log(`-----------  ------------  ---  -----------  -------  ----------------------------------------`);
  for (const t of todos) {
    const idShort = t.id.slice(-6);
    const state = (t._state || '').padEnd(12);
    const pri = (t.priority || '').padEnd(3);
    const ag = (t.agent || 'auto').slice(0, 11).padEnd(11);
    const age = formatAge(t.created_at).padEnd(7);
    const title = (t.title || '').slice(0, 60);
    log(`${idShort}       ${state}  ${pri}  ${ag}  ${age}  ${title}`);
  }
  return 0;
}

function cmdShow(args) {
  const id = args[0];
  if (!id) {
    err('error: id required. usage: josh show <id>');
    return 1;
  }

  // Look in todo/<state>/<id>/meta.json first.
  const todoFound = findTodoFolderById(id);
  if (todoFound) {
    log(`# ${todoFound.relative}/meta.json`);
    const obj = readJson(todoFound.path);
    if (obj) log(JSON.stringify(obj, null, 2));
    else log(fs.readFileSync(todoFound.path, 'utf8'));
    return 0;
  }

  const found = findById(id);
  if (!found) {
    err(`not found: ${id}`);
    return 2;
  }
  if (found.collision) {
    err(`warn: id suffix '${id}' matched multiple files; showing first. use full ID to disambiguate.`);
  }

  log(`# ${found.relative}`);
  if (found.path.endsWith('.json')) {
    const obj = readJson(found.path);
    if (obj) log(JSON.stringify(obj, null, 2));
    else log(fs.readFileSync(found.path, 'utf8'));
  } else {
    log(fs.readFileSync(found.path, 'utf8'));
  }
  return 0;
}

function cmdTick(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        verbose: { type: 'boolean' },
        force:   { type: 'boolean' }   // ignore lock (debug only)
      },
      allowPositionals: false,
      strict: true
    });
  } catch (e) {
    err(`error: ${e.message}`);
    return 1;
  }
  const verbose = parsed.values.verbose;
  const tickStart = new Date();

  // Ensure orchestrator dirs exist (be tolerant: maybe init wasn't run yet)
  const orchDir = path.join(JOSH_ROOT, 'orchestrator');
  for (const sub of ['', 'incoming']) {
    const p = sub ? path.join(orchDir, sub) : orchDir;
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  }

  // Lock
  if (!parsed.values.force) {
    if (!lockAcquire()) {
      if (verbose) log('orchestrator lock held by another tick; skipping');
      return 0;
    }
  } else {
    // Force: best-effort unlink, then acquire.
    try { fs.unlinkSync(LOCK_PATH()); } catch (e) {}
    lockAcquire();
  }

  let controlsProcessed = 0;
  let triaged = 0;
  let routed = 0;
  let swept = 0;
  let expired = 0;
  let triagedFailed = 0;

  try {
    // 1. Process control commands
    controlsProcessed = processAllControls();

    // 2. Read pause/drain state AFTER controls (a control may have set them)
    const paused = isPaused();
    const draining = isDraining();

    // 3. Load routing config once per tick (cheap; null if file missing)
    const routingCfg = readRoutingConfig();

    // 4. Triage incoming → triaged (skip if paused; allow during drain)
    if (!paused) {
      const incomingDir = path.join(JOSH_ROOT, 'todo', 'incoming');
      let entries = [];
      try { entries = fs.readdirSync(incomingDir, { withFileTypes: true }); } catch (e) {}
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        const folderEntry = { dir: path.join(incomingDir, e.name), id: e.name };
        const r = triageOne(folderEntry, null, routingCfg);
        if (r.result === 'triaged') {
          triaged++;
          if (r.routed) routed++;
        } else triagedFailed++;
      }
    }

    // 5. Sweep stale claims
    swept = sweepStaleClaims();

    // 5b. Promote approved → in_progress (Phase 2A dispatch)
    let promoted = 0;
    let throttled = 0;
    if (!paused) {
      const r = promoteApproved();
      promoted = r.promoted;
      throttled = r.throttled;
    }

    // 5c. Phase 3: doom-loop sweep — push repeated-failure todos to blocked/
    let doomLooped = 0;
    if (!paused) {
      const { sweepDoomLoops } = require('./lib/doom-loop');
      doomLooped = sweepDoomLoops(JOSH_ROOT);
      if (doomLooped > 0) {
        appendAudit({
          actor: 'orchestrator',
          action: 'todo.doom_loop_swept',
          id: null,
          details: { count: doomLooped },
        });
      }
    }

    // 5d. Phase 4: verdict-matrix lifecycle
    let matrixQueued = 0, matrixWinners = 0, matrixAutoAccepted = 0;
    if (!paused) {
      const r = sweepMatrix();
      matrixQueued = r.queued;
      matrixWinners = r.winners_materialized;
      matrixAutoAccepted = r.auto_accepted;
    }

    // 5e. Phase 5: sweep worktrees of terminal todos (done/failed/cancelled)
    let worktreesSwept = 0;
    if (!paused) {
      try {
        const { sweepWorktrees } = require('./lib/worktree');
        const r = sweepWorktrees(JOSH_ROOT);
        worktreesSwept = r.swept;
        if (worktreesSwept > 0) {
          appendAudit({ actor: 'orchestrator', action: 'worktree.swept', id: null, details: { count: worktreesSwept } });
        }
      } catch (e) { /* non-fatal */ }
    }

    // 6. Auto-resolve expired approvals (default decision applied)
    expired = expireApprovals();

    // 7. Update status board
    const status = readStatus();
    status.agents.orchestrator = {
      ...status.agents.orchestrator,
      alive: true,
      last_tick: new Date().toISOString(),
      tick_count: (status.agents.orchestrator?.tick_count || 0) + 1,
      interval_sec: status.agents.orchestrator?.interval_sec || DEFAULT_INTERVAL_SEC,
      paused,
      draining
    };
    refreshQueueCounts(status);
    status.updated_at = new Date().toISOString();
    writeStatus(status);

    // 8. Audit the tick
    appendAudit({
      actor: 'orchestrator',
      action: 'orchestrator.tick',
      id: null,
      details: {
        controls: controlsProcessed,
        triaged,
        routed,
        triaged_failed: triagedFailed,
        swept,
        promoted,
        throttled,
        doom_looped: doomLooped,
        matrix_queued: matrixQueued,
        matrix_winners: matrixWinners,
        matrix_auto_accepted: matrixAutoAccepted,
        worktrees_swept: worktreesSwept,
        expired_approvals: expired,
        paused,
        draining,
        duration_ms: Date.now() - tickStart.getTime()
      }
    });

    // 9. One-line summary (or verbose multi-line)
    const tickN = status.agents.orchestrator.tick_count;
    if (verbose) {
      log(`tick ${tickN} @ ${status.agents.orchestrator.last_tick}`);
      log(`  controls: ${controlsProcessed}  triaged: ${triaged} (routed: ${routed})  swept: ${swept}  promoted: ${promoted}  throttled: ${throttled}  doom_looped: ${doomLooped}  expired: ${expired}  failed: ${triagedFailed}`);
      log(`  paused: ${paused}  draining: ${draining}`);
      log(`  queue: incoming=${status.queue.incoming} triaged=${status.queue.triaged} in_progress=${status.queue.in_progress}`);
    } else {
      log(`tick ${tickN}: triaged=${triaged}${routed > 0 ? ` (routed:${routed})` : ''} swept=${swept} promoted=${promoted}${throttled > 0 ? ` throttled=${throttled}` : ''}${doomLooped > 0 ? ` doom_looped=${doomLooped}` : ''}${matrixQueued > 0 ? ` matrix_queued=${matrixQueued}` : ''}${matrixWinners > 0 ? ` matrix_winners=${matrixWinners}` : ''}${matrixAutoAccepted > 0 ? ` matrix_auto_accepted=${matrixAutoAccepted}` : ''}${worktreesSwept > 0 ? ` worktrees_swept=${worktreesSwept}` : ''} expired=${expired} controls=${controlsProcessed}${paused ? ' [paused]' : ''}${draining ? ' [draining]' : ''}`);
    }
  } finally {
    lockRelease();
  }
  return 0;
}

function cmdControl(args) {
  const action = args[0];
  if (!action) {
    err('error: action required. usage: josh control <action> [args]');
    err('actions: pause, resume, drain, undrain, sweep-now, set-interval <sec>, reorder <todo-id> --priority pX');
    return 1;
  }
  // Normalize hyphenated CLI form to spec form (sweep-now → sweep_now, set-interval → set_interval)
  const specAction = action.replace(/-/g, '_');
  const subArgs = args.slice(1);

  let payload = { schema: 1, id: ulid(), action: specAction };

  switch (specAction) {
    case 'pause':
    case 'resume':
    case 'drain':
    case 'undrain':
    case 'sweep_now':
      // No extra args.
      break;
    case 'set_interval': {
      const sec = parseInt(subArgs[0], 10);
      if (!Number.isFinite(sec) || sec < 10 || sec > 86400) {
        err('error: set-interval requires <seconds> in [10, 86400]');
        return 1;
      }
      payload.interval_sec = sec;
      break;
    }
    case 'reorder': {
      const todoId = subArgs[0];
      if (!todoId) {
        err('error: reorder requires <todo-id> --priority pX');
        return 1;
      }
      let parsed;
      try {
        parsed = parseArgs({
          args: subArgs.slice(1),
          options: { priority: { type: 'string' } },
          allowPositionals: false,
          strict: true
        });
      } catch (e) {
        err(`error: ${e.message}`);
        return 1;
      }
      const newPri = parsed.values.priority;
      if (!VALID_PRIORITIES.includes(newPri)) {
        err(`error: --priority must be one of ${VALID_PRIORITIES.join(', ')}`);
        return 1;
      }
      payload.todo_id = todoId;
      payload.new_priority = newPri;
      break;
    }
    default:
      err(`unknown control action: ${action}`);
      err('actions: pause, resume, drain, undrain, sweep-now, set-interval, reorder');
      return 1;
  }

  // Drop into orchestrator/incoming/<id>.json
  const dir = path.join(JOSH_ROOT, 'orchestrator', 'incoming');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filepath = path.join(dir, `${payload.id}.json`);
  writeJsonAtomic(filepath, payload);

  appendAudit({
    actor: defaultActor(),
    action: 'control.queued',
    id: payload.id,
    details: { control_action: specAction, ...(payload.todo_id ? { todo_id: payload.todo_id } : {}) }
  });

  log(payload.id);
  return 0;
}

function cmdClaim(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        as:           { type: 'string' },
        actor:        { type: 'string' },
        ttl:          { type: 'string' },
        agent:        { type: 'string' },
        speculative:  { type: 'string' },
        'base-repo':  { type: 'string' },
        'base-branch':{ type: 'string' },
      },
      allowPositionals: true,
      strict: true
    });
  } catch (e) { return errExit(e.message, 1); }

  const idArg = parsed.positionals[0];
  if (!idArg) return errExit('claim requires <todo-id>', 1);

  const actor = resolveActor(parsed.values);
  const ttlSec = parsed.values.ttl ? parseInt(parsed.values.ttl, 10) : 3600;
  if (!Number.isFinite(ttlSec) || ttlSec < 1 || ttlSec > 86400) {
    return errExit('--ttl must be in [1, 86400] seconds', 1);
  }

  const agentId = parsed.values.agent || null;
  const speculativeN = parsed.values.speculative ? parseInt(parsed.values.speculative, 10) : null;
  if (speculativeN != null) {
    if (!Number.isFinite(speculativeN) || speculativeN < 2 || speculativeN > 10) {
      return errExit('--speculative N must be in [2, 10]', 1);
    }
    if (!agentId) {
      return errExit('--speculative requires --agent <id>', 1);
    }
  }

  // If --agent given, take the dispatch path (triaged → claimed) with brief injection.
  if (agentId) {
    // Pre-flight: locate, check primary_role.
    const located = locateTodo(idArg, ['triaged']);
    if (located.error) return errExit(located.error, located.code);
    const todo = readJson(located.path);
    if (!todo) return errExit(`malformed todo at ${located.relative}`, 4);
    if (todo.primary_role !== agentId) {
      return errExit(`todo primary_role is '${todo.primary_role || '<unset>'}', expected '${agentId}'`, 1);
    }
    // Phase 3: hard-dep enforcement.
    {
      const { checkDependencies } = require('./lib/dependency-checker');
      const dep = checkDependencies(JOSH_ROOT, todo);
      if (!dep.ok) {
        const list = dep.blocked_by.map((b) => `${b.display_id}(${b.state})`).join(', ');
        return errExit(`dependencies not yet done: ${list}`, 3);
      }
    }
    // Phase 3: backpressure — advisory check at claim time so the agent learns early.
    {
      const { checkBackpressure } = require('./lib/backpressure');
      const bp = checkBackpressure(JOSH_ROOT, todo);
      if (!bp.ok && (bp.scope === 'global' || bp.scope === 'phase')) {
        return errExit(`backpressure: ${bp.reason}`, 3);
      }
    }
    // Load brief (asserts manifest + source exist).
    let brief;
    try {
      const { loadBrief } = require('./lib/agent-brief');
      brief = loadBrief(JOSH_ROOT, agentId);
    } catch (e) {
      return errExit(e.message, 2);
    }
    // Transition triaged → claimed. Stamp agent_brief_path. Write runtime.json.
    const r = transitionTodo({
      srcStates: ['triaged'],
      dst: 'claimed',
      idOrSuffix: idArg,
      actor,
      eventName: 'claimed',
      eventDetails: { ttl_sec: ttlSec, agent_id: agentId, speculative_n: speculativeN || 1 },
      update: (t, now) => {
        t.claim = { by: actor, at: now, ttl_sec: ttlSec, agent_id: agentId, host: require('./lib/host').currentHost() };
        t.agent_brief_path = brief.path;
        if (speculativeN) t.speculative_n = speculativeN;
      },
      audit: { action: 'todo.claimed', details: { ttl_sec: ttlSec, agent_id: agentId, speculative_n: speculativeN || 1 } }
    });
    if (r.error) return errExit(r.error, r.code);
    // After move, write runtime.json next to meta.json.
    const claimedFolder = path.join(JOSH_ROOT, 'todo', 'claimed', r.id);
    const { resolveAllowedTools } = require('./lib/tool-scoping');
    const runtime = {
      schema: 1,
      harness: process.env.JOSH_HARNESS || 'unknown',
      session_id: process.env.JOSH_SESSION_ID || null,
      claimed_by: agentId,
      actor,
      started_at: new Date().toISOString(),
      speculative_n: speculativeN || 1,
      allowed_tools: resolveAllowedTools(JOSH_ROOT, agentId),
    };
    // Phase 5: --speculative N forks N worktrees of meta.context.repo.
    if (speculativeN) {
      const meta = readJson(path.join(claimedFolder, 'meta.json')) || {};
      const baseRepo = parsed.values['base-repo'] || (meta.context && meta.context.repo);
      const baseBranch = parsed.values['base-branch'] || (meta.context && meta.context.branch) || 'main';
      if (!baseRepo) {
        return errExit('--speculative requires meta.context.repo or --base-repo <path>', 1);
      }
      try {
        const { createWorktree } = require('./lib/worktree');
        const wts = [];
        for (let i = 1; i <= speculativeN; i++) {
          const w = createWorktree(JOSH_ROOT, r.id, { baseRepo, baseBranch, suffix: i });
          wts.push({ path: w.path, branch: w.branch, suffix: w.suffix });
          log(`  worktree[${i}]: ${path.relative(JOSH_ROOT, w.path).replace(/\\/g, '/')} (${w.branch})`);
        }
        runtime.worktrees = wts;
      } catch (e) {
        return errExit(`worktree creation failed: ${e.message}`, 4);
      }
    }
    writeJsonAtomic(path.join(claimedFolder, 'runtime.json'), runtime);
    log(r.id);
    return 0;
  }

  // Backward-compatible path: triaged → in_progress (no --agent).
  // Phase 3: hard-dep enforcement + backpressure also apply here.
  {
    const located = locateTodo(idArg, ['triaged']);
    if (located.error) return errExit(located.error, located.code);
    const todo = readJson(located.path);
    if (!todo) return errExit(`malformed todo at ${located.relative}`, 4);
    const { checkDependencies } = require('./lib/dependency-checker');
    const dep = checkDependencies(JOSH_ROOT, todo);
    if (!dep.ok) {
      const list = dep.blocked_by.map((b) => `${b.display_id}(${b.state})`).join(', ');
      return errExit(`dependencies not yet done: ${list}`, 3);
    }
    const { checkBackpressure } = require('./lib/backpressure');
    const bp = checkBackpressure(JOSH_ROOT, todo);
    if (!bp.ok) return errExit(`backpressure: ${bp.reason}`, 3);
  }

  const r = transitionTodo({
    srcStates: ['triaged'],
    dst: 'in_progress',
    idOrSuffix: idArg,
    actor,
    eventName: 'claimed',
    eventDetails: { ttl_sec: ttlSec },
    update: (todo, now) => {
      todo.claim = { by: actor, at: now, ttl_sec: ttlSec, host: require('./lib/host').currentHost() };
    },
    audit: { action: 'todo.claimed', details: { ttl_sec: ttlSec } }
  });
  if (r.error) return errExit(r.error, r.code);
  log(r.id);
  return 0;
}

function cmdComplete(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        as:             { type: 'string' },
        actor:          { type: 'string' },
        note:           { type: 'string' },
        'skip-verify':  { type: 'boolean' },
        'skip-handoff': { type: 'boolean' },
      },
      allowPositionals: true,
      strict: true
    });
  } catch (e) { return errExit(e.message, 1); }

  const idArg = parsed.positionals[0];
  if (!idArg) return errExit('complete requires <todo-id>', 1);

  const actor = resolveActor(parsed.values);

  // Locate first so we can run verify + handoff check before the move.
  const located = locateTodo(idArg, ['in_progress']);
  if (located.error) return errExit(located.error, located.code);

  const todo = readJson(located.path);
  if (!todo) return errExit(`malformed todo at ${located.relative}`, 4);

  if (todo.verify && todo.verify.type === 'command' && !parsed.values['skip-verify']) {
    try {
      require('child_process').execSync(todo.verify.value, { stdio: 'pipe' });
    } catch (e) {
      err(`verify failed: ${todo.verify.value}`);
      err(`exit code: ${e.status}`);
      if (e.stderr) err(`stderr: ${e.stderr.toString().trim()}`);
      return errExit('verification failed; not completing. use --skip-verify to override or `josh fail` to mark failed', 1);
    }
  }

  // Handoff check (Phase 2A): handoff.md must exist + validate, unless --skip-handoff.
  if (!parsed.values['skip-handoff']) {
    const handoffPath = path.join(located.folder, 'handoff.md');
    if (!fs.existsSync(handoffPath)) {
      return errExit(`handoff.md not found at ${path.relative(JOSH_ROOT, handoffPath).replace(/\\/g, '/')}; write the 9-field handoff before completing (or pass --skip-handoff)`, 1);
    }
    const text = fs.readFileSync(handoffPath, 'utf8');
    const { validateHandoff } = require('./lib/handoff-validator');
    const v = validateHandoff(text);
    if (!v.ok) {
      err('handoff.md validation failed:');
      for (const e of v.errors) err(`  - ${e}`);
      return 1;
    }
  }

  const r = transitionTodo({
    srcStates: ['in_progress'],
    dst: 'done',
    idOrSuffix: idArg,
    actor,
    eventName: 'completed',
    eventDetails: parsed.values.note ? { note: parsed.values.note } : {},
    update: (t, now) => {
      t.completed_at = now;
      t.completed_by = actor;
      if (parsed.values.note) t.completion_note = parsed.values.note;
    },
    audit: { action: 'todo.completed', details: parsed.values.note ? { note: parsed.values.note } : {} }
  });
  if (r.error) return errExit(r.error, r.code);
  // Lifecycle event: terminal "done" with success=true.
  try {
    ew.appendEvent(JOSH_ROOT, 'done', r.id, {
      kind: 'done',
      success: true,
      actor,
      ...(parsed.values.note ? { note: parsed.values.note } : {}),
    });
  } catch (e) { /* non-fatal */ }
  log(r.id);
  return 0;
}

function cmdHeartbeat(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        as:    { type: 'string' },
        actor: { type: 'string' },
      },
      allowPositionals: true,
      strict: true
    });
  } catch (e) { return errExit(e.message, 1); }

  const idArg = parsed.positionals[0];
  if (!idArg) return errExit('heartbeat requires <todo-id>', 1);

  const actor = resolveActor(parsed.values);
  const allowed = ['claimed', 'planning', 'awaiting_approval', 'in_progress'];
  const located = locateTodo(idArg, allowed);
  if (located.error) return errExit(located.error, located.code);

  const todo = readJson(located.path);
  if (!todo) return errExit(`malformed todo at ${located.relative}`, 4);

  const now = new Date().toISOString();
  if (todo.claim) todo.claim.at = now;
  todo.history = todo.history || [];
  todo.history.push({ at: now, actor, event: 'heartbeat' });
  writeJsonAtomic(located.path, todo);

  // Per-todo events stream.
  try {
    ew.appendEvent(JOSH_ROOT, located.state, located.id, {
      kind: 'heartbeat',
      at: now,
      actor,
    });
  } catch (e) { /* non-fatal */ }

  appendAudit({ actor, action: 'todo.heartbeat', id: located.id, details: {} });
  log(`heartbeat: ${located.id} at ${now}`);
  return 0;
}

function cmdFail(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        as:     { type: 'string' },
        actor:  { type: 'string' },
        reason: { type: 'string' }
      },
      allowPositionals: true,
      strict: true
    });
  } catch (e) { return errExit(e.message, 1); }

  const idArg = parsed.positionals[0];
  if (!idArg) return errExit('fail requires <todo-id>', 1);
  const reason = parsed.values.reason;
  if (!reason) return errExit('fail requires --reason "<text>"', 1);
  const actor = resolveActor(parsed.values);

  const r = transitionTodo({
    srcStates: ['in_progress', 'triaged'],
    dst: 'failed',
    idOrSuffix: idArg,
    actor,
    eventName: 'failed',
    eventDetails: { reason },
    update: (t, now) => {
      t.failed_at = now;
      t.failed_by = actor;
      t.failure_reason = reason;
    },
    audit: { action: 'todo.failed', details: { reason } }
  });
  if (r.error) return errExit(r.error, r.code);
  // Lifecycle event: terminal "failed" with reason.
  try {
    ew.appendEvent(JOSH_ROOT, 'failed', r.id, {
      kind: 'failed',
      reason,
      actor,
    });
  } catch (e) { /* non-fatal */ }
  log(r.id);
  return 0;
}

function cmdBlock(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        as:           { type: 'string' },
        actor:        { type: 'string' },
        reason:       { type: 'string' },
        'depends-on': { type: 'string' }
      },
      allowPositionals: true,
      strict: true
    });
  } catch (e) { return errExit(e.message, 1); }

  const idArg = parsed.positionals[0];
  if (!idArg) return errExit('block requires <todo-id>', 1);
  const dependsOn = parsed.values['depends-on'];
  if (!dependsOn) return errExit('block requires --depends-on <other-id>[,<other-id>]', 1);
  const actor = resolveActor(parsed.values);
  const newDeps = dependsOn.split(',').map(s => s.trim()).filter(Boolean);

  const r = transitionTodo({
    srcStates: ['in_progress', 'triaged'],
    dst: 'blocked',
    idOrSuffix: idArg,
    actor,
    eventName: 'blocked',
    eventDetails: { depends_on: newDeps, reason: parsed.values.reason || null },
    update: (t) => {
      t.depends_on = Array.from(new Set([...(t.depends_on || []), ...newDeps]));
      t.claim = null;
      if (parsed.values.reason) t.block_reason = parsed.values.reason;
    },
    audit: { action: 'todo.blocked', details: { depends_on: newDeps, reason: parsed.values.reason || null } }
  });
  if (r.error) return errExit(r.error, r.code);
  log(r.id);
  return 0;
}

function cmdUnblock(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        as:    { type: 'string' },
        actor: { type: 'string' },
        note:  { type: 'string' }
      },
      allowPositionals: true,
      strict: true
    });
  } catch (e) { return errExit(e.message, 1); }

  const idArg = parsed.positionals[0];
  if (!idArg) return errExit('unblock requires <todo-id>', 1);
  const actor = resolveActor(parsed.values);

  const r = transitionTodo({
    srcStates: ['blocked'],
    dst: 'triaged',
    idOrSuffix: idArg,
    actor,
    eventName: 'unblocked',
    eventDetails: parsed.values.note ? { note: parsed.values.note } : {},
    update: (t) => {
      // Clear depends_on (caller decides whether deps were satisfied).
      t.depends_on = [];
      delete t.block_reason;
    },
    audit: { action: 'todo.unblocked', details: parsed.values.note ? { note: parsed.values.note } : {} }
  });
  if (r.error) return errExit(r.error, r.code);
  log(r.id);
  return 0;
}

function cmdCancel(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        as:     { type: 'string' },
        actor:  { type: 'string' },
        reason: { type: 'string' }
      },
      allowPositionals: true,
      strict: true
    });
  } catch (e) { return errExit(e.message, 1); }

  const idArg = parsed.positionals[0];
  if (!idArg) return errExit('cancel requires <todo-id>', 1);
  const actor = resolveActor(parsed.values);

  const r = transitionTodo({
    srcStates: ['incoming', 'triaged', 'in_progress', 'blocked'],
    dst: 'cancelled',
    idOrSuffix: idArg,
    actor,
    eventName: 'cancelled',
    eventDetails: parsed.values.reason ? { reason: parsed.values.reason } : {},
    update: (t, now) => {
      t.cancelled_at = now;
      t.cancelled_by = actor;
      if (parsed.values.reason) t.cancel_reason = parsed.values.reason;
      t.claim = null;
    },
    audit: { action: 'todo.cancelled', details: parsed.values.reason ? { reason: parsed.values.reason } : {} }
  });
  if (r.error) return errExit(r.error, r.code);
  log(r.id);
  return 0;
}

// ─── Handoff: push, reply, ack, list ─────────────────────────────────────────

function cmdPushHandoff(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        to:                  { type: 'string' },
        kind:                { type: 'string' },
        title:               { type: 'string' },
        body:                { type: 'string' },
        'reply-to':          { type: 'string' },
        priority:            { type: 'string' },
        'expects-reply-by':  { type: 'string' },
        'context-files':     { type: 'string' },
        from:                { type: 'string' }
      },
      allowPositionals: true,
      strict: true
    });
  } catch (e) { return errExit(e.message, 1); }

  const v = parsed.values;
  if (!v.to) return errExit('--to <agent> required (claude|codex|orchestrator)', 1);
  if (!KNOWN_AGENTS.includes(v.to)) {
    return errExit(`--to must be one of: ${KNOWN_AGENTS.join(', ')}`, 1);
  }
  if (!v.title) return errExit('--title "<text>" required', 1);
  if (!v.body) return errExit('--body "<text>" required', 1);

  const kind = v.kind || 'request';
  if (!HANDOFF_KINDS.includes(kind)) {
    return errExit(`--kind must be one of: ${HANDOFF_KINDS.join(', ')}`, 1);
  }

  const priority = v.priority || 'p2';
  if (!VALID_PRIORITIES.includes(priority)) {
    return errExit(`invalid priority '${priority}'. allowed: ${VALID_PRIORITIES.join(', ')}`, 1);
  }

  const id = ulid();
  let threadId = id;
  let replyTo = null;
  if (v['reply-to']) {
    const orig = locateHandoff(v['reply-to']);
    if (orig.error) return errExit(`--reply-to ${v['reply-to']}: ${orig.error}`, orig.code);
    const origData = readJson(orig.path);
    if (!origData) return errExit(`--reply-to ${v['reply-to']}: malformed`, 1);
    threadId = origData.thread_id || origData.id;
    replyTo = origData.id;
  }

  const from = v.from || defaultActor();
  const now = new Date().toISOString();
  const handoff = {
    schema: 1,
    id,
    thread_id: threadId,
    reply_to: replyTo,
    from,
    to: v.to,
    kind,
    title: v.title,
    body: v.body,
    context_files: v['context-files']
      ? v['context-files'].split(',').map(s => s.trim()).filter(Boolean)
      : [],
    created_at: now,
    expects_reply_by: v['expects-reply-by'] || null,
    priority,
    history: [{ at: now, actor: from, event: 'sent' }]
  };

  const dir = path.join(JOSH_ROOT, v.to, 'incoming');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filepath = path.join(dir, `${id}.json`);
  writeJsonAtomic(filepath, handoff);

  appendAudit({
    actor: from,
    action: 'handoff.sent',
    id,
    details: { to: v.to, kind, thread_id: threadId, reply_to: replyTo, title: v.title }
  });

  log(id);
  return 0;
}

function moveHandoffToProcessed(located, processedBy, eventName, eventDetails) {
  // Atomic move incoming → processed within the same agent's dir.
  if (located.state === 'processed') return { code: 0, alreadyProcessed: true };
  const fromPath = located.path;
  const toPath = path.join(JOSH_ROOT, located.agent, 'processed', `${located.id}.json`);
  // Ensure processed/ exists.
  const procDir = path.dirname(toPath);
  if (!fs.existsSync(procDir)) fs.mkdirSync(procDir, { recursive: true });

  try { fs.renameSync(fromPath, toPath); }
  catch (e) {
    if (e.code === 'ENOENT') return { code: 3, error: `handoff no longer in ${located.state} (race?)` };
    throw e;
  }

  const handoff = readJson(toPath);
  if (handoff) {
    handoff.history = handoff.history || [];
    const now = new Date().toISOString();
    handoff.history.push({ at: now, actor: processedBy, event: eventName, details: eventDetails || {} });
    handoff.processed_at = now;
    handoff.processed_by = processedBy;
    writeJsonAtomic(toPath, handoff);
  }
  return { code: 0, handoff, toPath };
}

function cmdReply(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        body:  { type: 'string' },
        kind:  { type: 'string' },
        as:    { type: 'string' },
        actor: { type: 'string' }
      },
      allowPositionals: true,
      strict: true
    });
  } catch (e) { return errExit(e.message, 1); }

  const idArg = parsed.positionals[0];
  if (!idArg) return errExit('reply requires <handoff-id>', 1);
  if (!parsed.values.body) return errExit('--body "<text>" required', 1);

  const located = locateHandoff(idArg);
  if (located.error) return errExit(located.error, located.code);

  const orig = readJson(located.path);
  if (!orig) return errExit(`malformed handoff at ${located.relative}`, 4);

  const replyKind = parsed.values.kind || 'answer';
  if (!HANDOFF_KINDS.includes(replyKind)) {
    return errExit(`--kind must be one of: ${HANDOFF_KINDS.join(', ')}`, 1);
  }
  const actor = resolveActor(parsed.values);

  // Recipient of the reply = sender of the original. Map to a known agent dir
  // by matching the prefix or exact value.
  const origFrom = (orig.from || '').toString();
  let recipientDir = null;
  for (const a of KNOWN_AGENTS) {
    if (origFrom === a || origFrom.startsWith(a + ':') ||
        origFrom.startsWith(a + '-code:') || origFrom === a + '-code') {
      recipientDir = a;
      break;
    }
  }
  if (!recipientDir) {
    // Heuristic: if from matches "claude-code…" route to claude/.
    if (/^claude/i.test(origFrom)) recipientDir = 'claude';
    else if (/^codex/i.test(origFrom)) recipientDir = 'codex';
    else return errExit(`cannot route reply: original 'from' is "${origFrom}", not a known agent`, 1);
  }

  // Build reply handoff.
  const id = ulid();
  const now = new Date().toISOString();
  const reply = {
    schema: 1,
    id,
    thread_id: orig.thread_id || orig.id,
    reply_to: orig.id,
    from: actor,
    to: recipientDir,
    kind: replyKind,
    title: `Re: ${orig.title || ''}`.slice(0, 200),
    body: parsed.values.body,
    context_files: [],
    created_at: now,
    expects_reply_by: null,
    priority: orig.priority || 'p2',
    history: [{ at: now, actor, event: 'sent', details: { reply_to: orig.id } }]
  };

  const replyDir = path.join(JOSH_ROOT, recipientDir, 'incoming');
  if (!fs.existsSync(replyDir)) fs.mkdirSync(replyDir, { recursive: true });
  writeJsonAtomic(path.join(replyDir, `${id}.json`), reply);

  appendAudit({
    actor,
    action: 'handoff.replied',
    id,
    details: { thread_id: reply.thread_id, reply_to: orig.id, to: recipientDir, kind: replyKind }
  });

  // Move original from incoming → processed (only if it WAS in incoming).
  const moveResult = moveHandoffToProcessed(located, actor, 'replied', { reply_id: id });
  if (moveResult.error) {
    err(`warn: ${moveResult.error} (reply was still sent)`);
  }

  log(id);
  return 0;
}

function cmdAck(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        as:    { type: 'string' },
        actor: { type: 'string' },
        note:  { type: 'string' }
      },
      allowPositionals: true,
      strict: true
    });
  } catch (e) { return errExit(e.message, 1); }

  const idArg = parsed.positionals[0];
  if (!idArg) return errExit('ack requires <handoff-id>', 1);
  const actor = resolveActor(parsed.values);

  const located = locateHandoff(idArg);
  if (located.error) return errExit(located.error, located.code);
  if (located.state === 'processed') return errExit('already processed', 1);

  const r = moveHandoffToProcessed(located, actor, 'acked',
    parsed.values.note ? { note: parsed.values.note } : {});
  if (r.error) return errExit(r.error, r.code);

  appendAudit({
    actor,
    action: 'handoff.acked',
    id: located.id,
    details: parsed.values.note ? { note: parsed.values.note } : {}
  });

  log(located.id);
  return 0;
}

function cmdListHandoffs(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        for:   { type: 'string' },
        state: { type: 'string' },
        json:  { type: 'boolean' }
      },
      allowPositionals: false,
      strict: true
    });
  } catch (e) { return errExit(e.message, 1); }

  const agents = parsed.values.for
    ? [parsed.values.for]
    : KNOWN_AGENTS;
  for (const a of agents) {
    if (!KNOWN_AGENTS.includes(a)) {
      return errExit(`--for must be one of: ${KNOWN_AGENTS.join(', ')}`, 1);
    }
  }
  const states = parsed.values.state
    ? (parsed.values.state === 'all' ? ['incoming', 'processed'] : [parsed.values.state])
    : ['incoming'];
  for (const s of states) {
    if (!['incoming', 'processed'].includes(s)) {
      return errExit(`--state must be incoming, processed, or all`, 1);
    }
  }

  const items = [];
  for (const agent of agents) {
    for (const state of states) {
      const dir = path.join(JOSH_ROOT, agent, state);
      let files;
      try { files = fs.readdirSync(dir).filter(f => f.endsWith('.json')); } catch (e) { continue; }
      for (const f of files) {
        const h = readJson(path.join(dir, f));
        if (!h) continue;
        items.push({ ...h, _agent: agent, _state: state });
      }
    }
  }

  // Sort: priority desc, then created_at asc
  const rank = { p0: 0, p1: 1, p2: 2, p3: 3 };
  items.sort((a, b) => {
    const pa = rank[a.priority] ?? 99, pb = rank[b.priority] ?? 99;
    if (pa !== pb) return pa - pb;
    return (a.created_at || '').localeCompare(b.created_at || '');
  });

  if (parsed.values.json) {
    log(JSON.stringify(items, null, 2));
    return 0;
  }
  if (items.length === 0) {
    log('(no handoffs match)');
    return 0;
  }

  log(`id (last 6)  for          state      kind     pri  age      from              title`);
  log(`-----------  -----------  ---------  -------  ---  -------  ----------------  --------------------`);
  for (const h of items) {
    const idShort = (h.id || '').slice(-6);
    const forA = (h._agent || '').padEnd(11);
    const state = (h._state || '').padEnd(9);
    const kind = (h.kind || '').padEnd(7);
    const pri = (h.priority || '').padEnd(3);
    const age = formatAge(h.created_at).padEnd(7);
    const from = (h.from || '').slice(0, 16).padEnd(16);
    const title = (h.title || '').slice(0, 50);
    log(`${idShort}       ${forA}  ${state}  ${kind}  ${pri}  ${age}  ${from}  ${title}`);
  }
  return 0;
}

// ─── Approval: push, list, approve, deny ─────────────────────────────────────

function cmdPushApproval(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        summary:           { type: 'string' },
        details:           { type: 'string' },
        options:           { type: 'string' },           // comma-separated, default: approve,deny
        'default-after':   { type: 'string' },           // human-friendly: 2h, 30m, 60
        'default-choice':  { type: 'string' },           // default: deny
        requester:         { type: 'string' }
      },
      allowPositionals: true,
      strict: true
    });
  } catch (e) { return errExit(e.message, 1); }

  const v = parsed.values;
  if (!v.summary && parsed.positionals.length === 0) {
    return errExit('approval requires --summary "<text>" or a positional summary', 1);
  }
  const summary = v.summary || parsed.positionals.join(' ').trim();
  const opts = (v.options || 'approve,deny').split(',').map(s => s.trim()).filter(Boolean);
  if (opts.length < 2) return errExit('--options must list at least 2 choices', 1);
  const defaultChoice = v['default-choice'] || 'deny';
  if (!opts.includes(defaultChoice)) {
    return errExit(`--default-choice must be one of: ${opts.join(', ')}`, 1);
  }

  let defaultAfterSec = null;
  if (v['default-after']) {
    const m = v['default-after'].match(/^(\d+)\s*(s|m|h|d)?$/i);
    if (!m) return errExit('--default-after format: <n>[s|m|h|d] (e.g. 30m, 2h)', 1);
    const n = parseInt(m[1], 10);
    const unit = (m[2] || 's').toLowerCase();
    const mult = { s: 1, m: 60, h: 3600, d: 86400 }[unit];
    defaultAfterSec = n * mult;
  }

  const id = ulid();
  const now = new Date().toISOString();
  const requester = v.requester || defaultActor();
  const approval = {
    schema: 1,
    id,
    created_at: now,
    requester,
    summary,
    details: v.details || '',
    options: opts,
    default_after_sec: defaultAfterSec,
    default_choice: defaultChoice,
    history: [{ at: now, actor: requester, event: 'requested' }]
  };

  const dir = path.join(JOSH_ROOT, 'approvals', 'pending');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  writeJsonAtomic(path.join(dir, `${id}.json`), approval);

  appendAudit({
    actor: requester,
    action: 'approval.requested',
    id,
    details: { summary, options: opts, default_after_sec: defaultAfterSec }
  });

  log(id);
  return 0;
}

function decideApproval(args, decision) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        as:     { type: 'string' },
        actor:  { type: 'string' },
        note:   { type: 'string' },
        reason: { type: 'string' }
      },
      allowPositionals: true,
      strict: true
    });
  } catch (e) { return errExit(e.message, 1); }

  const idArg = parsed.positionals[0];
  if (!idArg) return errExit(`${decision} requires <approval-id>`, 1);

  const located = locateApproval(idArg);
  if (located.error) return errExit(located.error, located.code);
  if (located.state !== 'pending') return errExit(`approval already ${located.state}`, 1);

  const fromPath = located.path;
  const toPath = path.join(JOSH_ROOT, 'approvals', 'done', `${located.id}.json`);

  try { fs.renameSync(fromPath, toPath); }
  catch (e) {
    if (e.code === 'ENOENT') return errExit('approval no longer pending (race?)', 3);
    throw e;
  }

  const approval = readJson(toPath);
  if (!approval) return errExit('malformed approval', 4);
  const now = new Date().toISOString();
  const actor = resolveActor(parsed.values);
  approval.decision = decision;
  approval.decided_at = now;
  approval.decided_by = actor;
  if (parsed.values.note) approval.decision_note = parsed.values.note;
  if (parsed.values.reason) approval.decision_reason = parsed.values.reason;
  approval.history = approval.history || [];
  approval.history.push({
    at: now,
    actor,
    event: 'decided',
    details: { decision, ...(parsed.values.note ? { note: parsed.values.note } : {}), ...(parsed.values.reason ? { reason: parsed.values.reason } : {}) }
  });
  writeJsonAtomic(toPath, approval);

  appendAudit({
    actor,
    action: 'approval.decided',
    id: located.id,
    details: { decision, ...(parsed.values.note ? { note: parsed.values.note } : {}), ...(parsed.values.reason ? { reason: parsed.values.reason } : {}) }
  });

  log(located.id);
  return 0;
}

function cmdApprove(args) { return decideApproval(args, 'approve'); }
function cmdDeny(args)    { return decideApproval(args, 'deny'); }

function cmdListApprovals(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        state: { type: 'string' },
        json:  { type: 'boolean' }
      },
      allowPositionals: false,
      strict: true
    });
  } catch (e) { return errExit(e.message, 1); }

  const states = parsed.values.state
    ? (parsed.values.state === 'all' ? ['pending', 'done'] : [parsed.values.state])
    : ['pending'];
  for (const s of states) {
    if (!['pending', 'done'].includes(s)) {
      return errExit(`--state must be pending, done, or all`, 1);
    }
  }

  const items = [];
  for (const state of states) {
    const dir = path.join(JOSH_ROOT, 'approvals', state);
    let files;
    try { files = fs.readdirSync(dir).filter(f => f.endsWith('.json')); } catch (e) { continue; }
    for (const f of files) {
      const a = readJson(path.join(dir, f));
      if (!a) continue;
      items.push({ ...a, _state: state });
    }
  }
  items.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));

  if (parsed.values.json) {
    log(JSON.stringify(items, null, 2));
    return 0;
  }
  if (items.length === 0) { log('(no approvals match)'); return 0; }

  log(`id (last 6)  state    age      decision   requester              summary`);
  log(`-----------  -------  -------  ---------  ---------------------  ------------------------`);
  for (const a of items) {
    const idShort = (a.id || '').slice(-6);
    const state = (a._state || '').padEnd(7);
    const age = formatAge(a.created_at).padEnd(7);
    const decision = (a.decision || '—').padEnd(9);
    const req = (a.requester || '').slice(0, 21).padEnd(21);
    const summary = (a.summary || '').slice(0, 50);
    log(`${idShort}       ${state}  ${age}  ${decision}  ${req}  ${summary}`);
  }
  return 0;
}

// ─── Locks: acquire, release, list ───────────────────────────────────────────

function parseTtl(raw) {
  const m = raw.match(/^(\d+)\s*(s|m|h|d)?$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = (m[2] || 's').toLowerCase();
  return n * ({ s: 1, m: 60, h: 3600, d: 86400 }[unit]);
}

function cmdLock(args) {
  const sub = args[0];
  if (!sub) {
    err('error: lock subcommand required. usage: josh lock <acquire|release|list>');
    return 1;
  }
  const subArgs = args.slice(1);
  switch (sub) {
    case 'acquire': return cmdLockAcquire(subArgs);
    case 'release': return cmdLockRelease(subArgs);
    case 'list':    return cmdLockList(subArgs);
    default:
      err(`unknown lock subcommand: ${sub}`);
      err('supported: acquire, release, list');
      return 1;
  }
}

function cmdLockAcquire(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        ttl:    { type: 'string' },
        reason: { type: 'string' },
        as:     { type: 'string' },
        actor:  { type: 'string' }
      },
      allowPositionals: true,
      strict: true
    });
  } catch (e) { return errExit(e.message, 1); }

  const resource = parsed.positionals[0];
  if (!resource) return errExit('lock acquire requires <resource>', 1);
  if (!/^[\w.-]+$/.test(resource)) {
    return errExit('resource must contain only word chars, hyphens, or dots', 1);
  }

  const ttlRaw = parsed.values.ttl || '1h';
  const ttlSec = parseTtl(ttlRaw);
  if (ttlSec === null || ttlSec < 1 || ttlSec > 86400) {
    return errExit('--ttl format: <n>[s|m|h|d] in [1, 86400] seconds (e.g. 1h, 30m)', 1);
  }

  const actor = resolveActor(parsed.values);
  const lockFile = path.join(JOSH_ROOT, 'locks', `${resource}.json`);
  const now = Date.now();

  if (fs.existsSync(lockFile)) {
    const existing = readJson(lockFile);
    if (existing && existing.expires_at) {
      const expiresAt = new Date(existing.expires_at).getTime();
      if (now < expiresAt) {
        err(`error: lock '${resource}' held by ${existing.holder} until ${existing.expires_at}`);
        return 3;
      }
    }
    // Stale or unparseable — remove before re-acquiring.
    try { fs.unlinkSync(lockFile); } catch (e) { /* race: another agent may have cleaned it */ }
  }

  const acquiredAt = new Date(now).toISOString();
  const expiresAt = new Date(now + ttlSec * 1000).toISOString();
  const lockObj = {
    schema: 1,
    resource,
    holder: actor,
    acquired_at: acquiredAt,
    expires_at: expiresAt,
    reason: parsed.values.reason || null
  };

  // wx = exclusive create: fails with EEXIST if another agent won the race.
  try {
    fs.writeFileSync(lockFile, JSON.stringify(lockObj, null, 2) + '\n', { flag: 'wx' });
  } catch (e) {
    if (e.code === 'EEXIST') {
      err(`error: lock '${resource}' acquired by another agent concurrently`);
      return 3;
    }
    err(`error: could not write lock file: ${e.message}`);
    return 4;
  }

  appendAudit({
    actor,
    action: 'lock.acquired',
    id: resource,
    details: { holder: actor, acquired_at: acquiredAt, expires_at: expiresAt, reason: lockObj.reason }
  });

  log(resource);
  return 0;
}

function cmdLockRelease(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        as:    { type: 'string' },
        actor: { type: 'string' }
      },
      allowPositionals: true,
      strict: true
    });
  } catch (e) { return errExit(e.message, 1); }

  const resource = parsed.positionals[0];
  if (!resource) return errExit('lock release requires <resource>', 1);

  const lockFile = path.join(JOSH_ROOT, 'locks', `${resource}.json`);
  if (!fs.existsSync(lockFile)) {
    err(`error: lock '${resource}' not found`);
    return 2;
  }

  const existing = readJson(lockFile);
  const actor = resolveActor(parsed.values);

  try { fs.unlinkSync(lockFile); }
  catch (e) {
    if (e.code === 'ENOENT') {
      err(`error: lock '${resource}' already gone (race?)`);
      return 3;
    }
    err(`error: could not remove lock: ${e.message}`);
    return 4;
  }

  appendAudit({
    actor,
    action: 'lock.released',
    id: resource,
    details: { previous_holder: existing?.holder || null, acquired_at: existing?.acquired_at || null }
  });

  log(resource);
  return 0;
}

function cmdLockList(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: { json: { type: 'boolean' } },
      allowPositionals: false,
      strict: true
    });
  } catch (e) { return errExit(e.message, 1); }

  const dir = path.join(JOSH_ROOT, 'locks');
  let files;
  try { files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.endsWith('.tmp')); }
  catch (e) { files = []; }

  const now = Date.now();
  const locks = [];
  for (const f of files) {
    const lock = readJson(path.join(dir, f));
    if (!lock) continue;
    const expired = lock.expires_at && now >= new Date(lock.expires_at).getTime();
    locks.push({ ...lock, _expired: expired });
  }
  locks.sort((a, b) => (a.acquired_at || '').localeCompare(b.acquired_at || ''));

  if (parsed.values.json) {
    log(JSON.stringify(locks, null, 2));
    return 0;
  }
  if (locks.length === 0) {
    log('(no locks held)');
    return 0;
  }

  log(`resource             holder                   expires_at            status   reason`);
  log(`-------------------  -----------------------  --------------------  -------  -------------------------`);
  for (const l of locks) {
    const res    = (l.resource || '').slice(0, 19).padEnd(19);
    const holder = (l.holder   || '').slice(0, 23).padEnd(23);
    const expires = (l.expires_at || '—').padEnd(20);
    const status = l._expired ? 'expired' : 'held   ';
    const reason = (l.reason || '—').slice(0, 50);
    log(`${res}  ${holder}  ${expires}  ${status}  ${reason}`);
  }
  return 0;
}

// ─── Review: push, verdict, list ─────────────────────────────────────────────

function cmdPushReview(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        'subject-ref':   { type: 'string' },
        'subject-type':  { type: 'string' },
        reviewer:        { type: 'string' },
        framing:         { type: 'string' },
        deadline:        { type: 'string' },
        priority:        { type: 'string' },
        notes:           { type: 'string' },
        'requested-by':  { type: 'string' }
      },
      allowPositionals: true,
      strict: true
    });
  } catch (e) { return errExit(e.message, 1); }

  const v = parsed.values;
  if (!v['subject-ref']) {
    return errExit('--subject-ref required (URL, file path, or ID)', 1);
  }
  if (!v.reviewer) return errExit('--reviewer required (claude|codex|<session-id>)', 1);

  const subjectType = v['subject-type'] || 'pr';
  if (!VALID_SUBJECT_TYPES.includes(subjectType)) {
    return errExit(`--subject-type must be one of: ${VALID_SUBJECT_TYPES.join(', ')}`, 1);
  }
  const framing = v.framing || 'regular';
  if (!VALID_FRAMINGS.includes(framing)) {
    return errExit(`--framing must be one of: ${VALID_FRAMINGS.join(', ')}`, 1);
  }
  const priority = v.priority || 'p2';
  if (!VALID_PRIORITIES.includes(priority)) {
    return errExit(`invalid priority '${priority}'. allowed: ${VALID_PRIORITIES.join(', ')}`, 1);
  }

  const id = ulid();
  const now = new Date().toISOString();
  const requestedBy = v['requested-by'] || defaultActor();

  const review = {
    schema: 1,
    id,
    created_at: now,
    requested_by: requestedBy,
    subject_type: subjectType,
    subject_ref: v['subject-ref'],
    framing,
    reviewer: v.reviewer,
    deadline: v.deadline || null,
    priority,
    notes: v.notes || '',
    history: [{ at: now, actor: requestedBy, event: 'requested' }]
  };

  const dir = path.join(JOSH_ROOT, 'reviews', 'pending');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  writeJsonAtomic(path.join(dir, `${id}.json`), review);

  appendAudit({
    actor: requestedBy,
    action: 'review.requested',
    id,
    details: { reviewer: v.reviewer, subject_type: subjectType, subject_ref: v['subject-ref'], framing }
  });

  log(id);
  return 0;
}

function cmdReview(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        verdict:   { type: 'string' },
        reasoning: { type: 'string' },
        as:        { type: 'string' },
        actor:     { type: 'string' }
      },
      allowPositionals: true,
      strict: true
    });
  } catch (e) { return errExit(e.message, 1); }

  const idArg = parsed.positionals[0];
  if (!idArg) return errExit('review requires <review-id>', 1);
  const verdict = parsed.values.verdict;
  if (!verdict) return errExit('--verdict required (approve|request_changes|block)', 1);
  if (!VALID_REVIEW_VERDICTS.includes(verdict)) {
    return errExit(`--verdict must be one of: ${VALID_REVIEW_VERDICTS.join(', ')}`, 1);
  }
  const reasoning = parsed.values.reasoning;
  if (!reasoning) return errExit('--reasoning "<text>" required (markdown OK)', 1);

  const located = locateReview(idArg);
  if (located.error) return errExit(located.error, located.code);
  if (located.state !== 'pending') return errExit(`review already ${located.state}`, 1);

  const fromPath = located.path;
  const toPath = path.join(JOSH_ROOT, 'reviews', 'done', `${located.id}.json`);

  try { fs.renameSync(fromPath, toPath); }
  catch (e) {
    if (e.code === 'ENOENT') return errExit('review no longer pending (race?)', 3);
    throw e;
  }

  const review = readJson(toPath);
  if (!review) return errExit('malformed review', 4);
  const now = new Date().toISOString();
  const actor = resolveActor(parsed.values);
  review.verdict = verdict;
  review.reasoning = reasoning;
  review.completed_at = now;
  review.completed_by = actor;
  review.history = review.history || [];
  review.history.push({
    at: now,
    actor,
    event: 'verdict_submitted',
    details: { verdict }
  });
  writeJsonAtomic(toPath, review);

  appendAudit({
    actor,
    action: 'review.completed',
    id: located.id,
    details: { verdict, reviewer: review.reviewer }
  });

  log(located.id);
  return 0;
}

function cmdListReviews(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        state:    { type: 'string' },
        reviewer: { type: 'string' },
        verdict:  { type: 'string' },
        json:     { type: 'boolean' }
      },
      allowPositionals: false,
      strict: true
    });
  } catch (e) { return errExit(e.message, 1); }

  const states = parsed.values.state
    ? (parsed.values.state === 'all' ? ['pending', 'done'] : [parsed.values.state])
    : ['pending'];
  for (const s of states) {
    if (!['pending', 'done'].includes(s)) {
      return errExit(`--state must be pending, done, or all`, 1);
    }
  }

  const items = [];
  for (const state of states) {
    const dir = path.join(JOSH_ROOT, 'reviews', state);
    let files;
    try { files = fs.readdirSync(dir).filter(f => f.endsWith('.json')); } catch (e) { continue; }
    for (const f of files) {
      const r = readJson(path.join(dir, f));
      if (!r) continue;
      if (parsed.values.reviewer && r.reviewer !== parsed.values.reviewer) continue;
      if (parsed.values.verdict && r.verdict !== parsed.values.verdict) continue;
      items.push({ ...r, _state: state });
    }
  }
  const rank = { p0: 0, p1: 1, p2: 2, p3: 3 };
  items.sort((a, b) => {
    const pa = rank[a.priority] ?? 99, pb = rank[b.priority] ?? 99;
    if (pa !== pb) return pa - pb;
    return (a.created_at || '').localeCompare(b.created_at || '');
  });

  if (parsed.values.json) {
    log(JSON.stringify(items, null, 2));
    return 0;
  }
  if (items.length === 0) { log('(no reviews match)'); return 0; }

  log(`id (last 6)  state    pri  age      reviewer        framing       verdict          subject`);
  log(`-----------  -------  ---  -------  --------------  ------------  ---------------  ----------------------`);
  for (const r of items) {
    const idShort = (r.id || '').slice(-6);
    const state = (r._state || '').padEnd(7);
    const pri = (r.priority || '').padEnd(3);
    const age = formatAge(r.created_at).padEnd(7);
    const reviewer = (r.reviewer || '').slice(0, 14).padEnd(14);
    const framing = (r.framing || '').padEnd(12);
    const verdict = (r.verdict || '—').padEnd(15);
    const subj = (r.subject_ref || '').slice(0, 60);
    log(`${idShort}       ${state}  ${pri}  ${age}  ${reviewer}  ${framing}  ${verdict}  ${subj}`);
  }
  return 0;
}

// ─── Schema validation ───────────────────────────────────────────────────────

// Each validator returns an array of error strings. Empty = valid.

function vRequired(obj, field, type) {
  if (obj[field] === undefined || obj[field] === null) return [`${field}: missing`];
  if (type === 'array' && !Array.isArray(obj[field])) return [`${field}: not array`];
  if (type !== 'array' && typeof obj[field] !== type) return [`${field}: not ${type}`];
  return [];
}
function vEnum(obj, field, allowed, optional = false) {
  if (obj[field] === undefined || obj[field] === null) return optional ? [] : [`${field}: missing`];
  if (!allowed.includes(obj[field])) return [`${field}: '${obj[field]}' not in [${allowed.join(', ')}]`];
  return [];
}
function vIso8601(obj, field, optional = false) {
  const v = obj[field];
  if (v === undefined || v === null) return optional ? [] : [`${field}: missing`];
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(v)) {
    return [`${field}: '${v}' not ISO-8601`];
  }
  return [];
}

function validateTodo(t) {
  return [
    ...vRequired(t, 'schema', 'number'),
    ...vRequired(t, 'id', 'string'),
    ...vRequired(t, 'title', 'string'),
    ...vIso8601(t, 'created_at'),
    ...vRequired(t, 'created_by', 'string'),
    ...vEnum(t, 'priority', VALID_PRIORITIES),
    ...vRequired(t, 'history', 'array')
  ].filter(Boolean);
}

function validateHandoff(h) {
  return [
    ...vRequired(h, 'schema', 'number'),
    ...vRequired(h, 'id', 'string'),
    ...vRequired(h, 'thread_id', 'string'),
    ...vRequired(h, 'from', 'string'),
    ...vEnum(h, 'to', KNOWN_AGENTS),
    ...vEnum(h, 'kind', HANDOFF_KINDS),
    ...vRequired(h, 'title', 'string'),
    ...vRequired(h, 'body', 'string'),
    ...vIso8601(h, 'created_at'),
    ...vEnum(h, 'priority', VALID_PRIORITIES, true)
  ];
}

function validateApproval(a) {
  return [
    ...vRequired(a, 'schema', 'number'),
    ...vRequired(a, 'id', 'string'),
    ...vIso8601(a, 'created_at'),
    ...vRequired(a, 'requester', 'string'),
    ...vRequired(a, 'summary', 'string'),
    ...vRequired(a, 'options', 'array')
  ];
}

function validateReview(r) {
  return [
    ...vRequired(r, 'schema', 'number'),
    ...vRequired(r, 'id', 'string'),
    ...vIso8601(r, 'created_at'),
    ...vRequired(r, 'requested_by', 'string'),
    ...vEnum(r, 'subject_type', VALID_SUBJECT_TYPES),
    ...vRequired(r, 'subject_ref', 'string'),
    ...vEnum(r, 'framing', VALID_FRAMINGS),
    ...vRequired(r, 'reviewer', 'string')
  ];
}

function validateLock(l) {
  return [
    ...vRequired(l, 'schema', 'number'),
    ...vRequired(l, 'resource', 'string'),
    ...vRequired(l, 'holder', 'string'),
    ...vIso8601(l, 'acquired_at'),
    ...vIso8601(l, 'expires_at')
  ];
}

function validateStatus(s) {
  const errs = [
    ...vRequired(s, 'schema', 'number'),
    ...vIso8601(s, 'updated_at'),
    ...vRequired(s, 'agents', 'object'),
    ...vRequired(s, 'queue', 'object')
  ];
  return errs;
}

function validateControl(c) {
  return [
    ...vRequired(c, 'schema', 'number'),
    ...vRequired(c, 'id', 'string'),
    ...vRequired(c, 'action', 'string')
  ];
}

// Map relative path → validator. Returns null if file is not validatable.
function validatorFor(rel) {
  const norm = rel.replace(/\\/g, '/');
  if (norm === 'status.json') return { kind: 'root-status', fn: validateStatus };
  if (norm.match(/^todo\/(incoming|triaged|claimed|planning|awaiting_approval|approved|rejected|revised|in_progress|done|blocked|failed|cancelled)\/[^/]+\/meta\.json$/)) {
    return { kind: 'todo', fn: validateTodo };
  }
  if (norm.match(/^(claude|codex|orchestrator)\/(incoming|processed)\/.+\.json$/)) {
    // orchestrator/incoming is control commands; everything else is handoff.
    if (norm.startsWith('orchestrator/incoming/')) return { kind: 'control', fn: validateControl };
    return { kind: 'handoff', fn: validateHandoff };
  }
  if (norm.match(/^(claude|codex|orchestrator)\/status\.json$/)) {
    // Agent status — minimal shape.
    return { kind: 'agent-status', fn: (o) => [
      ...vRequired(o, 'schema', 'number'),
      ...vRequired(o, 'agent', 'string')
    ]};
  }
  if (norm.match(/^approvals\/(pending|done)\/.+\.json$/)) return { kind: 'approval', fn: validateApproval };
  if (norm.match(/^reviews\/(pending|done)\/.+\.json$/)) return { kind: 'review', fn: validateReview };
  if (norm.match(/^locks\/.+\.json$/)) return { kind: 'lock', fn: validateLock };
  return null; // unknown / not-a-tracked-artifact
}

function cmdValidate(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        json:    { type: 'boolean' },
        verbose: { type: 'boolean' },
        strict:  { type: 'boolean' }   // exit non-zero on any error
      },
      allowPositionals: false,
      strict: true
    });
  } catch (e) { return errExit(e.message, 1); }

  const results = { ok: 0, errors: [], skipped: 0, malformed_json: 0 };
  const byKind = {};

  for (const file of walkTree(JOSH_ROOT, 0, 4)) {
    const rel = path.relative(JOSH_ROOT, file).replace(/\\/g, '/');
    if (!rel.endsWith('.json')) continue;
    const v = validatorFor(rel);
    if (!v) { results.skipped++; continue; }

    let obj;
    try { obj = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (e) {
      results.malformed_json++;
      results.errors.push({ file: rel, kind: v.kind, errors: [`json parse: ${e.message}`] });
      continue;
    }

    const errs = v.fn(obj);
    byKind[v.kind] = byKind[v.kind] || { ok: 0, bad: 0 };
    if (errs.length === 0) {
      results.ok++;
      byKind[v.kind].ok++;
    } else {
      results.errors.push({ file: rel, kind: v.kind, errors: errs });
      byKind[v.kind].bad++;
    }
  }

  if (parsed.values.json) {
    log(JSON.stringify({ ok: results.ok, error_count: results.errors.length,
      malformed_json: results.malformed_json, skipped: results.skipped,
      by_kind: byKind, errors: results.errors }, null, 2));
    return parsed.values.strict && results.errors.length > 0 ? 1 : 0;
  }

  log(`josh validate — ${JOSH_ROOT}`);
  log(``);
  log(`scanned: ${results.ok + results.errors.length} validatable files (${results.skipped} skipped, ${results.malformed_json} malformed JSON)`);
  log(``);
  log(`by kind:`);
  for (const [kind, counts] of Object.entries(byKind)) {
    const tag = counts.bad > 0 ? '  bad: ' + counts.bad : '';
    log(`  ${kind.padEnd(15)} ok: ${counts.ok}${tag}`);
  }

  if (results.errors.length > 0) {
    log(``);
    log(`errors:`);
    for (const e of results.errors) {
      log(`  ${e.file} [${e.kind}]:`);
      for (const msg of e.errors) log(`    - ${msg}`);
    }
  } else {
    log(``);
    log(`✓ all files valid`);
  }

  return parsed.values.strict && results.errors.length > 0 ? 1 : 0;
}

function cmdProject(args) {
  const sub = args[0];
  const rest = args.slice(1);
  if (!sub || sub === 'help' || sub === '--help' || sub === '-h') {
    log(`Usage: josh project <subcommand>

Subcommands:
  import <corpus-path>    Import a Markdown corpus (project + agents + todos)
  status [--project ID]   Render the daily-review template
  sync [--project ID]     Refresh imported entities from source files`);
    return 0;
  }
  switch (sub) {
    case 'import':  return cmdProjectImport(rest);
    case 'status':  return cmdProjectStatus(rest);
    case 'sync':    return cmdProjectSync(rest);
    default:
      err(`unknown project subcommand: ${sub}`);
      return 1;
  }
}

function cmdProjectImport(args) {
  if (args.length < 1 || args[0].startsWith('-')) {
    err('usage: josh project import <corpus-path>');
    return 1;
  }
  const corpusPath = path.resolve(args[0]);
  if (!fs.existsSync(corpusPath)) {
    err(`error: corpus path does not exist: ${corpusPath}`);
    return 2;
  }
  const { importProject } = require('./lib/project-importer');
  const actor = defaultActor();
  try {
    const result = importProject(corpusPath, { joshRoot: JOSH_ROOT, actor });
    log(`imported project ${result.project_id}`);
    log(`  todos:  ${result.todo_count}`);
    log(`  agents: ${result.agent_count}`);
    return 0;
  } catch (e) {
    err(`import failed: ${e.message}`);
    if (process.env.JOSH_DEBUG) err(e.stack);
    return 4;
  }
}

function cmdProjectStatus(args) {
  const { renderDailyReview } = require('./lib/project-status');
  let projectId = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project') {
      projectId = args[++i];
    }
  }
  if (!projectId) {
    const projectsDir = path.join(JOSH_ROOT, 'projects');
    if (!fs.existsSync(projectsDir)) {
      err('no projects imported yet');
      return 2;
    }
    const ids = fs.readdirSync(projectsDir).filter((d) =>
      fs.statSync(path.join(projectsDir, d)).isDirectory()
    );
    if (ids.length === 0) {
      err('no projects imported yet');
      return 2;
    }
    if (ids.length > 1) {
      err(`multiple projects exist; specify one with --project <id>`);
      err(`available: ${ids.join(', ')}`);
      return 1;
    }
    projectId = ids[0];
  }
  try {
    log(renderDailyReview(projectId, { joshRoot: JOSH_ROOT }));
    return 0;
  } catch (e) {
    err(e.message);
    return 2;
  }
}

function cmdProjectSync(args) {
  const { applySync } = require('./lib/project-sync');
  let projectId = null;
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project') projectId = args[++i];
    else if (args[i] === '--dry-run') dryRun = true;
  }
  if (!projectId) {
    const projectsDir = path.join(JOSH_ROOT, 'projects');
    if (!fs.existsSync(projectsDir)) {
      err('no projects imported yet');
      return 2;
    }
    const ids = fs.readdirSync(projectsDir).filter((d) =>
      fs.statSync(path.join(projectsDir, d)).isDirectory()
    );
    if (ids.length === 0) { err('no projects imported yet'); return 2; }
    if (ids.length > 1) {
      err('multiple projects exist; specify one with --project <id>');
      return 1;
    }
    projectId = ids[0];
  }
  try {
    const result = applySync(projectId, { joshRoot: JOSH_ROOT, actor: defaultActor(), dryRun });
    log(`sync ${result.dry_run ? '(dry-run) ' : ''}for project ${result.project_id}`);
    log(`  agents:  changed=${result.agents_changed} missing=${result.agents_missing} updated=${result.agents_updated}`);
    log(`  tasks:   changed=${result.tasks_changed} missing=${result.tasks_missing} updated=${result.tasks_updated}`);
    return 0;
  } catch (e) {
    err(e.message);
    if (process.env.JOSH_DEBUG) err(e.stack);
    return 4;
  }
}

function cmdPlan(args) {
  const sub = args[0];
  const rest = args.slice(1);
  if (!sub || sub === 'help' || sub === '--help' || sub === '-h') {
    log(`Usage: josh plan <subcommand>

Subcommands:
  submit <todo-id> --plan <path>          claimed → awaiting_approval (validates 8-section plan)
  approve <todo-id>                       awaiting_approval → approved (writes approval signal)
  reject <todo-id> --reason "..."         awaiting_approval → rejected`);
    return 0;
  }
  switch (sub) {
    case 'submit':  return cmdPlanSubmit(rest);
    case 'approve': return cmdPlanApprove(rest);
    case 'reject':  return cmdPlanReject(rest);
    default:
      err(`unknown plan subcommand: ${sub}`);
      return 1;
  }
}

function cmdPlanSubmit(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        plan:  { type: 'string' },
        as:    { type: 'string' },
        actor: { type: 'string' },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch (e) { return errExit(e.message, 1); }

  const idArg = parsed.positionals[0];
  if (!idArg) return errExit('plan submit requires <todo-id>', 1);
  const planPath = parsed.values.plan;
  if (!planPath) return errExit('plan submit requires --plan <path>', 1);
  if (!fs.existsSync(planPath)) return errExit(`plan file not found: ${planPath}`, 2);

  const actor = resolveActor(parsed.values);
  const planText = fs.readFileSync(planPath, 'utf8');
  const { validatePlan } = require('./lib/plan-validator');
  const v = validatePlan(planText);
  if (!v.ok) {
    err('plan validation failed:');
    for (const e of v.errors) err(`  - ${e}`);
    return 1;
  }

  // Transition claimed → awaiting_approval (single move; planning state is logged in history).
  const r = transitionTodo({
    srcStates: ['claimed'],
    dst: 'awaiting_approval',
    idOrSuffix: idArg,
    actor,
    eventName: 'plan_submitted',
    eventDetails: { plan_id: v.frontmatter.id, plan_status: v.frontmatter.status },
    update: (t, now) => {
      t.history.push({ at: now, actor, event: 'planning', details: { plan_id: v.frontmatter.id } });
      t.plan_id = v.frontmatter.id;
    },
    audit: { action: 'todo.plan_submitted', details: { plan_id: v.frontmatter.id } },
  });
  if (r.error) return errExit(r.error, r.code);

  // After the move, the folder is at awaiting_approval/<id>/.
  const folder = path.join(JOSH_ROOT, 'todo', 'awaiting_approval', r.id);
  // Copy plan.md into the folder.
  fs.writeFileSync(path.join(folder, 'plan.md'), planText, 'utf8');
  // Write plan-review.json.
  const planReview = {
    schema_version: 1,
    plan_id: v.frontmatter.id,
    submitted_at: new Date().toISOString(),
    submitted_by: actor,
    ready_for_implementation: false,
    blocking_decisions: [],
    section_count: v.sections.length,
  };
  writeJsonAtomic(path.join(folder, 'plan-review.json'), planReview);
  // Write approval signal file (atomic-mv pattern).
  fs.writeFileSync(path.join(folder, 'approval'), 'pending\n', 'utf8');

  log(r.id);
  return 0;
}

function cmdPlanApprove(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        as:    { type: 'string' },
        actor: { type: 'string' },
        note:  { type: 'string' },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch (e) { return errExit(e.message, 1); }
  const idArg = parsed.positionals[0];
  if (!idArg) return errExit('plan approve requires <todo-id>', 1);
  const actor = resolveActor(parsed.values);

  const r = transitionTodo({
    srcStates: ['awaiting_approval'],
    dst: 'approved',
    idOrSuffix: idArg,
    actor,
    eventName: 'plan_approved',
    eventDetails: parsed.values.note ? { note: parsed.values.note } : {},
    update: (t, now) => {
      t.plan_approved_at = now;
      t.plan_approved_by = actor;
    },
    audit: { action: 'todo.plan_approved', details: parsed.values.note ? { note: parsed.values.note } : {} },
  });
  if (r.error) return errExit(r.error, r.code);

  // Update the approval signal file in the new location.
  const folder = path.join(JOSH_ROOT, 'todo', 'approved', r.id);
  try { fs.writeFileSync(path.join(folder, 'approval'), 'approved\n', 'utf8'); } catch (e) { /* non-fatal */ }
  log(r.id);
  return 0;
}

function cmdPlanReject(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        as:     { type: 'string' },
        actor:  { type: 'string' },
        reason: { type: 'string' },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch (e) { return errExit(e.message, 1); }
  const idArg = parsed.positionals[0];
  if (!idArg) return errExit('plan reject requires <todo-id>', 1);
  const reason = parsed.values.reason;
  if (!reason) return errExit('plan reject requires --reason "<text>"', 1);
  const actor = resolveActor(parsed.values);

  const r = transitionTodo({
    srcStates: ['awaiting_approval'],
    dst: 'rejected',
    idOrSuffix: idArg,
    actor,
    eventName: 'plan_rejected',
    eventDetails: { reason },
    update: (t, now) => {
      t.plan_rejected_at = now;
      t.plan_rejected_by = actor;
      t.plan_rejection_reason = reason;
    },
    audit: { action: 'todo.plan_rejected', details: { reason } },
  });
  if (r.error) return errExit(r.error, r.code);

  const folder = path.join(JOSH_ROOT, 'todo', 'rejected', r.id);
  try { fs.writeFileSync(path.join(folder, 'approval'), 'rejected\n', 'utf8'); } catch (e) { /* non-fatal */ }
  log(r.id);
  return 0;
}

// ─── Phase 4: verdict matrix ─────────────────────────────────────────────────

function cmdVerdict(args) {
  const sub = args[0];
  const rest = args.slice(1);
  if (!sub || sub === 'help' || sub === '--help' || sub === '-h') {
    log(`Usage: josh verdict <subcommand>

Subcommands:
  submit <todo-id> --envelope <path>    Validate + write a verdict envelope
  list <todo-id>                        List per-agent verdicts on a todo
  show <todo-id> [<agent-id>|winner]    Print a verdict envelope (or winner.json)
  verify <todo-id> [<agent-id>]         Verify Ed25519 signatures (Phase 6)`);
    return 0;
  }
  switch (sub) {
    case 'submit': return cmdVerdictSubmit(rest);
    case 'list':   return cmdVerdictList(rest);
    case 'show':   return cmdVerdictShow(rest);
    case 'verify': return cmdVerdictVerify(rest);
    default:
      err(`unknown verdict subcommand: ${sub}`);
      return 1;
  }
}

function cmdVerdictSubmit(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        envelope: { type: 'string' },
        as:       { type: 'string' },
        actor:    { type: 'string' },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch (e) { return errExit(e.message, 1); }

  const todoId = parsed.positionals[0];
  if (!todoId) return errExit('verdict submit requires <todo-id>', 1);
  const envPath = parsed.values.envelope;
  if (!envPath) return errExit('verdict submit requires --envelope <path>', 1);
  if (!fs.existsSync(envPath)) return errExit(`envelope not found: ${envPath}`, 2);

  const { writeEnvelope, validateEnvelope, listVerdicts } = require('./lib/verdict-envelope');
  let envelope;
  try { envelope = JSON.parse(fs.readFileSync(envPath, 'utf8')); }
  catch (e) { return errExit(`malformed envelope: ${e.message}`, 1); }
  const v = validateEnvelope(envelope);
  if (!v.ok) {
    err('envelope validation failed:');
    for (const m of v.errors) err(`  - ${m}`);
    return 1;
  }
  if (envelope.todo_id !== todoId) {
    return errExit(`envelope todo_id (${envelope.todo_id}) does not match argument (${todoId})`, 1);
  }

  let written;
  try { written = writeEnvelope(JOSH_ROOT, todoId, envelope); }
  catch (e) { return errExit(e.message, 4); }

  appendAudit({ actor: resolveActor(parsed.values), action: 'verdict.submitted', id: envelope.id, details: { todo_id: todoId, agent_id: envelope.agent_id, status: envelope.payload.status } });
  log(`verdict submitted: ${envelope.agent_id} → ${path.relative(JOSH_ROOT, written).replace(/\\/g, '/')}`);

  const all = listVerdicts(JOSH_ROOT, todoId);
  log(`  envelopes on ${todoId}: ${all.length} (${all.join(', ')})`);
  return 0;
}

function cmdVerdictList(args) {
  const todoId = args[0];
  if (!todoId) return errExit('verdict list requires <todo-id>', 1);
  const { listVerdicts, readEnvelope, findTodoFolder } = require('./lib/verdict-envelope');
  if (!findTodoFolder(JOSH_ROOT, todoId)) return errExit(`todo ${todoId} not found`, 2);
  const ids = listVerdicts(JOSH_ROOT, todoId);
  if (ids.length === 0) { log('(no verdicts)'); return 0; }
  for (const a of ids.sort()) {
    try {
      const env = readEnvelope(JOSH_ROOT, todoId, a);
      log(`  ${a.padEnd(6)} ${env.payload.status.padEnd(8)} conf=${env.confidence.toFixed(2)}  ${env.produced_at}`);
    } catch (e) {
      log(`  ${a.padEnd(6)} <unreadable>`);
    }
  }
  // Winner present?
  const folder = findTodoFolder(JOSH_ROOT, todoId);
  const winnerPath = path.join(folder, 'verdicts', 'winner.json');
  if (fs.existsSync(winnerPath)) {
    try {
      const w = JSON.parse(fs.readFileSync(winnerPath, 'utf8'));
      log(`  winner: ${w.winner_id}  (adjudicator confidence: ${w.adjudicator_confidence})`);
    } catch (e) {}
  }
  return 0;
}

function cmdVerdictShow(args) {
  const todoId = args[0];
  const which  = args[1] || 'winner';
  if (!todoId) return errExit('verdict show requires <todo-id> [<agent-id>|winner]', 1);
  const { findTodoFolder, readEnvelope } = require('./lib/verdict-envelope');
  const folder = findTodoFolder(JOSH_ROOT, todoId);
  if (!folder) return errExit(`todo ${todoId} not found`, 2);
  if (which === 'winner') {
    const p = path.join(folder, 'verdicts', 'winner.json');
    if (!fs.existsSync(p)) return errExit('no winner yet', 2);
    log(fs.readFileSync(p, 'utf8'));
    return 0;
  }
  try {
    log(JSON.stringify(readEnvelope(JOSH_ROOT, todoId, which), null, 2));
  } catch (e) { return errExit(e.message, 2); }
  return 0;
}

function cmdMatrix(args) {
  const sub = args[0];
  const rest = args.slice(1);
  if (!sub || sub === 'help' || sub === '--help' || sub === '-h') {
    log(`Usage: josh matrix <subcommand>

Subcommands:
  status [--todo <id>]                  Show matrix progress (per-todo if --todo)
  pending                               List queued E08 adjudications`);
    return 0;
  }
  switch (sub) {
    case 'status':  return cmdMatrixStatus(rest);
    case 'pending': return cmdMatrixPending(rest);
    default:
      err(`unknown matrix subcommand: ${sub}`);
      return 1;
  }
}

function cmdMatrixStatus(args) {
  let parsed;
  try { parsed = parseArgs({ args, options: { todo: { type: 'string' }, json: { type: 'boolean' } }, allowPositionals: true, strict: true }); }
  catch (e) { return errExit(e.message, 1); }
  const { listVerdicts, findTodoFolder } = require('./lib/verdict-envelope');
  const todoIds = parsed.values.todo
    ? [parsed.values.todo]
    : listInProgressIdsWithVerdicts();
  const rows = [];
  for (const tid of todoIds) {
    const folder = findTodoFolder(JOSH_ROOT, tid);
    if (!folder) continue;
    const meta = readJson(path.join(folder, 'meta.json')) || {};
    const cands = (meta.matrix_candidates || []).slice();
    const envelopes = listVerdicts(JOSH_ROOT, tid);
    rows.push({
      todo_id: tid,
      display_id: meta.display_id || tid,
      candidates: cands,
      envelopes,
      envelope_count: envelopes.length,
      candidate_count: cands.length,
      winner: fs.existsSync(path.join(folder, 'verdicts', 'winner.json')),
    });
  }

  if (parsed.values.json) { log(JSON.stringify(rows, null, 2)); return 0; }
  if (rows.length === 0) { log('(no in-flight matrices)'); return 0; }
  for (const r of rows) {
    log(`  ${r.display_id}  cands=${r.candidates.join(',') || '(unset)'}  envelopes=${r.envelope_count}/${r.candidate_count || '?'}  winner=${r.winner ? '✓' : '—'}`);
  }
  return 0;
}

function listInProgressIdsWithVerdicts() {
  const out = [];
  const dir = path.join(JOSH_ROOT, 'todo', 'in_progress');
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const v = path.join(dir, e.name, 'verdicts');
    if (fs.existsSync(v)) out.push(e.name);
  }
  return out;
}

function cmdMatrixPending(args = []) {
  // This took no parameters, so it never parsed its argv and every flag was
  // silently ignored — `matrix pending --json` printed the human list and
  // exited 0, which is the worst answer for a caller that asked for JSON.
  let parsed;
  try {
    parsed = parseArgs({ args, options: { json: { type: 'boolean' } }, allowPositionals: false, strict: true });
  } catch (e) { return errExit(e.message, 1); }

  const { listPendingAdjudications } = require('./lib/adjudicator');
  const list = listPendingAdjudications(JOSH_ROOT);
  if (parsed.values.json) { log(JSON.stringify(list, null, 2)); return 0; }
  if (list.length === 0) { log('(no pending adjudications)'); return 0; }
  for (const a of list) {
    log(`  ${a.id}  todo=${a.todo_id}  candidates=${a.candidate_count}  queued=${a.queued_at}`);
  }
  return 0;
}

// ─── Phase 6: cryptographic audit ────────────────────────────────────────────

function cmdAgent(args) {
  const sub = args[0];
  const rest = args.slice(1);
  if (!sub || sub === 'help' || sub === '--help' || sub === '-h') {
    log(`Usage: josh agent <subcommand>

Subcommands:
  mint <agent-id> [--rotate]      Mint Ed25519 keypair + DID; patch manifest
  show <agent-id>                 Show DID + pubkey path + brief_hash`);
    return 0;
  }
  switch (sub) {
    case 'mint': return cmdAgentMint(rest);
    case 'show': return cmdAgentShow(rest);
    default: err(`unknown agent subcommand: ${sub}`); return 1;
  }
}

function cmdAgentMint(args) {
  let parsed;
  try {
    parsed = parseArgs({ args, options: { rotate: { type: 'boolean' } }, allowPositionals: true, strict: true });
  } catch (e) { return errExit(e.message, 1); }
  const id = parsed.positionals[0];
  if (!id) return errExit('agent mint requires <agent-id>', 1);
  const { mintAgentIdentity } = require('./lib/identity');
  try {
    const r = mintAgentIdentity(JOSH_ROOT, id, { rotate: !!parsed.values.rotate });
    log(`agent ${id} minted`);
    log(`  did:        ${r.did}`);
    log(`  pubkey:     agents/${id}/pubkey.jwk`);
    log(`  identity:   agents/${id}/identity.key (mode 0600)`);
    log(`  version:    ${r.version}`);
    appendAudit({ actor: defaultActor(), action: 'agent.minted', id, details: { did: r.did, version: r.version } });
    return 0;
  } catch (e) { return errExit(e.message, 4); }
}

function cmdAgentShow(args) {
  const id = args[0];
  if (!id) return errExit('agent show requires <agent-id>', 1);
  const { agentBriefHash } = require('./lib/identity');
  const manifestPath = path.join(JOSH_ROOT, 'agents', id, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return errExit(`agent ${id} not found`, 2);
  const m = readJson(manifestPath);
  log(`agent ${id}`);
  log(`  did:         ${m.did || '(not minted)'}`);
  log(`  pubkey_path: ${m.pubkey_path || '(none)'}`);
  log(`  source:      ${m.source_path}`);
  try { log(`  brief_hash:  ${agentBriefHash(JOSH_ROOT, id)}`); } catch (e) {}
  log(`  version:     ${m.version || 1}`);
  return 0;
}

function cmdAudit(args) {
  const sub = args[0];
  const rest = args.slice(1);
  if (!sub || sub === 'help' || sub === '--help' || sub === '-h') {
    log(`Usage: josh audit <subcommand>

Subcommands:
  verify <date>                   Verify HMAC chain for a YYYY-MM-DD audit file
  rotate-key [--id YYYY-MM]       Mint a new audit key + emit key_rotated event
  list-keys                       List audit keys present in ~/.josh/keys/`);
    return 0;
  }
  switch (sub) {
    case 'verify':       return cmdAuditVerify(rest);
    case 'rotate-key':   return cmdAuditRotateKey(rest);
    case 'list-keys':    return cmdAuditListKeys(rest);
    default: err(`unknown audit subcommand: ${sub}`); return 1;
  }
}

function cmdAuditVerify(args) {
  const date = args[0];
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return errExit('audit verify requires <YYYY-MM-DD>', 1);
  const { verifyChain } = require('./lib/audit-chain');
  const r = verifyChain(JOSH_ROOT, date);
  const tail = (r.unchained > 0)
    ? `  (chained: ${r.chained}, unchained: ${r.unchained} legacy)`
    : `  (${r.chain_length} events)`;
  if (r.valid) {
    log(`audit ${date}: VALID${tail}`);
    return 0;
  }
  err(`audit ${date}: INVALID${tail}`);
  for (const e of r.errors.slice(0, 20)) {
    err(`  line ${e.position}: ${e.message}`);
  }
  if (r.errors.length > 20) err(`  ... ${r.errors.length - 20} more`);
  return 1;
}

function cmdAuditRotateKey(args) {
  let parsed;
  try { parsed = parseArgs({ args, options: { id: { type: 'string' } }, allowPositionals: false, strict: true }); }
  catch (e) { return errExit(e.message, 1); }
  const { rotateAuditKey } = require('./lib/audit-key');
  const { appendChainedAudit } = require('./lib/audit-chain');
  try {
    const r = rotateAuditKey(JOSH_ROOT, { newId: parsed.values.id });
    // Emit a key_rotated marker as the first event under the new key's umbrella for today.
    appendChainedAudit(JOSH_ROOT, {
      event: 'audit.key_rotated', actor: defaultActor(),
      details: { from: r.previous_key_id, to: r.current_key_id },
    }, { key_id: r.current_key_id });
    log(`audit key rotated: ${r.previous_key_id || '(genesis)'} → ${r.current_key_id}`);
    return 0;
  } catch (e) { return errExit(e.message, 4); }
}

function cmdAuditListKeys() {
  const { listAuditKeys } = require('./lib/audit-key');
  const ids = listAuditKeys(JOSH_ROOT);
  if (ids.length === 0) { log('(no audit keys)'); return 0; }
  for (const id of ids) log(`  audit-${id}.key`);
  return 0;
}

// ─── Phase 7: spec-evolver + lessons ─────────────────────────────────────────

function cmdEvolve(args) {
  const sub = args[0];
  const rest = args.slice(1);
  if (!sub || sub === 'help' || sub === '--help' || sub === '-h') {
    log(`Usage: josh evolve <subcommand>

Subcommands:
  start <agent-id> [--max-rounds 5] [--simulator <dir>] [--allow-any]
  status [<evolve-id>]
  list [--state active|pending_approval|done]
  approve <evolve-id> [--as actor]
  reject <evolve-id> --reason "..." [--as actor]`);
    return 0;
  }
  switch (sub) {
    case 'start':   return cmdEvolveStart(rest);
    case 'status':  return cmdEvolveStatus(rest);
    case 'list':    return cmdEvolveList(rest);
    case 'approve': return cmdEvolveApprove(rest);
    case 'reject':  return cmdEvolveReject(rest);
    default: err(`unknown evolve subcommand: ${sub}`); return 1;
  }
}

function cmdEvolveStart(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        'max-rounds': { type: 'string' },
        simulator:    { type: 'string' },
        'allow-any':  { type: 'boolean' },
        as:           { type: 'string' },
        actor:        { type: 'string' },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch (e) { return errExit(e.message, 1); }
  const agentId = parsed.positionals[0];
  if (!agentId) return errExit('evolve start requires <agent-id>', 1);
  const { enqueueEvolution, processRound, assembleApproval } = require('./lib/spec-evolver');
  let r;
  try {
    r = enqueueEvolution(JOSH_ROOT, agentId, {
      maxRounds: parsed.values['max-rounds'] ? parseInt(parsed.values['max-rounds'], 10) : undefined,
      allowAny: !!parsed.values['allow-any'],
    });
  } catch (e) { return errExit(e.message, 4); }
  log(`evolve queued: ${r.evolve_id}`);
  appendAudit({ actor: resolveActor(parsed.values), action: 'agent.evolve_started', id: r.evolve_id, details: { agent_id: agentId } });

  const simDir = parsed.values.simulator;
  if (simDir) {
    if (!fs.existsSync(simDir)) return errExit(`simulator dir not found: ${simDir}`, 2);
    const files = fs.readdirSync(simDir)
      .filter((f) => /^round-\d+\.json$/.test(f))
      .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));
    for (const f of files) {
      const candidate = JSON.parse(fs.readFileSync(path.join(simDir, f), 'utf8'));
      const pr = processRound(JOSH_ROOT, agentId, r.evolve_id, candidate);
      log(`  round ${candidate.round_num}: pass=${pr.latest.pass}/${pr.latest.total}  no_new_gaps=${pr.latest.no_new_gaps_found}  halted=${pr.halted}${pr.halted ? ' (' + pr.halt_reason + ')' : ''}`);
      if (pr.halted) {
        const a = assembleApproval(JOSH_ROOT, agentId, r.evolve_id);
        log(`  approval ready at: ${path.relative(JOSH_ROOT, a.approval_dir).replace(/\\/g, '/')}`);
        break;
      }
    }
  }
  return 0;
}

function cmdEvolveStatus(args) {
  const evId = args[0];
  const { listEvolutions, readState } = require('./lib/spec-evolver');
  if (!evId) {
    const list = listEvolutions(JOSH_ROOT);
    if (list.length === 0) { log('(no evolutions)'); return 0; }
    for (const e of list) {
      log(`  ${e.evolve_id}  loc=${e.location}${e.agent_id ? '  agent=' + e.agent_id : ''}${e.halted != null ? '  halted=' + e.halted : ''}${e.halt_reason ? '  reason=' + e.halt_reason : ''}`);
    }
    return 0;
  }
  const m = evId.match(/^evolve-([^-]+)-/);
  if (!m) return errExit('malformed evolve-id', 1);
  const agentId = m[1];
  const state = readState(JOSH_ROOT, agentId, evId);
  if (!state) return errExit(`evolve ${evId} not found`, 2);
  log(JSON.stringify(state, null, 2));
  return 0;
}

function cmdEvolveList(args) {
  let parsed;
  try { parsed = parseArgs({ args, options: { state: { type: 'string' }, json: { type: 'boolean' } }, allowPositionals: false, strict: true }); }
  catch (e) { return errExit(e.message, 1); }
  const { listEvolutions } = require('./lib/spec-evolver');
  const list = listEvolutions(JOSH_ROOT, { state: parsed.values.state });
  if (parsed.values.json) { log(JSON.stringify(list, null, 2)); return 0; }
  if (list.length === 0) { log('(none)'); return 0; }
  for (const e of list) {
    log(`  ${e.evolve_id}  loc=${e.location}${e.halt_reason ? '  reason=' + e.halt_reason : ''}`);
  }
  return 0;
}

function cmdEvolveApprove(args) {
  let parsed;
  try { parsed = parseArgs({ args, options: { as: { type: 'string' }, actor: { type: 'string' } }, allowPositionals: true, strict: true }); }
  catch (e) { return errExit(e.message, 1); }
  const evId = parsed.positionals[0];
  if (!evId) return errExit('evolve approve requires <evolve-id>', 1);
  const { applyApproval } = require('./lib/spec-evolver');
  let r;
  try { r = applyApproval(JOSH_ROOT, evId, { actor: resolveActor(parsed.values) }); }
  catch (e) { return errExit(e.message, 4); }
  log(`evolved ${r.agent_id} → version ${r.new_version}`);
  appendAudit({ actor: resolveActor(parsed.values), action: 'agent.evolved', id: evId, details: { agent_id: r.agent_id, new_version: r.new_version } });
  return 0;
}

function cmdEvolveReject(args) {
  let parsed;
  try { parsed = parseArgs({ args, options: { as: { type: 'string' }, actor: { type: 'string' }, reason: { type: 'string' } }, allowPositionals: true, strict: true }); }
  catch (e) { return errExit(e.message, 1); }
  const evId = parsed.positionals[0];
  if (!evId) return errExit('evolve reject requires <evolve-id>', 1);
  const reason = parsed.values.reason;
  if (!reason) return errExit('--reason required', 1);
  const { archiveRejection } = require('./lib/spec-evolver');
  try { archiveRejection(JOSH_ROOT, evId, reason, { actor: resolveActor(parsed.values) }); }
  catch (e) { return errExit(e.message, 4); }
  log(`evolve rejected: ${evId}`);
  appendAudit({ actor: resolveActor(parsed.values), action: 'agent.evolve_rejected', id: evId, details: { reason } });
  return 0;
}

function cmdLesson(args) {
  const sub = args[0];
  const rest = args.slice(1);
  if (!sub || sub === 'help' || sub === '--help' || sub === '-h') {
    log(`Usage: josh lesson <subcommand>

Subcommands:
  add <agent-id> "text" [--as actor]
  list <agent-id>`);
    return 0;
  }
  switch (sub) {
    case 'add':  return cmdLessonAdd(rest);
    case 'list': return cmdLessonList(rest);
    default: err(`unknown lesson subcommand: ${sub}`); return 1;
  }
}

function cmdLessonAdd(args) {
  let parsed;
  try { parsed = parseArgs({ args, options: { as: { type: 'string' }, actor: { type: 'string' } }, allowPositionals: true, strict: true }); }
  catch (e) { return errExit(e.message, 1); }
  const agentId = parsed.positionals[0];
  const text = parsed.positionals.slice(1).join(' ').trim();
  if (!agentId || !text) return errExit('lesson add requires <agent-id> "text"', 1);
  const { appendLesson } = require('./lib/lessons');
  appendLesson(JOSH_ROOT, agentId, text, { actor: resolveActor(parsed.values) });
  log(`lesson appended for ${agentId}`);
  appendAudit({ actor: resolveActor(parsed.values), action: 'agent.lesson_added', id: agentId, details: { text } });
  return 0;
}

function cmdLessonList(args) {
  const agentId = args[0];
  if (!agentId) return errExit('lesson list requires <agent-id>', 1);
  const { readLessons } = require('./lib/lessons');
  const r = readLessons(JOSH_ROOT, agentId);
  if (r.entries.length === 0) { log('(no lessons)'); return 0; }
  for (const e of r.entries) {
    log(`  [${e.at}] (${e.actor}) ${e.text}`);
  }
  return 0;
}

// ─── Phase 8: cross-runtime gateway ──────────────────────────────────────────

function cmdTool(args) {
  const sub = args[0];
  const rest = args.slice(1);
  if (!sub || sub === 'help' || sub === '--help' || sub === '-h') {
    log(`Usage: josh tool <subcommand>

Subcommands:
  register --id <id> [--command <c>] [--args <a,b>] [--cap <x,y>]
  unregister --id <id>
  list
  show <id>
  scope-add <agent-id> <tool-id>
  scope-remove <agent-id> <tool-id>
  scope-show <agent-id>
  violation log --todo <id> --agent <id> --tool <id> [--reason "..."]`);
    return 0;
  }
  switch (sub) {
    case 'register':     return cmdToolRegister(rest);
    case 'unregister':   return cmdToolUnregister(rest);
    case 'list':         return cmdToolList(rest);
    case 'show':         return cmdToolShow(rest);
    case 'scope-add':    return cmdToolScopeAdd(rest);
    case 'scope-remove': return cmdToolScopeRemove(rest);
    case 'scope-show':   return cmdToolScopeShow(rest);
    case 'violation':    return cmdToolViolation(rest);
    default: err(`unknown tool subcommand: ${sub}`); return 1;
  }
}

function cmdToolRegister(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        id: { type: 'string' },
        command: { type: 'string' },
        args: { type: 'string' },
        cap: { type: 'string' },
        env: { type: 'string' },
      },
      allowPositionals: false, strict: true,
    });
  } catch (e) { return errExit(e.message, 1); }
  if (!parsed.values.id) return errExit('--id required', 1);
  const { registerServer } = require('./lib/mcp-registry');
  const r = registerServer(JOSH_ROOT, {
    id: parsed.values.id,
    command: parsed.values.command || null,
    args: parsed.values.args ? parsed.values.args.split(',') : [],
    capabilities: parsed.values.cap ? parsed.values.cap.split(',') : [],
  });
  log(`registered tool: ${r.id}`);
  appendAudit({ actor: defaultActor(), action: 'tool.registered', id: r.id, details: { capabilities: r.capabilities } });
  return 0;
}

function cmdToolUnregister(args) {
  let parsed;
  try { parsed = parseArgs({ args, options: { id: { type: 'string' } }, allowPositionals: false, strict: true }); }
  catch (e) { return errExit(e.message, 1); }
  if (!parsed.values.id) return errExit('--id required', 1);
  const { unregisterServer } = require('./lib/mcp-registry');
  const r = unregisterServer(JOSH_ROOT, parsed.values.id);
  log(`unregistered ${r.removed} tool(s) named ${parsed.values.id}`);
  return 0;
}

function cmdToolList() {
  const { listServers } = require('./lib/mcp-registry');
  const list = listServers(JOSH_ROOT);
  if (list.length === 0) { log('(no MCP tools registered)'); return 0; }
  for (const s of list) {
    log(`  ${s.id.padEnd(20)} caps=${(s.capabilities || []).join(',')}`);
  }
  return 0;
}

function cmdToolShow(args) {
  const id = args[0];
  if (!id) return errExit('tool show requires <id>', 1);
  const { getServer } = require('./lib/mcp-registry');
  const s = getServer(JOSH_ROOT, id);
  if (!s) return errExit(`tool ${id} not found`, 2);
  log(JSON.stringify(s, null, 2));
  return 0;
}

function cmdToolScopeAdd(args) {
  const [agentId, toolId] = args;
  if (!agentId || !toolId) return errExit('scope-add requires <agent-id> <tool-id>', 1);
  const { addAllowedTool } = require('./lib/tool-scoping');
  try {
    const list = addAllowedTool(JOSH_ROOT, agentId, toolId);
    log(`agent ${agentId} allowed_tools: ${JSON.stringify(list)}`);
    appendAudit({ actor: defaultActor(), action: 'agent.scope_add', id: agentId, details: { tool_id: toolId } });
    return 0;
  } catch (e) { return errExit(e.message, 4); }
}

function cmdToolScopeRemove(args) {
  const [agentId, toolId] = args;
  if (!agentId || !toolId) return errExit('scope-remove requires <agent-id> <tool-id>', 1);
  const { removeAllowedTool } = require('./lib/tool-scoping');
  try {
    const list = removeAllowedTool(JOSH_ROOT, agentId, toolId);
    log(`agent ${agentId} allowed_tools: ${JSON.stringify(list)}`);
    appendAudit({ actor: defaultActor(), action: 'agent.scope_remove', id: agentId, details: { tool_id: toolId } });
    return 0;
  } catch (e) { return errExit(e.message, 4); }
}

function cmdToolScopeShow(args) {
  const agentId = args[0];
  if (!agentId) return errExit('scope-show requires <agent-id>', 1);
  const { resolveAllowedTools } = require('./lib/tool-scoping');
  const list = resolveAllowedTools(JOSH_ROOT, agentId);
  if (list === null) { log(`${agentId}: unrestricted (full tool access)`); return 0; }
  log(`${agentId}: ${JSON.stringify(list)}`);
  return 0;
}

function cmdToolViolation(args) {
  const sub = args[0];
  if (sub !== 'log') return errExit('tool violation usage: tool violation log --todo <id> --agent <id> --tool <id> [--reason "..."]', 1);
  let parsed;
  try {
    parsed = parseArgs({
      args: args.slice(1),
      options: { todo: { type: 'string' }, agent: { type: 'string' }, tool: { type: 'string' }, reason: { type: 'string' } },
      allowPositionals: false, strict: true,
    });
  } catch (e) { return errExit(e.message, 1); }
  if (!parsed.values.todo || !parsed.values.agent || !parsed.values.tool) {
    return errExit('--todo, --agent, --tool all required', 1);
  }
  const { recordViolation, resolveAllowedTools, checkScope } = require('./lib/tool-scoping');
  const allowed = resolveAllowedTools(JOSH_ROOT, parsed.values.agent);
  const check = checkScope(allowed, parsed.values.tool);
  const r = recordViolation(JOSH_ROOT, {
    todoId: parsed.values.todo,
    agentId: parsed.values.agent,
    toolId: parsed.values.tool,
    reason: parsed.values.reason || (check.allowed ? null : check.reason),
  });
  log(`violation logged: ${path.relative(JOSH_ROOT, r.recorded).replace(/\\/g, '/')}`);
  appendAudit({ actor: defaultActor(), action: 'agent.tool_violation', id: parsed.values.agent, details: { tool: parsed.values.tool, todo_id: parsed.values.todo, in_scope: check.allowed } });
  return 0;
}

function cmdA2A(args) {
  const sub = args[0];
  const rest = args.slice(1);
  if (!sub || sub === 'help' || sub === '--help' || sub === '-h') {
    log(`Usage: josh a2a <subcommand>

Subcommands:
  serve [--port N]                  Foreground HTTP server (Ctrl+C to stop)
  stop                              Signal a running serve to exit
  health                            Hit /healthz on default port`);
    return 0;
  }
  switch (sub) {
    case 'serve':  return cmdA2AServe(rest);
    case 'stop':   return cmdA2AStop(rest);
    case 'health': return cmdA2AHealth(rest);
    default: err(`unknown a2a subcommand: ${sub}`); return 1;
  }
}

function cmdA2AServe(args) {
  let parsed;
  try { parsed = parseArgs({ args, options: { port: { type: 'string' }, host: { type: 'string' } }, allowPositionals: false, strict: true }); }
  catch (e) { return errExit(e.message, 1); }
  const { startServer } = require('./lib/a2a-bridge');
  const port = parsed.values.port ? parseInt(parsed.values.port, 10) : undefined;
  const host = parsed.values.host || '127.0.0.1';
  startServer(JOSH_ROOT, { port, host }).then(({ server, port: actualPort }) => {
    log(`josh a2a serving on http://${host}:${actualPort}`);
    log(`(send SIGINT or 'josh a2a stop' to exit)`);
    process.on('SIGINT', () => { try { server.close(() => process.exit(0)); } catch (e) {} });
  }).catch((e) => {
    err(`a2a serve failed: ${e.message}`);
    process.exit(4);
  });
  return 0;
}

function cmdA2AStop() {
  const { requestStop } = require('./lib/a2a-bridge');
  requestStop(JOSH_ROOT);
  log('stop signal written; running server will exit on next poll');
  return 0;
}

function cmdA2AHealth(args) {
  let parsed;
  try { parsed = parseArgs({ args, options: { port: { type: 'string' }, host: { type: 'string' } }, allowPositionals: false, strict: true }); }
  catch (e) { return errExit(e.message, 1); }
  const port = parsed.values.port ? parseInt(parsed.values.port, 10) : parseInt(process.env.JOSH_A2A_PORT || '7843', 10);
  const host = parsed.values.host || '127.0.0.1';
  const httpLib = require('http');
  httpLib.get({ host, port, path: '/healthz' }, (res) => {
    let body = '';
    res.on('data', (c) => { body += c; });
    res.on('end', () => log(body));
  }).on('error', (e) => { err(e.message); process.exit(4); });
  return 0;
}

// ─── Phase 9: dashboard + cost telemetry ─────────────────────────────────────

function cmdCost(args) {
  const sub = args[0];
  const rest = args.slice(1);
  if (!sub || sub === 'help' || sub === '--help' || sub === '-h') {
    log(`Usage: josh cost <subcommand>

Subcommands:
  log --todo <id> --agent <id> --model <m> --tokens-in N --tokens-out N --wall N --usd N [--phase N]
  summary [--month YYYY-MM] [--since ISO] [--by agent|phase|model]
  list-months`);
    return 0;
  }
  switch (sub) {
    case 'log':         return cmdCostLog(rest);
    case 'summary':     return cmdCostSummary(rest);
    case 'list-months': return cmdCostListMonths();
    default: err(`unknown cost subcommand: ${sub}`); return 1;
  }
}

function cmdCostLog(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        todo:        { type: 'string' },
        agent:       { type: 'string' },
        model:       { type: 'string' },
        'tokens-in': { type: 'string' },
        'tokens-out':{ type: 'string' },
        wall:        { type: 'string' },
        usd:         { type: 'string' },
        phase:       { type: 'string' },
        sentinel:    { type: 'string' },
      },
      allowPositionals: false, strict: true,
    });
  } catch (e) { return errExit(e.message, 1); }
  const { appendCost } = require('./lib/cost-ledger');
  const v = parsed.values;
  const p = appendCost(JOSH_ROOT, {
    todo_id: v.todo, agent_id: v.agent, model: v.model,
    tokens_in: v['tokens-in'] ? parseInt(v['tokens-in'], 10) : 0,
    tokens_out: v['tokens-out'] ? parseInt(v['tokens-out'], 10) : 0,
    wall_seconds: v.wall ? parseInt(v.wall, 10) : 0,
    usd: v.usd ? parseFloat(v.usd) : 0,
    phase: v.phase != null ? parseInt(v.phase, 10) : null,
    sentinel: v.sentinel || null,
  });
  log(`logged → ${path.relative(JOSH_ROOT, p).replace(/\\/g, '/')}`);
  return 0;
}

function cmdCostSummary(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: { month: { type: 'string' }, since: { type: 'string' }, by: { type: 'string' }, todo: { type: 'string' }, agent: { type: 'string' } },
      allowPositionals: false, strict: true,
    });
  } catch (e) { return errExit(e.message, 1); }
  const { summarize } = require('./lib/cost-ledger');
  const s = summarize(JOSH_ROOT, {
    month: parsed.values.month,
    since: parsed.values.since,
    todo_id: parsed.values.todo,
    agent_id: parsed.values.agent,
  });
  log(`runs:        ${s.run_count}`);
  log(`tokens_in:   ${s.total.tokens_in}`);
  log(`tokens_out:  ${s.total.tokens_out}`);
  log(`wall_sec:    ${s.total.wall_seconds}`);
  log(`usd:         ${s.total.usd.toFixed(4)}`);
  const breakdownKey = parsed.values.by;
  if (breakdownKey === 'agent') {
    log('');
    log('by agent:');
    for (const [k, v] of Object.entries(s.by_agent)) log(`  ${k.padEnd(12)} runs=${v.count} usd=${v.usd.toFixed(4)}`);
  } else if (breakdownKey === 'model') {
    log('');
    log('by model:');
    for (const [k, v] of Object.entries(s.by_model)) log(`  ${k.padEnd(12)} runs=${v.count} usd=${v.usd.toFixed(4)}`);
  } else if (breakdownKey === 'phase') {
    log('');
    log('by phase:');
    for (const [k, v] of Object.entries(s.by_phase)) log(`  ${k.padEnd(12)} runs=${v.count} usd=${v.usd.toFixed(4)}`);
  }
  return 0;
}

function cmdCostListMonths() {
  const { listMonths } = require('./lib/cost-ledger');
  const months = listMonths(JOSH_ROOT);
  if (months.length === 0) { log('(no cost ledger files)'); return 0; }
  for (const m of months) log(`  ${m}`);
  return 0;
}

function cmdDashboard(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        project:          { type: 'string' },
        since:            { type: 'string' },
        'drift-window':   { type: 'string' },
        'drift-threshold':{ type: 'string' },
      },
      allowPositionals: false, strict: true,
    });
  } catch (e) { return errExit(e.message, 1); }
  const { renderDashboard } = require('./lib/dashboard');
  log(renderDashboard(JOSH_ROOT, {
    project: parsed.values.project,
    since: parsed.values.since,
    driftWindow: parsed.values['drift-window'] ? parseInt(parsed.values['drift-window'], 10) : undefined,
    driftThreshold: parsed.values['drift-threshold'] ? parseInt(parsed.values['drift-threshold'], 10) : undefined,
  }));
  return 0;
}

// ─── Phase 10: multi-machine + sprint continuity ─────────────────────────────

function cmdSync(args) {
  const sub = args[0];
  const rest = args.slice(1);
  if (!sub || sub === 'help' || sub === '--help' || sub === '-h') {
    log(`Usage: josh sync <subcommand>

Subcommands:
  resolve [--dry-run]              Resolve Syncthing-style sync-conflict files
  status                           Show pending sync conflicts (no changes)
  stignore                         Write the recommended .stignore at JOSH_ROOT`);
    return 0;
  }
  switch (sub) {
    case 'resolve':  return cmdSyncResolve(rest);
    case 'status':   return cmdSyncStatus(rest);
    case 'stignore': return cmdSyncStignore(rest);
    default: err(`unknown sync subcommand: ${sub}`); return 1;
  }
}

function cmdSyncResolve(args) {
  let parsed;
  try { parsed = parseArgs({ args, options: { 'dry-run': { type: 'boolean' } }, allowPositionals: false, strict: true }); }
  catch (e) { return errExit(e.message, 1); }
  const { resolveAll } = require('./lib/sync-conflict');
  const r = resolveAll(JOSH_ROOT, { dryRun: !!parsed.values['dry-run'] });
  log(`sync resolve ${parsed.values['dry-run'] ? '(dry-run) ' : ''}${r.count} conflicts`);
  for (const x of r.results) {
    log(`  ${x.action}: ${x.source}${x.archived ? ' → ' + x.archived : ''}`);
  }
  appendAudit({
    actor: defaultActor(),
    action: 'sync.resolved',
    id: null,
    details: { count: r.count, dry_run: !!parsed.values['dry-run'] },
  });
  return 0;
}

function cmdSyncStatus() {
  const { findConflicts } = require('./lib/sync-conflict');
  const list = findConflicts(JOSH_ROOT);
  if (list.length === 0) { log('(no sync conflicts)'); return 0; }
  for (const c of list) log(`  ${c.kind} ${c.path}`);
  return 0;
}

function cmdSyncStignore() {
  const { writeStignore } = require('./lib/stignore');
  const p = writeStignore(JOSH_ROOT);
  log(`wrote ${p}`);
  return 0;
}

function cmdSprint(args) {
  const sub = args[0];
  const rest = args.slice(1);
  if (!sub || sub === 'help' || sub === '--help' || sub === '-h') {
    log(`Usage: josh sprint <subcommand>

Subcommands:
  snapshot [--label TAG]            Capture queue + cost + audit-tip into ~/.josh/sprints/
  list                              List existing snapshots
  show <name>                       Print a snapshot by filename`);
    return 0;
  }
  switch (sub) {
    case 'snapshot': return cmdSprintSnapshot(rest);
    case 'list':     return cmdSprintList(rest);
    case 'show':     return cmdSprintShow(rest);
    default: err(`unknown sprint subcommand: ${sub}`); return 1;
  }
}

function cmdSprintSnapshot(args) {
  let parsed;
  try { parsed = parseArgs({ args, options: { label: { type: 'string' } }, allowPositionals: false, strict: true }); }
  catch (e) { return errExit(e.message, 1); }
  const { snapshot } = require('./lib/sprint');
  const r = snapshot(JOSH_ROOT, { label: parsed.values.label });
  log(`snapshot: ${path.relative(JOSH_ROOT, r.path).replace(/\\/g, '/')}`);
  log(`  in_progress: ${r.snapshot.queue.in_progress}  done: ${r.snapshot.queue.done}  cost_usd: ${r.snapshot.cost_total_usd}`);
  appendAudit({ actor: defaultActor(), action: 'sprint.snapshot', id: null, details: { path: r.path, label: parsed.values.label || null } });
  return 0;
}

function cmdSprintList() {
  const { listSnapshots } = require('./lib/sprint');
  const list = listSnapshots(JOSH_ROOT);
  if (list.length === 0) { log('(no snapshots)'); return 0; }
  for (const f of list) log(`  ${f}`);
  return 0;
}

function cmdSprintShow(args) {
  const name = args[0];
  if (!name) return errExit('sprint show requires <name>', 1);
  const { loadSnapshot } = require('./lib/sprint');
  try { log(JSON.stringify(loadSnapshot(JOSH_ROOT, name), null, 2)); return 0; }
  catch (e) { return errExit(e.message, 2); }
}

function cmdHost(args) {
  const sub = args[0];
  const rest = args.slice(1);
  if (!sub || sub === 'help' || sub === '--help' || sub === '-h') {
    log(`Usage: josh host <subcommand>

Subcommands:
  show                                          Show current host + capacity (if set)
  capacity-set [--max-concurrent N] [--max-concurrent-per-phase N] [--max-concurrent-per-agent N]
  capacity-list                                 List per-host capacity files`);
    return 0;
  }
  switch (sub) {
    case 'show':          return cmdHostShow(rest);
    case 'capacity-set':  return cmdHostCapacitySet(rest);
    case 'capacity-list': return cmdHostCapacityList(rest);
    default: err(`unknown host subcommand: ${sub}`); return 1;
  }
}

function cmdHostShow() {
  const { currentHost, readCapacity } = require('./lib/host');
  const h = currentHost();
  log(`host: ${h}`);
  const cap = readCapacity(JOSH_ROOT, h);
  log(`capacity: ${cap ? JSON.stringify(cap) : '(unset — global defaults apply)'}`);
  return 0;
}

function cmdHostCapacitySet(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        'max-concurrent':            { type: 'string' },
        'max-concurrent-per-phase':  { type: 'string' },
        'max-concurrent-per-agent':  { type: 'string' },
        host:                        { type: 'string' },
      },
      allowPositionals: false, strict: true,
    });
  } catch (e) { return errExit(e.message, 1); }
  const { writeCapacity, currentHost } = require('./lib/host');
  const cap = {};
  if (parsed.values['max-concurrent']) cap.max_concurrent = parseInt(parsed.values['max-concurrent'], 10);
  if (parsed.values['max-concurrent-per-phase']) cap.max_concurrent_per_phase = parseInt(parsed.values['max-concurrent-per-phase'], 10);
  if (parsed.values['max-concurrent-per-agent']) cap.max_concurrent_per_agent = parseInt(parsed.values['max-concurrent-per-agent'], 10);
  const host = parsed.values.host || currentHost();
  const p = writeCapacity(JOSH_ROOT, host, cap);
  log(`wrote capacity for ${host} → ${path.relative(JOSH_ROOT, p).replace(/\\/g, '/')}`);
  return 0;
}

function cmdHostCapacityList() {
  const { listHostCapacities } = require('./lib/host');
  const list = listHostCapacities(JOSH_ROOT);
  if (list.length === 0) { log('(no host capacity files)'); return 0; }
  for (const h of list) log(`  ${h}`);
  return 0;
}

// Augment cmdVerdict with `verify` subcommand.
function cmdVerdictVerify(args) {
  const todoId = args[0];
  const agentId = args[1] || null;
  if (!todoId) return errExit('verdict verify requires <todo-id> [<agent-id>]', 1);
  const { listVerdicts, readEnvelope, verifyEnvelope } = require('./lib/verdict-envelope');
  const targets = agentId ? [agentId] : listVerdicts(JOSH_ROOT, todoId);
  if (targets.length === 0) { err('no envelopes found'); return 2; }
  let allOk = true;
  for (const a of targets) {
    let env;
    try { env = readEnvelope(JOSH_ROOT, todoId, a); }
    catch (e) { log(`  ${a}: read failed: ${e.message}`); allOk = false; continue; }
    const r = verifyEnvelope(JOSH_ROOT, env);
    log(`  ${a}: ${r.valid ? 'VALID' : 'INVALID — ' + r.reason}`);
    if (!r.valid) allOk = false;
  }
  return allOk ? 0 : 1;
}

function cmdHelp() {
  log(`josh — CLI for the ~/.josh/ shared agent runtime`);
  log(``);
  log(`usage: josh <command> [args]`);
  log(``);
  log(`commands:`);
  log(`  init                          create the directory tree (idempotent)`);
  log(`  status                        pretty-print the status board`);
  log(`  push todo "title" [flags]     create a new todo in incoming/`);
  log(`  list todo [--state STATE]     list todos (defaults to live states)`);
  log(`  show <id>                     print any artifact by ID (full or last-6)`);
  log(`  tick [--verbose] [--force]    one orchestrator heartbeat (cron driver)`);
  log(`  control <action> [args]       send a control command to the orchestrator`);
  log(``);
  log(`agent mutate ops (atomic state transitions):`);
  log(`  claim <id> [--as actor] [--ttl 3600]    triaged → in_progress`);
  log(`  complete <id> [--note "..."]            in_progress → done (runs verify)`);
  log(`         [--skip-verify]                  skip verify command if defined`);
  log(`  fail <id> --reason "..."                in_progress|triaged → failed`);
  log(`  block <id> --depends-on <ids>           in_progress|triaged → blocked`);
  log(`         [--reason "..."]`);
  log(`  unblock <id> [--note "..."]             blocked → triaged`);
  log(`  cancel <id> [--reason "..."]            any live state → cancelled`);
  log(``);
  log(`handoffs (cross-agent messaging):`);
  log(`  push handoff --to AGENT --title "..." --body "..." [--kind request|answer|note]`);
  log(`         [--reply-to ID] [--priority pX] [--from ACTOR]`);
  log(`  list handoffs [--for AGENT] [--state incoming|processed|all]`);
  log(`  reply <handoff-id> --body "..." [--kind answer|note] [--actor X]`);
  log(`  ack <handoff-id> [--note "..."]         move incoming → processed`);
  log(``);
  log(`approvals (human-gated decisions):`);
  log(`  push approval --summary "..." [--details "..."] [--options approve,deny]`);
  log(`         [--default-after 2h] [--default-choice deny]`);
  log(`  list approvals [--state pending|done|all]`);
  log(`  approve <approval-id> [--note "..."]`);
  log(`  deny <approval-id> [--reason "..."]`);
  log(``);
  log(`reviews (cross-agent code/design review):`);
  log(`  push review --subject-ref <url|path> --reviewer AGENT [--subject-type pr|file|approach|todo]`);
  log(`         [--framing regular|adversarial] [--deadline ISO] [--priority pX] [--notes "..."]`);
  log(`  list reviews [--state pending|done|all] [--reviewer X] [--verdict V]`);
  log(`  review <review-id> --verdict approve|request_changes|block --reasoning "..." [--as ACTOR]`);
  log(``);
  log(`maintenance:`);
  log(`  validate [--json] [--verbose] [--strict]   walk tree, check every JSON against`);
  log(`                                              its schema. --strict: exit 1 on errors.`);
  log(``);
  log(`locks (general resource locks):`);
  log(`  lock acquire <resource> [--ttl 1h] [--reason "..."]   acquire a lock`);
  log(`  lock release <resource>                                release a lock`);
  log(`  lock list [--json]                                     list held locks`);
  log(`  list locks                    alias for lock list`);
  log(``);
  log(`project ops:`);
  log(`  josh project import <corpus-path>          import a Markdown corpus (project + agents + todos)`);
  log(`  josh project status [--project ID]         render the daily-review template`);
  log(`  josh project sync   [--project ID] [--dry-run]   refresh imported entities from source`);
  log(``);
  log(`agent dispatch (Phase 2A — plan/approve/execute):`);
  log(`  claim <id> --agent A01 [--as actor] [--ttl 3600]`);
  log(`         triaged → claimed; injects agent brief reference + writes runtime.json`);
  log(`  plan submit <id> --plan <path> [--as actor]    claimed → awaiting_approval`);
  log(`  plan approve <id> [--as actor] [--note "..."]  awaiting_approval → approved`);
  log(`  plan reject <id> --reason "..." [--as actor]   awaiting_approval → rejected`);
  log(`  complete <id> [--note "..."] [--skip-handoff] [--skip-verify]`);
  log(`         in_progress → done; requires valid 9-field handoff.md`);
  log(`         (next 'josh tick' auto-promotes approved → in_progress)`);
  log(``);
  log(`  help                          show this message`);
  log(`  version                       show CLI version`);
  log(``);
  log(`push todo flags:`);
  log(`  --priority p0|p1|p2|p3        default: p2`);
  log(`  --agent auto|claude|codex     default: auto`);
  log(`  --label foo,bar               comma-separated`);
  log(`  --due YYYY-MM-DD`);
  log(`  --verify "cmd"                shell command, exit 0 = pass`);
  log(`  --description "..."`);
  log(`  --repo PATH                   --branch NAME`);
  log(`  --depends-on id1,id2`);
  log(`  --created-by "actor"`);
  log(``);
  log(`list todo flags:`);
  log(`  --state incoming|triaged|in_progress|blocked|done|failed|cancelled|all`);
  log(`  --agent NAME    --priority p0|p1|p2|p3    --json`);
  log(``);
  log(`control actions:`);
  log(`  pause | resume                pause/resume triage of new incoming todos`);
  log(`  drain | undrain               drain mode: finish current, take no new`);
  log(`  sweep-now                     trigger stale-claim sweep on next tick`);
  log(`  set-interval <seconds>        change orchestrator heartbeat interval`);
  log(`  reorder <todo-id> --priority pX   change a live todo's priority`);
  log(``);
  log(`spec: ${path.join(JOSH_ROOT, 'README.md')}`);
  log(`env:  JOSH_ROOT=${JOSH_ROOT}`);
  return 0;
}

function cmdVersion() {
  const pkg = require('./package.json');
  log(`${pkg.name} ${pkg.version}`);
  return 0;
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

const COMMANDS = {
  init: cmdInit,
  status: cmdStatus,
  push: cmdPush,
  list: cmdList,
  show: cmdShow,
  tick: cmdTick,
  control: cmdControl,
  claim: cmdClaim,
  heartbeat: cmdHeartbeat,
  complete: cmdComplete,
  fail: cmdFail,
  block: cmdBlock,
  unblock: cmdUnblock,
  cancel: cmdCancel,
  reply: cmdReply,
  ack: cmdAck,
  approve: cmdApprove,
  deny: cmdDeny,
  review: cmdReview,
  validate: cmdValidate,
  project: cmdProject,
  plan: cmdPlan,
  verdict: cmdVerdict,
  matrix: cmdMatrix,
  agent: cmdAgent,
  audit: cmdAudit,
  evolve: cmdEvolve,
  lesson: cmdLesson,
  tool: cmdTool,
  a2a: cmdA2A,
  cost: cmdCost,
  dashboard: cmdDashboard,
  sync: cmdSync,
  sprint: cmdSprint,
  host: cmdHost,
  lock: cmdLock,
  help: cmdHelp,
  '--help': cmdHelp,
  '-h': cmdHelp,
  version: cmdVersion,
  '--version': cmdVersion,
  '-v': cmdVersion
};

function main() {
  const argv = process.argv.slice(2);
  const sub = argv[0];

  if (!sub) { cmdHelp(); return 0; }
  const fn = COMMANDS[sub];
  if (!fn) {
    err(`unknown command: ${sub}`);
    err(`run 'josh help' for usage.`);
    return 1;
  }
  try {
    return fn(argv.slice(1)) || 0;
  } catch (e) {
    err(`error: ${e.message}`);
    if (process.env.JOSH_DEBUG) err(e.stack);
    return 4;
  }
}

process.exit(main());
