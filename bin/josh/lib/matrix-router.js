'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { enforceCeiling, MAX_TOKENS_PER_VERDICT } = require('./cost-math');

function readRouting(joshRoot) {
  const p = path.join(joshRoot, 'orchestrator', 'routing.json');
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

function readAgent(joshRoot, agentId) {
  const p = path.join(joshRoot, 'agents', agentId, 'manifest.json');
  if (!fs.existsSync(p)) return { id: agentId };
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return { id: agentId }; }
}

function shouldFanOut(todo) {
  if (todo && todo.verdict_mode === 'matrix') return { fanOut: true, reason: 'verdict_mode=matrix' };
  if (todo && todo.risk === 'high')           return { fanOut: true, reason: 'risk=high (auto)' };
  return { fanOut: false, reason: 'single-agent path' };
}

function pickByRules(routing, todo) {
  const rules = (routing && routing.matrix_rules) || [];
  for (const r of rules) {
    if (Array.isArray(r.if_labels) && Array.isArray(todo.labels)) {
      if (r.if_labels.some((l) => todo.labels.includes(l))) {
        return { candidates: r.candidates.slice(), source: `matrix_rules.if_labels=${r.if_labels.join(',')}` };
      }
    }
    if (r.if_phase != null && todo.phase === r.if_phase) {
      return { candidates: r.candidates.slice(), source: `matrix_rules.if_phase=${r.if_phase}` };
    }
  }
  if (Array.isArray(routing && routing.default_matrix_candidates)) {
    return { candidates: routing.default_matrix_candidates.slice(), source: 'default_matrix_candidates' };
  }
  // Last-resort fallback: just the primary role.
  if (todo && todo.primary_role) {
    return { candidates: [todo.primary_role], source: 'fallback:primary_role' };
  }
  return { candidates: [], source: 'fallback:none' };
}

function selectCandidates(joshRoot, todo, opts = {}) {
  const decision = shouldFanOut(todo);
  if (!decision.fanOut) {
    return {
      mode: 'single',
      candidates: todo && todo.primary_role ? [todo.primary_role] : [],
      reason: decision.reason,
      pruned: [],
    };
  }
  const routing = readRouting(joshRoot);
  const picked = pickByRules(routing, todo);
  const agentObjs = picked.candidates.map((id) => readAgent(joshRoot, id));
  const ceiling = opts.ceiling || MAX_TOKENS_PER_VERDICT;
  const enforced = enforceCeiling(agentObjs, todo, ceiling);
  return {
    mode: 'matrix',
    candidates: enforced.kept,
    pruned: enforced.pruned,
    reason: picked.source,
    ceiling,
    total_tokens_predicted: enforced.total_tokens,
  };
}

module.exports = { selectCandidates, readRouting };
