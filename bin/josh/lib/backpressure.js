'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULTS = Object.freeze({
  max_concurrent: 10,
  max_concurrent_per_phase: 5,
  max_concurrent_per_agent: 2,
});

function readBackpressureConfig(joshRoot) {
  const cfgPath = path.join(joshRoot, 'orchestrator', 'backpressure.json');
  let base = { ...DEFAULTS };
  if (fs.existsSync(cfgPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      base = { ...base, ...raw };
    } catch (e) {}
  }
  // Phase 10: per-host capacity (~/.josh/<host>.capacity.json) overrides if present.
  try {
    const { readCapacity } = require('./host');
    const hostCap = readCapacity(joshRoot);
    if (hostCap) {
      for (const k of ['max_concurrent', 'max_concurrent_per_phase', 'max_concurrent_per_agent']) {
        if (Number.isFinite(hostCap[k])) base[k] = hostCap[k];
      }
    }
  } catch (e) { /* host.js absent — ok */ }
  return base;
}

function listInProgressFolders(joshRoot) {
  const dir = path.join(joshRoot, 'todo', 'in_progress');
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch (e) {
    return [];
  }
}

function readMeta(joshRoot, id) {
  const p = path.join(joshRoot, 'todo', 'in_progress', id, 'meta.json');
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

function countInProgress(joshRoot) {
  return listInProgressFolders(joshRoot).length;
}

function countInProgressForPhase(joshRoot, phase) {
  let n = 0;
  for (const id of listInProgressFolders(joshRoot)) {
    const m = readMeta(joshRoot, id);
    if (m && m.phase === phase) n++;
  }
  return n;
}

function countInProgressForAgent(joshRoot, agentId) {
  let n = 0;
  for (const id of listInProgressFolders(joshRoot)) {
    const m = readMeta(joshRoot, id);
    if (m && m.primary_role === agentId) n++;
  }
  return n;
}

function checkBackpressure(joshRoot, todo) {
  const cfg = readBackpressureConfig(joshRoot);

  const totalCurrent = countInProgress(joshRoot);
  if (totalCurrent >= cfg.max_concurrent) {
    return {
      ok: false,
      scope: 'global',
      reason: `global in_progress cap reached: ${totalCurrent}/${cfg.max_concurrent}`,
      current: totalCurrent,
      max: cfg.max_concurrent,
    };
  }

  if (todo && todo.phase != null) {
    const phaseCurrent = countInProgressForPhase(joshRoot, todo.phase);
    if (phaseCurrent >= cfg.max_concurrent_per_phase) {
      return {
        ok: false,
        scope: 'phase',
        reason: `phase ${todo.phase} cap reached: ${phaseCurrent}/${cfg.max_concurrent_per_phase}`,
        current: phaseCurrent,
        max: cfg.max_concurrent_per_phase,
      };
    }
  }

  if (todo && todo.primary_role) {
    const agentCurrent = countInProgressForAgent(joshRoot, todo.primary_role);
    if (agentCurrent >= cfg.max_concurrent_per_agent) {
      return {
        ok: false,
        scope: 'agent',
        reason: `agent ${todo.primary_role} cap reached: ${agentCurrent}/${cfg.max_concurrent_per_agent}`,
        current: agentCurrent,
        max: cfg.max_concurrent_per_agent,
      };
    }
  }

  return { ok: true };
}

module.exports = {
  DEFAULTS,
  readBackpressureConfig,
  countInProgress,
  countInProgressForPhase,
  countInProgressForAgent,
  checkBackpressure,
};
