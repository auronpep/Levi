// `TIER_COSTS[model] || TIER_COSTS.sonnet` reaches through Object.prototype.
// `constructor`, `toString`, `valueOf` and `hasOwnProperty` are all truthy, so
// the fallback never fired for them; the "tier" was a function with no
// `in_per_1m`, the price came out NaN, and NaN then poisoned every total in
// predictCost.

const test = require('node:test');
const assert = require('node:assert');
const cost = require('../lib/cost-math');

const TODO = { target_minutes: 30 };
const agent = (model) => ({ id: 'A', budget: { preferred_model: model } });
const PROTO_KEYS = ['constructor', 'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf', '__proto__'];

test('an Object.prototype key as a model name no longer yields NaN', () => {
  for (const model of PROTO_KEYS) {
    const r = cost.predictCost([agent(model)], TODO);
    assert.ok(Number.isFinite(r.usd), `${model} produced ${r.usd}`);
    assert.ok(Number.isFinite(r.per_candidate[0].usd), `${model} per-candidate produced NaN`);
  }
});

test('such a model is priced at the documented fallback tier', () => {
  const sonnet = cost.predictCost([agent('sonnet')], TODO).usd;
  for (const model of PROTO_KEYS) {
    assert.strictEqual(cost.predictCost([agent(model)], TODO).usd, sonnet, `${model} should fall back`);
  }
});

test('one bad candidate no longer poisons the whole matrix total', () => {
  const good = cost.predictCost([agent('opus'), agent('haiku')], TODO).usd;
  const withBad = cost.predictCost([agent('opus'), agent('haiku'), agent('constructor')], TODO);
  assert.ok(Number.isFinite(withBad.usd));
  assert.ok(withBad.usd > good, 'the extra candidate adds cost rather than erasing it');
});

test('an unrecognised model still falls back, and says so', () => {
  const r = cost.predictCost([agent('gpt-5')], TODO);
  assert.strictEqual(r.per_candidate[0].model, 'gpt-5', 'the requested model is still reported');
  assert.strictEqual(r.per_candidate[0].priced_as, 'sonnet', 'and the tier actually used is visible');
  assert.strictEqual(r.usd, cost.predictCost([agent('sonnet')], TODO).usd);
});

test('a known model is priced as itself', () => {
  for (const model of ['haiku', 'sonnet', 'opus']) {
    const r = cost.predictCost([agent(model)], TODO);
    assert.strictEqual(r.per_candidate[0].priced_as, model);
    assert.strictEqual(r.per_candidate[0].model, model);
  }
});

test('tier ordering is unchanged: haiku < sonnet < opus', () => {
  const usd = (m) => cost.predictCost([agent(m)], TODO).usd;
  assert.ok(usd('haiku') < usd('sonnet'), 'haiku is cheapest');
  assert.ok(usd('sonnet') < usd('opus'), 'opus is dearest');
});

test('tierFor: resolves own keys and only own keys', () => {
  assert.strictEqual(cost.tierFor('opus'), 'opus');
  assert.strictEqual(cost.tierFor('haiku'), 'haiku');
  assert.strictEqual(cost.tierFor('constructor'), cost.FALLBACK_MODEL);
  assert.strictEqual(cost.tierFor('nope'), cost.FALLBACK_MODEL);
  assert.strictEqual(cost.tierFor(undefined), cost.FALLBACK_MODEL);
  assert.strictEqual(cost.tierFor(null), cost.FALLBACK_MODEL);
});

test('usdFor: a missing model prices at the fallback rather than throwing', () => {
  assert.strictEqual(usdIsFinite(undefined), true);
  assert.strictEqual(usdIsFinite('constructor'), true);
  function usdIsFinite(m) { return Number.isFinite(cost.usdFor(1000, 1000, m)); }
});

test('usdFor: arithmetic is the documented per-million rate', () => {
  // 1,000,000 in + 1,000,000 out at opus = 15 + 75
  assert.strictEqual(cost.usdFor(1e6, 1e6, 'opus'), 90);
  assert.strictEqual(cost.usdFor(1e6, 0, 'haiku'), 0.25);
});

test('an agent with no budget block still prices as the default model', () => {
  const r = cost.predictCost([{ id: 'A' }], TODO);
  assert.strictEqual(r.per_candidate[0].model, 'sonnet');
  assert.strictEqual(r.per_candidate[0].priced_as, 'sonnet');
  assert.ok(Number.isFinite(r.usd));
});
