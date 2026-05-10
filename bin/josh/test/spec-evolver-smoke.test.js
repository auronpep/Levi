const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');
const { writeGoldItem } = require('../lib/gold-set');

const joshBin = path.resolve(__dirname, '..', 'josh.js');
function run(cmd, env, opts = {}) {
  return execSync(`node "${joshBin}" ${cmd}`, { env, stdio: opts.stdio || 'pipe' }).toString();
}

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-evolve-'));
  const env = { ...process.env, JOSH_ROOT: root };
  execSync(`node "${joshBin}" init`, { env, stdio: 'pipe' });

  // Seed A01.
  const dir = path.join(root, 'agents', 'A01');
  fs.mkdirSync(dir, { recursive: true });
  const briefPath = path.join(dir, 'brief.md');
  fs.writeFileSync(briefPath, [
    '# Agent A01 - Command Center',
    '',
    'Status: READY',
    '',
    '## Mission',
    'Coordinate the launch.',
    '',
    '## Acceptance Gates',
    'Every public asset has clearance.',
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A01', source_path: briefPath, version: 1,
  }, null, 2));
  // Mint identity so signed verdicts work.
  run('agent mint A01', env);

  // Seed gold items (small set).
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

function makeSimulator(passingRound, opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-evolve-sim-'));
  const rounds = opts.rounds || [
    { round_num: 1, no_new_gaps: false, pass: 3, total: 5 },
    { round_num: 2, no_new_gaps: true,  pass: 5, total: 5 },
    { round_num: 3, no_new_gaps: true,  pass: 5, total: 5 },
  ];
  for (const r of rounds) {
    const candidate = {
      round_num: r.round_num,
      after_md: `# Agent A01\n\nStatus: READY\n\n## Mission\nCoordinate the launch (rev ${r.round_num}).\n\n## Acceptance Gates\nEvery public asset has clearance.\n`,
      no_new_gaps_found_emitted: r.no_new_gaps,
      frustration_log: `frustration round ${r.round_num}\n`,
      gap_categories: { mission: 0, inputs: 0, outputs: 1 },
      archetype: 'spec_drift_repair',
      archetype_id: 10,
      gold_replay: { pass: r.pass, fail: r.total - r.pass, total: r.total, regression_count: 0 },
    };
    fs.writeFileSync(path.join(dir, `round-${r.round_num}.json`), JSON.stringify(candidate, null, 2));
  }
  return dir;
}

test('spec-evolver smoke: 3 rounds → converged → approval drop assembled', () => {
  const { root, env } = setup();
  const sim = makeSimulator();
  const out = run(`evolve start A01 --simulator "${sim}"`, env);
  assert.match(out, /evolve queued: evolve-A01-/);
  assert.match(out, /converged/);
  assert.match(out, /approval ready at:/);

  // Find the evolve_id from output.
  const evMatch = out.match(/evolve-A01-[A-Z0-9]+/);
  assert.ok(evMatch);
  const evId = evMatch[0];
  const approvalDir = path.join(root, 'approvals', evId);
  for (const f of ['before.md', 'after.md', 'diff.patch', 'gold-replay.json', 'approval.md', 'iteration-logs']) {
    assert.equal(fs.existsSync(path.join(approvalDir, f)), true, `missing ${f}`);
  }
  fs.rmSync(sim, { recursive: true, force: true });
  fs.rmSync(root, { recursive: true, force: true });
});

test('spec-evolver smoke: approve swaps brief + bumps version + appends lesson', () => {
  const { root, env, briefPath } = setup();
  const beforeBrief = fs.readFileSync(briefPath, 'utf8');
  const sim = makeSimulator();
  const out = run(`evolve start A01 --simulator "${sim}"`, env);
  const evId = out.match(/evolve-A01-[A-Z0-9]+/)[0];

  run(`evolve approve ${evId} --as human`, env);
  const afterBrief = fs.readFileSync(briefPath, 'utf8');
  assert.notEqual(afterBrief, beforeBrief);
  assert.match(afterBrief, /rev 3/);

  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'agents', 'A01', 'manifest.json'), 'utf8'));
  assert.equal(manifest.version, 2);

  const lessons = fs.readFileSync(path.join(root, 'agents', 'A01', 'lessons.md'), 'utf8');
  assert.match(lessons, /version 2/);

  // Approval folder moved to done/.
  assert.equal(fs.existsSync(path.join(root, 'approvals', evId)), false);
  assert.equal(fs.existsSync(path.join(root, 'approvals', 'done', evId)), true);

  fs.rmSync(sim, { recursive: true, force: true });
  fs.rmSync(root, { recursive: true, force: true });
});

test('spec-evolver smoke: regression halts + reject archives with reason', () => {
  const { root, env } = setup();
  // Round 1 strong, round 2 regresses.
  const sim = makeSimulator(null, {
    rounds: [
      { round_num: 1, no_new_gaps: false, pass: 4, total: 5 },
      { round_num: 2, no_new_gaps: false, pass: 2, total: 5 },
    ],
  });
  const out = run(`evolve start A01 --simulator "${sim}"`, env);
  assert.match(out, /regression/);

  const evId = out.match(/evolve-A01-[A-Z0-9]+/)[0];
  // Approval folder still gets dropped (regression revert points to round 1).
  assert.equal(fs.existsSync(path.join(root, 'approvals', evId)), true);

  // Reject path.
  run(`evolve reject ${evId} --reason "regression too steep"`, env);
  assert.equal(fs.existsSync(path.join(root, 'approvals', evId)), false);
  const archived = path.join(root, 'approvals', 'done', evId);
  assert.equal(fs.existsSync(archived), true);
  const rejection = JSON.parse(fs.readFileSync(path.join(archived, 'rejection.json'), 'utf8'));
  assert.match(rejection.reason, /regression too steep/);

  fs.rmSync(sim, { recursive: true, force: true });
  fs.rmSync(root, { recursive: true, force: true });
});

test('spec-evolver smoke: non-v1 agent rejected without --allow-any', () => {
  const { root, env } = setup();
  // Seed an A99.
  const dir = path.join(root, 'agents', 'A99');
  fs.mkdirSync(dir, { recursive: true });
  const briefPath = path.join(dir, 'brief.md');
  fs.writeFileSync(briefPath, '# A99\n');
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A99', source_path: briefPath, version: 1,
  }, null, 2));
  let stderrOut = '';
  try { run('evolve start A99', env); }
  catch (e) { stderrOut = e.stderr.toString(); }
  assert.match(stderrOut, /v1 evolve list/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('lesson add + list: round-trips entries', () => {
  const { root, env } = setup();
  run('lesson add A01 "Always cite source path."', env);
  run('lesson add A01 "Reject claims without dates."', env);
  const out = run('lesson list A01', env);
  assert.match(out, /Always cite source path\./);
  assert.match(out, /Reject claims without dates\./);
  fs.rmSync(root, { recursive: true, force: true });
});
