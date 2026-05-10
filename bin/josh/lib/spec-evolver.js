'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const V1_AGENTS = ['A01', 'E00', 'E08'];
const DEFAULT_MAX_ROUNDS = 5;
const HARD_CEILING = 8;
const MIN_ROUNDS = 3;
const PASS_RATE_THRESHOLD = 0.95;
const BRIEF_LINE_BLOAT = 250;

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

function writeJsonAtomic(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  fs.renameSync(tmp, p);
}

function evolveDir(joshRoot, agentId, evolveId) {
  return path.join(joshRoot, 'agents', agentId, 'evolve', evolveId);
}

function readManifest(joshRoot, agentId) {
  const p = path.join(joshRoot, 'agents', agentId, 'manifest.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeManifest(joshRoot, agentId, manifest) {
  const p = path.join(joshRoot, 'agents', agentId, 'manifest.json');
  writeJsonAtomic(p, manifest);
}

function briefHash(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function enqueueEvolution(joshRoot, agentId, opts = {}) {
  if (!opts.allowAny && !V1_AGENTS.includes(agentId)) {
    throw new Error(`agent ${agentId} not in v1 evolve list (${V1_AGENTS.join(',')}); pass {allowAny: true} to override`);
  }
  const manifest = readManifest(joshRoot, agentId);
  if (!manifest.source_path || !fs.existsSync(manifest.source_path)) {
    throw new Error(`agent ${agentId} source brief missing`);
  }
  const briefV1 = fs.readFileSync(manifest.source_path, 'utf8');
  const evolveId = 'evolve-' + agentId + '-' + ulid();
  const dir = evolveDir(joshRoot, agentId, evolveId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'before.md'), briefV1);
  const state = {
    schema: 1,
    evolve_id: evolveId,
    agent_id: agentId,
    started_at: new Date().toISOString(),
    brief_hash_v1: briefHash(briefV1),
    max_rounds: opts.maxRounds || DEFAULT_MAX_ROUNDS,
    halted: false,
    halt_reason: null,
    history: [],
    last_round: 0,
  };
  writeJsonAtomic(path.join(dir, 'state.json'), state);

  // Dispatch file for external runtime (real path) OR simulator drives manually.
  const dispatchDir = path.join(joshRoot, 'orchestrator', 'incoming');
  fs.mkdirSync(dispatchDir, { recursive: true });
  writeJsonAtomic(path.join(dispatchDir, `${evolveId}.json`), {
    schema: 1,
    kind: 'evolve',
    id: evolveId,
    evolve_id: evolveId,
    action: 'evolve',
    agent_id: agentId,
    max_rounds: state.max_rounds,
    brief_hash_v1: state.brief_hash_v1,
    queued_at: state.started_at,
  });

  return { evolve_id: evolveId };
}

function readState(joshRoot, agentId, evolveId) {
  const p = path.join(evolveDir(joshRoot, agentId, evolveId), 'state.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeState(joshRoot, agentId, evolveId, state) {
  writeJsonAtomic(path.join(evolveDir(joshRoot, agentId, evolveId), 'state.json'), state);
}

function checkHaltRules(state, latest) {
  // Returns {halt:bool, reason:string, revert_to_round:int|null}
  if (latest.regression_against_prev) {
    return { halt: true, reason: 'regression', revert_to_round: latest.round_num - 1 };
  }
  if (latest.brief_lines > BRIEF_LINE_BLOAT) {
    return { halt: true, reason: `bloating:${latest.brief_lines}`, revert_to_round: latest.round_num };
  }
  // Converged: pass >= 0.95 AND NO_NEW_GAPS_FOUND for 2 rounds in a row.
  const lastTwo = state.history.slice(-2);
  if (
    state.history.length >= MIN_ROUNDS &&
    lastTwo.length === 2 &&
    lastTwo.every((h) => h.pass_rate >= PASS_RATE_THRESHOLD && h.no_new_gaps_found)
  ) {
    return { halt: true, reason: 'converged', revert_to_round: latest.round_num };
  }
  if (latest.round_num >= HARD_CEILING) {
    return { halt: true, reason: 'max_rounds', revert_to_round: latest.round_num };
  }
  if (latest.round_num >= state.max_rounds) {
    return { halt: true, reason: 'max_rounds', revert_to_round: latest.round_num };
  }
  return { halt: false };
}

function processRound(joshRoot, agentId, evolveId, candidate, opts = {}) {
  const state = readState(joshRoot, agentId, evolveId);
  if (!state) throw new Error(`evolve job ${evolveId} not found`);
  if (state.halted) return { halted: true, halt_reason: state.halt_reason };

  const dir = evolveDir(joshRoot, agentId, evolveId);
  const roundDir = path.join(dir, `round-${candidate.round_num}`);
  fs.mkdirSync(roundDir, { recursive: true });
  fs.writeFileSync(path.join(roundDir, 'after.md'), candidate.after_md);
  if (candidate.frustration_log) fs.writeFileSync(path.join(roundDir, 'frustration.md'), candidate.frustration_log);
  if (candidate.gap_categories) fs.writeFileSync(path.join(roundDir, 'gaps.json'), JSON.stringify(candidate.gap_categories, null, 2));

  // Replay gold against candidate brief. The CALLER provides per-gold produced verdicts
  // (in production from the real runtime; in tests from fixture data).
  const goldReplay = candidate.gold_replay || { pass: 0, fail: 0, regression_count: 0, total: 0, items: [] };
  const passRate = (goldReplay.total > 0) ? (goldReplay.pass / goldReplay.total) : 0;
  const briefLines = candidate.after_md.split('\n').length;

  const prev = state.history[state.history.length - 1];
  const regressionAgainstPrev = prev ? (passRate < prev.pass_rate) : false;

  const latest = {
    round_num: candidate.round_num,
    pass_rate: passRate,
    pass: goldReplay.pass,
    fail: goldReplay.fail,
    total: goldReplay.total,
    regression_count: goldReplay.regression_count || 0,
    brief_lines: briefLines,
    no_new_gaps_found: !!candidate.no_new_gaps_found_emitted,
    regression_against_prev: regressionAgainstPrev,
    archetype: candidate.archetype || null,
    archetype_id: candidate.archetype_id || null,
    at: new Date().toISOString(),
  };
  state.history.push(latest);
  state.last_round = candidate.round_num;

  const halt = checkHaltRules(state, latest);
  if (halt.halt) {
    state.halted = true;
    state.halt_reason = halt.reason;
    state.revert_to_round = halt.revert_to_round;
  }
  writeState(joshRoot, agentId, evolveId, state);
  return { halted: halt.halt, halt_reason: halt.reason, revert_to_round: halt.revert_to_round, latest };
}

function unifiedDiff(beforeText, afterText) {
  // Minimal hunk-free unified diff: header + removed lines (-) + added lines (+).
  // Sufficient for human review; not a real patch tool.
  const before = beforeText.split('\n');
  const after = afterText.split('\n');
  const lines = [
    '--- before.md',
    '+++ after.md',
  ];
  // Naive line-by-line LCS-free diff.
  const max = Math.max(before.length, after.length);
  for (let i = 0; i < max; i++) {
    const b = before[i];
    const a = after[i];
    if (b === a) continue;
    if (b !== undefined) lines.push(`-${b}`);
    if (a !== undefined) lines.push(`+${a}`);
  }
  return lines.join('\n') + '\n';
}

function assembleApproval(joshRoot, agentId, evolveId) {
  const state = readState(joshRoot, agentId, evolveId);
  if (!state || !state.halted) throw new Error(`evolve job ${evolveId} not halted`);

  const evDir = evolveDir(joshRoot, agentId, evolveId);
  const beforePath = path.join(evDir, 'before.md');
  const winRound = state.revert_to_round || state.last_round;
  const afterPath = path.join(evDir, `round-${winRound}`, 'after.md');
  if (!fs.existsSync(afterPath)) {
    throw new Error(`winning round candidate not found: ${afterPath}`);
  }

  const approvalDir = path.join(joshRoot, 'approvals', evolveId);
  fs.mkdirSync(path.join(approvalDir, 'iteration-logs'), { recursive: true });
  const beforeText = fs.readFileSync(beforePath, 'utf8');
  const afterText = fs.readFileSync(afterPath, 'utf8');
  fs.writeFileSync(path.join(approvalDir, 'before.md'), beforeText);
  fs.writeFileSync(path.join(approvalDir, 'after.md'), afterText);
  fs.writeFileSync(path.join(approvalDir, 'diff.patch'), unifiedDiff(beforeText, afterText));
  for (const h of state.history) {
    const log = [
      `# Round ${h.round_num}`,
      '',
      `- archetype: ${h.archetype || '?'} (${h.archetype_id || '?'})`,
      `- pass_rate: ${h.pass_rate.toFixed(3)}  (${h.pass}/${h.total})`,
      `- brief_lines: ${h.brief_lines}`,
      `- NO_NEW_GAPS_FOUND: ${h.no_new_gaps_found}`,
      `- regression_against_prev: ${h.regression_against_prev}`,
      `- regression_count_vs_gold: ${h.regression_count}`,
      `- at: ${h.at}`,
    ].join('\n') + '\n';
    fs.writeFileSync(path.join(approvalDir, 'iteration-logs', `round-${h.round_num}.md`), log);
  }
  const goldReplay = {
    schema: 1,
    rounds: state.history.map((h) => ({ round: h.round_num, pass_rate: h.pass_rate, pass: h.pass, total: h.total, regression_count: h.regression_count })),
    halt_reason: state.halt_reason,
  };
  fs.writeFileSync(path.join(approvalDir, 'gold-replay.json'), JSON.stringify(goldReplay, null, 2));

  const lastRound = state.history[state.history.length - 1];
  const approvalSummary = `# Evolve approval — ${agentId} (${evolveId})

- halt_reason: ${state.halt_reason}
- winning_round: ${winRound}
- pass_rate: ${(lastRound && lastRound.pass_rate || 0).toFixed(3)}
- brief_size: ${lastRound && lastRound.brief_lines || '?'} lines
- old_brief_hash: ${state.brief_hash_v1}
- new_brief_hash: ${briefHash(afterText)}
`;
  fs.writeFileSync(path.join(approvalDir, 'approval.md'), approvalSummary);

  return { approval_dir: approvalDir, winning_round: winRound, halt_reason: state.halt_reason };
}

function applyApproval(joshRoot, evolveId, opts = {}) {
  const approvalDir = path.join(joshRoot, 'approvals', evolveId);
  if (!fs.existsSync(approvalDir)) throw new Error(`approval not found: ${evolveId}`);
  const summaryPath = path.join(approvalDir, 'approval.md');
  if (!fs.existsSync(summaryPath)) throw new Error('approval missing approval.md');
  const after = fs.readFileSync(path.join(approvalDir, 'after.md'), 'utf8');

  // Determine agent_id from evolve_id format `evolve-<agent>-<ulid>`.
  const m = evolveId.match(/^evolve-([^-]+)-/);
  if (!m) throw new Error(`malformed evolve_id: ${evolveId}`);
  const agentId = m[1];

  const manifest = readManifest(joshRoot, agentId);
  // Backup current brief into approvals/<evolveId>/before-overwritten.md.
  if (manifest.source_path && fs.existsSync(manifest.source_path)) {
    fs.writeFileSync(path.join(approvalDir, 'before-overwritten.md'), fs.readFileSync(manifest.source_path));
  }
  fs.writeFileSync(manifest.source_path, after);
  manifest.version = (manifest.version || 1) + 1;
  writeManifest(joshRoot, agentId, manifest);

  // Lessons append.
  const { appendLesson } = require('./lessons');
  appendLesson(joshRoot, agentId,
    `Brief evolved → version ${manifest.version} via ${evolveId}.`,
    { actor: opts.actor || 'orchestrator' });

  // Move approval folder to ~/.josh/approvals/done/<id>/
  const doneDir = path.join(joshRoot, 'approvals', 'done', evolveId);
  fs.mkdirSync(path.dirname(doneDir), { recursive: true });
  if (fs.existsSync(doneDir)) fs.rmSync(doneDir, { recursive: true, force: true });
  fs.renameSync(approvalDir, doneDir);

  return { agent_id: agentId, new_version: manifest.version, archived_to: doneDir };
}

function archiveRejection(joshRoot, evolveId, reason, opts = {}) {
  const approvalDir = path.join(joshRoot, 'approvals', evolveId);
  if (!fs.existsSync(approvalDir)) throw new Error(`approval not found: ${evolveId}`);
  fs.writeFileSync(path.join(approvalDir, 'rejection.json'), JSON.stringify({
    schema: 1,
    evolve_id: evolveId,
    rejected_at: new Date().toISOString(),
    rejected_by: opts.actor || 'orchestrator',
    reason,
  }, null, 2));
  const doneDir = path.join(joshRoot, 'approvals', 'done', evolveId);
  fs.mkdirSync(path.dirname(doneDir), { recursive: true });
  if (fs.existsSync(doneDir)) fs.rmSync(doneDir, { recursive: true, force: true });
  fs.renameSync(approvalDir, doneDir);
  return { archived_to: doneDir };
}

function listEvolutions(joshRoot, opts = {}) {
  const out = [];
  // Active evolutions = state.json under ~/.josh/agents/*/evolve/*/state.json
  const agentsDir = path.join(joshRoot, 'agents');
  if (fs.existsSync(agentsDir)) {
    for (const a of fs.readdirSync(agentsDir, { withFileTypes: true })) {
      if (!a.isDirectory()) continue;
      const eDir = path.join(agentsDir, a.name, 'evolve');
      if (!fs.existsSync(eDir)) continue;
      for (const e of fs.readdirSync(eDir, { withFileTypes: true })) {
        if (!e.isDirectory()) continue;
        const sp = path.join(eDir, e.name, 'state.json');
        if (!fs.existsSync(sp)) continue;
        try {
          const s = JSON.parse(fs.readFileSync(sp, 'utf8'));
          out.push({
            evolve_id: s.evolve_id, agent_id: s.agent_id,
            halted: s.halted, halt_reason: s.halt_reason,
            rounds: s.history.length, started_at: s.started_at,
            location: 'active',
          });
        } catch (err) {}
      }
    }
  }
  // Pending approvals.
  const approvalsDir = path.join(joshRoot, 'approvals');
  if (fs.existsSync(approvalsDir)) {
    for (const e of fs.readdirSync(approvalsDir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      if (e.name === 'pending' || e.name === 'done') continue;
      if (!/^evolve-/.test(e.name)) continue;
      out.push({ evolve_id: e.name, location: 'pending_approval' });
    }
  }
  // Done.
  const doneDir = path.join(joshRoot, 'approvals', 'done');
  if (fs.existsSync(doneDir)) {
    for (const e of fs.readdirSync(doneDir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      if (!/^evolve-/.test(e.name)) continue;
      out.push({ evolve_id: e.name, location: 'done' });
    }
  }
  if (opts.state) return out.filter((x) => x.location === opts.state);
  return out;
}

module.exports = {
  V1_AGENTS,
  DEFAULT_MAX_ROUNDS,
  HARD_CEILING,
  MIN_ROUNDS,
  PASS_RATE_THRESHOLD,
  BRIEF_LINE_BLOAT,
  enqueueEvolution,
  readState,
  writeState,
  processRound,
  checkHaltRules,
  assembleApproval,
  applyApproval,
  archiveRejection,
  listEvolutions,
  briefHash,
};
