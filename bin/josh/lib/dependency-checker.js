'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ALL_LIVE_STATES = [
  'incoming', 'triaged', 'claimed', 'planning', 'awaiting_approval',
  'approved', 'rejected', 'revised', 'in_progress', 'done',
  'blocked', 'failed', 'cancelled',
];

function findState(joshRoot, depId) {
  for (const s of ALL_LIVE_STATES) {
    if (fs.existsSync(path.join(joshRoot, 'todo', s, depId))) return s;
  }
  return 'missing';
}

function readDisplayId(joshRoot, depId, state) {
  if (state === 'missing') return null;
  const metaPath = path.join(joshRoot, 'todo', state, depId, 'meta.json');
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    return meta.display_id || null;
  } catch (e) {
    return null;
  }
}

function checkDependencies(joshRoot, todo) {
  const deps = Array.isArray(todo && todo.depends_on) ? todo.depends_on : [];
  const displayIds = Array.isArray(todo && todo.depends_on_display_ids) ? todo.depends_on_display_ids : [];
  const blocked_by = [];
  for (let i = 0; i < deps.length; i++) {
    const dep = deps[i];
    if (!dep || dep.kind === 'soft') continue;
    const state = findState(joshRoot, dep.id);
    if (state === 'done') continue;
    const display_id = readDisplayId(joshRoot, dep.id, state) || displayIds[i] || dep.id.slice(-6);
    blocked_by.push({ id: dep.id, display_id, state });
  }
  return { ok: blocked_by.length === 0, blocked_by };
}

module.exports = { checkDependencies, ALL_LIVE_STATES };
