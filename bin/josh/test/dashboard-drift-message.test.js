// The "no drift" line hard-coded the default thresholds, so a dashboard run with
// --drift-threshold / --drift-window reported a conclusion about a check it had
// not performed.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { renderDashboard } = require('../lib/dashboard');

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'josh-drift-msg-'));
}

// Two candidates, `claude` wins every run, so `codex` disagrees `n` times.
function seedRuns(root, n) {
  for (let i = 0; i < n; i++) {
    const folder = path.join(root, 'todo', 'done', `T${i}`);
    fs.mkdirSync(path.join(folder, 'verdicts'), { recursive: true });
    fs.writeFileSync(path.join(folder, 'meta.json'), JSON.stringify({
      id: `T${i}`, archetype: 'general', matrix_candidates: ['claude', 'codex'],
    }));
    fs.writeFileSync(path.join(folder, 'verdicts', 'winner.json'), JSON.stringify({
      winner_id: 'claude', materialized_at: `2026-09-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
    }));
  }
  return root;
}

const driftLine = (out) => out.split('## Drift alerts')[1].split('\n')[1];

test('the empty-state line reports the thresholds that were used', () => {
  const out = renderDashboard(tmpRoot(), { driftThreshold: 5, driftWindow: 20 });
  assert.match(driftLine(out), /≥5 disagreements in last 20 matrix runs/);
});

test('the defaults are still reported when nothing is passed', () => {
  const out = renderDashboard(tmpRoot());
  assert.match(driftLine(out), /≥3 disagreements in last 10 matrix runs/);
});

test('the reported threshold matches the one that suppressed the alert', () => {
  // 3 disagreements: fires at the default, silent at a threshold of 5.
  const root = seedRuns(tmpRoot(), 3);

  const quiet = renderDashboard(root, { driftThreshold: 5 });
  assert.match(driftLine(quiet), /≥5 disagreements/, 'the stated bar must be the bar applied');
  assert.ok(!quiet.includes('⚠️'), 'and no alert should be listed');

  const loud = renderDashboard(root);
  assert.ok(loud.includes('⚠️'), 'the same data does alert at the default threshold');
  assert.ok(loud.includes('codex'));
});

test('a window that excludes the runs is reported as the window used', () => {
  const root = seedRuns(tmpRoot(), 3);
  const out = renderDashboard(root, { driftThreshold: 4, driftWindow: 2 });
  assert.match(driftLine(out), /≥4 disagreements in last 2 matrix runs/);
});

test('only one of the two options being set still reports both accurately', () => {
  assert.match(driftLine(renderDashboard(tmpRoot(), { driftThreshold: 7 })), /≥7 disagreements in last 10/);
  assert.match(driftLine(renderDashboard(tmpRoot(), { driftWindow: 50 })), /≥3 disagreements in last 50/);
});

test('when alerts exist the listing is unchanged', () => {
  const root = seedRuns(tmpRoot(), 3);
  const out = renderDashboard(root);
  assert.match(out, /⚠️\s+codex on general: 3\/3 disagreements \(rate 1\)/);
});
