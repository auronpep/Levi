// Approving an evolution overwrites the agent's own operating brief - mission,
// acceptance gates, "do not do" - and bumps the manifest version. Nothing stopped
// the agent from approving its own rewrite: editing its own constraints and
// signing off on the edit.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { writeGoldItem } = require('../lib/gold-set');

const joshBin = path.resolve(__dirname, '..', 'josh.js');

function run(cmd, env) {
  return execSync(`node "${joshBin}" ${cmd}`, { env, stdio: 'pipe' }).toString();
}

function tryRun(cmd, env) {
  try { return { code: 0, out: run(cmd, env) }; }
  catch (e) { return { code: e.status, out: String(e.stdout || ''), err: String(e.stderr || '') }; }
}

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-esa-'));
  const env = { ...process.env, JOSH_ROOT: root };
  execSync(`node "${joshBin}" init`, { env, stdio: 'pipe' });

  const dir = path.join(root, 'agents', 'A01');
  fs.mkdirSync(dir, { recursive: true });
  const briefPath = path.join(dir, 'brief.md');
  fs.writeFileSync(briefPath, [
    '# Agent A01 - Command Center', '', 'Status: READY', '',
    '## Mission', 'Coordinate the launch.', '',
    '## Acceptance Gates', 'Every public asset has clearance.',
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A01', source_path: briefPath, version: 1,
  }, null, 2));

  for (let i = 0; i < 5; i++) {
    writeGoldItem(root, 'A01', {
      schema: 1, id: `g0${i}`,
      todo_minimal: { title: `t${i}`, labels: [] },
      expected_verdict: { status: 'approve', claim_text: `clearance ok ${i}` },
      rubric: '',
    });
  }
  return { root, env, briefPath };
}

function makeSimulator() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-esa-sim-'));
  for (const r of [
    { round_num: 1, no_new_gaps: false, pass: 3 },
    { round_num: 2, no_new_gaps: true, pass: 5 },
    { round_num: 3, no_new_gaps: true, pass: 5 },
  ]) {
    fs.writeFileSync(path.join(dir, `round-${r.round_num}.json`), JSON.stringify({
      round_num: r.round_num,
      after_md: `# Agent A01\n\nStatus: READY\n\n## Mission\nCoordinate the launch (rev ${r.round_num}).\n\n## Acceptance Gates\nEvery public asset has clearance.\n`,
      no_new_gaps_found_emitted: r.no_new_gaps,
      gold_replay: { pass: r.pass, fail: 5 - r.pass, total: 5, regression_count: 0 },
    }, null, 2));
  }
  return dir;
}

// A converged evolve job for A01, ready to approve.
function converged() {
  const { root, env, briefPath } = setup();
  const sim = makeSimulator();
  const out = run(`evolve start A01 --simulator "${sim}"`, env);
  const evId = out.match(/evolve-A01-[A-Z0-9]+/)[0];
  return { root, env, briefPath, evId, before: fs.readFileSync(briefPath, 'utf8') };
}

const version = (root) =>
  JSON.parse(fs.readFileSync(path.join(root, 'agents', 'A01', 'manifest.json'), 'utf8')).version;

test('the agent cannot approve its own brief rewrite', () => {
  const { root, env, evId, briefPath, before } = converged();

  const r = tryRun(`evolve approve ${evId} --as A01`, env);

  assert.equal(r.code, 1);
  assert.match(r.err, /cannot approve it/);
  assert.equal(fs.readFileSync(briefPath, 'utf8'), before, 'the brief must be untouched');
  assert.equal(version(root), 1, 'and the version must not bump');
});

test('a different actor can approve it', () => {
  const { root, env, evId, briefPath, before } = converged();

  assert.equal(tryRun(`evolve approve ${evId} --as human`, env).code, 0);
  assert.notEqual(fs.readFileSync(briefPath, 'utf8'), before);
  assert.equal(version(root), 2);
});

test('--force allows the agent to approve its own rewrite', () => {
  const { root, env, evId } = converged();
  assert.equal(tryRun(`evolve approve ${evId} --as A01 --force`, env).code, 0);
  assert.equal(version(root), 2);
});

test('a forced self-approval is recorded as one', () => {
  const { root, env, evId } = converged();
  run(`evolve approve ${evId} --as A01 --force`, env);

  const date = new Date().toISOString().slice(0, 10);
  const audit = fs.readFileSync(path.join(root, 'audit', `${date}.jsonl`), 'utf8');
  const ev = audit.split('\n').filter(Boolean).map(JSON.parse).reverse()
    .find((e) => e.action === 'agent.evolved');

  assert.equal(ev.details.self_approved, true);
  assert.equal(ev.details.agent_id, 'A01');
});

test('a normal approval is not marked self-approved', () => {
  const { root, env, evId } = converged();
  run(`evolve approve ${evId} --as human`, env);

  const date = new Date().toISOString().slice(0, 10);
  const audit = fs.readFileSync(path.join(root, 'audit', `${date}.jsonl`), 'utf8');
  const ev = audit.split('\n').filter(Boolean).map(JSON.parse).reverse()
    .find((e) => e.action === 'agent.evolved');

  assert.equal(ev.details.self_approved, undefined);
});

test('an actor that merely resembles the agent id is not blocked', () => {
  const { env, evId } = converged();
  assert.equal(tryRun(`evolve approve ${evId} --as A01-reviewer`, env).code, 0);
});

test('evolve help states the rule', () => {
  const { env } = setup();
  assert.match(run('evolve', env), /cannot approve its own brief rewrite/);
});
