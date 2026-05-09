#!/usr/bin/env node
// josh — CLI for the ~/.josh/ shared agent runtime.
// Spec: ~/.josh/README.md
//
// v0.4.0 commands:
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
//
// Exit codes per spec: 0 success, 1 validation, 2 not-found, 3 lock-conflict, 4 fs-error.

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { parseArgs } = require('util');

// ─── Paths ───────────────────────────────────────────────────────────────────

const JOSH_ROOT = process.env.JOSH_ROOT || path.join(os.homedir(), '.josh');

const SUBDIRS = [
  'claude/incoming',
  'claude/outgoing',
  'codex/incoming',
  'codex/outgoing',
  'orchestrator/incoming',
  'todo/incoming',
  'todo/triaged',
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

// ─── Default actor (for created_by when --created-by not given) ──────────────

function defaultActor() {
  if (process.env.JOSH_ACTOR) return process.env.JOSH_ACTOR;
  return `cli:${os.userInfo().username}`;
}

// ─── Mutate-op helpers ───────────────────────────────────────────────────────

function errExit(msg, code) { err(`error: ${msg}`); return code; }

// Locate a todo by full ID or last-N suffix and return its current state.
// expectedStates: array of allowed states; if provided and not matched, returns error.
function locateTodo(idOrSuffix, expectedStates) {
  const found = findById(idOrSuffix);
  if (!found) return { error: 'not found', code: 2 };
  // Expect path: todo/<state>/<id>.json
  const rel = found.relative.replace(/\\/g, '/');
  if (!rel.startsWith('todo/')) return { error: `not a todo (in: ${rel})`, code: 1 };
  const parts = rel.split('/');
  if (parts.length !== 3) return { error: `unexpected path: ${rel}`, code: 1 };
  const state = parts[1];
  const id = parts[2].replace(/\.json$/, '');
  if (expectedStates && !expectedStates.includes(state)) {
    return { error: `todo is in state '${state}', expected one of: ${expectedStates.join(', ')}`, code: 1 };
  }
  return { path: found.path, state, id, relative: rel };
}

// Atomic move from src state to dst state. Returns 0 on success or error code.
// On success, calls update(todo) to mutate the file in place (after move).
function transitionTodo({ src, dst, srcStates, idOrSuffix, actor, eventName, eventDetails, update, audit }) {
  const located = locateTodo(idOrSuffix, srcStates);
  if (located.error) return { code: located.code, error: located.error };

  const fromPath = located.path;
  const toPath = path.join(JOSH_ROOT, 'todo', dst, `${located.id}.json`);

  // Atomic move = lock acquisition.
  try {
    fs.renameSync(fromPath, toPath);
  } catch (e) {
    if (e.code === 'ENOENT') return { code: 3, error: `todo no longer in ${located.state} (race?)` };
    if (e.code === 'EEXIST' || e.code === 'EPERM' || e.code === 'EACCES') {
      return { code: 4, error: `rename failed: ${e.message}` };
    }
    throw e;
  }

  // Now we own the file at toPath. Read, mutate, write.
  const todo = readJson(toPath);
  if (!todo) return { code: 4, error: `malformed todo at ${dst}/${located.id}.json` };
  todo.history = todo.history || [];
  const now = new Date().toISOString();
  todo.history.push({ at: now, actor, event: eventName, details: eventDetails || {} });
  if (typeof update === 'function') update(todo, now);
  writeJsonAtomic(toPath, todo);

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

function moveTodo(fromPath, toState, todo) {
  const id = todo.id;
  const toPath = path.join(JOSH_ROOT, 'todo', toState, `${id}.json`);
  // Re-write with updated history, then atomic rename
  writeJsonAtomic(fromPath, todo);
  fs.renameSync(fromPath, toPath);
}

function triageOne(file, opts) {
  const todo = readJson(file.path);
  if (!todo) {
    err(`warn: skipping malformed ${file.path}; moving to failed/`);
    const failedPath = path.join(JOSH_ROOT, 'todo', 'failed', file.name);
    try { fs.renameSync(file.path, failedPath); } catch (e) {}
    appendAudit({ actor: 'orchestrator', action: 'todo.malformed', id: file.name, details: {} });
    return { result: 'malformed' };
  }
  const now = new Date().toISOString();
  todo.history = todo.history || [];
  todo.history.push({ at: now, actor: 'orchestrator', event: 'triaged' });
  moveTodo(file.path, 'triaged', todo);
  appendAudit({
    actor: 'orchestrator',
    action: 'todo.triaged',
    id: todo.id,
    details: { agent: todo.agent, priority: todo.priority }
  });
  return { result: 'triaged', id: todo.id };
}

function sweepStaleClaims(opts) {
  let swept = 0;
  const dir = path.join(JOSH_ROOT, 'todo', 'in_progress');
  for (const file of listJsonIn(dir)) {
    const todo = readJson(file.path);
    if (!todo) continue;
    if (!todo.claim || !todo.claim.at || !todo.claim.ttl_sec) continue;
    const claimAt = new Date(todo.claim.at).getTime();
    const expiresAt = claimAt + todo.claim.ttl_sec * 1000;
    if (Date.now() < expiresAt) continue;
    // Stale: move back to triaged with claim cleared.
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
    moveTodo(file.path, 'triaged', todo);
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
        const filePath = path.join(JOSH_ROOT, 'todo', state, `${todoId}.json`);
        if (!fs.existsSync(filePath)) continue;
        const todo = readJson(filePath);
        if (!todo) continue;
        const oldPri = todo.priority;
        todo.priority = newPri;
        todo.history.push({ at: new Date().toISOString(), actor: 'orchestrator', event: 'reordered', details: { from: oldPri, to: newPri } });
        writeJsonAtomic(filePath, todo);
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
    case 'todo': return cmdPushTodo(subArgs);
    default:
      err(`unknown artifact type: ${subtype}`);
      err(`supported in v0.2: todo (handoff/approval/review coming next)`);
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

  const filepath = path.join(JOSH_ROOT, 'todo', 'incoming', `${id}.json`);
  if (!fs.existsSync(path.dirname(filepath))) {
    err(`error: ${path.dirname(filepath)} does not exist. run 'josh init' first.`);
    return 4;
  }
  writeJsonAtomic(filepath, todo);

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
    case 'todo': return cmdListTodo(subArgs);
    default:
      err(`unknown artifact type: ${subtype}`);
      err(`supported in v0.2: todo`);
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

  const allStates = ['incoming', 'triaged', 'in_progress', 'blocked', 'done', 'failed', 'cancelled'];
  const liveStates = ['incoming', 'triaged', 'in_progress', 'blocked'];
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
    let files;
    try { files = fs.readdirSync(dir).filter(f => f.endsWith('.json')); } catch (e) { continue; }
    for (const f of files) {
      const todo = readJson(path.join(dir, f));
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
  let swept = 0;
  let triagedFailed = 0;

  try {
    // 1. Process control commands
    controlsProcessed = processAllControls();

    // 2. Read pause/drain state AFTER controls (a control may have set them)
    const paused = isPaused();
    const draining = isDraining();

    // 3. Triage incoming → triaged (skip if paused; allow during drain)
    if (!paused) {
      const incomingDir = path.join(JOSH_ROOT, 'todo', 'incoming');
      for (const file of listJsonIn(incomingDir)) {
        const r = triageOne(file);
        if (r.result === 'triaged') triaged++;
        else triagedFailed++;
      }
    }

    // 4. Sweep stale claims
    swept = sweepStaleClaims();

    // 5. Update status board
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

    // 6. Audit the tick
    appendAudit({
      actor: 'orchestrator',
      action: 'orchestrator.tick',
      id: null,
      details: {
        controls: controlsProcessed,
        triaged,
        triaged_failed: triagedFailed,
        swept,
        paused,
        draining,
        duration_ms: Date.now() - tickStart.getTime()
      }
    });

    // 7. One-line summary (or verbose multi-line)
    const tickN = status.agents.orchestrator.tick_count;
    if (verbose) {
      log(`tick ${tickN} @ ${status.agents.orchestrator.last_tick}`);
      log(`  controls: ${controlsProcessed}  triaged: ${triaged}  swept: ${swept}  failed: ${triagedFailed}`);
      log(`  paused: ${paused}  draining: ${draining}`);
      log(`  queue: incoming=${status.queue.incoming} triaged=${status.queue.triaged} in_progress=${status.queue.in_progress}`);
    } else {
      log(`tick ${tickN}: triaged=${triaged} swept=${swept} controls=${controlsProcessed}${paused ? ' [paused]' : ''}${draining ? ' [draining]' : ''}`);
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
        as:  { type: 'string' },
        ttl: { type: 'string' }
      },
      allowPositionals: true,
      strict: true
    });
  } catch (e) { return errExit(e.message, 1); }

  const idArg = parsed.positionals[0];
  if (!idArg) return errExit('claim requires <todo-id>', 1);

  const actor = parsed.values.as || defaultActor();
  const ttlSec = parsed.values.ttl ? parseInt(parsed.values.ttl, 10) : 3600;
  if (!Number.isFinite(ttlSec) || ttlSec < 1 || ttlSec > 86400) {
    return errExit('--ttl must be in [1, 86400] seconds', 1);
  }

  const r = transitionTodo({
    srcStates: ['triaged'],
    dst: 'in_progress',
    idOrSuffix: idArg,
    actor,
    eventName: 'claimed',
    eventDetails: { ttl_sec: ttlSec },
    update: (todo, now) => {
      todo.claim = { by: actor, at: now, ttl_sec: ttlSec };
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
        actor:         { type: 'string' },
        note:          { type: 'string' },
        'skip-verify': { type: 'boolean' }
      },
      allowPositionals: true,
      strict: true
    });
  } catch (e) { return errExit(e.message, 1); }

  const idArg = parsed.positionals[0];
  if (!idArg) return errExit('complete requires <todo-id>', 1);

  const actor = parsed.values.actor || defaultActor();

  // Locate first so we can run verify before the move.
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
  log(r.id);
  return 0;
}

function cmdFail(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
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
  const actor = parsed.values.actor || defaultActor();

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
  log(r.id);
  return 0;
}

function cmdBlock(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
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
  const actor = parsed.values.actor || defaultActor();
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
        actor: { type: 'string' },
        note:  { type: 'string' }
      },
      allowPositionals: true,
      strict: true
    });
  } catch (e) { return errExit(e.message, 1); }

  const idArg = parsed.positionals[0];
  if (!idArg) return errExit('unblock requires <todo-id>', 1);
  const actor = parsed.values.actor || defaultActor();

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
        actor:  { type: 'string' },
        reason: { type: 'string' }
      },
      allowPositionals: true,
      strict: true
    });
  } catch (e) { return errExit(e.message, 1); }

  const idArg = parsed.positionals[0];
  if (!idArg) return errExit('cancel requires <todo-id>', 1);
  const actor = parsed.values.actor || defaultActor();

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
  complete: cmdComplete,
  fail: cmdFail,
  block: cmdBlock,
  unblock: cmdUnblock,
  cancel: cmdCancel,
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
