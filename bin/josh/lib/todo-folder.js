'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ALL_STATES = [
  'incoming', 'triaged', 'claimed', 'planning', 'awaiting_approval',
  'approved', 'rejected', 'revised', 'in_progress', 'done',
  'blocked', 'failed', 'cancelled',
];

function folderPath(joshRoot, state, id) {
  return path.join(joshRoot, 'todo', state, id);
}

function metaPath(joshRoot, state, id) {
  return path.join(folderPath(joshRoot, state, id), 'meta.json');
}

function ensureFolder(joshRoot, state, id) {
  fs.mkdirSync(folderPath(joshRoot, state, id), { recursive: true });
}

function writeJsonAtomic(p, obj) {
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, p);
}

function writeMeta(joshRoot, state, id, meta) {
  ensureFolder(joshRoot, state, id);
  writeJsonAtomic(metaPath(joshRoot, state, id), meta);
  // Also keep the one-line `state` sibling in sync.
  fs.writeFileSync(path.join(folderPath(joshRoot, state, id), 'state'), state + '\n', 'utf8');
}

function readMeta(joshRoot, state, id) {
  const p = metaPath(joshRoot, state, id);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

function listTodosInState(joshRoot, state) {
  const dir = path.join(joshRoot, 'todo', state);
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return []; }
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const meta = readMeta(joshRoot, state, e.name);
    if (!meta) continue;
    out.push({ ...meta, _state: state });
  }
  return out;
}

function findFolderById(joshRoot, idOrSuffix) {
  if (!idOrSuffix) return null;
  let exactHit = null;
  let suffixHit = null;
  for (const state of ALL_STATES) {
    const dir = path.join(joshRoot, 'todo', state);
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { continue; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name === idOrSuffix) {
        exactHit = { state, id: e.name };
        break;
      }
      if (idOrSuffix.length >= 4 && idOrSuffix.length < 26 && e.name.endsWith(idOrSuffix)) {
        if (!suffixHit) suffixHit = { state, id: e.name };
        else suffixHit.collision = true;
      }
    }
    if (exactHit) break;
  }
  return exactHit || suffixHit;
}

function transitionFolder(joshRoot, fromState, toState, id) {
  const fromDir = folderPath(joshRoot, fromState, id);
  const toDir = folderPath(joshRoot, toState, id);
  if (!fs.existsSync(fromDir)) {
    return { code: 3, error: `todo no longer in ${fromState} (race?)` };
  }
  if (fs.existsSync(toDir)) {
    return { code: 4, error: `target already exists: ${toState}/${id}` };
  }
  // Ensure parent exists
  fs.mkdirSync(path.dirname(toDir), { recursive: true });
  try {
    fs.renameSync(fromDir, toDir);
  } catch (e) {
    return { code: 4, error: `rename failed: ${e.message}` };
  }
  // Sync the one-line state file with the new parent dir name.
  try {
    fs.writeFileSync(path.join(toDir, 'state'), toState + '\n', 'utf8');
  } catch (e) {
    // non-fatal; meta.json is canonical
  }
  return { code: 0 };
}

module.exports = {
  ALL_STATES,
  folderPath,
  metaPath,
  ensureFolder,
  writeMeta,
  readMeta,
  listTodosInState,
  findFolderById,
  transitionFolder,
};
