'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { listServers } = require('./mcp-registry');

const A2A_VERSION = '1.0.0';
const STOP_FLAG = (joshRoot) => path.join(joshRoot, 'a2a', '.stop');

function readJson(p) {
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

function writeJsonAtomic(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  fs.renameSync(tmp, p);
}

function findTodoFolder(joshRoot, todoId) {
  const states = [
    'incoming', 'triaged', 'claimed', 'planning', 'awaiting_approval',
    'approved', 'in_progress', 'done', 'blocked', 'failed', 'cancelled',
    'rejected', 'revised',
  ];
  for (const s of states) {
    const p = path.join(joshRoot, 'todo', s, todoId);
    if (fs.existsSync(p)) return { state: s, folder: p };
  }
  return null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (!raw) return resolve({});
        resolve(JSON.parse(raw));
      } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(obj));
}

function makeApp(joshRoot) {
  return async function app(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const route = `${req.method} ${url.pathname}`;
    try {
      if (route === 'GET /healthz') {
        return sendJson(res, 200, { ok: true, version: A2A_VERSION, mcp_servers: listServers(joshRoot).length });
      }
      if (route === 'POST /agents/register') {
        const body = await readBody(req);
        if (!body || !body.id) return sendJson(res, 400, { error: 'id required' });
        const dir = path.join(joshRoot, 'agents', body.id);
        fs.mkdirSync(dir, { recursive: true });
        let manifest = readJson(path.join(dir, 'manifest.json')) || { schema: 1, id: body.id };
        manifest.id = body.id;
        if (body.did) manifest.did = body.did;
        if (Array.isArray(body.allowed_tools)) manifest.allowed_tools = body.allowed_tools.slice();
        if (body.source_path) manifest.source_path = body.source_path;
        if (body.pubkey_jwk) {
          fs.writeFileSync(path.join(dir, 'pubkey.jwk'), JSON.stringify(body.pubkey_jwk, null, 2));
          manifest.pubkey_path = 'pubkey.jwk';
        }
        writeJsonAtomic(path.join(dir, 'manifest.json'), manifest);
        return sendJson(res, 200, { id: body.id, registered: true, did: manifest.did || null });
      }
      if (route === 'POST /tasks/sendSubscribe') {
        const body = await readBody(req);
        const { todo_id, agent_id } = body;
        if (!todo_id || !agent_id) return sendJson(res, 400, { error: 'todo_id and agent_id required' });
        const located = findTodoFolder(joshRoot, todo_id);
        if (!located) return sendJson(res, 404, { error: `todo ${todo_id} not found` });
        if (located.state !== 'triaged') return sendJson(res, 409, { error: `todo ${todo_id} is in state '${located.state}', expected 'triaged'` });
        // Atomic move triaged → claimed (mirror cmdClaim --agent without dep/backpressure for now).
        const dst = path.join(joshRoot, 'todo', 'claimed', todo_id);
        if (fs.existsSync(dst)) return sendJson(res, 409, { error: 'destination exists (race?)' });
        try {
          fs.mkdirSync(path.dirname(dst), { recursive: true });
          fs.renameSync(located.folder, dst);
        } catch (e) {
          return sendJson(res, 500, { error: `rename failed: ${e.message}` });
        }
        try { fs.writeFileSync(path.join(dst, 'state'), 'claimed\n'); } catch (e) {}
        // Update meta + write runtime.json (mirror josh claim --agent).
        const metaPath = path.join(dst, 'meta.json');
        const meta = readJson(metaPath) || { id: todo_id };
        const now = new Date().toISOString();
        meta.claim = { by: 'a2a:' + agent_id, at: now, ttl_sec: 3600, agent_id };
        meta.history = meta.history || [];
        meta.history.push({ at: now, actor: 'a2a:' + agent_id, event: 'claimed', details: { via: 'a2a' } });
        writeJsonAtomic(metaPath, meta);
        // runtime.json with allowed_tools from agent manifest (Phase 8 tool scoping).
        const { resolveAllowedTools } = require('./tool-scoping');
        const allowed = resolveAllowedTools(joshRoot, agent_id);
        const runtime = {
          schema: 1, harness: 'a2a', session_id: null,
          claimed_by: agent_id, actor: 'a2a:' + agent_id, started_at: now,
          allowed_tools: allowed,
        };
        writeJsonAtomic(path.join(dst, 'runtime.json'), runtime);
        return sendJson(res, 200, { todo_id, state: 'claimed', allowed_tools: allowed });
      }
      const taskMatch = url.pathname.match(/^\/tasks\/([A-Z0-9_-]+)$/);
      if (req.method === 'GET' && taskMatch) {
        const located = findTodoFolder(joshRoot, taskMatch[1]);
        if (!located) return sendJson(res, 404, { error: 'not found' });
        const meta = readJson(path.join(located.folder, 'meta.json'));
        return sendJson(res, 200, { todo_id: taskMatch[1], state: located.state, meta });
      }
      sendJson(res, 404, { error: 'not found' });
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
  };
}

function startServer(joshRoot, opts = {}) {
  const port = opts.port || parseInt(process.env.JOSH_A2A_PORT || '7843', 10);
  const host = opts.host || '127.0.0.1';
  // Clean stale stop flag.
  try { fs.unlinkSync(STOP_FLAG(joshRoot)); } catch (e) {}

  const server = http.createServer(makeApp(joshRoot));
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      // Stop-flag poller.
      const interval = setInterval(() => {
        if (fs.existsSync(STOP_FLAG(joshRoot))) {
          clearInterval(interval);
          server.close(() => {
            try { fs.unlinkSync(STOP_FLAG(joshRoot)); } catch (e) {}
          });
        }
      }, opts.pollMs || 250);
      // Don't keep the Node event loop alive solely on this poll timer.
      if (typeof interval.unref === 'function') interval.unref();
      // Also unref the server so test cleanup (server.close) is sufficient to exit.
      const stop = () => { clearInterval(interval); };
      resolve({ server, port, host, stopWatcher: interval, stop });
    });
  });
}

function requestStop(joshRoot) {
  fs.mkdirSync(path.dirname(STOP_FLAG(joshRoot)), { recursive: true });
  fs.writeFileSync(STOP_FLAG(joshRoot), new Date().toISOString());
}

module.exports = { A2A_VERSION, makeApp, startServer, requestStop, STOP_FLAG };
