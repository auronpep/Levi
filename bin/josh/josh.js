#!/usr/bin/env node
// josh — CLI for the ~/.josh/ shared agent runtime.
// Spec: ~/.josh/README.md
//
// v0.2.0 commands:
//   josh init                — create the directory tree + initial status.json (idempotent)
//   josh status              — pretty-print status.json
//   josh push todo "title"   — drop a todo into incoming/
//   josh list todo           — list todos with filtering
//   josh show <id>           — print any artifact by ID (full or last-6 suffix)
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
