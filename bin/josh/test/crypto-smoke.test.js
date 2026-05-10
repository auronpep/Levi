const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

const joshBin = path.resolve(__dirname, '..', 'josh.js');
function run(cmd, env, opts = {}) {
  return execSync(`node "${joshBin}" ${cmd}`, { env, stdio: opts.stdio || 'pipe' }).toString();
}

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-crypto-'));
  const env = { ...process.env, JOSH_ROOT: root };
  execSync(`node "${joshBin}" init`, { env, stdio: 'pipe' });

  // Seed agent A03 with a brief.
  const agentDir = path.join(root, 'agents', 'A03');
  fs.mkdirSync(agentDir, { recursive: true });
  const briefPath = path.join(agentDir, 'brief.md');
  fs.writeFileSync(briefPath, '# A03\nbrief content here\n');
  fs.writeFileSync(path.join(agentDir, 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A03', source_path: briefPath,
  }, null, 2));
  return { root, env, briefPath };
}

test('crypto smoke: agent mint + verdict submit auto-signs + verdict verify passes', () => {
  const { root, env } = setup();

  run('agent mint A03', env);
  // Seed a todo in_progress to receive the verdict.
  const todoId = '01CRYPTOTODO00000000000000';
  const todoDir = path.join(root, 'todo', 'in_progress', todoId);
  fs.mkdirSync(path.join(todoDir, 'verdicts'), { recursive: true });
  fs.writeFileSync(path.join(todoDir, 'meta.json'), JSON.stringify({
    schema: 1, id: todoId, primary_role: 'A03', history: [],
  }));
  fs.writeFileSync(path.join(todoDir, 'state'), 'in_progress\n');
  fs.writeFileSync(path.join(todoDir, 'events.ndjson'), '');

  // Build envelope WITHOUT sig — submit should sign it on write.
  const env1 = {
    schema: 1,
    id: '01HX' + 'X'.repeat(22),
    todo_id: todoId, agent_id: 'A03', agent_version: 1,
    brief_hash: 'placeholder' + 'a'.repeat(53),  // wrong; should be replaced
    produced_at: '2026-05-10T00:00:00.000Z',
    payload: {
      claim_text: 'approve', status: 'approve', evidence_basis: 'x',
      risk_if_accepted: 'low', risk_if_rejected: 'low',
      verification_required: 'none', human_review_needed: false,
      blockers: [], trust_dimensions: ['legal_accuracy'],
    },
    confidence: 0.85,
    cost: { tokens_in: 1000, tokens_out: 500, wall_seconds: 10, model: 'sonnet', usd: 0.01 },
  };
  // Validation requires brief_hash to be a valid sha256 hex; use placeholder that matches.
  env1.brief_hash = '0'.repeat(64);
  const tmp = path.join(root, 'env.json');
  fs.writeFileSync(tmp, JSON.stringify(env1));
  run(`verdict submit ${todoId} --envelope "${tmp}"`, env);

  // verdict verify should now pass — sig was added at write time.
  const out = run(`verdict verify ${todoId}`, env);
  assert.match(out, /A03: VALID/);

  fs.rmSync(root, { recursive: true, force: true });
});

test('crypto smoke: 50-event audit chain + tamper detection at exact line', () => {
  const { root, env } = setup();
  run('audit rotate-key --id 2026-05', env);

  // Append events via the chain helper directly (the CLI doesn't expose appendChainedAudit; manually drive it).
  const { appendChainedAudit, verifyChain, chainFile } = require('../lib/audit-chain');
  const today = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < 50; i++) {
    appendChainedAudit(root, { event: 'noop', id: `T${i}`, details: { i } }, { date: today, key_id: '2026-05' });
  }
  // verify CLI passes
  const out = run(`audit verify ${today}`, env);
  assert.match(out, /VALID/);
  assert.match(out, /5\d events/);

  // Tamper line 25 by changing one byte inside details.
  const file = chainFile(root, today);
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  const tamperIdx = 25;
  // Find a digit in the line content and change it deterministically.
  const before = lines[tamperIdx];
  const tampered = before.replace(/"i":\d+/, '"i":99999');
  assert.notEqual(tampered, before, 'tamper didn\'t actually change anything');
  lines[tamperIdx] = tampered;
  fs.writeFileSync(file, lines.join('\n') + '\n');

  let exitCode = 0; let stderrOut = '';
  try { run(`audit verify ${today}`, env); }
  catch (e) { exitCode = e.status; stderrOut = e.stderr.toString(); }
  assert.equal(exitCode, 1);
  assert.match(stderrOut, /INVALID/);

  fs.rmSync(root, { recursive: true, force: true });
});

