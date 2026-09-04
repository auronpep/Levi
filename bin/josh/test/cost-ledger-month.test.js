// An entry must be filed in the month it happened in, not the month it was
// written in. Before the fix, `appendCost` always used the write-time clock,
// so a backfilled or late-arriving row landed in the wrong ledger and
// `summarize({ month })` reported $0 for a month that had real spend.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cost = require('../lib/cost-ledger');

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'josh-costm-'));
}

test('appendCost: files an entry under the month in its own `at`', () => {
  const root = tmpRoot();
  const p = cost.appendCost(root, { at: '2026-07-15T12:00:00.000Z', agent_id: 'claude', usd: 5 });

  assert.strictEqual(path.basename(p), '2026-07.jsonl');
  assert.deepStrictEqual(cost.listMonths(root), ['2026-07']);
});

test('summarize: a backfilled month reports its real spend', () => {
  const root = tmpRoot();
  cost.appendCost(root, { at: '2026-07-15T12:00:00.000Z', agent_id: 'claude', usd: 5 });

  const july = cost.summarize(root, { month: '2026-07' });
  assert.strictEqual(july.run_count, 1);
  assert.strictEqual(july.total.usd, 5);
});

test('appendCost: an entry with no `at` still goes to the current month', () => {
  const root = tmpRoot();
  const p = cost.appendCost(root, { agent_id: 'claude', usd: 1 });

  assert.strictEqual(path.basename(p), `${cost.currentMonth()}.jsonl`);
});

test('appendCost: an unparseable `at` falls back to the current month, never drops the row', () => {
  const root = tmpRoot();
  const p = cost.appendCost(root, { at: 'not a date', agent_id: 'claude', usd: 2 });

  assert.strictEqual(path.basename(p), `${cost.currentMonth()}.jsonl`);
  assert.strictEqual(cost.summarize(root, { month: cost.currentMonth() }).total.usd, 2);
});

test('appendCost: entries spanning a month boundary split into two ledgers', () => {
  const root = tmpRoot();
  cost.appendCost(root, { at: '2026-07-31T23:59:59.000Z', agent_id: 'claude', usd: 1 });
  cost.appendCost(root, { at: '2026-08-01T00:00:01.000Z', agent_id: 'claude', usd: 2 });

  assert.deepStrictEqual(cost.listMonths(root), ['2026-07', '2026-08']);
  assert.strictEqual(cost.summarize(root, { month: '2026-07' }).total.usd, 1);
  assert.strictEqual(cost.summarize(root, { month: '2026-08' }).total.usd, 2);
});

test('summarize: with no month filter, every month is still totalled together', () => {
  const root = tmpRoot();
  cost.appendCost(root, { at: '2026-07-15T12:00:00.000Z', usd: 5 });
  cost.appendCost(root, { at: '2026-08-15T12:00:00.000Z', usd: 3 });

  assert.strictEqual(cost.summarize(root).total.usd, 8);
  assert.strictEqual(cost.summarize(root).run_count, 2);
});

test('monthForEntry: maps timestamps to UTC months', () => {
  assert.strictEqual(cost.monthForEntry('2026-01-01T00:00:00.000Z'), '2026-01');
  assert.strictEqual(cost.monthForEntry('2026-12-31T23:59:59.999Z'), '2026-12');
  assert.strictEqual(cost.monthForEntry('garbage'), cost.currentMonth());
  assert.strictEqual(cost.monthForEntry(undefined), cost.currentMonth());
});

test('appendCost: the row is still readable back with its fields intact', () => {
  const root = tmpRoot();
  cost.appendCost(root, { at: '2026-07-15T12:00:00.000Z', agent_id: 'codex', model: 'gpt', tokens_in: 7, usd: 5 });

  const [row] = cost.readCostsForMonth(root, '2026-07');
  assert.strictEqual(row.at, '2026-07-15T12:00:00.000Z');
  assert.strictEqual(row.agent_id, 'codex');
  assert.strictEqual(row.model, 'gpt');
  assert.strictEqual(row.tokens_in, 7);
  assert.strictEqual(row.usd, 5);
});
