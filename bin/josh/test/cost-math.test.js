const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TIER_COSTS,
  MAX_TOKENS_PER_VERDICT,
  predictTokens,
  predictCost,
  enforceCeiling,
} = require('../lib/cost-math');

test('TIER_COSTS: includes haiku/sonnet/opus', () => {
  assert.ok(TIER_COSTS.haiku);
  assert.ok(TIER_COSTS.sonnet);
  assert.ok(TIER_COSTS.opus);
});

test('predictTokens: defaults from agent budget', () => {
  const a = { id: 'A03', budget: { preferred_model: 'sonnet', max_tokens_per_claim: 50000 } };
  const todo = { target_minutes: 30 };
  const r = predictTokens(a, todo);
  assert.ok(r.tokens_in > 0);
  assert.ok(r.tokens_out > 0);
  assert.equal(r.model, 'sonnet');
});

test('predictTokens: scales with target_minutes', () => {
  const a = { budget: { preferred_model: 'sonnet' } };
  const small = predictTokens(a, { target_minutes: 15 });
  const big = predictTokens(a, { target_minutes: 60 });
  assert.ok(big.tokens_in > small.tokens_in);
});

test('predictTokens: respects max_tokens_per_claim ceiling', () => {
  const a = { budget: { preferred_model: 'sonnet', max_tokens_per_claim: 1000 } };
  const r = predictTokens(a, { target_minutes: 60 });
  assert.ok(r.tokens_in + r.tokens_out <= 1000);
});

test('predictCost: sums candidates and converts to USD', () => {
  const cands = [
    { id: 'A01', budget: { preferred_model: 'sonnet' } },
    { id: 'A03', budget: { preferred_model: 'haiku' } },
  ];
  const r = predictCost(cands, { target_minutes: 30 });
  assert.ok(r.tokens_total > 0);
  assert.ok(r.usd > 0);
  assert.equal(r.per_candidate.length, 2);
});

test('enforceCeiling: keeps all when under cap', () => {
  const cands = [
    { id: 'A01', budget: { preferred_model: 'haiku' } },
    { id: 'A03', budget: { preferred_model: 'haiku' } },
  ];
  const r = enforceCeiling(cands, { target_minutes: 5 }, 100000);
  assert.equal(r.kept.length, 2);
  assert.equal(r.pruned.length, 0);
});

test('enforceCeiling: prunes most-expensive first when over cap', () => {
  const cands = [
    { id: 'A_OPUS',  budget: { preferred_model: 'opus' } },
    { id: 'A_SONNET', budget: { preferred_model: 'sonnet' } },
    { id: 'A_HAIKU',  budget: { preferred_model: 'haiku' } },
  ];
  const r = enforceCeiling(cands, { target_minutes: 60 }, 5000);
  // Opus prediction is highest; should be pruned first.
  assert.ok(!r.kept.includes('A_OPUS'));
  assert.ok(r.pruned.find(p => p.agent_id === 'A_OPUS'));
});

test('MAX_TOKENS_PER_VERDICT: defaults to 50000', () => {
  assert.equal(MAX_TOKENS_PER_VERDICT, 50000);
});
