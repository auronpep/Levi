const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');
const {
  createWorktree, removeWorktree, listWorktrees, sweepWorktrees,
} = require('../lib/worktree');

function makeFixtureRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-wt-repo-'));
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "t@t" && git config user.name "t"', { cwd: dir, stdio: 'pipe' });
  fs.writeFileSync(path.join(dir, 'README.md'), '# fixture\n');
  execSync('git add . && git commit -m "init"', { cwd: dir, stdio: 'pipe' });
  // detect default branch
  const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: dir }).toString().trim();
  return { repo: dir, branch };
}

function makeJoshRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-wt-root-'));
  for (const s of ['triaged', 'claimed', 'in_progress', 'done', 'failed', 'cancelled']) {
    fs.mkdirSync(path.join(root, 'todo', s), { recursive: true });
  }
  return root;
}

function seedTodo(joshRoot, state, id, meta = {}) {
  const dir = path.join(joshRoot, 'todo', state, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ schema: 1, id, ...meta }, null, 2));
  fs.writeFileSync(path.join(dir, 'state'), state + '\n');
  return dir;
}

test('createWorktree: creates a worktree on a new agent branch', () => {
  const { repo, branch } = makeFixtureRepo();
  const root = makeJoshRoot();
  seedTodo(root, 'claimed', '01TODO0001');
  const r = createWorktree(root, '01TODO0001', { baseRepo: repo, baseBranch: branch, suffix: 1 });
  assert.ok(fs.existsSync(r.path), `expected ${r.path}`);
  assert.match(r.branch, /^agent\/.*-1$/);
  // The branch must show up in `git branch --list`
  const branches = execSync('git branch --list', { cwd: repo }).toString();
  assert.match(branches, new RegExp(r.branch.replace('/', '\\/')));
  // Cleanup
  execSync(`git -C "${repo}" worktree remove --force "${r.path}"`, { stdio: 'pipe' });
  execSync(`git -C "${repo}" branch -D ${r.branch}`, { stdio: 'pipe' });
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(repo, { recursive: true, force: true });
});

test('listWorktrees: enumerates per-todo worktrees', () => {
  const { repo, branch } = makeFixtureRepo();
  const root = makeJoshRoot();
  seedTodo(root, 'claimed', '01TODO0002');
  const w1 = createWorktree(root, '01TODO0002', { baseRepo: repo, baseBranch: branch, suffix: 1 });
  const w2 = createWorktree(root, '01TODO0002', { baseRepo: repo, baseBranch: branch, suffix: 2 });
  const list = listWorktrees(root, '01TODO0002');
  assert.equal(list.length, 2);
  assert.deepEqual(list.map((w) => w.suffix).sort(), ['1', '2']);
  for (const w of [w1, w2]) {
    execSync(`git -C "${repo}" worktree remove --force "${w.path}"`, { stdio: 'pipe' });
    execSync(`git -C "${repo}" branch -D ${w.branch}`, { stdio: 'pipe' });
  }
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(repo, { recursive: true, force: true });
});

test('removeWorktree: cleans path + branch', () => {
  const { repo, branch } = makeFixtureRepo();
  const root = makeJoshRoot();
  seedTodo(root, 'claimed', '01TODO0003');
  const w = createWorktree(root, '01TODO0003', { baseRepo: repo, baseBranch: branch, suffix: 1 });
  const before = execSync('git branch --list', { cwd: repo }).toString();
  assert.match(before, /agent\//);
  const r = removeWorktree(root, '01TODO0003', { baseRepo: repo });
  assert.equal(r.removed, 1);
  const after = execSync('git branch --list', { cwd: repo }).toString();
  assert.equal(after.includes('agent/'), false, 'agent branch should be gone');
  assert.equal(fs.existsSync(w.path), false, 'worktree dir should be gone');
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(repo, { recursive: true, force: true });
});

test('sweepWorktrees: removes worktrees of done/failed/cancelled todos only', () => {
  const { repo, branch } = makeFixtureRepo();
  const root = makeJoshRoot();
  // Two todos: one done (should sweep), one claimed (should leave alone).
  seedTodo(root, 'claimed', '01ALIVE');
  seedTodo(root, 'done',    '01DEAD',  { context: { repo } });
  const wAlive = createWorktree(root, '01ALIVE', { baseRepo: repo, baseBranch: branch, suffix: 1 });
  const wDead  = createWorktree(root, '01DEAD',  { baseRepo: repo, baseBranch: branch, suffix: 1 });
  const r = sweepWorktrees(root, { baseRepo: repo });
  assert.equal(r.swept, 1);
  assert.equal(fs.existsSync(wDead.path), false);
  assert.equal(fs.existsSync(wAlive.path), true);
  // Cleanup the survivor
  execSync(`git -C "${repo}" worktree remove --force "${wAlive.path}"`, { stdio: 'pipe' });
  execSync(`git -C "${repo}" branch -D ${wAlive.branch}`, { stdio: 'pipe' });
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(repo, { recursive: true, force: true });
});
