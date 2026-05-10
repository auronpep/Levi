'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_MAX_FAILURES = 3;
const SCAN_STATES = ['failed', 'triaged'];

function countFailureEvents(todo) {
  if (!todo || !Array.isArray(todo.history)) return 0;
  let n = 0;
  for (const h of todo.history) {
    if (h && h.event === 'failed') n++;
  }
  return n;
}

function detectDoomLoop(todo, maxFailures = DEFAULT_MAX_FAILURES) {
  const failure_count = countFailureEvents(todo);
  return { isLoop: failure_count >= maxFailures, failure_count };
}

function writeJsonAtomic(p, obj) {
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  fs.renameSync(tmp, p);
}

function appendEventLine(eventsPath, event) {
  try {
    fs.appendFileSync(eventsPath, JSON.stringify(event) + '\n');
  } catch (e) { /* non-fatal */ }
}

function sweepOne(joshRoot, state, id, maxFailures) {
  const fromDir = path.join(joshRoot, 'todo', state, id);
  const metaPath = path.join(fromDir, 'meta.json');
  let todo;
  try { todo = JSON.parse(fs.readFileSync(metaPath, 'utf8')); }
  catch (e) { return false; }

  const det = detectDoomLoop(todo, maxFailures);
  if (!det.isLoop) return false;

  const toDir = path.join(joshRoot, 'todo', 'blocked', id);
  if (fs.existsSync(toDir)) return false;       // refuse to clobber

  try {
    fs.mkdirSync(path.dirname(toDir), { recursive: true });
    fs.renameSync(fromDir, toDir);
  } catch (e) {
    return false;
  }

  const now = new Date().toISOString();
  const newMetaPath = path.join(toDir, 'meta.json');
  try {
    const meta = JSON.parse(fs.readFileSync(newMetaPath, 'utf8'));
    meta.blocked_reason = `doom-loop-detected:${det.failure_count}`;
    meta.history = meta.history || [];
    meta.history.push({
      at: now,
      actor: 'orchestrator',
      event: 'doom_loop_blocked',
      details: { failure_count: det.failure_count, max_failures: maxFailures, from: state },
    });
    writeJsonAtomic(newMetaPath, meta);
  } catch (e) { /* meta read failed; folder still moved, leave as-is */ }

  try { fs.writeFileSync(path.join(toDir, 'state'), 'blocked\n', 'utf8'); }
  catch (e) { /* non-fatal */ }

  appendEventLine(path.join(toDir, 'events.ndjson'), {
    kind: 'failed',
    at: now,
    actor: 'orchestrator',
    reason: 'doom_loop',
    failure_count: det.failure_count,
  });

  return true;
}

function sweepDoomLoops(joshRoot, opts = {}) {
  const maxFailures = opts.maxFailures || DEFAULT_MAX_FAILURES;
  let swept = 0;
  for (const state of SCAN_STATES) {
    const dir = path.join(joshRoot, 'todo', state);
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (e) { continue; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (sweepOne(joshRoot, state, e.name, maxFailures)) swept++;
    }
  }
  return swept;
}

module.exports = {
  DEFAULT_MAX_FAILURES,
  SCAN_STATES,
  countFailureEvents,
  detectDoomLoop,
  sweepDoomLoops,
};
