// `summarize().earliest` / `.latest` are a min and a max over the entries'
// timestamps. Before the fix they were just the first and last rows of the
// append-ordered file, so out-of-order rows - concurrent finishes, retries,
// backfills - could report an `earliest` LATER than the `latest`.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cost = require('../lib/cost-ledger');

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'josh-costr-'));
}

function writeRows(root, rows, month) {
  const p = cost.ledgerPath(root, month || cost.currentMonth());
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
}

test('summarize: out-of-order rows still report the true min and max', () => {
  const root = tmpRoot();
  writeRows(root, [
    { at: '2026-09-03T00:00:00.000Z', usd: 1 },
    { at: '2026-09-01T00:00:00.000Z', usd: 1 },
    { at: '2026-09-02T00:00:00.000Z', usd: 1 },
  ]);

  const s = cost.summarize(root);
  assert.strictEqual(s.earliest, '2026-09-01T00:00:00.000Z');
  assert.strictEqual(s.latest, '2026-09-03T00:00:00.000Z');
});

test('summarize: earliest is never later than latest', () => {
  const root = tmpRoot();
  writeRows(root, [
    { at: '2026-09-09T00:00:00.000Z', usd: 1 },
    { at: '2026-09-04T00:00:00.000Z', usd: 1 },
  ]);

  const s = cost.summarize(root);
  assert.ok(Date.parse(s.earliest) <= Date.parse(s.latest), `${s.earliest} must not be after ${s.latest}`);
});

test('summarize: already-ordered rows behave exactly as before', () => {
  const root = tmpRoot();
  writeRows(root, [
    { at: '2026-09-01T00:00:00.000Z', usd: 1 },
    { at: '2026-09-02T00:00:00.000Z', usd: 1 },
    { at: '2026-09-03T00:00:00.000Z', usd: 1 },
  ]);

  const s = cost.summarize(root);
  assert.strictEqual(s.earliest, '2026-09-01T00:00:00.000Z');
  assert.strictEqual(s.latest, '2026-09-03T00:00:00.000Z');
});

test('summarize: a single row is both the earliest and the latest', () => {
  const root = tmpRoot();
  writeRows(root, [{ at: '2026-09-05T06:07:08.000Z', usd: 1 }]);

  const s = cost.summarize(root);
  assert.strictEqual(s.earliest, '2026-09-05T06:07:08.000Z');
  assert.strictEqual(s.latest, '2026-09-05T06:07:08.000Z');
});

test('summarize: rows with an unparseable `at` are ignored for the range but still counted', () => {
  const root = tmpRoot();
  writeRows(root, [
    { at: 'not a date', usd: 2 },
    { at: '2026-09-02T00:00:00.000Z', usd: 1 },
  ]);

  const s = cost.summarize(root);
  assert.strictEqual(s.earliest, '2026-09-02T00:00:00.000Z');
  assert.strictEqual(s.latest, '2026-09-02T00:00:00.000Z');
  assert.strictEqual(s.run_count, 2, 'the row is still a run');
  assert.strictEqual(s.total.usd, 3, 'and its cost still counts');
});

test('summarize: when no row has a usable timestamp the range is null, not undefined', () => {
  const root = tmpRoot();
  writeRows(root, [{ at: 'nope', usd: 1 }, { usd: 1 }]);

  const s = cost.summarize(root);
  assert.strictEqual(s.earliest, null);
  assert.strictEqual(s.latest, null);
  assert.strictEqual(s.run_count, 2);
});

test('summarize: an empty ledger reports a null range', () => {
  const s = cost.summarize(tmpRoot());
  assert.strictEqual(s.earliest, null);
  assert.strictEqual(s.latest, null);
});

test('summarize: the range respects the `since` filter', () => {
  const root = tmpRoot();
  writeRows(root, [
    { at: '2026-09-01T00:00:00.000Z', usd: 1 },
    { at: '2026-09-05T00:00:00.000Z', usd: 1 },
    { at: '2026-09-09T00:00:00.000Z', usd: 1 },
  ]);

  const s = cost.summarize(root, { since: '2026-09-04T00:00:00.000Z' });
  assert.strictEqual(s.earliest, '2026-09-05T00:00:00.000Z');
  assert.strictEqual(s.latest, '2026-09-09T00:00:00.000Z');
});
