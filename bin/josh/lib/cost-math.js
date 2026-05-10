'use strict';

const TIER_COSTS = Object.freeze({
  haiku:  { in_per_1m: 0.25,  out_per_1m: 1.25 },
  sonnet: { in_per_1m: 3.00,  out_per_1m: 15.00 },
  opus:   { in_per_1m: 15.00, out_per_1m: 75.00 },
});

const MAX_TOKENS_PER_VERDICT = 50000;
const DEFAULT_TARGET_MINUTES = 30;
const TOKENS_PER_MINUTE_IN = 167;   // ≈ 5000 in for 30-min default
const TOKENS_PER_MINUTE_OUT = 50;   // ≈ 1500 out for 30-min default
const OUT_RATIO = TOKENS_PER_MINUTE_OUT / (TOKENS_PER_MINUTE_IN + TOKENS_PER_MINUTE_OUT);

function modelOf(agent) {
  return (agent && agent.budget && agent.budget.preferred_model) || 'sonnet';
}

function predictTokens(agent, todo) {
  const minutes = (todo && todo.target_minutes) || DEFAULT_TARGET_MINUTES;
  let tokens_in  = Math.round(TOKENS_PER_MINUTE_IN  * minutes);
  let tokens_out = Math.round(TOKENS_PER_MINUTE_OUT * minutes);
  const cap = agent && agent.budget && agent.budget.max_tokens_per_claim;
  if (Number.isFinite(cap) && tokens_in + tokens_out > cap) {
    tokens_out = Math.round(cap * OUT_RATIO);
    tokens_in  = cap - tokens_out;
  }
  return { tokens_in, tokens_out, model: modelOf(agent) };
}

function usdFor(tokens_in, tokens_out, model) {
  const tier = TIER_COSTS[model] || TIER_COSTS.sonnet;
  return (tokens_in * tier.in_per_1m + tokens_out * tier.out_per_1m) / 1e6;
}

function predictCost(candidates, todo) {
  const per_candidate = candidates.map((a) => {
    const t = predictTokens(a, todo);
    return {
      agent_id: a.id,
      tokens_in: t.tokens_in,
      tokens_out: t.tokens_out,
      model: t.model,
      usd: usdFor(t.tokens_in, t.tokens_out, t.model),
    };
  });
  const tokens_total = per_candidate.reduce((s, c) => s + c.tokens_in + c.tokens_out, 0);
  const usd = per_candidate.reduce((s, c) => s + c.usd, 0);
  return { tokens_total, usd, per_candidate };
}

function enforceCeiling(candidates, todo, ceiling = MAX_TOKENS_PER_VERDICT) {
  const list = candidates.map((a) => {
    const t = predictTokens(a, todo);
    return { agent: a, tokens: t.tokens_in + t.tokens_out, model: t.model };
  });
  list.sort((a, b) => b.tokens - a.tokens); // highest first
  let total = list.reduce((s, x) => s + x.tokens, 0);
  const pruned = [];
  while (total > ceiling && list.length > 0) {
    const dropped = list.shift();
    pruned.push({ agent_id: dropped.agent.id, tokens: dropped.tokens, reason: 'over_ceiling' });
    total -= dropped.tokens;
  }
  return {
    kept: list.map((x) => x.agent.id),
    pruned,
    total_tokens: total,
    ceiling,
  };
}

module.exports = {
  TIER_COSTS,
  MAX_TOKENS_PER_VERDICT,
  predictTokens,
  predictCost,
  enforceCeiling,
};
