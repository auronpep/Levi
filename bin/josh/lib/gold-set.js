'use strict';

const fs = require('node:fs');
const path = require('node:path');

function goldDir(joshRoot, agentId) {
  return path.join(joshRoot, 'agents', agentId, 'gold');
}

function readGold(joshRoot, agentId) {
  const dir = goldDir(joshRoot, agentId);
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try {
      out.push(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
    } catch (e) { /* skip malformed */ }
  }
  return out;
}

// The id becomes the filename, so it has to be a name and nothing else. Template
// interpolation turned a missing id into the literal file `undefined.json` - one
// name shared by every id-less item, so the second write destroyed the first -
// and turned a relative id into a path that landed outside the gold directory.
const GOLD_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function assertGoldId(id) {
  if (typeof id !== 'string' || !GOLD_ID_RE.test(id)) {
    throw new Error(`gold item id must match [A-Za-z0-9_-]{1,64}, got ${JSON.stringify(id)}`);
  }
  return id;
}

function writeGoldItem(joshRoot, agentId, item) {
  const id = assertGoldId(item && item.id);
  const dir = goldDir(joshRoot, agentId);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `${id}.json.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(item, null, 2) + '\n');
  fs.renameSync(tmp, path.join(dir, `${id}.json`));
}

// A gold item is only usable as a test if it states what it expects. readGold
// already skips files that will not parse; this is the same judgement applied to
// a file that parses fine but has no expectation in it.
function isUsableItem(item) {
  return !!item
    && typeof item.expected_verdict === 'object'
    && item.expected_verdict !== null
    && !Array.isArray(item.expected_verdict);
}

function matchesItem(item, produced) {
  if (!produced) return false;
  if (!isUsableItem(item)) return false;
  if (produced.status !== item.expected_verdict.status) return false;
  const expected = item.expected_verdict.claim_text || '';
  const got = produced.claim_text || '';
  if ((item.rubric || '').includes('strict_text')) {
    return got === expected;
  }
  // fuzzy: any non-empty key word from expected appears in got
  if (!expected) return true;
  const keywords = expected.toLowerCase().split(/\s+/).filter((w) => w.length >= 4);
  if (keywords.length === 0) return got.length > 0;
  return keywords.some((kw) => got.toLowerCase().includes(kw));
}

function replayGold(joshRoot, agentId, producedByGoldId, priorResults = null) {
  const items = readGold(joshRoot, agentId);
  let pass = 0, fail = 0, skipped = 0, regression_count = 0;
  const detail = [];
  for (const item of items) {
    const produced = (producedByGoldId && item && producedByGoldId[item.id]) || null;

    // An item with no expected_verdict has nothing to compare against. Scoring it
    // as a failure would report the agent as wrong for an incomplete fixture, so
    // it is set aside and counted separately - visible, but not on the agent's
    // record and never a regression.
    if (!isUsableItem(item)) {
      skipped++;
      detail.push({
        gold_id: (item && item.id) || null,
        expected: null,
        got: produced,
        match: false,
        skipped: true,
        reason: 'gold item has no expected_verdict',
      });
      continue;
    }

    const ok = matchesItem(item, produced);
    detail.push({
      gold_id: item.id,
      expected: item.expected_verdict,
      got: produced,
      match: ok,
    });
    if (ok) pass++;
    else {
      fail++;
      if (priorResults && priorResults[item.id] === 'pass') regression_count++;
    }
  }
  return { pass, fail, skipped, regression_count, items: detail, total: items.length };
}

module.exports = { readGold, writeGoldItem, replayGold, goldDir, assertGoldId };
