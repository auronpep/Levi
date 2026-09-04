// Drift is "the agent's verdict was not the winner picked by E08", implemented
// as `c !== r.winner_id`. Every candidate differs from a *missing* winner, so a
// winner.json without a usable winner_id used to mark every participating agent
// as a 100% dissenter - manufacturing drift alerts against agents that had won
// every matrix they entered.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const drift = require('../lib/drift-alerts');

// Each entry is the winner.json body for one run; candidates are always the
// same two agents so the tally is easy to reason about.
function rootWith(winners, opts = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-drift-'));
  winners.forEach((winner, i) => {
    const folder = path.join(root, 'todo', opts.state || 'done', `T${i}`);
    fs.mkdirSync(path.join(folder, 'verdicts'), { recursive: true });
    fs.writeFileSync(path.join(folder, 'meta.json'), JSON.stringify({
      id: `T${i}`,
      archetype: opts.archetype || 'general',
      matrix_candidates: opts.candidates || ['claude', 'codex'],
    }));
    fs.writeFileSync(path.join(folder, 'verdicts', 'winner.json'), JSON.stringify(winner));
  });
  return root;
}

function agents(alerts) {
  return alerts.map((a) => a.agent).sort();
}

// Three runs, one winner each, materialized on consecutive days.
function threeRuns(body) {
  return [0, 1, 2].map((i) => ({ ...body, materialized_at: `2026-09-0${i + 1}T00:00:00.000Z` }));
}

test('a recorded winner still produces the real drift alert', () => {
  const root = rootWith(threeRuns({ winner_id: 'claude' }));
  const alerts = drift.computeDriftAlerts(root);
  assert.deepStrictEqual(agents(alerts), ['codex'], 'only the agent that lost every run drifts');
  assert.strictEqual(alerts[0].disagreements, 3);
  assert.strictEqual(alerts[0].rate, 1);
});

test('a missing winner_id does not manufacture drift', () => {
  const root = rootWith(threeRuns({}));
  assert.deepStrictEqual(drift.computeDriftAlerts(root), []);
});

test('a null winner_id does not manufacture drift', () => {
  const root = rootWith(threeRuns({ winner_id: null }));
  assert.deepStrictEqual(drift.computeDriftAlerts(root), []);
});

test('an empty-string winner_id does not manufacture drift', () => {
  const root = rootWith(threeRuns({ winner_id: '' }));
  assert.deepStrictEqual(drift.computeDriftAlerts(root), []);
});

test('a non-string winner_id is skipped, not compared against string ids', () => {
  // `'claude' !== 0` is true, which would have flagged everyone.
  for (const winner_id of [0, false, 42, [], {}]) {
    const root = rootWith(threeRuns({ winner_id }));
    assert.deepStrictEqual(drift.computeDriftAlerts(root), [], `winner_id ${JSON.stringify(winner_id)}`);
  }
});

test('the agent that won every run is never reported, whatever the other files say', () => {
  // Two good runs claude wins, one unusable run. Before the fix the unusable
  // run put claude on the board alongside codex.
  const root = rootWith([
    { winner_id: 'claude', materialized_at: '2026-09-01T00:00:00.000Z' },
    { winner_id: 'claude', materialized_at: '2026-09-02T00:00:00.000Z' },
    { materialized_at: '2026-09-03T00:00:00.000Z' },
  ]);
  const alerts = drift.computeDriftAlerts(root, { threshold: 2 });
  assert.deepStrictEqual(agents(alerts), ['codex']);
  assert.strictEqual(alerts[0].disagreements, 2, 'only the two decided runs count');
  assert.strictEqual(alerts[0].runs_in_window, 2, 'the undecided run is not in the denominator either');
});

test('an unusable run does not dilute the rate of a real drifter', () => {
  const root = rootWith([
    { winner_id: 'claude', materialized_at: '2026-09-01T00:00:00.000Z' },
    { winner_id: 'claude', materialized_at: '2026-09-02T00:00:00.000Z' },
    { winner_id: 'claude', materialized_at: '2026-09-03T00:00:00.000Z' },
    { winner_id: null, materialized_at: '2026-09-04T00:00:00.000Z' },
  ]);
  const alerts = drift.computeDriftAlerts(root);
  assert.strictEqual(alerts.length, 1);
  assert.strictEqual(alerts[0].rate, 1, 'codex lost 3 of the 3 runs that had a winner');
});

test('runs remain visible in listMatrixRuns even when their winner is unusable', () => {
  // The listing is a factual inventory; only the drift tally requires a winner.
  const root = rootWith(threeRuns({}));
  assert.strictEqual(drift.listMatrixRuns(root).length, 3);
});

test('a genuine winner below threshold still does not alert', () => {
  const root = rootWith([
    { winner_id: 'claude', materialized_at: '2026-09-01T00:00:00.000Z' },
    { winner_id: 'codex', materialized_at: '2026-09-02T00:00:00.000Z' },
  ]);
  assert.deepStrictEqual(drift.computeDriftAlerts(root), [], 'one disagreement each, threshold is 3');
});

test('an empty root produces no alerts and no crash', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-drift-'));
  assert.deepStrictEqual(drift.computeDriftAlerts(root), []);
  assert.deepStrictEqual(drift.listMatrixRuns(root), []);
});
