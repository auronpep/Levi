'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { listMonths, summarize } = require('./cost-ledger');

function sprintsDir(joshRoot) {
  return path.join(joshRoot, 'sprints');
}

function ts() {
  return new Date().toISOString().slice(0, 16).replace(/[:T-]/g, '').replace(/(\d{4})(\d{2})(\d{2})(\d{4})/, '$1-$2-$3-$4');
}

function snapshotPath(joshRoot, label) {
  const t = ts();
  const tag = label ? `-${label}` : '';
  return path.join(sprintsDir(joshRoot), `${t}${tag}.json`);
}

function countDir(p) {
  try { return fs.readdirSync(p, { withFileTypes: true }).filter((e) => e.isDirectory()).length; }
  catch (e) { return 0; }
}

function inFlightByAgent(joshRoot) {
  const dir = path.join(joshRoot, 'todo', 'in_progress');
  const out = {};
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(dir, e.name, 'meta.json'), 'utf8'));
      const a = meta.primary_role || meta.agent || '(unknown)';
      out[a] = (out[a] || 0) + 1;
    } catch (err) {}
  }
  return out;
}

function lastAuditChainTip(joshRoot) {
  const auditDir = path.join(joshRoot, 'audit');
  if (!fs.existsSync(auditDir)) return null;
  const files = fs.readdirSync(auditDir).filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort();
  if (files.length === 0) return null;
  const f = files[files.length - 1];
  try {
    const lines = fs.readFileSync(path.join(auditDir, f), 'utf8').split('\n').filter(Boolean);
    if (lines.length === 0) return { date: f.replace(/\.jsonl$/, ''), hmac: null };
    const last = JSON.parse(lines[lines.length - 1]);
    return { date: f.replace(/\.jsonl$/, ''), hmac: last.hmac || null, line_count: lines.length };
  } catch (e) { return null; }
}

function snapshot(joshRoot, opts = {}) {
  fs.mkdirSync(sprintsDir(joshRoot), { recursive: true });
  const queue = {};
  for (const s of ['incoming', 'triaged', 'claimed', 'planning', 'awaiting_approval', 'approved', 'in_progress', 'done', 'blocked', 'failed', 'cancelled']) {
    queue[s] = countDir(path.join(joshRoot, 'todo', s));
  }
  let costSummary = null;
  try { costSummary = summarize(joshRoot, {}); } catch (e) {}

  const snap = {
    schema: 1,
    label: opts.label || null,
    captured_at: new Date().toISOString(),
    queue,
    in_flight_by_agent: inFlightByAgent(joshRoot),
    cost_total_usd: costSummary ? Number(costSummary.total.usd.toFixed(4)) : 0,
    cost_run_count: costSummary ? costSummary.run_count : 0,
    months_with_cost: costSummary ? listMonths(joshRoot) : [],
    audit_chain_tip: lastAuditChainTip(joshRoot),
    host: opts.host || require('./host').currentHost(),
  };
  const p = snapshotPath(joshRoot, opts.label);
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(snap, null, 2) + '\n');
  fs.renameSync(tmp, p);
  return { path: p, snapshot: snap };
}

function listSnapshots(joshRoot) {
  const dir = sprintsDir(joshRoot);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
}

function loadSnapshot(joshRoot, name) {
  const p = path.join(sprintsDir(joshRoot), name);
  if (!fs.existsSync(p)) throw new Error(`snapshot not found: ${name}`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

module.exports = { snapshot, listSnapshots, loadSnapshot, sprintsDir };
