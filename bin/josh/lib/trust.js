'use strict';

const fs = require('node:fs');
const path = require('node:path');

function trustPath(joshRoot, agentId) {
  return path.join(joshRoot, 'agents', agentId, 'trust.json');
}

function defaults(agentId) {
  return {
    schema: 1,
    agent_id: agentId,
    dimensions: {},
    matrix_runs: 0,
    last_updated: null,
  };
}

// readTrust has to actually return the shape updateTrust relies on, and it must
// not turn "this file is damaged" into "this agent has no history".
//
// updateTrust does read -> modify -> write, so swallowing a parse error meant a
// corrupt trust.json was replaced by a fresh zeroed record on the very next
// matrix run: every accumulated agreement rate for that agent was erased, and
// the erasure was written to disk with no error. A file that parsed but had no
// `dimensions` key crashed instead, on `t.dimensions[dim]`.
function readTrust(joshRoot, agentId) {
  const p = trustPath(joshRoot, agentId);
  if (!fs.existsSync(p)) return defaults(agentId);

  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) {
    throw new Error(
      `trust store is unreadable at ${p}: ${e.message}. ` +
      `Refusing to continue so the recorded history is not overwritten — ` +
      `repair the file or move it aside to start fresh.`
    );
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`trust store at ${p} is not a JSON object. Repair it or move it aside.`);
  }

  const t = { ...defaults(agentId), ...parsed };
  if (!t.dimensions || typeof t.dimensions !== 'object' || Array.isArray(t.dimensions)) t.dimensions = {};
  if (!Number.isFinite(t.matrix_runs)) t.matrix_runs = 0;
  return t;
}

function writeJsonAtomic(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  fs.renameSync(tmp, p);
}

function updateTrust(joshRoot, agentId, allDimensions, agreedDimensions) {
  const t = readTrust(joshRoot, agentId);
  const agreedSet = new Set(agreedDimensions || []);
  for (const dim of allDimensions || []) {
    const prev = t.dimensions[dim];
    // A per-dimension record whose counters are not numbers cannot be added to;
    // `undefined + 1` would silently write NaN into the agent's rate.
    const cur = (prev && Number.isFinite(prev.total) && Number.isFinite(prev.agreed))
      ? prev
      : { agreed: 0, total: 0, rate: 0 };
    cur.total += 1;
    if (agreedSet.has(dim)) cur.agreed += 1;
    cur.rate = cur.total > 0 ? Math.round((cur.agreed / cur.total) * 10000) / 10000 : 0;
    t.dimensions[dim] = cur;
  }
  t.matrix_runs = (t.matrix_runs || 0) + 1;
  t.last_updated = new Date().toISOString();
  writeJsonAtomic(trustPath(joshRoot, agentId), t);
  return t;
}

module.exports = { readTrust, updateTrust };
