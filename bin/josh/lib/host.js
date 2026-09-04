'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function currentHost() {
  return process.env.JOSH_HOST_OVERRIDE || os.hostname();
}

function capacityPath(joshRoot, host) {
  const h = host || currentHost();
  return path.join(joshRoot, `${h}.capacity.json`);
}

const CAPACITY_DEFAULTS = Object.freeze({
  schema: 1,
  max_concurrent: null,
  max_concurrent_per_phase: null,
  max_concurrent_per_agent: null,
});

function readCapacity(joshRoot, host) {
  const p = capacityPath(joshRoot, host);
  if (!fs.existsSync(p)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { ...CAPACITY_DEFAULTS, ...raw, host: host || currentHost() };
  } catch (e) { return null; }
}

function writeCapacity(joshRoot, host, capacity) {
  const p = capacityPath(joshRoot, host);
  // Every other writer in lib/ (lessons, mcp-registry, stignore, …) creates its
  // parent directory first. Without this, declaring capacity on a host whose
  // JOSH_ROOT has not been initialised yet fails with a raw ENOENT.
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ schema: 1, host: host || currentHost(), ...capacity }, null, 2) + '\n');
  fs.renameSync(tmp, p);
  return p;
}

function listHostCapacities(joshRoot) {
  if (!fs.existsSync(joshRoot)) return [];
  return fs.readdirSync(joshRoot)
    .filter((f) => /\.capacity\.json$/.test(f))
    .map((f) => f.replace(/\.capacity\.json$/, ''))
    .sort();
}

module.exports = {
  currentHost,
  capacityPath,
  readCapacity,
  writeCapacity,
  listHostCapacities,
  CAPACITY_DEFAULTS,
};
