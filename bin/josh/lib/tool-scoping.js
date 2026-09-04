'use strict';

const fs = require('node:fs');
const path = require('node:path');

function readAgentManifest(joshRoot, agentId) {
  const p = path.join(joshRoot, 'agents', agentId, 'manifest.json');
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

function writeAgentManifest(joshRoot, agentId, manifest) {
  const p = path.join(joshRoot, 'agents', agentId, 'manifest.json');
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2) + '\n');
  fs.renameSync(tmp, p);
}

function resolveAllowedTools(joshRoot, agentId) {
  const m = readAgentManifest(joshRoot, agentId);
  if (!m) return null;
  // An ABSENT allowed_tools means "never scoped" → full access. That is the v1
  // case: v1 predates the field, so a v1 manifest has no key here at all and is
  // caught by the isArray check below.
  //
  // An EMPTY allowed_tools is a different statement. It is only ever produced by
  // v2 code - by removeAllowedTool() taking out the last entry, or by an explicit
  // setAllowedTools(agent, []) - and in both cases the operator was subtracting
  // permission. Collapsing it to "full access" inverted the one operation whose
  // entire purpose is to take access away. checkScope() has always read a
  // present-but-empty list as deny-all; this is the other half agreeing with it.
  //
  // ['*'] remains the way to say "unrestricted" on purpose.
  if (!Array.isArray(m.allowed_tools)) return null;     // unset → full
  if (m.allowed_tools.includes('*')) return null;       // explicit wildcard
  return m.allowed_tools.slice();                       // [] → restricted to nothing
}

function checkScope(allowed, toolId) {
  if (allowed === null) return { allowed: true, reason: 'unrestricted' };
  if (!Array.isArray(allowed)) return { allowed: true, reason: 'unrestricted' };
  // Match: exact OR prefix-with-colon. e.g., allowed=["mcp:duckdb", "fs:read"]; toolId="fs:read".
  // Also support category wildcards: "mcp:*" matches "mcp:duckdb".
  for (const pattern of allowed) {
    if (pattern === toolId) return { allowed: true, reason: `exact:${pattern}` };
    if (pattern.endsWith(':*')) {
      const prefix = pattern.slice(0, -2);
      if (toolId.startsWith(prefix + ':') || toolId === prefix) {
        return { allowed: true, reason: `wildcard:${pattern}` };
      }
    }
  }
  return { allowed: false, reason: `tool '${toolId}' not in allowed_tools=${JSON.stringify(allowed)}` };
}

function violationsPath(joshRoot, dateStr) {
  const date = dateStr || new Date().toISOString().slice(0, 10);
  return path.join(joshRoot, 'audit', `violations-${date}.jsonl`);
}

function recordViolation(joshRoot, { todoId, agentId, toolId, reason }) {
  const v = {
    schema: 1,
    at: new Date().toISOString(),
    todo_id: todoId || null,
    agent_id: agentId,
    tool_id: toolId,
    reason: reason || null,
  };
  const p = violationsPath(joshRoot);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.appendFileSync(p, JSON.stringify(v) + '\n');
  // Also emit a 'failed' lifecycle event into the todo's events.ndjson if locatable.
  if (todoId) {
    const states = ['claimed', 'planning', 'awaiting_approval', 'approved', 'in_progress'];
    for (const s of states) {
      const evPath = path.join(joshRoot, 'todo', s, todoId, 'events.ndjson');
      if (fs.existsSync(evPath)) {
        try {
          fs.appendFileSync(evPath, JSON.stringify({
            kind: 'failed',
            at: v.at,
            actor: agentId,
            reason: 'tool_scope_violation',
            tool_id: toolId,
          }) + '\n');
        } catch (e) {}
        break;
      }
    }
  }
  return { recorded: p };
}

function setAllowedTools(joshRoot, agentId, list) {
  const m = readAgentManifest(joshRoot, agentId);
  if (!m) throw new Error(`agent ${agentId} not found`);
  m.allowed_tools = Array.isArray(list) ? list.slice() : [];
  writeAgentManifest(joshRoot, agentId, m);
  return m.allowed_tools;
}

function addAllowedTool(joshRoot, agentId, toolId) {
  const m = readAgentManifest(joshRoot, agentId);
  if (!m) throw new Error(`agent ${agentId} not found`);
  m.allowed_tools = Array.isArray(m.allowed_tools) ? m.allowed_tools.slice() : [];
  if (!m.allowed_tools.includes(toolId)) m.allowed_tools.push(toolId);
  writeAgentManifest(joshRoot, agentId, m);
  return m.allowed_tools;
}

function removeAllowedTool(joshRoot, agentId, toolId) {
  const m = readAgentManifest(joshRoot, agentId);
  if (!m) throw new Error(`agent ${agentId} not found`);
  m.allowed_tools = Array.isArray(m.allowed_tools) ? m.allowed_tools.filter((t) => t !== toolId) : [];
  writeAgentManifest(joshRoot, agentId, m);
  return m.allowed_tools;
}

module.exports = {
  resolveAllowedTools,
  checkScope,
  recordViolation,
  setAllowedTools,
  addAllowedTool,
  removeAllowedTool,
  violationsPath,
};
