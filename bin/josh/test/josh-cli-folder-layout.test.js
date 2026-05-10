const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

const JOSH_BIN = path.resolve(__dirname, '..', 'josh.js');

function runCli(args, env) {
  return execSync(`node "${JOSH_BIN}" ${args}`, {
    env: { ...process.env, ...env },
    stdio: 'pipe',
  }).toString();
}

function setupRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-cli-'));
  runCli('init', { JOSH_ROOT: root });
  return root;
}

test('cli: claim flow works against folder layout', () => {
  const root = setupRoot();
  // Push a todo via the CLI (creates folder layout in incoming/)
  const out = runCli('push todo "do a thing"', { JOSH_ROOT: root });
  // The push CLI prints the new id on the last non-empty line
  const id = out.trim().split('\n').filter(Boolean).pop().trim();

  // Tick to triage it (push goes to incoming → triaged)
  runCli('tick', { JOSH_ROOT: root });

  // Verify folder layout in triaged
  const triagedDir = path.join(root, 'todo', 'triaged', id);
  assert.equal(fs.existsSync(path.join(triagedDir, 'meta.json')), true,
    `expected ${triagedDir}/meta.json after tick`);
  assert.equal(fs.readFileSync(path.join(triagedDir, 'state'), 'utf8').trim(), 'triaged');

  // Claim — moves into in_progress (Phase 2A keeps existing claim semantics for now;
  // the new --agent + claimed state lands in Task 11.)
  runCli(`claim ${id} --as test`, { JOSH_ROOT: root });
  const ipDir = path.join(root, 'todo', 'in_progress', id);
  assert.equal(fs.existsSync(path.join(ipDir, 'meta.json')), true, 'expected meta.json in in_progress');

  fs.rmSync(root, { recursive: true, force: true });
});

test('cli: claim --agent moves to claimed and writes runtime.json + agent_brief_path', () => {
  const root = setupRoot();
  // Seed an agent manifest so loadBrief works
  const briefSource = path.join(root, 'AGENT_01_TEST.md');
  fs.writeFileSync(briefSource, '# Agent A01 - Test\n\n## Mission\n\nDo the thing.\n');
  fs.mkdirSync(path.join(root, 'agents', 'A01'), { recursive: true });
  fs.writeFileSync(path.join(root, 'agents', 'A01', 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A01', source_path: briefSource,
  }));

  // Push a todo whose primary_role matches A01
  const out = runCli('push todo "do command-center work" --label A01', { JOSH_ROOT: root });
  const id = out.trim().split('\n').filter(Boolean).pop().trim();
  runCli('tick', { JOSH_ROOT: root });

  // Manually set primary_role on the meta (push doesn't take a flag for it; this is what import would do)
  const metaPath = path.join(root, 'todo', 'triaged', id, 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  meta.primary_role = 'A01';
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

  // Claim with --agent A01
  runCli(`claim ${id} --agent A01 --as A01`, { JOSH_ROOT: root });

  // Folder should be in claimed/
  const claimedDir = path.join(root, 'todo', 'claimed', id);
  assert.equal(fs.existsSync(claimedDir), true, 'expected claimed folder');
  // runtime.json present
  const runtime = JSON.parse(fs.readFileSync(path.join(claimedDir, 'runtime.json'), 'utf8'));
  assert.equal(runtime.claimed_by, 'A01');
  assert.equal(typeof runtime.started_at, 'string');
  // agent_brief_path stamped on meta
  const newMeta = JSON.parse(fs.readFileSync(path.join(claimedDir, 'meta.json'), 'utf8'));
  assert.equal(newMeta.agent_brief_path, briefSource);

  fs.rmSync(root, { recursive: true, force: true });
});

test('cli: claim --agent rejects when primary_role does not match', () => {
  const root = setupRoot();
  fs.mkdirSync(path.join(root, 'agents', 'A02'), { recursive: true });
  fs.writeFileSync(path.join(root, 'agents', 'A02', 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A02', source_path: 'irrelevant',
  }));

  const out = runCli('push todo "wrong-role work"', { JOSH_ROOT: root });
  const id = out.trim().split('\n').filter(Boolean).pop().trim();
  runCli('tick', { JOSH_ROOT: root });
  const metaPath = path.join(root, 'todo', 'triaged', id, 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  meta.primary_role = 'A09';
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

  let err = null;
  try {
    runCli(`claim ${id} --agent A02 --as A02`, { JOSH_ROOT: root });
  } catch (e) {
    err = e;
  }
  assert.ok(err, 'expected claim to fail');
  assert.match(err.stderr.toString(), /primary_role/);

  fs.rmSync(root, { recursive: true, force: true });
});
