const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

const joshBin = path.resolve(__dirname, '..', 'josh.js');

function run(cmd, env) {
  return execSync(`node "${joshBin}" ${cmd}`, { env, stdio: 'pipe' }).toString();
}

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-mxs-'));
  const env = { ...process.env, JOSH_ROOT: root };
  execSync(`node "${joshBin}" init`, { env, stdio: 'pipe' });

  // Routing: matrix_rules for phase=1.
  fs.writeFileSync(path.join(root, 'orchestrator', 'routing.json'), JSON.stringify({
    schema: 1, rules: [],
    matrix_rules: [{ if_phase: 1, candidates: ['A01', 'A03', 'A07'] }],
  }));

  // Three agents + briefs.
  for (const id of ['A01', 'A03', 'A07', 'E08']) {
    const dir = path.join(root, 'agents', id);
    fs.mkdirSync(dir, { recursive: true });
    const briefPath = path.join(dir, 'brief.md');
    fs.writeFileSync(briefPath, `# Agent ${id}\n`);
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
      schema: 1, id, source_path: briefPath,
      budget: { preferred_model: 'sonnet', max_tokens_per_claim: 50000 },
    }, null, 2));
  }

  // Seed an in_progress todo with verdict_mode=matrix.
  const todoId = '01MXTODO0000000000000000';
  const folder = path.join(root, 'todo', 'in_progress', todoId);
  fs.mkdirSync(path.join(folder, 'verdicts'), { recursive: true });
  fs.writeFileSync(path.join(folder, 'meta.json'), JSON.stringify({
    schema: 1, id: todoId, display_id: 'D1-001',
    primary_role: 'A01', phase: 1,
    verdict_mode: 'matrix',
    matrix_candidates: ['A01', 'A03', 'A07'],
    matrix_n: 3,
    history: [],
  }, null, 2));
  fs.writeFileSync(path.join(folder, 'state'), 'in_progress\n');
  fs.writeFileSync(path.join(folder, 'events.ndjson'), '');
  return { root, env, todoId, folder };
}

function envelope(todoId, agentId, status, conf, sentinel = null) {
  return {
    schema: 1,
    id: '01HX' + agentId.padEnd(22, 'X').slice(0, 22),
    todo_id: todoId,
    agent_id: agentId,
    agent_version: 1,
    brief_hash: 'a'.repeat(64),
    produced_at: '2026-05-10T00:00:00.000Z',
    payload: {
      claim_text: `${agentId} says ${status}`,
      status,
      evidence_basis: 'reviewed inputs',
      risk_if_accepted: 'low',
      risk_if_rejected: 'low',
      verification_required: 'none',
      human_review_needed: false,
      blockers: [],
      trust_dimensions: ['legal_accuracy', 'source_safety'],
    },
    confidence: conf,
    cost: { tokens_in: 4000, tokens_out: 1000, wall_seconds: 30, model: 'sonnet', usd: 0.027 },
    sentinel,
    sig: null,
  };
}

test('matrix smoke: 3 candidates → tick queues E08 → simulate winner → tick materializes + trust', () => {
  const { root, env, todoId, folder } = setup();

  // Submit 3 envelopes (mixed statuses).
  for (const [agent, status, conf] of [['A01','approve',0.84],['A03','approve',0.81],['A07','reject',0.78]]) {
    const tmp = path.join(root, `${agent}.json`);
    fs.writeFileSync(tmp, JSON.stringify(envelope(todoId, agent, status, conf), null, 2));
    run(`verdict submit ${todoId} --envelope "${tmp}"`, env);
  }

  // Tick → matrix should be queued for E08.
  const out1 = run('tick', env);
  assert.match(out1, /matrix_queued=1/);

  // Confirm queue file in E08/incoming/
  const e08Incoming = path.join(root, 'E08', 'incoming');
  const queue = fs.readdirSync(e08Incoming).filter((f) => f.endsWith('.json'));
  assert.equal(queue.length, 1);

  // Simulate E08 picking winner — write winner.json shape that materializeWinner expects.
  fs.writeFileSync(path.join(folder, 'verdicts', 'winner.json'), JSON.stringify({
    schema: 1,
    winner_id: 'A03',
    synthesis_notes: 'A03 was most decisive and agrees with A01; A07 dissented.',
    confidence: 0.83,
  }, null, 2));

  // Tick again → should materialize winner + dissent + trust.
  const out2 = run('tick', env);
  assert.match(out2, /matrix_winners=1/);

  // Verify dissent dir.
  const dissentDir = path.join(folder, 'verdicts', 'dissent');
  assert.equal(fs.existsSync(path.join(dissentDir, 'A01.md')), true);
  assert.equal(fs.existsSync(path.join(dissentDir, 'A07.md')), true);
  assert.equal(fs.existsSync(path.join(dissentDir, 'A03.md')), false);

  // Trust files for all three.
  for (const id of ['A01', 'A03', 'A07']) {
    const t = JSON.parse(fs.readFileSync(path.join(root, 'agents', id, 'trust.json'), 'utf8'));
    assert.equal(t.matrix_runs, 1);
    assert.ok(t.dimensions.legal_accuracy);
  }
  const winnerTrust = JSON.parse(fs.readFileSync(path.join(root, 'agents', 'A03', 'trust.json'), 'utf8'));
  assert.equal(winnerTrust.dimensions.legal_accuracy.agreed, 1);
  const loserTrust = JSON.parse(fs.readFileSync(path.join(root, 'agents', 'A07', 'trust.json'), 'utf8'));
  assert.equal(loserTrust.dimensions.legal_accuracy.agreed, 0);

  // History tagged.
  const meta = JSON.parse(fs.readFileSync(path.join(folder, 'meta.json'), 'utf8'));
  assert.ok(meta.history.find((h) => h.event === 'matrix_queued'));
  assert.ok(meta.history.find((h) => h.event === 'winner_materialized'));

  fs.rmSync(root, { recursive: true, force: true });
});

test('matrix smoke: AUTO_ACCEPT sentinel + conf>=0.9 short-circuits matrix', () => {
  const { root, env, todoId, folder } = setup();

  // Submit a single high-confidence auto-accept envelope.
  const env1 = envelope(todoId, 'A01', 'approve', 0.95, 'auto_accept');
  const tmp = path.join(root, 'A01.json');
  fs.writeFileSync(tmp, JSON.stringify(env1, null, 2));
  run(`verdict submit ${todoId} --envelope "${tmp}"`, env);

  // Tick → auto_accepted should fire (no need to wait for N envelopes).
  const out = run('tick', env);
  assert.match(out, /matrix_auto_accepted=1/);

  // Winner.json present, A01 is the winner.
  const w = JSON.parse(fs.readFileSync(path.join(folder, 'verdicts', 'winner.json'), 'utf8'));
  assert.equal(w.winner_id, 'A01');

  fs.rmSync(root, { recursive: true, force: true });
});

test('matrix smoke: verdict list shows submitted envelopes', () => {
  const { root, env, todoId } = setup();
  for (const [a, s, c] of [['A01','approve',0.8],['A03','reject',0.7]]) {
    const tmp = path.join(root, `${a}.json`);
    fs.writeFileSync(tmp, JSON.stringify(envelope(todoId, a, s, c), null, 2));
    run(`verdict submit ${todoId} --envelope "${tmp}"`, env);
  }
  const out = run(`verdict list ${todoId}`, env);
  assert.match(out, /A01\s+approve/);
  assert.match(out, /A03\s+reject/);
  fs.rmSync(root, { recursive: true, force: true });
});
