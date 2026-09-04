// The plan gate exists so something other than the agent decides whether the
// agent's plan should run: claimed → planning → awaiting_approval → approved is
// the review step before execution. Without a check, the agent that wrote the
// plan could walk the whole lifecycle itself - submit, approve, execute.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const JOSH = path.join(__dirname, '..', 'josh.js');
const SECTIONS = [
  'Fast-Path', 'Problem statement', 'Current state evidence', 'Proposed approach',
  'Step-by-step change list', 'Risks + rollback', 'Test plan', 'Approval prompt',
];

function run(root, args) {
  return execFileSync(process.execPath, [JOSH, ...args], {
    env: { ...process.env, JOSH_ROOT: root }, encoding: 'utf8',
  });
}

function tryRun(root, args) {
  try { return { code: 0, stdout: run(root, args), stderr: '' }; }
  catch (e) { return { code: e.status, stdout: String(e.stdout || ''), stderr: String(e.stderr || '') }; }
}

// A todo claimed by `claude` with a valid plan submitted, sitting in awaiting_approval.
function awaitingApproval() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-pa-'));
  run(root, ['init']);
  const adir = path.join(root, 'agents', 'claude');
  fs.mkdirSync(adir, { recursive: true });
  const brief = path.join(adir, 'BRIEF.md');
  fs.writeFileSync(brief, '# Agent claude\n');
  fs.writeFileSync(path.join(adir, 'manifest.json'), JSON.stringify({ schema: 1, id: 'claude', source_path: brief }));

  const id = run(root, ['push', 'todo', 'build the thing']).match(/[0-9A-HJKMNP-TV-Z]{26}/)[0];
  run(root, ['tick']);
  const mp = path.join(root, 'todo', 'triaged', id, 'meta.json');
  const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
  m.primary_role = 'claude';
  fs.writeFileSync(mp, JSON.stringify(m));
  run(root, ['claim', id, '--agent', 'claude']);

  let plan = `---\nid: ${id}\nstatus: PENDING\nclaimed_by: claude\nplan_hash: abc\n---\n\n`;
  for (const s of SECTIONS) plan += `## ${s}\nfilled in\n\n`;
  const pp = path.join(root, 'plan.md');
  fs.writeFileSync(pp, plan);
  run(root, ['plan', 'submit', id, '--plan', pp]);
  return { root, id };
}

const stateOf = (root, id) =>
  ['awaiting_approval', 'approved'].find((s) => fs.existsSync(path.join(root, 'todo', s, id)));

test('the plan author cannot approve their own plan', () => {
  const { root, id } = awaitingApproval();

  const r = tryRun(root, ['plan', 'approve', id, '--as', 'claude']);

  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /authored by claude/);
  assert.strictEqual(stateOf(root, id), 'awaiting_approval', 'the plan stays at the gate');
});

test('the claiming actor is barred too, not just the agent id', () => {
  // `claim --agent claude` records by=cli:<user> and agent_id=claude. Both are
  // the author; barring only one lets the same party approve under the other.
  const { root, id } = awaitingApproval();
  const claim = JSON.parse(
    fs.readFileSync(path.join(root, 'todo', 'awaiting_approval', id, 'meta.json'), 'utf8')).claim;

  assert.ok(claim.by && claim.by !== 'claude', 'precondition: by and agent_id differ');
  const r = tryRun(root, ['plan', 'approve', id, '--as', claim.by]);

  assert.strictEqual(r.code, 1, `approving as ${claim.by} should be refused`);
  assert.strictEqual(stateOf(root, id), 'awaiting_approval');
});

test('a different actor can approve it', () => {
  const { root, id } = awaitingApproval();

  const r = tryRun(root, ['plan', 'approve', id, '--as', 'human']);

  assert.strictEqual(r.code, 0);
  assert.strictEqual(stateOf(root, id), 'approved');
  const meta = JSON.parse(fs.readFileSync(path.join(root, 'todo', 'approved', id, 'meta.json'), 'utf8'));
  assert.strictEqual(meta.plan_approved_by, 'human');
});

test('--force lets a single-operator setup approve anyway', () => {
  const { root, id } = awaitingApproval();
  assert.strictEqual(tryRun(root, ['plan', 'approve', id, '--as', 'claude', '--force']).code, 0);
  assert.strictEqual(stateOf(root, id), 'approved');
});

test('a forced self-approval is recorded as one', () => {
  const { root, id } = awaitingApproval();
  run(root, ['plan', 'approve', id, '--as', 'claude', '--force']);

  const date = new Date().toISOString().slice(0, 10);
  const audit = fs.readFileSync(path.join(root, 'audit', `${date}.jsonl`), 'utf8');
  const ev = audit.split('\n').filter(Boolean).map(JSON.parse).reverse()
    .find((e) => e.action === 'todo.plan_approved');

  assert.strictEqual(ev.details.self_approved, true);
  assert.strictEqual(ev.details.author, 'claude');
});

test('a normal approval is not marked self-approved', () => {
  const { root, id } = awaitingApproval();
  run(root, ['plan', 'approve', id, '--as', 'human']);

  const date = new Date().toISOString().slice(0, 10);
  const audit = fs.readFileSync(path.join(root, 'audit', `${date}.jsonl`), 'utf8');
  const ev = audit.split('\n').filter(Boolean).map(JSON.parse).reverse()
    .find((e) => e.action === 'todo.plan_approved');

  assert.strictEqual(ev.details.self_approved, undefined);
});

test('--note still reaches the audit event', () => {
  const { root, id } = awaitingApproval();
  run(root, ['plan', 'approve', id, '--as', 'human', '--note', 'looks fine']);

  const date = new Date().toISOString().slice(0, 10);
  const audit = fs.readFileSync(path.join(root, 'audit', `${date}.jsonl`), 'utf8');
  const ev = audit.split('\n').filter(Boolean).map(JSON.parse).reverse()
    .find((e) => e.action === 'todo.plan_approved');

  assert.strictEqual(ev.details.note, 'looks fine');
});

test('the approval signal file is still written', () => {
  const { root, id } = awaitingApproval();
  run(root, ['plan', 'approve', id, '--as', 'human']);
  assert.strictEqual(
    fs.readFileSync(path.join(root, 'todo', 'approved', id, 'approval'), 'utf8').trim(),
    'approved',
  );
});

test('approving a todo that is not awaiting approval is still a state error', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-pa-'));
  run(root, ['init']);
  const id = run(root, ['push', 'todo', 'x']).match(/[0-9A-HJKMNP-TV-Z]{26}/)[0];
  const r = tryRun(root, ['plan', 'approve', id, '--as', 'human']);
  assert.notStrictEqual(r.code, 0);
  assert.match(r.stderr, /expected one of: awaiting_approval/);
});

test('plan help states the rule', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-pa-'));
  run(root, ['init']);
  assert.match(run(root, ['plan']), /cannot approve it/);
});
