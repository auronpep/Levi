#!/usr/bin/env node
// josh — CLI for the ~/.josh/ shared agent runtime.
// Spec: ~/.josh/README.md
//
// v0.1.0 commands:
//   josh init     — create the directory tree + initial status.json (idempotent)
//   josh status   — pretty-print status.json
//
// Exit codes per spec: 0 success, 1 validation, 2 not-found, 3 lock-conflict, 4 fs-error.

const fs = require('fs');
const path = require('path');
const os = require('os');
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

// ─── Status board template ───────────────────────────────────────────────────

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
      incoming: 0,
      triaged: 0,
      in_progress: 0,
      blocked: 0,
      failed: 0,
      approvals_pending: 0,
      reviews_pending: 0
    }
  };
}

// ─── Queue counter ───────────────────────────────────────────────────────────

function countDir(p) {
  try { return fs.readdirSync(p).filter(f => !f.startsWith('.')).length; }
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

// ─── Commands ────────────────────────────────────────────────────────────────

function cmdInit() {
  // Verify root exists; refuse to create silently if no README (the spec).
  if (!fs.existsSync(JOSH_ROOT)) {
    fs.mkdirSync(JOSH_ROOT, { recursive: true });
    log(`created  ${JOSH_ROOT}`);
  }

  const readmePath = path.join(JOSH_ROOT, 'README.md');
  if (!fs.existsSync(readmePath)) {
    err(`warn: no README.md at ${readmePath} — initializing tree without spec.`);
    err(`      drop the spec from C:/Levi/.josh/README.md or recreate via your plugin.`);
  }

  let created = 0, existed = 0;
  for (const sub of SUBDIRS) {
    const full = path.join(JOSH_ROOT, sub);
    if (fs.existsSync(full)) {
      existed++;
    } else {
      fs.mkdirSync(full, { recursive: true });
      log(`created  ${path.relative(JOSH_ROOT, full).replace(/\\/g, '/')}/`);
      created++;
    }
  }

  // status.json
  const statusPath = path.join(JOSH_ROOT, 'status.json');
  if (!fs.existsSync(statusPath)) {
    writeJsonAtomic(statusPath, emptyStatus());
    log(`created  status.json`);
  } else {
    log(`existed  status.json`);
  }

  // Per-agent status stubs
  for (const agent of ['claude', 'codex', 'orchestrator']) {
    const agentStatusPath = path.join(JOSH_ROOT, agent, 'status.json');
    if (!fs.existsSync(agentStatusPath)) {
      writeJsonAtomic(agentStatusPath, {
        schema: 1,
        agent,
        alive: false,
        last_seen: null,
        current_task: null,
        session_id: null
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

  // Refresh queue counts on read (cheap).
  refreshQueueCounts(status);

  // Pretty print.
  const fmt = (k, v) => `  ${k.padEnd(18)} ${v}`;
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
    log(fmt(k, v));
  }

  return 0;
}

function cmdHelp() {
  log(`josh — CLI for the ~/.josh/ shared agent runtime`);
  log(``);
  log(`usage: josh <command> [args]`);
  log(``);
  log(`commands:`);
  log(`  init       create the directory tree + initial status.json (idempotent)`);
  log(`  status     pretty-print the status board`);
  log(`  help       show this message`);
  log(`  version    show CLI version`);
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
