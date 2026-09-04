'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const tf = require('./todo-folder');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function renderDailyReview(projectId, opts = {}) {
  const joshRoot = opts.joshRoot || path.join(os.homedir(), '.josh');
  const charterPath = path.join(joshRoot, 'projects', projectId, 'charter.json');
  if (!fs.existsSync(charterPath)) {
    throw new Error(`project ${projectId} not found at ${charterPath}`);
  }
  const charter = readJson(charterPath);

  const states = [
    'incoming', 'triaged', 'claimed', 'planning', 'awaiting_approval',
    'approved', 'rejected', 'revised', 'in_progress', 'done',
    'blocked', 'failed', 'cancelled',
  ];
  const counts = {};
  const byDay = {};
  for (const state of states) {
    counts[state] = 0;
    for (const todo of tf.listTodosInState(joshRoot, state)) {
      if (todo.project_id !== projectId) continue;
      counts[state]++;
      const dayKey = `Day ${todo.day}`;
      if (!byDay[dayKey]) byDay[dayKey] = { total: 0, done: 0, in_progress: 0, blocked: 0 };
      byDay[dayKey].total++;
      if (state === 'done') byDay[dayKey].done++;
      if (state === 'in_progress') byDay[dayKey].in_progress++;
      if (state === 'blocked') byDay[dayKey].blocked++;
    }
  }

  // One damaged manifest must not take down the whole report. `listTodosInState`
  // already skips todos it cannot read, so the todo half of this render survives
  // a partial sync or an interrupted write; the agent half threw on the first bad
  // file and `josh project status` produced nothing at all.
  //
  // Unreadable manifests are collected and reported at the end rather than
  // silently dropped, so the operator can see the report is incomplete and which
  // file to look at.
  const agentsDir = path.join(joshRoot, 'agents');
  const agents = [];
  const unreadableAgents = [];
  if (fs.existsSync(agentsDir)) {
    for (const id of fs.readdirSync(agentsDir)) {
      const manifestPath = path.join(agentsDir, id, 'manifest.json');
      if (!fs.existsSync(manifestPath)) continue;
      let m;
      try { m = readJson(manifestPath); }
      catch (e) { unreadableAgents.push({ id, error: e.message }); continue; }
      if (!m || typeof m !== 'object') { unreadableAgents.push({ id, error: 'not a JSON object' }); continue; }
      if (m.project_id === projectId) agents.push(m);
    }
  }

  const totalTodos = Object.values(counts).reduce((a, b) => a + b, 0);

  const lines = [];
  lines.push(`# ${charter.title}`);
  lines.push('');
  lines.push(`Project ID: ${charter.id}`);
  lines.push(`Source: ${charter.source_path}`);
  lines.push(`Imported: ${charter.imported_at} by ${charter.imported_by}`);
  lines.push('');
  lines.push(`## Counts`);
  lines.push(`- todos: ${totalTodos}`);
  for (const state of states) {
    if (counts[state] > 0) lines.push(`  - ${state}: ${counts[state]}`);
  }
  lines.push(`- agents: ${agents.length}`);
  lines.push('');
  lines.push(`## Day-by-day`);
  for (const day of charter.days || []) {
    const k = `Day ${day.day}`;
    const d = byDay[k] || { total: 0, done: 0, in_progress: 0, blocked: 0 };
    const pct = d.total > 0 ? Math.round((d.done / d.total) * 100) : 0;
    lines.push(`- ${k} (${day.date}): ${d.done}/${d.total} done (${pct}%) — ${day.goal}`);
  }
  lines.push('');
  lines.push(`## Agents`);
  // Sort by id, tolerating a manifest that parsed but has no id.
  for (const agent of agents.sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')))) {
    lines.push(`- ${agent.id}: ${agent.title} [${agent.status || 'UNKNOWN'}]`);
  }

  if (unreadableAgents.length > 0) {
    lines.push('');
    lines.push(`## Unreadable agent manifests (${unreadableAgents.length})`);
    for (const u of unreadableAgents) {
      lines.push(`- ${u.id}: ${u.error}`);
    }
  }

  return lines.join('\n');
}

module.exports = { renderDailyReview };
