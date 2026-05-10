const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

const joshBin = path.resolve(__dirname, '..', 'josh.js');

function run(cmd, env) {
  return execSync(`node "${joshBin}" ${cmd}`, { env, stdio: 'pipe' }).toString();
}

function makeFixtureRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-spec-repo-'));
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "t@t" && git config user.name "t"', { cwd: dir, stdio: 'pipe' });
  fs.writeFileSync(path.join(dir, 'README.md'), '# fixture\n');
  execSync('git add . && git commit -m "init"', { cwd: dir, stdio: 'pipe' });
  const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: dir }).toString().trim();
  return { repo: dir, branch };
}

function setup() {
  const { repo, branch } = makeFixtureRepo();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-spec-'));
  const env = { ...process.env, JOSH_ROOT: root };
  execSync(`node "${joshBin}" init`, { env, stdio: 'pipe' });

  // Seed agent A03.
  const dir = path.join(root, 'agents', 'A03');
  fs.mkdirSync(dir, { recursive: true });
  const briefPath = path.join(dir, 'brief.md');
  fs.writeFileSync(briefPath, '# A03\n');
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A03', source_path: briefPath,
  }, null, 2));

  // Seed triaged matrix-mode todo with context.repo set to the fixture.
  const todoId = '01SPECTODO000000000000000';
  const todoDir = path.join(root, 'todo', 'triaged', todoId);
  fs.mkdirSync(todoDir, { recursive: true });
  fs.writeFileSync(path.join(todoDir, 'meta.json'), JSON.stringify({
    schema: 1, id: todoId, display_id: 'D1-SPEC',
    primary_role: 'A03',
    verdict_mode: 'matrix',
    context: { repo, branch },
    history: [],
  }, null, 2));
  fs.writeFileSync(path.join(todoDir, 'state'), 'triaged\n');
  fs.writeFileSync(path.join(todoDir, 'events.ndjson'), '');

  return { root, env, todoId, repo, branch };
}

test('speculative smoke: claim --speculative 3 forks 3 worktrees + sweep on done', () => {
  const { root, env, todoId, repo, branch } = setup();

  // Claim with --speculative 3.
  const out = run(`claim ${todoId} --agent A03 --as A03 --speculative 3`, env);
  assert.match(out, /worktree\[1\]/);
  assert.match(out, /worktree\[2\]/);
  assert.match(out, /worktree\[3\]/);

  // 3 worktree dirs in claimed/<id>/.
  const claimedDir = path.join(root, 'todo', 'claimed', todoId);
  for (let i = 1; i <= 3; i++) {
    assert.equal(fs.existsSync(path.join(claimedDir, `worktree-${i}`)), true);
    assert.equal(fs.existsSync(path.join(claimedDir, `worktree-${i}`, 'README.md')), true);
  }
  // 3 agent branches.
  const branches = execSync('git branch --list', { cwd: repo }).toString();
  const matches = branches.match(/agent\//g) || [];
  assert.equal(matches.length, 3, `expected 3 agent/* branches, got: ${branches}`);

  // Move the todo to done/ to trigger sweep.
  const doneDir = path.join(root, 'todo', 'done', todoId);
  fs.renameSync(claimedDir, doneDir);
  fs.writeFileSync(path.join(doneDir, 'state'), 'done\n');

  // Tick → should sweep all 3 worktrees + branches.
  const tickOut = run('tick', env);
  assert.match(tickOut, /worktrees_swept=3/);

  // Worktree dirs gone.
  for (let i = 1; i <= 3; i++) {
    assert.equal(fs.existsSync(path.join(doneDir, `worktree-${i}`)), false);
  }
  // Branches gone.
  const branchesAfter = execSync('git branch --list', { cwd: repo }).toString();
  assert.equal((branchesAfter.match(/agent\//g) || []).length, 0);

  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(repo, { recursive: true, force: true });
});

test('speculative smoke: --speculative without --agent fails with usage error', () => {
  const { root, env, todoId } = setup();
  let exitCode = 0; let stderrOut = '';
  try {
    execSync(`node "${joshBin}" claim ${todoId} --as A03 --speculative 3`, { env, stdio: 'pipe' });
  } catch (e) { exitCode = e.status; stderrOut = e.stderr.toString(); }
  assert.equal(exitCode, 1);
  assert.match(stderrOut, /requires --agent/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('speculative smoke: --speculative N out of [2,10] rejected', () => {
  const { root, env, todoId } = setup();
  let exitCode = 0; let stderrOut = '';
  try {
    execSync(`node "${joshBin}" claim ${todoId} --agent A03 --as A03 --speculative 1`, { env, stdio: 'pipe' });
  } catch (e) { exitCode = e.status; stderrOut = e.stderr.toString(); }
  assert.equal(exitCode, 1);
  assert.match(stderrOut, /\[2, 10\]/);
  fs.rmSync(root, { recursive: true, force: true });
});
