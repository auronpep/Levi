// A ledger row missing a numeric field must not poison the report. Before the
// fix, one older-schema line made `total.usd`, `total.tokens_in`, and every
// per-agent/model/phase bucket NaN - the good rows' money silently vanished.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cost = require('../lib/cost-ledger');

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'josh-cost-'));
}

function writeLines(root, month, lines) {
  const p = cost.ledgerPath(root, month);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, lines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n') + '\n');
  return p;
}

const GOOD = {
  schema: 1, at: '2026-09-01T00:00:00.000Z', todo_id: 't1', agent_id: 'claude',
  model: 'opus', tokens_in: 100, tokens_out: 50, wall_seconds: 10, usd: 1.5, phase: 'build',
};

test('summarize: a row missing numeric fields does not NaN the totals', () => {
  const root = tmpRoot();
  const month = cost.currentMonth();
  writeLines(root, month, [GOOD, { at: '2026-09-02T00:00:00.000Z', agent_id: 'claude', model: 'opus' }]);

  const s = cost.summarize(root);
  assert.strictEqual(s.run_count, 2);
  assert.strictEqual(s.total.usd, 1.5, 'the good row\'s cost must survive');
  assert.strictEqual(s.total.tokens_in, 100);
  assert.strictEqual(s.total.tokens_out, 50);
  assert.strictEqual(s.total.wall_seconds, 10);
});

test('summarize: per-agent, per-model and per-phase buckets stay numeric', () => {
  const root = tmpRoot();
  writeLines(root, cost.currentMonth(), [GOOD, { at: '2026-09-02T00:00:00.000Z', agent_id: 'claude', model: 'opus', phase: 'build' }]);

  const s = cost.summarize(root);
  assert.strictEqual(s.by_agent.claude.usd, 1.5);
  assert.strictEqual(s.by_model.opus.tokens_in, 100);
  assert.strictEqual(s.by_phase.build.usd, 1.5);
});

test('readCostsForMonth: normalises missing numerics to 0, keeps other fields', () => {
  const root = tmpRoot();
  writeLines(root, cost.currentMonth(), [{ at: '2026-09-02T00:00:00.000Z', agent_id: 'codex' }]);

  const [row] = cost.readCostsForMonth(root);
  assert.strictEqual(row.usd, 0);
  assert.strictEqual(row.tokens_in, 0);
  assert.strictEqual(row.tokens_out, 0);
  assert.strictEqual(row.wall_seconds, 0);
  assert.strictEqual(row.agent_id, 'codex', 'non-numeric fields are untouched');
});

test('readCostsForMonth: non-finite numerics (null, string, NaN-ish) become 0', () => {
  const root = tmpRoot();
  writeLines(root, cost.currentMonth(), [
    { at: '2026-09-02T00:00:00.000Z', usd: null, tokens_in: '900', tokens_out: true, wall_seconds: {} },
  ]);

  const [row] = cost.readCostsForMonth(root);
  assert.strictEqual(row.usd, 0);
  assert.strictEqual(row.tokens_in, 0, 'a numeric string is not a number - do not half-trust it');
  assert.strictEqual(row.tokens_out, 0);
  assert.strictEqual(row.wall_seconds, 0);
});

test('readCostsForMonth: non-object JSON lines are dropped, not summed', () => {
  const root = tmpRoot();
  writeLines(root, cost.currentMonth(), [GOOD, '42', '"a string"', '[1,2,3]', 'null', '{ broken']);

  const rows = cost.readCostsForMonth(root);
  assert.strictEqual(rows.length, 1, 'only the one real object row survives');
  const s = cost.summarize(root);
  assert.strictEqual(s.total.usd, 1.5);
  assert.strictEqual(s.run_count, 1);
});

test('summarize: an empty ledger still reports zeroes, not NaN', () => {
  const root = tmpRoot();
  const s = cost.summarize(root);
  assert.deepStrictEqual(s.total, { tokens_in: 0, tokens_out: 0, wall_seconds: 0, usd: 0 });
  assert.strictEqual(s.run_count, 0);
});

test('summarize: well-formed rows are still summed exactly as before', () => {
  const root = tmpRoot();
  writeLines(root, cost.currentMonth(), [GOOD, { ...GOOD, at: '2026-09-03T00:00:00.000Z', usd: 2.25, tokens_in: 7 }]);

  const s = cost.summarize(root);
  assert.strictEqual(s.total.usd, 3.75);
  assert.strictEqual(s.total.tokens_in, 107);
});
