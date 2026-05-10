const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');
const { appendCost, summarize, listMonths, currentMonth } = require('../lib/cost-ledger');
const { computeDriftAlerts } = require('../lib/drift-alerts');
const { renderDashboard } = require('../lib/dashboard');

const joshBin = path.resolve(__dirname, '..', 'josh.js');
function run(cmd, env) {
  return execSync(`node "${joshBin}" ${cmd}`, { env, stdio: 'pipe' }).toString();
}

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-dash-'));
  const env = { ...process.env, JOSH_ROOT: root };
  execSync(`node "${joshBin}" init`, { env, stdio: 'pipe' });
  return { root, env };
}

test('cost-ledger: appendCost + summarize round-trip', () => {
  const { root } = setup();
  appendCost(root, { todo_id: 'T1', agent_id: 'A03', model: 'sonnet', tokens_in: 1000, tokens_out: 200, wall_seconds: 10, usd: 0.005 });
  appendCost(root, { todo_id: 'T1', agent_id: 'A03', model: 'sonnet', tokens_in: 500, tokens_out: 100, wall_seconds: 5, usd: 0.002 });
  appendCost(root, { todo_id: 'T2', agent_id: 'A07', model: 'haiku',  tokens_in: 200, tokens_out: 50,  wall_seconds: 1, usd: 0.0001 });

  const s = summarize(root);
  assert.equal(s.run_count, 3);
  assert.equal(s.total.tokens_in, 1700);
  assert.equal(s.total.tokens_out, 350);
  assert.equal(Number(s.total.usd.toFixed(4)), 0.0071);
  assert.equal(s.by_agent.A03.count, 2);
  assert.equal(s.by_model.haiku.count, 1);
  fs.rmSync(root, { recursive: true, force: true });
});

test('cost-ledger: listMonths surfaces files', () => {
  const { root } = setup();
  appendCost(root, { todo_id: 'T', agent_id: 'A', model: 'sonnet', tokens_in: 1, tokens_out: 1, wall_seconds: 1, usd: 0.001 });
  const months = listMonths(root);
  assert.equal(months.length, 1);
  assert.equal(months[0], currentMonth());
  fs.rmSync(root, { recursive: true, force: true });
});

test('drift-alerts: agent disagreeing 3+ times in last 10 fires alert', () => {
  const { root } = setup();
  // Seed 5 matrix runs, each with candidates [A03, A07, A09], winner A03.
  // A07 and A09 thus "disagree" 5 times each.
  for (let i = 0; i < 5; i++) {
    const todoId = `01DRIFTTODO${String(i).padStart(13, '0')}`;
    const folder = path.join(root, 'todo', 'done', todoId);
    fs.mkdirSync(path.join(folder, 'verdicts'), { recursive: true });
    fs.writeFileSync(path.join(folder, 'meta.json'), JSON.stringify({
      schema: 1, id: todoId, matrix_candidates: ['A03', 'A07', 'A09'], archetype: 'general',
    }));
    fs.writeFileSync(path.join(folder, 'verdicts', 'winner.json'), JSON.stringify({
      schema: 1, winner_id: 'A03', materialized_at: `2026-05-${10 + i}T01:00:00Z`,
    }));
  }
  const alerts = computeDriftAlerts(root, { window: 10, threshold: 3 });
  const a07 = alerts.find((a) => a.agent === 'A07');
  const a09 = alerts.find((a) => a.agent === 'A09');
  assert.ok(a07);
  assert.ok(a09);
  assert.equal(a07.disagreements, 5);
  assert.equal(a09.disagreements, 5);
  // A03 was always winner — should NOT fire.
  assert.equal(alerts.find((a) => a.agent === 'A03'), undefined);
  fs.rmSync(root, { recursive: true, force: true });
});

test('drift-alerts: below threshold does NOT fire', () => {
  const { root } = setup();
  for (let i = 0; i < 5; i++) {
    const todoId = `01DRIFTLOTODO${String(i).padStart(11, '0')}`;
    const folder = path.join(root, 'todo', 'done', todoId);
    fs.mkdirSync(path.join(folder, 'verdicts'), { recursive: true });
    fs.writeFileSync(path.join(folder, 'meta.json'), JSON.stringify({
      schema: 1, id: todoId, matrix_candidates: ['A03', 'A07'], archetype: 'general',
    }));
    fs.writeFileSync(path.join(folder, 'verdicts', 'winner.json'), JSON.stringify({
      // Alternate winners so each loses ~half — under threshold within window=10.
      schema: 1, winner_id: i % 2 === 0 ? 'A03' : 'A07', materialized_at: `2026-05-1${i}T01:00:00Z`,
    }));
  }
  // A07 lost 3 (i=0,2,4), A03 lost 2 (i=1,3). With threshold=4, neither fires.
  const alerts = computeDriftAlerts(root, { window: 10, threshold: 4 });
  assert.equal(alerts.length, 0);
  fs.rmSync(root, { recursive: true, force: true });
});

test('dashboard: renders all expected sections + cost matches seeded data', () => {
  const { root } = setup();
  // Seed 30 cost entries.
  for (let i = 0; i < 30; i++) {
    appendCost(root, {
      todo_id: `T${i % 5}`, agent_id: i % 2 === 0 ? 'A03' : 'A07',
      model: 'sonnet', tokens_in: 1000, tokens_out: 200,
      wall_seconds: 10, usd: 0.005, phase: 1,
    });
  }
  // Seed an in_progress todo + a done todo.
  fs.mkdirSync(path.join(root, 'todo', 'in_progress', '01DASHTODO00000000000000A'), { recursive: true });
  fs.writeFileSync(path.join(root, 'todo', 'in_progress', '01DASHTODO00000000000000A', 'meta.json'),
    JSON.stringify({ schema: 1, id: '01DASHTODO00000000000000A', primary_role: 'A03', phase: 1 }));
  fs.writeFileSync(path.join(root, 'todo', 'in_progress', '01DASHTODO00000000000000A', 'state'), 'in_progress\n');

  const out = renderDashboard(root, {});
  assert.match(out, /Queue snapshot/);
  assert.match(out, /In-flight by phase/);
  assert.match(out, /In-flight by agent/);
  assert.match(out, /Cost \(since/);
  assert.match(out, /runs:\s+30/);
  assert.match(out, /USD:\s+0\.1500/);
  assert.match(out, /Drift alerts/);

  fs.rmSync(root, { recursive: true, force: true });
});

test('CLI: josh cost log + summary work end-to-end', () => {
  const { root, env } = setup();
  run('cost log --todo T1 --agent A03 --model sonnet --tokens-in 1000 --tokens-out 200 --wall 10 --usd 0.005 --phase 1', env);
  run('cost log --todo T2 --agent A03 --model haiku --tokens-in 100 --tokens-out 30 --wall 1 --usd 0.0001', env);
  const out = run('cost summary --by agent', env);
  assert.match(out, /runs:\s+2/);
  assert.match(out, /by agent:/);
  assert.match(out, /A03\s+runs=2/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('CLI: josh dashboard runs without errors', () => {
  const { root, env } = setup();
  run('cost log --todo T1 --agent A03 --model sonnet --tokens-in 100 --tokens-out 50 --wall 1 --usd 0.001', env);
  const out = run('dashboard', env);
  assert.match(out, /josh dashboard/);
  assert.match(out, /Queue snapshot/);
  fs.rmSync(root, { recursive: true, force: true });
});
