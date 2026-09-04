'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { summarize } = require('./cost-ledger');
const { computeDriftAlerts } = require('./drift-alerts');
const { ALL_STATES } = require('./todo-folder');

function countDir(p) {
  try {
    return fs.readdirSync(p, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
  } catch (e) { return 0; }
}

function listInProgressByAgentAndPhase(joshRoot) {
  const dir = path.join(joshRoot, 'todo', 'in_progress');
  const byAgent = {};
  const byPhase = {};
  if (!fs.existsSync(dir)) return { byAgent, byPhase, total: 0 };
  let total = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    total++;
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(dir, e.name, 'meta.json'), 'utf8'));
      const a = meta.primary_role || meta.agent || '(unknown)';
      const p = meta.phase != null ? `phase-${meta.phase}` : '(unset)';
      byAgent[a] = (byAgent[a] || 0) + 1;
      byPhase[p] = (byPhase[p] || 0) + 1;
    } catch (e2) {}
  }
  return { byAgent, byPhase, total };
}

function pad(s, n) { return String(s).padEnd(n); }

function renderDashboard(joshRoot, opts = {}) {
  const lines = [];
  // Reuse todo-folder's ALL_STATES rather than keeping a private copy. The copy
  // that used to live here had drifted: it listed 11 of the 13 states, so todos
  // sitting in `rejected` or `revised` were absent from the dashboard entirely -
  // not shown as zero, simply never looked at.
  const queueStates = ALL_STATES;
  lines.push(`josh dashboard — ${joshRoot}`);
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push('');

  // 1. Queue snapshot
  lines.push('## Queue snapshot');
  for (const s of queueStates) {
    const c = countDir(path.join(joshRoot, 'todo', s));
    if (c > 0) lines.push(`  ${pad(s, 18)} ${c}`);
  }
  lines.push('');

  // 2. In-flight by phase
  const ip = listInProgressByAgentAndPhase(joshRoot);
  lines.push(`## In-flight by phase  (in_progress total: ${ip.total})`);
  if (Object.keys(ip.byPhase).length === 0) {
    lines.push('  (none)');
  } else {
    for (const [k, v] of Object.entries(ip.byPhase).sort()) {
      lines.push(`  ${pad(k, 12)} ${v}`);
    }
  }
  lines.push('');

  // 3. Per-agent utilization (in_progress)
  lines.push('## In-flight by agent');
  if (Object.keys(ip.byAgent).length === 0) {
    lines.push('  (none)');
  } else {
    for (const [k, v] of Object.entries(ip.byAgent).sort()) {
      lines.push(`  ${pad(k, 12)} ${v}`);
    }
  }
  lines.push('');

  // 4. Cost burn rate (rolling)
  const summary = summarize(joshRoot, { since: opts.since });
  lines.push('## Cost (since: ' + (opts.since || 'all-time') + ')');
  lines.push(`  runs:        ${summary.run_count}`);
  lines.push(`  tokens_in:   ${summary.total.tokens_in.toLocaleString()}`);
  lines.push(`  tokens_out:  ${summary.total.tokens_out.toLocaleString()}`);
  lines.push(`  wall_sec:    ${summary.total.wall_seconds.toLocaleString()}`);
  lines.push(`  USD:         ${summary.total.usd.toFixed(4)}`);
  if (summary.run_count > 0 && summary.earliest && summary.latest) {
    const hours = (Date.parse(summary.latest) - Date.parse(summary.earliest)) / 3600000 || 1;
    lines.push(`  USD/hour:    ${(summary.total.usd / hours).toFixed(4)}`);
  }
  if (Object.keys(summary.by_model).length > 0) {
    lines.push('');
    lines.push('  by model:');
    for (const [m, v] of Object.entries(summary.by_model)) {
      lines.push(`    ${pad(m, 12)} runs=${v.count} usd=${v.usd.toFixed(4)}`);
    }
  }
  if (Object.keys(summary.by_agent).length > 0) {
    lines.push('  by agent:');
    for (const [a, v] of Object.entries(summary.by_agent)) {
      lines.push(`    ${pad(a, 12)} runs=${v.count} usd=${v.usd.toFixed(4)}`);
    }
  }
  lines.push('');

  // 5. Drift alerts
  // Report the thresholds that were actually applied. The empty-state line used
  // to hard-code "≥3 ... last 10" regardless of --drift-threshold/--drift-window,
  // so a dashboard run with different numbers stated a conclusion about a check
  // it had not performed.
  const driftWindow = opts.driftWindow || 10;
  const driftThreshold = opts.driftThreshold || 3;
  const alerts = computeDriftAlerts(joshRoot, { window: driftWindow, threshold: driftThreshold });
  lines.push('## Drift alerts');
  if (alerts.length === 0) {
    lines.push(`  (none — no agent has ≥${driftThreshold} disagreements in last ${driftWindow} matrix runs)`);
  } else {
    for (const a of alerts) {
      lines.push(`  ⚠️  ${a.agent} on ${a.archetype}: ${a.disagreements}/${a.runs_in_window} disagreements (rate ${a.rate})`);
    }
  }
  lines.push('');

  // 6. Project filter (optional)
  if (opts.project) {
    lines.push(`## Project: ${opts.project}`);
    // (Phase 1 already ships per-project status; surface its render or skip if unavailable.)
    try {
      const { renderDailyReview } = require('./project-status');
      lines.push(renderDailyReview(opts.project, { joshRoot }));
    } catch (e) {
      lines.push(`  (project-status helper unavailable: ${e.message})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

module.exports = { renderDashboard };
