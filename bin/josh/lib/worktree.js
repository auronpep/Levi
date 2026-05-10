'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ALL_LIVE_STATES = [
  'incoming', 'triaged', 'claimed', 'planning', 'awaiting_approval',
  'approved', 'rejected', 'revised', 'in_progress', 'done',
  'blocked', 'failed', 'cancelled',
];
const TERMINAL_STATES = ['done', 'failed', 'cancelled'];

function findTodoFolder(joshRoot, todoId) {
  for (const s of ALL_LIVE_STATES) {
    const p = path.join(joshRoot, 'todo', s, todoId);
    if (fs.existsSync(p)) return { folder: p, state: s };
  }
  return null;
}

function shortId(todoId) {
  return todoId.slice(-6).toLowerCase();
}

function git(repo, args, opts = {}) {
  return execSync(`git -C "${repo}" ${args}`, { stdio: opts.stdio || 'pipe', encoding: 'utf8' });
}

function createWorktree(joshRoot, todoId, opts = {}) {
  const found = findTodoFolder(joshRoot, todoId);
  if (!found) throw new Error(`todo ${todoId} not found`);
  const baseRepo = opts.baseRepo;
  if (!baseRepo) throw new Error('createWorktree requires opts.baseRepo');
  if (!fs.existsSync(baseRepo)) throw new Error(`baseRepo not found: ${baseRepo}`);
  const baseBranch = opts.baseBranch || 'main';
  const suffix = opts.suffix == null ? '' : String(opts.suffix);
  const subdir = suffix === '' ? 'worktree' : `worktree-${suffix}`;
  const wtPath = path.join(found.folder, subdir);
  if (fs.existsSync(wtPath)) {
    throw new Error(`worktree already exists at ${wtPath}`);
  }
  const branch = `agent/${shortId(todoId)}${suffix === '' ? '' : '-' + suffix}`;
  // git worktree add -b <branch> <path> <baseBranch>
  git(baseRepo, `worktree add -b ${branch} "${wtPath}" ${baseBranch}`);
  return { path: wtPath, branch, suffix: suffix || '' };
}

function readRuntimeWorktrees(folder) {
  try {
    const r = JSON.parse(fs.readFileSync(path.join(folder, 'runtime.json'), 'utf8'));
    return Array.isArray(r.worktrees) ? r.worktrees : [];
  } catch (e) { return []; }
}

function listWorktrees(joshRoot, todoId) {
  const found = findTodoFolder(joshRoot, todoId);
  if (!found) return [];
  // Prefer runtime.json (has authoritative branch names that survive folder renames).
  const runtimeWts = readRuntimeWorktrees(found.folder);
  const byName = new Map();
  for (const w of runtimeWts) {
    const subdir = w.suffix === '' ? 'worktree' : `worktree-${w.suffix}`;
    const wtPath = path.join(found.folder, subdir);  // re-resolve to current location
    byName.set(subdir, { path: wtPath, branch: w.branch, suffix: String(w.suffix) });
  }
  // Add any worktree dirs present that aren't in runtime.json (best-effort branch detection).
  for (const e of fs.readdirSync(found.folder, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    if (!(e.name === 'worktree' || /^worktree-/.test(e.name))) continue;
    if (byName.has(e.name)) continue;
    const wtPath = path.join(found.folder, e.name);
    const suffix = e.name === 'worktree' ? '' : e.name.replace(/^worktree-/, '');
    let branch = null;
    try { branch = git(wtPath, 'rev-parse --abbrev-ref HEAD').trim(); } catch (_) {}
    byName.set(e.name, { path: wtPath, branch, suffix });
  }
  return Array.from(byName.values());
}

function removeWorktree(joshRoot, todoId, opts = {}) {
  const list = listWorktrees(joshRoot, todoId);
  if (list.length === 0) return { removed: 0 };
  const filtered = opts.suffix != null
    ? list.filter((w) => w.suffix === String(opts.suffix))
    : list;

  let removed = 0;
  for (const wt of filtered) {
    let baseRepo = opts.baseRepo;
    // If baseRepo not given, infer from the worktree's gitdir-pointer (only works
    // if the worktree dir hasn't been moved since `git worktree add`).
    if (!baseRepo) {
      try {
        const gitDirPath = git(wt.path, 'rev-parse --git-common-dir').trim();
        baseRepo = path.resolve(wt.path, gitDirPath, '..');
      } catch (e) { /* moved worktrees can't resolve this */ }
    }
    const branch = wt.branch;
    if (baseRepo) {
      // Try the clean path first (works only if git's worktree registry still
      // matches the current path).
      try { git(baseRepo, `worktree remove --force "${wt.path}"`); } catch (e) { /* often fails after rename */ }
      // Always prune to clean any stale registry entries pointing at moved paths.
      try { git(baseRepo, `worktree prune`); } catch (e) {}
      if (branch && branch !== 'HEAD') {
        try { git(baseRepo, `branch -D ${branch}`); } catch (e) {}
      }
    }
    if (fs.existsSync(wt.path)) {
      try { fs.rmSync(wt.path, { recursive: true, force: true }); } catch (e) {}
    }
    removed++;
  }
  return { removed };
}

function sweepWorktrees(joshRoot, opts = {}) {
  let swept = 0;
  for (const state of TERMINAL_STATES) {
    const dir = path.join(joshRoot, 'todo', state);
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (e) { continue; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const todoFolder = path.join(dir, e.name);
      const wts = fs.readdirSync(todoFolder, { withFileTypes: true })
        .filter((x) => x.isDirectory() && (x.name === 'worktree' || /^worktree-/.test(x.name)));
      if (wts.length === 0) continue;
      // Resolve baseRepo from meta.context.repo if not provided.
      let baseRepo = opts.baseRepo;
      if (!baseRepo) {
        try {
          const meta = JSON.parse(fs.readFileSync(path.join(todoFolder, 'meta.json'), 'utf8'));
          baseRepo = meta && meta.context && meta.context.repo;
        } catch (err) {}
      }
      const r = removeWorktree(joshRoot, e.name, { baseRepo });
      swept += r.removed;
    }
  }
  return { swept };
}

module.exports = {
  createWorktree,
  removeWorktree,
  listWorktrees,
  sweepWorktrees,
  shortId,
  TERMINAL_STATES,
};
