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

module.exports = {
  ALL_STATES,
  folderPath,
  metaPath,
  ensureFolder,
  writeMeta,
  readMeta,
};
