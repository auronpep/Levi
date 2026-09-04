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

// `depends_on` is written in two shapes by two different producers:
//
//   project-importer / project-sync:  [{ id: '01H...', kind: 'hard' }]
//   josh push todo --depends-on,
//   josh block --depends-on:          ['01H...']          (bare ULID strings)
//
// Only the object shape was ever read, so a bare string yielded `dep.id ===
// undefined` and `path.join(root, 'todo', state, undefined)` threw
// `The "path" argument must be of type string`. Normalising here rather than at
// the writers fixes both producers at once and also repairs todos already on
// disk in the string form.
function normalizeDep(dep) {
  if (typeof dep === 'string') {
    const id = dep.trim();
    return id ? { id, kind: 'hard' } : null;
  }
  if (dep && typeof dep === 'object' && typeof dep.id === 'string' && dep.id) return dep;
  return null;
}

function checkDependencies(joshRoot, todo) {
  const deps = Array.isArray(todo && todo.depends_on) ? todo.depends_on : [];
  const displayIds = Array.isArray(todo && todo.depends_on_display_ids) ? todo.depends_on_display_ids : [];
  const blocked_by = [];
  for (let i = 0; i < deps.length; i++) {
    const raw = deps[i];
    if (!raw) continue;
    const dep = normalizeDep(raw);
    // An entry that carries no usable id cannot be looked up, but dropping it
    // would silently release a dependency the operator declared. Report it so
    // the todo stays blocked and the bad entry is visible.
    if (!dep) {
      blocked_by.push({ id: null, display_id: displayIds[i] || '(malformed)', state: 'malformed' });
      continue;
    }
    if (dep.kind === 'soft') continue;
    const state = findState(joshRoot, dep.id);
    if (state === 'done') continue;
    const display_id = readDisplayId(joshRoot, dep.id, state) || displayIds[i] || dep.id.slice(-6);
    blocked_by.push({ id: dep.id, display_id, state });
  }
  return { ok: blocked_by.length === 0, blocked_by };
}

module.exports = { checkDependencies, normalizeDep, ALL_LIVE_STATES };
