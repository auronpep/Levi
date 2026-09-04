'use strict';

const fs = require('node:fs');
const path = require('node:path');

function registryPath(joshRoot) {
  return path.join(joshRoot, 'mcp', 'registry.json');
}

// A corrupt registry must NOT be reported as an empty registry. Every mutating
// path (registerServer / unregisterServer) does read → modify → write, so
// swallowing a parse error here turned "the file is damaged" into "the file
// contains nothing", and the very next write replaced every registered server
// with the single entry being added.
function readRegistry(joshRoot) {
  const p = registryPath(joshRoot);
  if (!fs.existsSync(p)) return { schema: 1, servers: [] };

  let raw;
  try { raw = fs.readFileSync(p, 'utf8'); }
  catch (e) { throw new Error(`mcp registry unreadable at ${p}: ${e.message}`); }

  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) {
    throw new Error(
      `mcp registry is corrupt at ${p}: ${e.message}. ` +
      `Refusing to continue so the existing entries are not overwritten — ` +
      `repair the file or move it aside to start a fresh registry.`
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`mcp registry at ${p} is not a JSON object. Repair it or move it aside.`);
  }
  if (parsed.servers !== undefined && !Array.isArray(parsed.servers)) {
    throw new Error(`mcp registry at ${p} has a non-array "servers" field. Repair it or move it aside.`);
  }
  if (!Array.isArray(parsed.servers)) parsed.servers = [];
  return parsed;
}

function writeRegistry(joshRoot, reg) {
  const p = registryPath(joshRoot);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(reg, null, 2) + '\n');
  fs.renameSync(tmp, p);
}

function registerServer(joshRoot, server) {
  if (!server || !server.id) throw new Error('registerServer: server.id required');
  const reg = readRegistry(joshRoot);
  if (!Array.isArray(reg.servers)) reg.servers = [];
  const idx = reg.servers.findIndex((s) => s.id === server.id);
  const entry = {
    schema: 1,
    id: server.id,
    command: server.command || null,
    args: Array.isArray(server.args) ? server.args.slice() : [],
    env: server.env && typeof server.env === 'object' ? { ...server.env } : {},
    capabilities: Array.isArray(server.capabilities) ? server.capabilities.slice() : [],
    scopes: Array.isArray(server.scopes) ? server.scopes.slice() : [],
    registered_at: new Date().toISOString(),
  };
  if (idx >= 0) reg.servers[idx] = entry;
  else reg.servers.push(entry);
  writeRegistry(joshRoot, reg);
  return entry;
}

function unregisterServer(joshRoot, id) {
  const reg = readRegistry(joshRoot);
  const before = (reg.servers || []).length;
  reg.servers = (reg.servers || []).filter((s) => s.id !== id);
  writeRegistry(joshRoot, reg);
  return { removed: before - reg.servers.length };
}

function getServer(joshRoot, id) {
  const reg = readRegistry(joshRoot);
  return (reg.servers || []).find((s) => s.id === id) || null;
}

function listServers(joshRoot) {
  const reg = readRegistry(joshRoot);
  return reg.servers || [];
}

module.exports = {
  registryPath,
  readRegistry,
  writeRegistry,
  registerServer,
  unregisterServer,
  getServer,
  listServers,
};
