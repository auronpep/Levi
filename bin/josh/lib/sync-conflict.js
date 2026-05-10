'use strict';

// Syncthing-style sync-conflict resolver. Files matching `*.sync-conflict-*` get
// disambiguated against their canonical sibling: lexicographically-greater ULID wins
// (preserved at canonical name); loser archived to ~/.josh/conflicts/<date>/<id>/.

const fs = require('node:fs');
const path = require('node:path');

const CONFLICT_RE = /\.sync-conflict-/;

function findConflicts(joshRoot, opts = {}) {
  const root = opts.scope || path.join(joshRoot, 'todo');
  const out = [];
  function walk(dir) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (e) { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (CONFLICT_RE.test(e.name)) out.push({ path: full, kind: 'directory', name: e.name });
        else walk(full);
      } else if (e.isFile() && CONFLICT_RE.test(e.name)) {
        out.push({ path: full, kind: 'file', name: e.name });
      }
    }
  }
  walk(root);
  return out;
}

function canonicalSiblingPath(conflictPath) {
  // Strip the `.sync-conflict-<timestamp>-<host>` segment. Pattern Syncthing produces:
  //   foo.sync-conflict-20260510-1500-HOST.txt   → foo.txt
  //   somedir.sync-conflict-20260510-1500-HOST   → somedir
  const dir = path.dirname(conflictPath);
  const base = path.basename(conflictPath);
  const stripped = base.replace(/\.sync-conflict-[0-9]{8}-[0-9]{4,6}-[A-Za-z0-9_-]+/, '');
  return path.join(dir, stripped);
}

function ulidCandidate(name) {
  // ULIDs are 26 chars Crockford base32. Match leading or contained ULID-like substring.
  const m = name.match(/[0-9A-HJKMNP-TV-Z]{20,26}/);
  return m ? m[0] : null;
}

function pickWinner(canonicalName, conflictName) {
  const a = ulidCandidate(canonicalName) || canonicalName;
  const b = ulidCandidate(conflictName)  || conflictName;
  // Lexicographic sort; later ULID is greater.
  return a >= b ? 'canonical' : 'conflict';
}

function ensureConflictsArchive(joshRoot, dateStr) {
  const dir = path.join(joshRoot, 'conflicts', dateStr || new Date().toISOString().slice(0, 10));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function archive(joshRoot, fromPath, opts = {}) {
  const archiveDir = ensureConflictsArchive(joshRoot, opts.date);
  const dst = path.join(archiveDir, path.basename(fromPath));
  let i = 0;
  let target = dst;
  while (fs.existsSync(target)) { i++; target = `${dst}.${i}`; }
  fs.renameSync(fromPath, target);
  return target;
}

function resolveConflict(joshRoot, conflict, opts = {}) {
  const canonicalPath = canonicalSiblingPath(conflict.path);
  if (!fs.existsSync(canonicalPath)) {
    // No canonical → just promote the conflict to canonical (it's the only thing).
    if (opts.dryRun) return { action: 'promote', conflict: conflict.path, canonical: canonicalPath };
    fs.renameSync(conflict.path, canonicalPath);
    return { action: 'promoted', winner: 'conflict', archived: null };
  }
  const winner = pickWinner(path.basename(canonicalPath), path.basename(conflict.path));
  if (opts.dryRun) return { action: 'preview', conflict: conflict.path, canonical: canonicalPath, winner };

  if (winner === 'canonical') {
    // Archive the conflict.
    const archived = archive(joshRoot, conflict.path, opts);
    return { action: 'archived', winner: 'canonical', archived };
  } else {
    // Promote conflict over canonical: archive canonical, then rename conflict.
    const archived = archive(joshRoot, canonicalPath, opts);
    fs.renameSync(conflict.path, canonicalPath);
    return { action: 'promoted', winner: 'conflict', archived };
  }
}

function resolveAll(joshRoot, opts = {}) {
  const conflicts = findConflicts(joshRoot, opts);
  const results = [];
  for (const c of conflicts) {
    try {
      results.push({ ...resolveConflict(joshRoot, c, opts), source: c.path });
    } catch (e) {
      results.push({ action: 'error', source: c.path, error: e.message });
    }
  }
  return { count: conflicts.length, results };
}

module.exports = {
  findConflicts,
  canonicalSiblingPath,
  pickWinner,
  resolveConflict,
  resolveAll,
  CONFLICT_RE,
};
