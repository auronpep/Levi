const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

const JOSH_BIN = path.resolve(__dirname, '..', 'josh.js');
const FIXTURE_CORPUS = path.resolve(__dirname, 'fixtures/corpus');
const SAMPLE_PLAN = path.resolve(__dirname, 'fixtures/sample-plan.md');
const SAMPLE_HANDOFF = path.resolve(__dirname, 'fixtures/sample-handoff.md');

function runCli(args, env) {
  return execSync(`node "${JOSH_BIN}" ${args}`, {
    env: { ...process.env, ...env },
    stdio: 'pipe',
  }).toString();
}

test('smoke: full dispatch lifecycle import → claim → plan → approve → tick → complete', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-smoke-'));
  runCli('init', { JOSH_ROOT: root });

  // 1. Import the fixture corpus
  const importOut = runCli(`project import "${FIXTURE_CORPUS}"`, { JOSH_ROOT: root });
  assert.match(importOut, /imported project/);
  assert.match(importOut, /todos:\s+2/);
  assert.match(importOut, /agents:\s+2/);

  // 2. Find the D1-001 todo (primary_role A01) by listing triaged
  const triagedDir = path.join(root, 'todo', 'triaged');
  const ids = fs.readdirSync(triagedDir, { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name);
  assert.equal(ids.length, 2);
  let targetId = null;
  for (const id of ids) {
    const meta = JSON.parse(fs.readFileSync(path.join(triagedDir, id, 'meta.json'), 'utf8'));
    if (meta.display_id === 'D1-001') {
      targetId = id;
      break;
    }
  }
  assert.ok(targetId, 'expected to find D1-001 todo');

  // 3. Claim with --agent A01
  runCli(`claim ${targetId} --agent A01 --as A01`, { JOSH_ROOT: root });
  assert.equal(fs.existsSync(path.join(root, 'todo', 'claimed', targetId, 'runtime.json')), true);
  const stampedMeta = JSON.parse(fs.readFileSync(path.join(root, 'todo', 'claimed', targetId, 'meta.json'), 'utf8'));
  assert.match(stampedMeta.agent_brief_path, /AGENT_01_COMMAND_CENTER\.md$/);

  // 4. Submit plan
  runCli(`plan submit ${targetId} --plan "${SAMPLE_PLAN}" --as A01`, { JOSH_ROOT: root });
  assert.equal(fs.existsSync(path.join(root, 'todo', 'awaiting_approval', targetId, 'plan.md')), true);
  assert.equal(fs.readFileSync(path.join(root, 'todo', 'awaiting_approval', targetId, 'approval'), 'utf8').trim(), 'pending');

  // 5. Approve
  runCli(`plan approve ${targetId} --as human:tester`, { JOSH_ROOT: root });
  assert.equal(fs.existsSync(path.join(root, 'todo', 'approved', targetId)), true);
  assert.equal(fs.readFileSync(path.join(root, 'todo', 'approved', targetId, 'approval'), 'utf8').trim(), 'approved');

  // 6. Tick — should auto-promote to in_progress
  runCli('tick', { JOSH_ROOT: root });
  assert.equal(fs.existsSync(path.join(root, 'todo', 'in_progress', targetId, 'meta.json')), true);

  // 7. Write handoff into the in_progress folder
  fs.copyFileSync(SAMPLE_HANDOFF, path.join(root, 'todo', 'in_progress', targetId, 'handoff.md'));

  // 8. Complete
  runCli(`complete ${targetId} --as A01`, { JOSH_ROOT: root });
  assert.equal(fs.existsSync(path.join(root, 'todo', 'done', targetId, 'meta.json')), true);
  assert.equal(fs.existsSync(path.join(root, 'todo', 'done', targetId, 'handoff.md')), true);

  // 9. Audit log captures every transition.
  const auditDir = path.join(root, 'audit');
  const auditFiles = fs.readdirSync(auditDir).filter((f) => f.endsWith('.jsonl'));
  assert.ok(auditFiles.length > 0);
  const auditLines = fs.readFileSync(path.join(auditDir, auditFiles[0]), 'utf8').trim().split('\n').map(JSON.parse);
  const actions = auditLines.map((l) => l.action);
  for (const a of [
    'project.imported', 'todo.imported', 'todo.claimed',
    'todo.plan_submitted', 'todo.plan_approved',
    'todo.auto_promoted', 'todo.completed',
  ]) {
    assert.ok(actions.includes(a), `audit log missing action: ${a}; got: ${actions.join(', ')}`);
  }

  fs.rmSync(root, { recursive: true, force: true });
});

test('smoke: rejection path import → claim → plan → reject leaves todo in rejected', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-smoke-rej-'));
  runCli('init', { JOSH_ROOT: root });
  runCli(`project import "${FIXTURE_CORPUS}"`, { JOSH_ROOT: root });
  const triagedDir = path.join(root, 'todo', 'triaged');
  const ids = fs.readdirSync(triagedDir, { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name);
  let targetId = null;
  for (const id of ids) {
    const meta = JSON.parse(fs.readFileSync(path.join(triagedDir, id, 'meta.json'), 'utf8'));
    if (meta.display_id === 'D1-001') { targetId = id; break; }
  }
  runCli(`claim ${targetId} --agent A01 --as A01`, { JOSH_ROOT: root });
  runCli(`plan submit ${targetId} --plan "${SAMPLE_PLAN}" --as A01`, { JOSH_ROOT: root });
  runCli(`plan reject ${targetId} --reason "scope drift" --as human:tester`, { JOSH_ROOT: root });

  assert.equal(fs.existsSync(path.join(root, 'todo', 'rejected', targetId, 'meta.json')), true);
  assert.equal(fs.readFileSync(path.join(root, 'todo', 'rejected', targetId, 'approval'), 'utf8').trim(), 'rejected');
  fs.rmSync(root, { recursive: true, force: true });
});
