// approval.md is the document a human reads before overwriting an agent's brief.
// It reported metrics from the LAST round, but on a `regression` halt the round
// being applied is the one before it (`revert_to_round = round_num - 1`). So the
// summary showed the pass rate of the discarded, worse round next to the correct
// winning round number.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { writeGoldItem } = require('../lib/gold-set');

const JOSH = path.resolve(__dirname, '..', 'josh.js');

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-apr-'));
  const env = { ...process.env, JOSH_ROOT: root };
  execSync(`node "${JOSH}" init`, { env, stdio: 'pipe' });

  const dir = path.join(root, 'agents', 'A01');
  fs.mkdirSync(dir, { recursive: true });
  const brief = path.join(dir, 'brief.md');
  fs.writeFileSync(brief, '# Agent A01\n\nStatus: READY\n\n## Mission\nCoordinate.\n');
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A01', source_path: brief, version: 1,
  }));
  for (let i = 0; i < 5; i++) {
    writeGoldItem(root, 'A01', {
      schema: 1, id: `g0${i}`, expected_verdict: { status: 'approve', claim_text: 'ok' }, rubric: '',
    });
  }
  return { root, env };
}

// rounds: [round_num, passing_out_of_5]
function simulator(rounds) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-apr-sim-'));
  for (const [n, pass] of rounds) {
    fs.writeFileSync(path.join(dir, `round-${n}.json`), JSON.stringify({
      round_num: n,
      after_md: `# Agent A01\n\nStatus: READY\n\n## Mission\nCoordinate (rev ${n}).\n`,
      no_new_gaps_found_emitted: n > 1,
      gold_replay: { pass, fail: 5 - pass, total: 5, regression_count: 0 },
    }));
  }
  return dir;
}

function evolve(rounds) {
  const { root, env } = setup();
  const sim = simulator(rounds);
  const out = execSync(`node "${JOSH}" evolve start A01 --simulator "${sim}"`, { env, stdio: 'pipe' }).toString();
  const evId = out.match(/evolve-A01-[A-Z0-9]+/)[0];
  const dir = path.join(root, 'approvals', evId);
  return {
    root,
    evId,
    summary: fs.readFileSync(path.join(dir, 'approval.md'), 'utf8'),
    after: fs.readFileSync(path.join(dir, 'after.md'), 'utf8'),
    goldReplay: JSON.parse(fs.readFileSync(path.join(dir, 'gold-replay.json'), 'utf8')),
  };
}

const field = (summary, name) => summary.match(new RegExp(`- ${name}: (.+)`))[1].trim();

test('a regression halt reports the winning round pass rate, not the regressed one', () => {
  // 3/5, then 5/5, then a regression to 2/5 → halt, revert to round 2.
  const r = evolve([[1, 3], [2, 5], [3, 2]]);

  assert.equal(field(r.summary, 'halt_reason'), 'regression');
  assert.equal(field(r.summary, 'winning_round'), '2');
  assert.equal(field(r.summary, 'pass_rate'), '1.000', 'round 2 scored 5/5');
});

test('the reported pass rate matches the brief actually being applied', () => {
  const r = evolve([[1, 3], [2, 5], [3, 2]]);

  assert.match(r.after, /rev 2/, 'after.md holds the winning round');
  const winning = r.goldReplay.rounds.find((x) => x.round === Number(field(r.summary, 'winning_round')));
  assert.equal(field(r.summary, 'pass_rate'), winning.pass_rate.toFixed(3));
});

test('brief_size also comes from the winning round', () => {
  const r = evolve([[1, 3], [2, 5], [3, 2]]);
  const winning = r.goldReplay.rounds.find((x) => x.round === 2);
  assert.ok(winning, 'round 2 is in the replay record');
  assert.equal(field(r.summary, 'brief_size'), `${r.after.split('\n').length} lines`);
});

test('a converged halt is unaffected - last round is the winning round', () => {
  const r = evolve([[1, 3], [2, 5], [3, 5]]);

  assert.equal(field(r.summary, 'halt_reason'), 'converged');
  assert.equal(field(r.summary, 'winning_round'), '3');
  assert.equal(field(r.summary, 'pass_rate'), '1.000');
  assert.match(r.after, /rev 3/);
});

test('gold-replay.json still records every round', () => {
  const r = evolve([[1, 3], [2, 5], [3, 2]]);
  assert.equal(r.goldReplay.rounds.length, 3);
  assert.equal(r.goldReplay.halt_reason, 'regression');
});

test('the brief hashes still describe before and after', () => {
  const r = evolve([[1, 3], [2, 5], [3, 2]]);
  assert.match(field(r.summary, 'old_brief_hash'), /^[a-f0-9]{64}$/);
  assert.match(field(r.summary, 'new_brief_hash'), /^[a-f0-9]{64}$/);
  assert.notEqual(field(r.summary, 'old_brief_hash'), field(r.summary, 'new_brief_hash'));
});
