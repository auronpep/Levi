const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { writeEnvelope } = require('../lib/verdict-envelope');
const { enqueueAdjudication, materializeWinner, listPendingAdjudications } = require('../lib/adjudicator');

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-adj-'));
  fs.mkdirSync(path.join(root, 'todo', 'in_progress', '01TODO', 'verdicts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'E08', 'incoming'), { recursive: true });
  fs.mkdirSync(path.join(root, 'E08', 'processed'), { recursive: true });
  fs.mkdirSync(path.join(root, 'agents', 'E08'), { recursive: true });
  return root;
}

function envOf(over = {}) {
  return {
    schema: 1, id: '01HX' + 'A'.repeat(22), todo_id: '01TODO',
    agent_id: 'A03', agent_version: 1, brief_hash: 'a'.repeat(64),
    produced_at: '2026-05-10T00:00:00.000Z',
    payload: {
      claim_text: 'approve', status: 'approve', evidence_basis: 'x',
      risk_if_accepted: 'low', risk_if_rejected: 'low',
      verification_required: 'none', human_review_needed: false,
      blockers: [], trust_dimensions: ['legal_accuracy'],
    },
    confidence: 0.84,
    cost: { tokens_in: 1000, tokens_out: 500, wall_seconds: 10, model: 'sonnet', usd: 0.01 },
    ...over,
  };
}

test('enqueueAdjudication: writes a queue file with candidate list + trust map', () => {
  const root = makeRoot();
  const e1 = envOf({ agent_id: 'A03', id: '01HX' + 'A'.repeat(22) });
  const e2 = envOf({ agent_id: 'A07', id: '01HX' + 'B'.repeat(22), payload: { ...envOf().payload, status: 'reject', claim_text: 'reject' } });
  const e3 = envOf({ agent_id: 'A09', id: '01HX' + 'C'.repeat(22) });
  writeEnvelope(root, '01TODO', e1);
  writeEnvelope(root, '01TODO', e2);
  writeEnvelope(root, '01TODO', e3);

  const r = enqueueAdjudication(root, '01TODO', ['A03', 'A07', 'A09']);
  assert.match(r.adjudication_id, /^adj-/);
  const queueFile = path.join(root, 'E08', 'incoming', `${r.adjudication_id}.json`);
  assert.equal(fs.existsSync(queueFile), true);
  const payload = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
  assert.equal(payload.todo_id, '01TODO');
  assert.deepEqual(payload.candidates.map((c) => c.agent_id).sort(), ['A03', 'A07', 'A09']);
  fs.rmSync(root, { recursive: true, force: true });
});

test('listPendingAdjudications: returns queue files with id+todo', () => {
  const root = makeRoot();
  writeEnvelope(root, '01TODO', envOf({ agent_id: 'A03' }));
  enqueueAdjudication(root, '01TODO', ['A03']);
  const list = listPendingAdjudications(root);
  assert.equal(list.length, 1);
  assert.equal(list[0].todo_id, '01TODO');
  fs.rmSync(root, { recursive: true, force: true });
});

test('materializeWinner: copies winner envelope to verdicts/winner.json + dissent .md', () => {
  const root = makeRoot();
  writeEnvelope(root, '01TODO', envOf({ agent_id: 'A03' }));
  writeEnvelope(root, '01TODO', envOf({ agent_id: 'A07', payload: { ...envOf().payload, status: 'reject', claim_text: 'reject' } }));
  writeEnvelope(root, '01TODO', envOf({ agent_id: 'A09' }));

  const winnerJson = {
    schema: 1,
    winner_id: 'A03',
    synthesis_notes: 'A03 was clearest, A07 was overcautious, A09 mostly agreed.',
    confidence: 0.88,
  };
  const r = materializeWinner(root, '01TODO', winnerJson);
  assert.equal(r.winner, 'A03');
  assert.equal(r.dissent_count, 2);

  const winnerFile = path.join(root, 'todo', 'in_progress', '01TODO', 'verdicts', 'winner.json');
  assert.equal(fs.existsSync(winnerFile), true);

  const dissentDir = path.join(root, 'todo', 'in_progress', '01TODO', 'verdicts', 'dissent');
  assert.equal(fs.existsSync(path.join(dissentDir, 'A07.md')), true);
  assert.equal(fs.existsSync(path.join(dissentDir, 'A09.md')), true);

  // Original envelope JSONs should still be present (pick-one preserves audit).
  assert.equal(fs.existsSync(path.join(root, 'todo', 'in_progress', '01TODO', 'verdicts', 'A03.json')), true);
  assert.equal(fs.existsSync(path.join(root, 'todo', 'in_progress', '01TODO', 'verdicts', 'A07.json')), true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('materializeWinner: throws when winner_id has no envelope', () => {
  const root = makeRoot();
  writeEnvelope(root, '01TODO', envOf({ agent_id: 'A03' }));
  assert.throws(() => materializeWinner(root, '01TODO', {
    schema: 1, winner_id: 'A99', synthesis_notes: 'x', confidence: 0.7,
  }));
  fs.rmSync(root, { recursive: true, force: true });
});
