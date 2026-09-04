// A token ceiling bounds what a matrix costs. It should not decide that the work
// does not happen. `while (total > ceiling && list.length > 0)` pruned every
// candidate whenever one candidate's own prediction exceeded the ceiling, and
// matrix-router forwards `kept` straight into `candidates` - so a long task
// produced a matrix with nobody in it, yielding no verdicts and no winner.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cost = require('../lib/cost-math');
const { selectCandidates } = require('../lib/matrix-router');

const agent = (id, model = 'sonnet') => ({ id, budget: { preferred_model: model } });

// ~217 tokens/minute, so 300 minutes ≈ 65,100 tokens - past the 50,000 default.
const LONG = { target_minutes: 300 };
const NORMAL = { target_minutes: 30 };

test('a single oversized candidate is kept, not pruned to nothing', () => {
  const r = cost.enforceCeiling([agent('A01')], LONG);
  assert.deepStrictEqual(r.kept, ['A01']);
  assert.strictEqual(r.pruned.length, 0);
  assert.ok(r.total_tokens > 0, 'the surviving candidate still has a predicted cost');
});

test('several oversized candidates still leave exactly one standing', () => {
  const r = cost.enforceCeiling([agent('A01'), agent('A02'), agent('A03')], LONG);
  assert.strictEqual(r.kept.length, 1);
  assert.strictEqual(r.pruned.length, 2);
});

test('the case where even one candidate does not fit is reported', () => {
  const r = cost.enforceCeiling([agent('A01')], LONG);
  assert.strictEqual(r.ceiling_exceeded, true);
  assert.ok(r.total_tokens > r.ceiling);
});

test('a matrix that fits reports ceiling_exceeded false', () => {
  const r = cost.enforceCeiling([agent('A01'), agent('A02')], NORMAL);
  assert.strictEqual(r.ceiling_exceeded, false);
  assert.deepStrictEqual(r.kept, ['A01', 'A02']);
  assert.strictEqual(r.pruned.length, 0);
});

test('pruning down to a fitting subset still reports false', () => {
  // Three at ~6,510 each; a 14,000 ceiling fits two.
  const r = cost.enforceCeiling([agent('A01'), agent('A02'), agent('A03')], { target_minutes: 30 }, 14000);
  assert.strictEqual(r.kept.length, 2);
  assert.strictEqual(r.pruned.length, 1);
  assert.strictEqual(r.ceiling_exceeded, false);
  assert.ok(r.total_tokens <= r.ceiling);
});

test('the survivor is the cheapest candidate, not an arbitrary one', () => {
  const cands = [
    { id: 'BIG', budget: { preferred_model: 'sonnet', max_tokens_per_claim: 40000 } },
    { id: 'SMALL', budget: { preferred_model: 'sonnet', max_tokens_per_claim: 1000 } },
  ];
  const r = cost.enforceCeiling(cands, LONG, 500);
  assert.deepStrictEqual(r.kept, ['SMALL']);
  assert.deepStrictEqual(r.pruned.map((p) => p.agent_id), ['BIG']);
});

test('an empty candidate list is still empty - there is nothing to keep', () => {
  const r = cost.enforceCeiling([], LONG);
  assert.deepStrictEqual(r.kept, []);
  assert.deepStrictEqual(r.pruned, []);
  assert.strictEqual(r.total_tokens, 0);
  assert.strictEqual(r.ceiling_exceeded, false);
});

test('total_tokens always matches the kept set', () => {
  for (const todo of [LONG, NORMAL]) {
    const r = cost.enforceCeiling([agent('A01'), agent('A02'), agent('A03')], todo);
    const recomputed = cost.predictCost(r.kept.map((id) => agent(id)), todo).tokens_total;
    assert.strictEqual(r.total_tokens, recomputed, 'the reported total describes the kept agents');
  }
});

test('pruned entries keep their reason and token count', () => {
  const r = cost.enforceCeiling([agent('A01'), agent('A02')], LONG);
  for (const p of r.pruned) {
    assert.strictEqual(p.reason, 'over_ceiling');
    assert.ok(Number.isFinite(p.tokens) && p.tokens > 0);
    assert.ok(typeof p.agent_id === 'string');
  }
});

test('matrix-router no longer emits a matrix with zero candidates', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-ceil-'));
  fs.mkdirSync(path.join(root, 'orchestrator'), { recursive: true });
  fs.writeFileSync(path.join(root, 'orchestrator', 'routing.json'), JSON.stringify({
    schema: 1, rules: [], matrix_rules: [{ if_phase: 1, candidates: ['A01', 'A03', 'A07'] }],
  }));
  for (const id of ['A01', 'A03', 'A07']) {
    const dir = path.join(root, 'agents', id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
      schema: 1, id, source_path: '/dev/null', budget: { preferred_model: 'sonnet' },
    }));
  }

  // A task long enough that any single candidate blows the default ceiling.
  const r = selectCandidates(root, {
    verdict_mode: 'matrix', phase: 1, primary_role: 'A01', target_minutes: 300,
  });

  assert.strictEqual(r.mode, 'matrix');
  assert.ok(r.candidates.length >= 1, `a matrix must have someone in it, got ${JSON.stringify(r.candidates)}`);
  assert.strictEqual(r.pruned.length, 2, 'the other two are still pruned for cost');
  fs.rmSync(root, { recursive: true, force: true });
});
