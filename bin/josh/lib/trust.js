'use strict';

const fs = require('node:fs');
const path = require('node:path');

function trustPath(joshRoot, agentId) {
  return path.join(joshRoot, 'agents', agentId, 'trust.json');
}

function readTrust(joshRoot, agentId) {
  const p = trustPath(joshRoot, agentId);
  if (fs.existsSync(p)) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) {}
  }
  return {
    schema: 1,
    agent_id: agentId,
    dimensions: {},
    matrix_runs: 0,
    last_updated: null,
  };
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
    const cur = t.dimensions[dim] || { agreed: 0, total: 0, rate: 0 };
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
