'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_MAX_FAILURES = 3;
const SCAN_STATES = ['failed', 'triaged'];

// Failures are counted since the last time this todo was quarantined for
// looping - not over its whole lifetime.
//
// The sweep scans `triaged`, and `josh unblock` is exactly what puts a todo back
// into `triaged`. Counting from the beginning of history meant the failures that
// caused the quarantine were still on the tally after a human released it, so the
// next tick re-blocked it immediately. `josh unblock` could never actually
// unblock anything, and nothing said why - the only escape was hand-editing
// meta.json.
//
// A doom loop is repeated failure without progress. Once an operator has looked
// at it and deliberately released it, that decision is the new starting line;
// three *fresh* failures will quarantine it again.
function countFailureEvents(todo) {
  if (!todo || !Array.isArray(todo.history)) return 0;
  let start = 0;
  for (let i = todo.history.length - 1; i >= 0; i--) {
    const h = todo.history[i];
    if (h && h.event === 'doom_loop_blocked') { start = i + 1; break; }
  }
  let n = 0;
  for (let i = start; i < todo.history.length; i++) {
    const h = todo.history[i];
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
