'use strict';

const fs = require('node:fs');
const path = require('node:path');

function ledgerPath(joshRoot, yyyymm) {
  return path.join(joshRoot, 'cost', `${yyyymm}.jsonl`);
}

function currentMonth() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function appendCost(joshRoot, entry) {
  const e = {
    schema: 1,
    at: entry.at || new Date().toISOString(),
    todo_id: entry.todo_id || null,
    agent_id: entry.agent_id || null,
    model: entry.model || null,
    tokens_in: Number.isFinite(entry.tokens_in) ? entry.tokens_in : 0,
    tokens_out: Number.isFinite(entry.tokens_out) ? entry.tokens_out : 0,
    wall_seconds: Number.isFinite(entry.wall_seconds) ? entry.wall_seconds : 0,
    usd: Number.isFinite(entry.usd) ? entry.usd : 0,
    phase: entry.phase != null ? entry.phase : null,
    sentinel: entry.sentinel || null,
  };
  const p = ledgerPath(joshRoot, currentMonth());
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.appendFileSync(p, JSON.stringify(e) + '\n');
  return p;
}

function readCostsForMonth(joshRoot, yyyymm) {
  const p = ledgerPath(joshRoot, yyyymm || currentMonth());
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch (e) { return null; }
  }).filter(Boolean);
}

function listMonths(joshRoot) {
  const dir = path.join(joshRoot, 'cost');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}\.jsonl$/.test(f)).map((f) => f.replace(/\.jsonl$/, '')).sort();
}

function summarize(joshRoot, opts = {}) {
  let entries = [];
  if (opts.month) {
    entries = readCostsForMonth(joshRoot, opts.month);
  } else {
    for (const m of listMonths(joshRoot)) {
      entries = entries.concat(readCostsForMonth(joshRoot, m));
    }
  }
  if (opts.since) {
    const cutoff = Date.parse(opts.since);
    if (Number.isFinite(cutoff)) entries = entries.filter((e) => Date.parse(e.at) >= cutoff);
  }
  if (opts.todo_id) entries = entries.filter((e) => e.todo_id === opts.todo_id);
  if (opts.agent_id) entries = entries.filter((e) => e.agent_id === opts.agent_id);

  const total = entries.reduce((a, e) => ({
    tokens_in: a.tokens_in + e.tokens_in,
    tokens_out: a.tokens_out + e.tokens_out,
    wall_seconds: a.wall_seconds + e.wall_seconds,
    usd: a.usd + e.usd,
  }), { tokens_in: 0, tokens_out: 0, wall_seconds: 0, usd: 0 });

  const groupBy = (key) => {
    const out = {};
    for (const e of entries) {
      const k = e[key] || '(unset)';
      if (!out[k]) out[k] = { count: 0, tokens_in: 0, tokens_out: 0, wall_seconds: 0, usd: 0 };
      out[k].count++;
      out[k].tokens_in += e.tokens_in;
      out[k].tokens_out += e.tokens_out;
      out[k].wall_seconds += e.wall_seconds;
      out[k].usd += e.usd;
    }
    return out;
  };

  // `earliest` / `latest` are a min and a max, not the first and last rows.
  // The ledger is append-ordered by write time, which is not timestamp order
  // once runs finish concurrently, get retried, or are backfilled - taking
  // the ends of the array can report an `earliest` that is later than the
  // `latest`. Rows whose `at` will not parse are ignored for the range but
  // still counted everywhere else.
  let earliest = null;
  let latest = null;
  for (const e of entries) {
    const t = Date.parse(e.at);
    if (!Number.isFinite(t)) continue;
    if (earliest === null || t < earliest.t) earliest = { t, at: e.at };
    if (latest === null || t > latest.t) latest = { t, at: e.at };
  }

  return {
    run_count: entries.length,
    total,
    by_agent: groupBy('agent_id'),
    by_model: groupBy('model'),
    by_phase: groupBy('phase'),
    earliest: earliest ? earliest.at : null,
    latest: latest ? latest.at : null,
  };
}

module.exports = { appendCost, readCostsForMonth, listMonths, summarize, ledgerPath, currentMonth };
