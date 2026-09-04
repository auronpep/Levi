'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Drift = same agent + same archetype + ≥3 disagreements with E08 in last 10 matrix runs.
// "Disagreement" = agent's verdict was not the winner picked by E08.
// We read from todo/<state>/<id>/verdicts/winner.json across all live + done states.

const ALL_STATES = [
  'incoming', 'triaged', 'claimed', 'planning', 'awaiting_approval',
  'approved', 'rejected', 'revised', 'in_progress', 'done',
  'blocked', 'failed', 'cancelled',
];

function listMatrixRuns(joshRoot) {
  const out = [];
  for (const state of ALL_STATES) {
    const dir = path.join(joshRoot, 'todo', state);
    if (!fs.existsSync(dir)) continue;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { continue; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const todoFolder = path.join(dir, e.name);
      const winnerFile = path.join(todoFolder, 'verdicts', 'winner.json');
      if (!fs.existsSync(winnerFile)) continue;
      try {
        const winner = JSON.parse(fs.readFileSync(winnerFile, 'utf8'));
        const meta = JSON.parse(fs.readFileSync(path.join(todoFolder, 'meta.json'), 'utf8'));
        const candidates = meta.matrix_candidates || [];
        out.push({
          todo_id: e.name,
          state,
          winner_id: winner.winner_id,
          candidates,
          archetype: meta.archetype || meta.labels && meta.labels[0] || 'general',
          materialized_at: winner.materialized_at,
        });
      } catch (err) {}
    }
  }
  // Sort by materialized_at descending.
  out.sort((a, b) => (b.materialized_at || '').localeCompare(a.materialized_at || ''));
  return out;
}

function computeDriftAlerts(joshRoot, opts = {}) {
  const window = opts.window || 10;
  const threshold = opts.threshold || 3;
  const runs = listMatrixRuns(joshRoot);
  // For every (agent, archetype) pair, count disagreements among the last `window` runs.
  const tally = new Map();   // key: "agent|archetype" -> { total, disagreed }
  for (const r of runs.slice(0, window * 5)) {  // bound by 5×window for perf
    // A run whose winner was never recorded cannot testify about agreement.
    // "Disagreement" is defined as `c !== winner_id`, and every candidate
    // differs from a missing winner - so counting such a run marks every
    // participating agent as a 100% dissenter, including the agents that in
    // fact won every matrix they entered. Absence of a winner is absence of
    // evidence, not evidence of drift. Agent ids are strings throughout, so a
    // usable winner is a non-empty string; anything else is skipped rather
    // than compared.
    if (typeof r.winner_id !== 'string' || r.winner_id === '') continue;
    const archetype = r.archetype || 'general';
    for (const c of r.candidates) {
      const key = `${c}|${archetype}`;
      if (!tally.has(key)) tally.set(key, { agent: c, archetype, total: 0, disagreed: 0, sample_runs: [] });
      const t = tally.get(key);
      if (t.total >= window) continue;
      t.total++;
      if (c !== r.winner_id) {
        t.disagreed++;
        t.sample_runs.push(r.todo_id);
      }
    }
  }
  const alerts = [];
  for (const [, t] of tally) {
    if (t.disagreed >= threshold && t.total >= threshold) {
      alerts.push({
        agent: t.agent,
        archetype: t.archetype,
        disagreements: t.disagreed,
        runs_in_window: t.total,
        rate: Math.round((t.disagreed / t.total) * 100) / 100,
        sample_runs: t.sample_runs.slice(0, 5),
      });
    }
  }
  alerts.sort((a, b) => b.rate - a.rate);
  return alerts;
}

module.exports = { computeDriftAlerts, listMatrixRuns };
