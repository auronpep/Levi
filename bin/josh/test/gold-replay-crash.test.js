// readGold deliberately skips files that will not parse, so a damaged gold
// directory does not stop a replay. A file that parses but carries no
// expected_verdict slipped past that guard and reached
// `produced.status !== item.expected_verdict.status`, throwing a TypeError and
// taking every other item's result down with it.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const gold = require('../lib/gold-set');

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'josh-gold-'));
}

function seed(root, items) {
  const dir = gold.goldDir(root, 'A03');
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(items)) {
    fs.writeFileSync(path.join(dir, `${name}.json`), typeof body === 'string' ? body : JSON.stringify(body));
  }
  return root;
}

const GOOD = (id, text) => ({ id, expected_verdict: { status: 'approve', claim_text: text } });

test('replayGold: an item with no expected_verdict does not throw', () => {
  const root = seed(tmpRoot(), {
    g1: GOOD('g1', 'alpha'),
    g2: { id: 'g2', rubric: 'note - verdict not filled in yet' },
  });
  assert.doesNotThrow(() => gold.replayGold(root, 'A03', {
    g1: { status: 'approve', claim_text: 'alpha' },
    g2: { status: 'approve', claim_text: 'anything' },
  }));
});

test('replayGold: the other items still report their real results', () => {
  const root = seed(tmpRoot(), {
    g1: GOOD('g1', 'alpha'),
    g2: { id: 'g2', rubric: 'no verdict' },
    g3: GOOD('g3', 'gamma'),
  });
  const r = gold.replayGold(root, 'A03', {
    g1: { status: 'approve', claim_text: 'alpha' },
    g2: { status: 'approve', claim_text: 'anything' },
    g3: { status: 'approve', claim_text: 'gamma' },
  });
  assert.strictEqual(r.pass, 2, 'both real items passed and must be reported');
  assert.strictEqual(r.fail, 0, 'an incomplete fixture is not the agent failing');
  assert.strictEqual(r.skipped, 1);
  assert.strictEqual(r.total, 3, 'total still counts every file found');
});

test('replayGold: pass + fail + skipped accounts for every item', () => {
  const root = seed(tmpRoot(), {
    g1: GOOD('g1', 'alpha'),
    g2: { id: 'g2' },
    g3: GOOD('g3', 'gamma'),
    g4: GOOD('g4', 'delta'),
  });
  const r = gold.replayGold(root, 'A03', {
    g1: { status: 'approve', claim_text: 'alpha' },
    g2: { status: 'approve', claim_text: 'x' },
    g3: { status: 'reject', claim_text: 'gamma' },
  });
  assert.strictEqual(r.pass + r.fail + r.skipped, r.total);
});

test('replayGold: a skipped item is reported, not swallowed', () => {
  const root = seed(tmpRoot(), { g2: { id: 'g2', rubric: 'no verdict' } });
  const r = gold.replayGold(root, 'A03', { g2: { status: 'approve' } });
  const entry = r.items.find((i) => i.gold_id === 'g2');
  assert.strictEqual(entry.skipped, true);
  assert.match(entry.reason, /expected_verdict/);
  assert.deepStrictEqual(entry.got, { status: 'approve' }, 'what the agent produced is still on the record');
});

test('replayGold: an unusable item never counts as a regression', () => {
  const root = seed(tmpRoot(), { g2: { id: 'g2', rubric: 'no verdict' } });
  const r = gold.replayGold(root, 'A03', { g2: { status: 'approve' } }, { g2: 'pass' });
  assert.strictEqual(r.regression_count, 0, 'a fixture losing its verdict is not the agent regressing');
});

test('replayGold: a null or array expected_verdict is treated the same way', () => {
  const root = seed(tmpRoot(), {
    g1: { id: 'g1', expected_verdict: null },
    g2: { id: 'g2', expected_verdict: [] },
  });
  const r = gold.replayGold(root, 'A03', { g1: { status: 'approve' }, g2: { status: 'approve' } });
  assert.strictEqual(r.skipped, 2);
  assert.strictEqual(r.fail, 0);
});

test('replayGold: malformed JSON is still dropped before it gets here', () => {
  const root = seed(tmpRoot(), { g1: GOOD('g1', 'alpha'), broken: '{ not json' });
  const r = gold.replayGold(root, 'A03', { g1: { status: 'approve', claim_text: 'alpha' } });
  assert.strictEqual(r.total, 1);
  assert.strictEqual(r.pass, 1);
  assert.strictEqual(r.skipped, 0);
});

test('replayGold: a missing produced verdict is still a fail, not a skip', () => {
  const root = seed(tmpRoot(), { g1: GOOD('g1', 'alpha') });
  const r = gold.replayGold(root, 'A03', {});
  assert.strictEqual(r.fail, 1, 'the item was a real test and the agent answered nothing');
  assert.strictEqual(r.skipped, 0);
});

test('replayGold: scoring of well-formed items is unchanged', () => {
  const root = seed(tmpRoot(), { g1: GOOD('g1', 'alpha'), g2: GOOD('g2', 'beta') });
  const r = gold.replayGold(
    root,
    'A03',
    { g1: { status: 'approve', claim_text: 'alpha here' }, g2: { status: 'reject', claim_text: 'beta' } },
    { g2: 'pass' },
  );
  assert.strictEqual(r.pass, 1);
  assert.strictEqual(r.fail, 1);
  assert.strictEqual(r.regression_count, 1);
  assert.strictEqual(r.skipped, 0);
});

test('replayGold: an empty gold directory reports zeroes, not a crash', () => {
  const root = tmpRoot();
  const r = gold.replayGold(root, 'A03', {});
  assert.deepStrictEqual(
    { pass: r.pass, fail: r.fail, skipped: r.skipped, total: r.total },
    { pass: 0, fail: 0, skipped: 0, total: 0 },
  );
});
