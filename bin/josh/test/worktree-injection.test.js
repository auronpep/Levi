// `git()` built a shell command string and interpolated the branch name and
// paths into it. `baseBranch` comes from the todo's `meta.context.branch`, so it
// can arrive on a synced or imported todo rather than being typed by the
// operator - and it was handed to a shell.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const wt = require('../lib/worktree');

const TODO_ID = '01ABCDEF0000000000000XYZ12';

function setup() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-wt-'));
  const repo = path.join(tmp, 'repo');
  fs.mkdirSync(repo);
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'f.txt'), 'x');
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['-c', 'user.email=a@b.example', '-c', 'user.name=a', 'commit', '-qm', 'init'], { cwd: repo });

  const root = path.join(tmp, 'josh');
  fs.mkdirSync(path.join(root, 'todo', 'in_progress', TODO_ID), { recursive: true });
  return { tmp, repo, root };
}

test('a shell metacharacter in baseBranch cannot run a command', () => {
  const { tmp, repo, root } = setup();
  const marker = path.join(tmp, 'PWNED.txt');

  assert.throws(
    () => wt.createWorktree(root, TODO_ID, { baseRepo: repo, baseBranch: `main & echo owned > "${marker}"` }),
    'git must reject the branch name rather than a shell running it',
  );
  assert.strictEqual(fs.existsSync(marker), false, 'no command may be executed');
});

test('several injection shapes all fail closed', () => {
  const { tmp, repo, root } = setup();
  const shapes = ['main; touch A', 'main && touch B', 'main | touch C', 'main`touch D`', 'main$(touch E)'];

  for (const [i, branch] of shapes.entries()) {
    const dir = path.join(root, 'todo', 'in_progress', `T${i}`);
    fs.mkdirSync(dir, { recursive: true });
    try { wt.createWorktree(root, `T${i}`, { baseRepo: repo, baseBranch: branch }); } catch (e) { /* expected */ }
  }
  for (const f of ['A', 'B', 'C', 'D', 'E']) {
    assert.strictEqual(fs.existsSync(path.join(tmp, f)), false, `${f} should not have been created`);
    assert.strictEqual(fs.existsSync(path.join(process.cwd(), f)), false, `${f} should not be in cwd either`);
  }
});

test('a normal worktree is still created on the right branch', () => {
  const { repo, root } = setup();
  const r = wt.createWorktree(root, TODO_ID, { baseRepo: repo, baseBranch: 'main' });

  assert.ok(fs.existsSync(r.path), 'the worktree directory exists');
  assert.strictEqual(r.branch, `agent/${wt.shortId(TODO_ID)}`);
  const head = execFileSync('git', ['-C', r.path, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim();
  assert.strictEqual(head, r.branch);
});

test('a repo path containing a space still works', () => {
  const { tmp, root } = setup();
  const spaced = path.join(tmp, 'my repo');
  fs.mkdirSync(spaced);
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: spaced });
  fs.writeFileSync(path.join(spaced, 'f.txt'), 'x');
  execFileSync('git', ['add', '-A'], { cwd: spaced });
  execFileSync('git', ['-c', 'user.email=a@b.example', '-c', 'user.name=a', 'commit', '-qm', 'init'], { cwd: spaced });

  const r = wt.createWorktree(root, TODO_ID, { baseRepo: spaced, baseBranch: 'main' });
  assert.ok(fs.existsSync(r.path));
});

test('listWorktrees reports the branch of a created worktree', () => {
  const { repo, root } = setup();
  const created = wt.createWorktree(root, TODO_ID, { baseRepo: repo, baseBranch: 'main' });

  const list = wt.listWorktrees(root, TODO_ID);
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].branch, created.branch);
});

test('removeWorktree cleans up the path and the branch', () => {
  const { repo, root } = setup();
  const created = wt.createWorktree(root, TODO_ID, { baseRepo: repo, baseBranch: 'main' });

  const r = wt.removeWorktree(root, TODO_ID, { baseRepo: repo });
  assert.strictEqual(r.removed, 1);
  assert.strictEqual(fs.existsSync(created.path), false);

  const branches = execFileSync('git', ['-C', repo, 'branch', '--list'], { encoding: 'utf8' });
  assert.ok(!branches.includes(created.branch), 'the agent branch is deleted');
});

test('a suffixed worktree gets its own branch and path', () => {
  const { repo, root } = setup();
  const a = wt.createWorktree(root, TODO_ID, { baseRepo: repo, baseBranch: 'main', suffix: 2 });
  assert.match(a.path, /worktree-2$/);
  assert.strictEqual(a.branch, `agent/${wt.shortId(TODO_ID)}-2`);
});

test('a nonexistent base branch is a git error, not a silent success', () => {
  const { repo, root } = setup();
  assert.throws(() => wt.createWorktree(root, TODO_ID, { baseRepo: repo, baseBranch: 'no-such-branch' }));
});