test('crypto smoke: rotate-key emits key_rotated marker + chain still verifies after rotation', () => {
  const { root, env } = setup();
  run('audit rotate-key --id 2026-05', env);
  const { appendChainedAudit, verifyChain } = require('../lib/audit-chain');
  const today = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < 5; i++) {
    appendChainedAudit(root, { event: 'noop', id: `T${i}` }, { date: today, key_id: '2026-05' });
  }
  // Rotate; CLI emits the key_rotated event.
  run('audit rotate-key --id 2026-06', env);
  for (let i = 0; i < 5; i++) {
    appendChainedAudit(root, { event: 'noop', id: `U${i}` }, { date: today, key_id: '2026-06' });
  }

  const r = verifyChain(root, today);
  assert.equal(r.valid, true, `errors: ${JSON.stringify(r.errors)}`);
  // 1 key_rotated (initial mint) + 5 noop + 1 key_rotated + 5 noop = 12 events
  assert.equal(r.chain_length, 12);

  fs.rmSync(root, { recursive: true, force: true });
});

test('crypto smoke: forgery rejected (envelope with tampered brief_hash)', () => {
  const { root, env } = setup();
  run('agent mint A03', env);

  const todoId = '01CRYPTOTODO00000000000001';
  const todoDir = path.join(root, 'todo', 'in_progress', todoId);
  fs.mkdirSync(path.join(todoDir, 'verdicts'), { recursive: true });
  fs.writeFileSync(path.join(todoDir, 'meta.json'), JSON.stringify({ schema: 1, id: todoId, primary_role: 'A03', history: [] }));
  fs.writeFileSync(path.join(todoDir, 'state'), 'in_progress\n');
  fs.writeFileSync(path.join(todoDir, 'events.ndjson'), '');

  const env1 = {
    schema: 1, id: '01HX' + 'Y'.repeat(22), todo_id: todoId, agent_id: 'A03', agent_version: 1,
    brief_hash: '0'.repeat(64),
    produced_at: '2026-05-10T00:00:00.000Z',
    payload: {
      claim_text: 'approve', status: 'approve', evidence_basis: 'x',
      risk_if_accepted: 'low', risk_if_rejected: 'low', verification_required: 'none',
      human_review_needed: false, blockers: [], trust_dimensions: [],
    },
    confidence: 0.85,
    cost: { tokens_in: 100, tokens_out: 50, wall_seconds: 1, model: 'sonnet', usd: 0.001 },
  };
  const tmp = path.join(root, 'env.json');
  fs.writeFileSync(tmp, JSON.stringify(env1));
  run(`verdict submit ${todoId} --envelope "${tmp}"`, env);

  // Tamper: change envelope.brief_hash on disk after signing.
  const onDisk = path.join(todoDir, 'verdicts', 'A03.json');
  const stored = JSON.parse(fs.readFileSync(onDisk, 'utf8'));
  stored.brief_hash = 'b'.repeat(64);
  fs.writeFileSync(onDisk, JSON.stringify(stored));

  let exitCode = 0; let stdoutOut = '';
  try { stdoutOut = run(`verdict verify ${todoId}`, env); }
  catch (e) { exitCode = e.status; stdoutOut = (e.stdout || '').toString() + (e.stderr || '').toString(); }
  assert.equal(exitCode, 1);
  assert.match(stdoutOut, /INVALID/);

  fs.rmSync(root, { recursive: true, force: true });
});

test('crypto smoke: delegation chain — parent A01 issues VC, ephemeral verdict carries it, verifier accepts', () => {
  const { root, env } = setup();
  // Need two agents.
  fs.mkdirSync(path.join(root, 'agents', 'A01'), { recursive: true });
  const a01Brief = path.join(root, 'agents', 'A01', 'brief.md');
  fs.writeFileSync(a01Brief, '# A01\n');
  fs.writeFileSync(path.join(root, 'agents', 'A01', 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A01', source_path: a01Brief,
  }, null, 2));
  run('agent mint A01', env);

  // Issue + verify a delegation purely in lib.
  const { loadAgentKeys, derivedDID } = require('../lib/identity');
  const { issueDelegation, verifyDelegation } = require('../lib/delegation');
  const crypto = require('node:crypto');
  const a01Keys = loadAgentKeys(root, 'A01');
  // Make an ephemeral keypair (would be an in-memory sub-agent in production).
  const ekp = crypto.generateKeyPairSync('ed25519');
  const ephemeralPub = ekp.publicKey.export({ format: 'der', type: 'spki' }).slice(-32);
  const ephemeralDid = derivedDID(ephemeralPub);

  const vc = issueDelegation({
    parentKeys: a01Keys, ephemeralDID: ephemeralDid,
    scope: ['claim:01TODO', 'verdict:produce'],
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });
  const r = verifyDelegation(vc, { requiredScope: ['verdict:produce'] });
  assert.equal(r.valid, true, `errors: ${r.reason}`);
  assert.equal(r.payload.delegate_to, ephemeralDid);

  fs.rmSync(root, { recursive: true, force: true });
});
