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

test('cli: plan submit validates 8-section plan and transitions to awaiting_approval', () => {
  const root = setupRoot();
  // Seed agent A01
  const briefSource = path.join(root, 'AGENT_01.md');
  fs.writeFileSync(briefSource, '# Agent A01\n');
  fs.mkdirSync(path.join(root, 'agents', 'A01'), { recursive: true });
  fs.writeFileSync(path.join(root, 'agents', 'A01', 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A01', source_path: briefSource,
  }));
  // Push and triage and claim
  const out = runCli('push todo "plan-test"', { JOSH_ROOT: root });
  const id = out.trim().split('\n').filter(Boolean).pop().trim();
  runCli('tick', { JOSH_ROOT: root });
  const metaPath = path.join(root, 'todo', 'triaged', id, 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  meta.primary_role = 'A01';
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  runCli(`claim ${id} --agent A01 --as A01`, { JOSH_ROOT: root });

  // Submit a valid plan
  const planSource = path.resolve(__dirname, 'fixtures/sample-plan.md');
  runCli(`plan submit ${id} --plan "${planSource}" --as A01`, { JOSH_ROOT: root });

  // Folder should now be in awaiting_approval/
  const aaDir = path.join(root, 'todo', 'awaiting_approval', id);
  assert.equal(fs.existsSync(aaDir), true, 'expected awaiting_approval folder');
  assert.equal(fs.existsSync(path.join(aaDir, 'plan.md')), true, 'plan.md should be copied into folder');
  assert.equal(fs.existsSync(path.join(aaDir, 'plan-review.json')), true, 'plan-review.json should exist');
  assert.equal(fs.existsSync(path.join(aaDir, 'approval')), true, 'approval signal file should exist');
  assert.equal(fs.readFileSync(path.join(aaDir, 'approval'), 'utf8').trim(), 'pending');

  fs.rmSync(root, { recursive: true, force: true });
});

test('cli: plan submit rejects an invalid plan', () => {
  const root = setupRoot();
  const briefSource = path.join(root, 'AGENT_03.md');
  fs.writeFileSync(briefSource, '# Agent A03\n');
  fs.mkdirSync(path.join(root, 'agents', 'A03'), { recursive: true });
  fs.writeFileSync(path.join(root, 'agents', 'A03', 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A03', source_path: briefSource,
  }));
  const out = runCli('push todo "plan-bad"', { JOSH_ROOT: root });
  const id = out.trim().split('\n').filter(Boolean).pop().trim();
  runCli('tick', { JOSH_ROOT: root });
  const metaPath = path.join(root, 'todo', 'triaged', id, 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  meta.primary_role = 'A03';
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  runCli(`claim ${id} --agent A03 --as A03`, { JOSH_ROOT: root });

  // Write an invalid plan (no frontmatter)
  const badPlanPath = path.join(root, 'bad-plan.md');
  fs.writeFileSync(badPlanPath, '## Fast-Path\n\nincomplete\n');
  let err = null;
  try {
    runCli(`plan submit ${id} --plan "${badPlanPath}" --as A03`, { JOSH_ROOT: root });
  } catch (e) {
    err = e;
  }
  assert.ok(err, 'expected plan submit to fail on invalid plan');
  assert.match(err.stderr.toString(), /frontmatter|missing required section/i);
  // Todo must remain in claimed
  assert.equal(fs.existsSync(path.join(root, 'todo', 'claimed', id)), true);

  fs.rmSync(root, { recursive: true, force: true });
});

test('cli: tick promotes approved → in_progress', () => {
  const root = setupRoot();
  // Seed agent
  const briefSource = path.join(root, 'AGENT_05.md');
  fs.writeFileSync(briefSource, '# Agent A05\n');
  fs.mkdirSync(path.join(root, 'agents', 'A05'), { recursive: true });
  fs.writeFileSync(path.join(root, 'agents', 'A05', 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A05', source_path: briefSource,
  }));
  const out = runCli('push todo "tick-promo"', { JOSH_ROOT: root });
  const id = out.trim().split('\n').filter(Boolean).pop().trim();
  runCli('tick', { JOSH_ROOT: root });
  const metaPath = path.join(root, 'todo', 'triaged', id, 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  meta.primary_role = 'A05';
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  runCli(`claim ${id} --agent A05 --as A05`, { JOSH_ROOT: root });
  const planSource = path.resolve(__dirname, 'fixtures/sample-plan.md');
  runCli(`plan submit ${id} --plan "${planSource}" --as A05`, { JOSH_ROOT: root });
  runCli(`plan approve ${id} --as human`, { JOSH_ROOT: root });

  assert.equal(fs.existsSync(path.join(root, 'todo', 'approved', id)), true, 'should be in approved');

  // Tick
  runCli('tick', { JOSH_ROOT: root });

  assert.equal(fs.existsSync(path.join(root, 'todo', 'approved', id)), false, 'should leave approved');
  assert.equal(fs.existsSync(path.join(root, 'todo', 'in_progress', id, 'meta.json')), true, 'should land in in_progress');

  fs.rmSync(root, { recursive: true, force: true });
});

test('cli: complete rejects when handoff.md missing', () => {
  const root = setupRoot();
  // Push, tick, claim (legacy path, no --agent → in_progress)
  const out = runCli('push todo "no-handoff"', { JOSH_ROOT: root });
  const id = out.trim().split('\n').filter(Boolean).pop().trim();
  runCli('tick', { JOSH_ROOT: root });
  runCli(`claim ${id} --as worker`, { JOSH_ROOT: root });

  let err = null;
  try { runCli(`complete ${id} --as worker`, { JOSH_ROOT: root }); } catch (e) { err = e; }
  assert.ok(err, 'expected complete to fail without handoff.md');
  assert.match(err.stderr.toString(), /handoff\.md/);
  // Still in in_progress
  assert.equal(fs.existsSync(path.join(root, 'todo', 'in_progress', id, 'meta.json')), true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('cli: complete accepts a valid handoff.md', () => {
  const root = setupRoot();
  const out = runCli('push todo "with-handoff"', { JOSH_ROOT: root });
  const id = out.trim().split('\n').filter(Boolean).pop().trim();
  runCli('tick', { JOSH_ROOT: root });
  runCli(`claim ${id} --as worker`, { JOSH_ROOT: root });
  // Drop the handoff fixture in place
  const handoffSource = fs.readFileSync(path.join(__dirname, 'fixtures/sample-handoff.md'), 'utf8');
  fs.writeFileSync(path.join(root, 'todo', 'in_progress', id, 'handoff.md'), handoffSource);
  runCli(`complete ${id} --as worker`, { JOSH_ROOT: root });

  assert.equal(fs.existsSync(path.join(root, 'todo', 'done', id, 'meta.json')), true);
  assert.equal(fs.existsSync(path.join(root, 'todo', 'done', id, 'handoff.md')), true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('cli: complete --skip-handoff bypasses validation', () => {
  const root = setupRoot();
  const out = runCli('push todo "skip-handoff"', { JOSH_ROOT: root });
  const id = out.trim().split('\n').filter(Boolean).pop().trim();
  runCli('tick', { JOSH_ROOT: root });
  runCli(`claim ${id} --as worker`, { JOSH_ROOT: root });
  runCli(`complete ${id} --as worker --skip-handoff`, { JOSH_ROOT: root });
  assert.equal(fs.existsSync(path.join(root, 'todo', 'done', id, 'meta.json')), true);
  fs.rmSync(root, { recursive: true, force: true });
});
