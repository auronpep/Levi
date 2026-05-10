'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { findTodoFolder, readEnvelope, listVerdicts } = require('./verdict-envelope');

const ULID_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function ulid(now = Date.now()) {
  let timePart = '';
  let t = now;
  for (let i = 0; i < 10; i++) { timePart = ULID_CHARS[t % 32] + timePart; t = Math.floor(t / 32); }
  let bigInt = 0n;
  for (const b of crypto.randomBytes(10)) bigInt = (bigInt << 8n) | BigInt(b);
  let randPart = '';
  for (let i = 0; i < 16; i++) { randPart = ULID_CHARS[Number(bigInt & 31n)] + randPart; bigInt >>= 5n; }
  return timePart + randPart;
}

function readTrust(joshRoot, agentId) {
  const p = path.join(joshRoot, 'agents', agentId, 'trust.json');
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

function writeJsonAtomic(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  fs.renameSync(tmp, p);
}

function enqueueAdjudication(joshRoot, todoId, candidateAgentIds) {
  const folder = findTodoFolder(joshRoot, todoId);
  if (!folder) throw new Error(`todo ${todoId} not found`);
  const id = 'adj-' + ulid();
  const candidates = candidateAgentIds.map((agentId) => {
    const envelopeFile = path.join(folder, 'verdicts', `${agentId}.json`);
    if (!fs.existsSync(envelopeFile)) {
      throw new Error(`candidate ${agentId} has no envelope at ${envelopeFile}`);
    }
    const env = JSON.parse(fs.readFileSync(envelopeFile, 'utf8'));
    return {
      agent_id: agentId,
      envelope_path: envelopeFile,
      status: env.payload.status,
      confidence: env.confidence,
      sentinel: env.sentinel || null,
    };
  });
  const trust_scores = {};
  for (const agentId of candidateAgentIds) {
    const t = readTrust(joshRoot, agentId);
    if (t) trust_scores[agentId] = t;
  }
  const queueFile = path.join(joshRoot, 'E08', 'incoming', `${id}.json`);
  writeJsonAtomic(queueFile, {
    schema: 1,
    id,
    todo_id: todoId,
    candidates,
    trust_scores,
    gold_match: null,
    queued_at: new Date().toISOString(),
  });
  return { adjudication_id: id, queue_file: queueFile };
}

function listPendingAdjudications(joshRoot) {
  const dir = path.join(joshRoot, 'E08', 'incoming');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      out.push({ id: j.id, todo_id: j.todo_id, queued_at: j.queued_at, candidate_count: (j.candidates || []).length });
    } catch (e) {}
  }
  return out;
}

function envelopeToDissentMd(env, synthesisHint) {
  const p = env.payload || {};
  const lines = [
    `# Dissent — ${env.agent_id} (v${env.agent_version})`,
    '',
    `Status: **${p.status}**`,
    `Confidence: ${env.confidence}`,
    `Produced at: ${env.produced_at}`,
    '',
    '## Claim',
    p.claim_text || '',
    '',
    '## Evidence basis',
    p.evidence_basis || '',
    '',
    '## Risk if accepted',
    p.risk_if_accepted || '',
    '',
    '## Risk if rejected',
    p.risk_if_rejected || '',
    '',
    '## Verification required',
    p.verification_required || '',
  ];
  if (Array.isArray(p.blockers) && p.blockers.length) {
    lines.push('', '## Blockers', ...p.blockers.map((b) => `- ${b}`));
  }
  if (synthesisHint) {
    lines.push('', '## Adjudicator note', synthesisHint);
  }
  return lines.join('\n') + '\n';
}

function materializeWinner(joshRoot, todoId, winnerJson) {
  if (!winnerJson || !winnerJson.winner_id) {
    throw new Error('winnerJson.winner_id is required');
  }
  const folder = findTodoFolder(joshRoot, todoId);
  if (!folder) throw new Error(`todo ${todoId} not found`);
  const verdictsDir = path.join(folder, 'verdicts');
  const winnerEnvelopePath = path.join(verdictsDir, `${winnerJson.winner_id}.json`);
  if (!fs.existsSync(winnerEnvelopePath)) {
    throw new Error(`winner ${winnerJson.winner_id} has no envelope at ${winnerEnvelopePath}`);
  }
  const winnerEnvelope = JSON.parse(fs.readFileSync(winnerEnvelopePath, 'utf8'));

  // Write winner.json (full envelope + adjudicator note).
  writeJsonAtomic(path.join(verdictsDir, 'winner.json'), {
    schema: 1,
    winner_id: winnerJson.winner_id,
    envelope: winnerEnvelope,
    synthesis_notes: winnerJson.synthesis_notes || '',
    adjudicator_confidence: winnerJson.confidence != null ? winnerJson.confidence : null,
    materialized_at: new Date().toISOString(),
  });

  // Archive runners-up to dissent/.
  const dissentDir = path.join(verdictsDir, 'dissent');
  fs.mkdirSync(dissentDir, { recursive: true });
  const allAgents = listVerdicts(joshRoot, todoId);
  let dissent_count = 0;
  for (const agentId of allAgents) {
    if (agentId === winnerJson.winner_id) continue;
    const env = readEnvelope(joshRoot, todoId, agentId);
    fs.writeFileSync(
      path.join(dissentDir, `${agentId}.md`),
      envelopeToDissentMd(env, winnerJson.synthesis_notes),
      'utf8'
    );
    dissent_count++;
  }

  return { winner: winnerJson.winner_id, dissent_count };
}

module.exports = {
  enqueueAdjudication,
  materializeWinner,
  listPendingAdjudications,
};
