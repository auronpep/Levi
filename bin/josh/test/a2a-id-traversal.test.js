// Ids arriving over the A2A HTTP bridge become path segments under JOSH_ROOT.
// `path.join` resolves `..` instead of rejecting it, so before the fix
// `POST /agents/register` with an id of `../../x` returned 200 and created a
// directory - with a manifest.json and an attacker-supplied pubkey.jwk in it -
// outside the josh root entirely.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const a2a = require('../lib/a2a-bridge');

function tmpRoot() {
  // Nested one level down so `..` inside the test has somewhere to land that is
  // still under the OS temp dir and gets cleaned up.
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-a2a-'));
  const root = path.join(base, 'root');
  fs.mkdirSync(root, { recursive: true });
  return { base, root };
}

// Drive the request handler directly - no socket, no port, no teardown.
function call(root, method, url, body) {
  return new Promise((resolve, reject) => {
    const app = a2a.makeApp(root);
    const req = new http.IncomingMessage(null);
    req.method = method;
    req.url = url;
    req.headers = { host: '127.0.0.1' };

    const chunks = [];
    const res = {
      statusCode: 0,
      setHeader() {},
      end(chunk) {
        if (chunk) chunks.push(Buffer.from(chunk));
        let parsed = null;
        try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { /* non-JSON */ }
        resolve({ status: res.statusCode, body: parsed });
      },
    };

    Promise.resolve(app(req, res)).catch(reject);
    if (body !== undefined) req.push(typeof body === 'string' ? body : JSON.stringify(body));
    req.push(null);
  });
}

test('isSafeId: accepts the ids this system actually uses', () => {
  for (const id of ['claude', 'codex', 'orchestrator', '01HX0000000000000000000A', 'agent_1', 'agent-1', 'A']) {
    assert.strictEqual(a2a.isSafeId(id), true, `${id} should be accepted`);
  }
});

test('isSafeId: rejects anything that could leave its directory', () => {
  const hostile = [
    '..', '../x', '../../x', 'a/b', 'a\\b', '/abs', 'C:\\Windows',
    'a.b', '.', '', 'a\0b', 'x'.repeat(65),
  ];
  for (const id of hostile) {
    assert.strictEqual(a2a.isSafeId(id), false, `${JSON.stringify(id)} should be rejected`);
  }
});

test('isSafeId: rejects non-strings rather than coercing them', () => {
  for (const v of [null, undefined, 42, {}, [], ['ok']]) {
    assert.strictEqual(a2a.isSafeId(v), false);
  }
});

test('register: a traversing id is refused and writes nothing outside the root', async () => {
  const { base, root } = tmpRoot();
  const escaped = path.join(base, 'ESCAPED');

  const r = await call(root, 'POST', '/agents/register', { id: '../ESCAPED', did: 'did:web:untrusted.example' });

  assert.strictEqual(r.status, 400);
  assert.match(r.body.error, /id must match/);
  assert.strictEqual(fs.existsSync(escaped), false, 'nothing may be created outside JOSH_ROOT');
});

test('register: a traversing id cannot plant a pubkey either', async () => {
  const { base, root } = tmpRoot();

  await call(root, 'POST', '/agents/register', { id: '../ESCAPED', pubkey_jwk: { kty: 'OKP' } });

  assert.strictEqual(fs.existsSync(path.join(base, 'ESCAPED', 'pubkey.jwk')), false);
});

test('register: an absolute id is refused', async () => {
  const { root } = tmpRoot();
  const r = await call(root, 'POST', '/agents/register', { id: path.join(os.tmpdir(), 'josh-abs-escape') });
  assert.strictEqual(r.status, 400);
  assert.strictEqual(fs.existsSync(path.join(os.tmpdir(), 'josh-abs-escape')), false);
});

test('register: an ordinary id still registers, under the root', async () => {
  const { root } = tmpRoot();

  const r = await call(root, 'POST', '/agents/register', { id: 'claude', did: 'did:web:alice.example' });

  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.registered, true);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'agents', 'claude', 'manifest.json'), 'utf8'));
  assert.strictEqual(manifest.id, 'claude');
  assert.strictEqual(manifest.did, 'did:web:alice.example');
});

test('register: a missing id is still a 400, as before', async () => {
  const { root } = tmpRoot();
  const r = await call(root, 'POST', '/agents/register', {});
  assert.strictEqual(r.status, 400);
  assert.match(r.body.error, /id required/);
});

test('sendSubscribe: a traversing todo_id is refused before any lookup', async () => {
  const { root } = tmpRoot();
  const r = await call(root, 'POST', '/tasks/sendSubscribe', { todo_id: '../../etc', agent_id: 'claude' });
  assert.strictEqual(r.status, 400);
  assert.match(r.body.error, /todo_id must match/);
});

test('sendSubscribe: a traversing agent_id is refused', async () => {
  const { root } = tmpRoot();
  const r = await call(root, 'POST', '/tasks/sendSubscribe', { todo_id: '01HX0000000000000000000A', agent_id: '../x' });
  assert.strictEqual(r.status, 400);
  assert.match(r.body.error, /agent_id must match/);
});

test('sendSubscribe: a well-formed but unknown todo still reports 404, not 400', async () => {
  const { root } = tmpRoot();
  const r = await call(root, 'POST', '/tasks/sendSubscribe', { todo_id: '01HXNOTHERE0000000000000', agent_id: 'claude' });
  assert.strictEqual(r.status, 404);
});
