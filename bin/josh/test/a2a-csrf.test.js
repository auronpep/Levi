// The bridge binds to 127.0.0.1, which keeps other machines out but not the
// browser already running on this one. A CORS-"simple" cross-origin POST is sent
// without a preflight, so the side effect lands even though the attacker cannot
// read the response.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const a2a = require('../lib/a2a-bridge');

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'josh-csrf-'));
}

// Start a real server, run one fetch, shut it down.
async function withServer(fn) {
  const root = tmpRoot();
  const s = await a2a.startServer(root, { port: 0 });
  const port = s.server.address().port;
  try { return await fn(`http://127.0.0.1:${port}`, root); }
  finally { s.stop(); s.server.close(); }
}

const JSON_HEADERS = { 'content-type': 'application/json' };

test('a cross-origin simple POST is refused and registers nothing', async () => {
  await withServer(async (base, root) => {
    const r = await fetch(`${base}/agents/register`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain', origin: 'http://untrusted.example' },
      body: JSON.stringify({ id: 'planted', allowed_tools: ['*'] }),
    });
    assert.strictEqual(r.status, 403);
    assert.strictEqual(fs.existsSync(path.join(root, 'agents', 'planted')), false);
  });
});

test('an Origin header is refused even with a JSON content-type', async () => {
  await withServer(async (base, root) => {
    const r = await fetch(`${base}/agents/register`, {
      method: 'POST',
      headers: { ...JSON_HEADERS, origin: 'http://untrusted.example' },
      body: JSON.stringify({ id: 'planted' }),
    });
    assert.strictEqual(r.status, 403);
    assert.match((await r.json()).error, /Origin/);
    assert.strictEqual(fs.existsSync(path.join(root, 'agents', 'planted')), false);
  });
});

test('a text/plain POST without an Origin is still refused', async () => {
  await withServer(async (base, root) => {
    const r = await fetch(`${base}/agents/register`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({ id: 'planted' }),
    });
    assert.strictEqual(r.status, 403);
    assert.match((await r.json()).error, /application\/json/);
    assert.strictEqual(fs.existsSync(path.join(root, 'agents', 'planted')), false);
  });
});

test('a form-encoded POST is refused', async () => {
  await withServer(async (base) => {
    const r = await fetch(`${base}/agents/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'id=planted',
    });
    assert.strictEqual(r.status, 403);
  });
});

test('a legitimate JSON POST still works', async () => {
  await withServer(async (base, root) => {
    const r = await fetch(`${base}/agents/register`, {
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ id: 'claude' }),
    });
    assert.strictEqual(r.status, 200);
    assert.strictEqual((await r.json()).registered, true);
    assert.ok(fs.existsSync(path.join(root, 'agents', 'claude', 'manifest.json')));
  });
});

test('a charset parameter on the content-type is accepted', async () => {
  await withServer(async (base) => {
    const r = await fetch(`${base}/agents/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ id: 'claude' }),
    });
    assert.strictEqual(r.status, 200);
  });
});

test('GET /healthz still works without a content-type', async () => {
  await withServer(async (base) => {
    const r = await fetch(`${base}/healthz`);
    assert.strictEqual(r.status, 200);
    assert.strictEqual((await r.json()).ok, true);
  });
});

test('GET with an Origin header is refused too', async () => {
  await withServer(async (base) => {
    const r = await fetch(`${base}/healthz`, { headers: { origin: 'http://untrusted.example' } });
    assert.strictEqual(r.status, 403);
  });
});

test('hostIsLoopback: accepts loopback names and rejects rebinding hosts', () => {
  for (const h of ['127.0.0.1', '127.0.0.1:7843', 'localhost', 'localhost:7843', '[::1]:7843']) {
    assert.strictEqual(a2a.hostIsLoopback(h), true, `${h} should be accepted`);
  }
  for (const h of ['untrusted.example', 'untrusted.example:7843', '192.168.1.5', '', undefined]) {
    assert.strictEqual(a2a.hostIsLoopback(h), false, `${JSON.stringify(h)} should be rejected`);
  }
});

test('guardRequest: a rebinding Host is refused', () => {
  const refusal = a2a.guardRequest({
    method: 'POST',
    headers: { host: 'untrusted.example:7843', 'content-type': 'application/json' },
  });
  assert.match(refusal, /Host must be a loopback address/);
});

test('guardRequest: a well-formed local request passes', () => {
  assert.strictEqual(a2a.guardRequest({
    method: 'POST', headers: { host: '127.0.0.1:7843', 'content-type': 'application/json' },
  }), null);
});
