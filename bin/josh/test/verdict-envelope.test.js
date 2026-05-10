const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  validateEnvelope,
  writeEnvelope,
  readEnvelope,
  listVerdicts,
  STATUSES,
} = require('../lib/verdict-envelope');

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-ve-'));
  fs.mkdirSync(path.join(root, 'todo', 'in_progress', '01TODO', 'verdicts'), { recursive: true });
  return root;
}

function goodEnvelope(over = {}) {
  return {
    schema: 1,
    id: '01HX0000000000000000000001',
    todo_id: '01TODO',
    agent_id: 'A03',
    agent_version: 1,
    brief_hash: 'a'.repeat(64),
    produced_at: '2026-05-10T00:00:00.000Z',
    payload: {
      claim_text: 'Approve as-is.',
      status: 'approve',
      evidence_basis: 'reviewed PROGRESS_TRACKER.md',
      risk_if_accepted: 'low',
      risk_if_rejected: 'low',
      verification_required: 'none',
      human_review_needed: false,
      blockers: [],
      trust_dimensions: ['legal_accuracy'],
    },
    confidence: 0.84,
    cost: { tokens_in: 4200, tokens_out: 1100, wall_seconds: 32, model: 'sonnet', usd: 0.038 },
    sentinel: null,
    sig: null,
    ...over,
  };
}

test('validateEnvelope: accepts a complete envelope', () => {
  const r = validateEnvelope(goodEnvelope());
  assert.equal(r.ok, true, `errors: ${JSON.stringify(r.errors)}`);
});

test('validateEnvelope: STATUSES contract', () => {
  assert.deepEqual(STATUSES.sort(), ['approve', 'hold', 'reject', 'rewrite']);
});

test('validateEnvelope: rejects missing top-level id', () => {
  const env = goodEnvelope();
  delete env.id;
  const r = validateEnvelope(env);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => /id/.test(e)));
});

test('validateEnvelope: rejects bad payload.status', () => {
  const env = goodEnvelope();
  env.payload.status = 'maybe';
  const r = validateEnvelope(env);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => /status/.test(e)));
});

test('validateEnvelope: rejects confidence out of range', () => {
  const r = validateEnvelope(goodEnvelope({ confidence: 1.4 }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => /confidence/.test(e)));
});

test('validateEnvelope: rejects missing payload field', () => {
  const env = goodEnvelope();
  delete env.payload.claim_text;
  const r = validateEnvelope(env);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => /claim_text/.test(e)));
});

test('writeEnvelope/readEnvelope: round-trip via verdicts/<agent>.json', () => {
  const root = makeRoot();
  const env = goodEnvelope();
  writeEnvelope(root, '01TODO', env);
  const got = readEnvelope(root, '01TODO', 'A03');
  assert.equal(got.id, env.id);
  assert.equal(got.payload.claim_text, env.payload.claim_text);
  fs.rmSync(root, { recursive: true, force: true });
});

test('listVerdicts: returns agent ids of all verdicts in folder', () => {
  const root = makeRoot();
  writeEnvelope(root, '01TODO', goodEnvelope({ agent_id: 'A03' }));
  writeEnvelope(root, '01TODO', goodEnvelope({ agent_id: 'A07' }));
  const list = listVerdicts(root, '01TODO');
  assert.deepEqual(list.sort(), ['A03', 'A07']);
  fs.rmSync(root, { recursive: true, force: true });
});

test('listVerdicts: ignores winner.json and dissent/', () => {
  const root = makeRoot();
  writeEnvelope(root, '01TODO', goodEnvelope({ agent_id: 'A03' }));
  fs.writeFileSync(path.join(root, 'todo', 'in_progress', '01TODO', 'verdicts', 'winner.json'), '{}');
  fs.mkdirSync(path.join(root, 'todo', 'in_progress', '01TODO', 'verdicts', 'dissent'));
  fs.writeFileSync(path.join(root, 'todo', 'in_progress', '01TODO', 'verdicts', 'dissent', 'A07.md'), 'x');
  const list = listVerdicts(root, '01TODO');
  assert.deepEqual(list, ['A03']);
  fs.rmSync(root, { recursive: true, force: true });
});
