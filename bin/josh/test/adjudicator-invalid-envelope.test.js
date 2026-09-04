// `enqueueAdjudication` read `env.payload.status` unguarded, so one envelope
// without a payload threw a bare TypeError and aborted the whole enqueue - the
// agents that answered properly were never adjudicated either.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { enqueueAdjudication } = require('../lib/adjudicator');

const TODO = '01TODO0000000000000000000A';

function goodEnvelope(agentId) {
  return {
    schema: 1, id: `v-${agentId}`, todo_id: TODO, agent_id: agentId, agent_version: 1,
    brief_hash: 'a'.repeat(64), produced_at: new Date().toISOString(), confidence: 0.8, cost: {},
    payload: {
      claim_text: 'c', status: 'approve', evidence_basis: 'e',
      risk_if_accepted: 'r', risk_if_rejected: 'r', verification_required: 'v',
      human_review_needed: false, blockers: [], trust_dimensions: ['accuracy'],
    },
  };
}

function rootWith(envelopes) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-adj-'));
  const dir = path.join(root, 'todo', 'in_progress', TODO, 'verdicts');
  fs.mkdirSync(dir, { recursive: true });
  for (const [agentId, body] of Object.entries(envelopes)) {
    fs.writeFileSync(path.join(dir, `${agentId}.json`),
      typeof body === 'string' ? body : JSON.stringify(body));
  }
  return root;
}

const queued = (root, r) => JSON.parse(fs.readFileSync(r.queue_file, 'utf8'));

test('one payload-less envelope no longer blocks the whole matrix', () => {
  const root = rootWith({
    A01: goodEnvelope('A01'),
    A03: goodEnvelope('A03'),
    A07: { schema: 1, agent_id: 'A07', confidence: 0.5 },
  });

  const r = enqueueAdjudication(root, TODO, ['A01', 'A03', 'A07']);
  const q = queued(root, r);

  assert.deepStrictEqual(q.candidates.map((c) => c.agent_id), ['A01', 'A03']);
  assert.strictEqual(q.candidates[0].status, 'approve');
});

test('the excluded envelope is named with a reason', () => {
  const root = rootWith({
    A01: goodEnvelope('A01'),
    A07: { schema: 1, agent_id: 'A07' },
  });

  const q = queued(root, enqueueAdjudication(root, TODO, ['A01', 'A07']));
  assert.strictEqual(q.excluded.length, 1);
  assert.strictEqual(q.excluded[0].agent_id, 'A07');
  assert.match(q.excluded[0].reason, /no payload/);
  assert.match(q.excluded[0].envelope_path, /A07\.json$/);
});

test('an unparseable envelope is excluded rather than throwing', () => {
  const root = rootWith({ A01: goodEnvelope('A01'), A07: '{ broken' });

  const q = queued(root, enqueueAdjudication(root, TODO, ['A01', 'A07']));
  assert.deepStrictEqual(q.candidates.map((c) => c.agent_id), ['A01']);
  assert.match(q.excluded[0].reason, /unparseable/);
});

test('a non-object envelope is excluded', () => {
  for (const body of ['[]', '42', '"str"', 'null']) {
    const root = rootWith({ A01: goodEnvelope('A01'), A07: body });
    const q = queued(root, enqueueAdjudication(root, TODO, ['A01', 'A07']));
    assert.strictEqual(q.candidates.length, 1, `body ${body}`);
    assert.strictEqual(q.excluded.length, 1, `body ${body}`);
  }
});

test('when nothing is usable it still fails, and says which files', () => {
  const root = rootWith({ A01: { schema: 1 }, A07: '{ broken' });

  assert.throws(
    () => enqueueAdjudication(root, TODO, ['A01', 'A07']),
    /no usable envelopes.*A01.*A07/s,
  );
});

test('a candidate that never submitted is still a hard error', () => {
  const root = rootWith({ A01: goodEnvelope('A01') });
  assert.throws(() => enqueueAdjudication(root, TODO, ['A01', 'A99']), /has no envelope/);
});

test('an all-valid matrix is unchanged and records no exclusions', () => {
  const root = rootWith({ A01: goodEnvelope('A01'), A03: goodEnvelope('A03') });

  const q = queued(root, enqueueAdjudication(root, TODO, ['A01', 'A03']));
  assert.strictEqual(q.candidates.length, 2);
  assert.deepStrictEqual(q.excluded, []);
  assert.strictEqual(q.todo_id, TODO);
});

test('trust scores are still collected for every requested candidate', () => {
  const root = rootWith({ A01: goodEnvelope('A01'), A07: { schema: 1 } });
  const dir = path.join(root, 'agents', 'A07');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'trust.json'), JSON.stringify({ schema: 1, agent_id: 'A07', dimensions: {} }));

  const q = queued(root, enqueueAdjudication(root, TODO, ['A01', 'A07']));
  assert.ok(q.trust_scores.A07, 'the excluded agent still has its trust recorded for context');
});

test('an unknown todo is still an error', () => {
  const root = rootWith({ A01: goodEnvelope('A01') });
  assert.throws(() => enqueueAdjudication(root, 'NOPE', ['A01']), /not found/);
});
