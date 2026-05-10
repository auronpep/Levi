const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { execSync } = require('node:child_process');
const { startServer } = require('../lib/a2a-bridge');

const joshBin = path.resolve(__dirname, '..', 'josh.js');
function run(cmd, env, opts = {}) {
  return execSync(`node "${joshBin}" ${cmd}`, { env, stdio: opts.stdio || 'pipe' }).toString();
}

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-x-'));
  const env = { ...process.env, JOSH_ROOT: root };
  execSync(`node "${joshBin}" init`, { env, stdio: 'pipe' });

  // Seed agent A03 with a brief.
  const dir = path.join(root, 'agents', 'A03');
  fs.mkdirSync(dir, { recursive: true });
  const briefPath = path.join(dir, 'brief.md');
  fs.writeFileSync(briefPath, '# A03\n');
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A03', source_path: briefPath, version: 1,
  }, null, 2));
  return { root, env };
}

function httpJson(method, port, path_, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = http.request({
      method, host: '127.0.0.1', port, path: path_,
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) },
    }, (res) => {
      let chunks = '';
      res.on('data', (c) => { chunks += c; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = chunks ? JSON.parse(chunks) : null; } catch (e) {}
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

test('cross-runtime: tool register + scope-add + claim writes allowed_tools to runtime.json', () => {
  const { root, env } = setup();
  run('tool register --id mcp:duckdb --command duckdb-mcp --cap query,export', env);
  run('tool scope-add A03 fs:read', env);
  run('tool scope-add A03 mcp:duckdb', env);

  // Seed triaged todo for A03.
  const todoId = '01XTRTODO0000000000000000';
  const todoDir = path.join(root, 'todo', 'triaged', todoId);
  fs.mkdirSync(todoDir, { recursive: true });
  fs.writeFileSync(path.join(todoDir, 'meta.json'), JSON.stringify({
    schema: 1, id: todoId, primary_role: 'A03', history: [],
  }));
  fs.writeFileSync(path.join(todoDir, 'state'), 'triaged\n');
  fs.writeFileSync(path.join(todoDir, 'events.ndjson'), '');

  run(`claim ${todoId} --agent A03 --as A03`, env);
  const runtime = JSON.parse(fs.readFileSync(path.join(root, 'todo', 'claimed', todoId, 'runtime.json'), 'utf8'));
  assert.deepEqual(runtime.allowed_tools.sort(), ['fs:read', 'mcp:duckdb']);

  fs.rmSync(root, { recursive: true, force: true });
});

test('cross-runtime: tool violation log writes audit + emits failed event', () => {
  const { root, env } = setup();
  run('tool scope-add A03 fs:read', env);
  // Seed an in_progress todo.
  const todoId = '01XTRVTODO000000000000000';
  const todoDir = path.join(root, 'todo', 'in_progress', todoId);
  fs.mkdirSync(todoDir, { recursive: true });
  fs.writeFileSync(path.join(todoDir, 'meta.json'), JSON.stringify({ schema: 1, id: todoId, history: [] }));
  fs.writeFileSync(path.join(todoDir, 'state'), 'in_progress\n');
  fs.writeFileSync(path.join(todoDir, 'events.ndjson'), '');

  run(`tool violation log --todo ${todoId} --agent A03 --tool mcp:slack --reason "out_of_scope"`, env);

  const today = new Date().toISOString().slice(0, 10);
  const violations = fs.readFileSync(path.join(root, 'audit', `violations-${today}.jsonl`), 'utf8');
  const lastLine = violations.trim().split('\n').pop();
  const v = JSON.parse(lastLine);
  assert.equal(v.agent_id, 'A03');
  assert.equal(v.tool_id, 'mcp:slack');

  const events = fs.readFileSync(path.join(todoDir, 'events.ndjson'), 'utf8').trim().split('\n').map(JSON.parse);
  const failed = events.find((e) => e.kind === 'failed' && e.reason === 'tool_scope_violation');
  assert.ok(failed, `expected failed event in events.ndjson, got: ${JSON.stringify(events)}`);

  fs.rmSync(root, { recursive: true, force: true });
});

test('cross-runtime: A2A bridge healthz + register agent + claim via HTTP', async () => {
  const { root, env } = setup();
  // Pick a high random port to avoid collisions across parallel test runs.
  const port = 17800 + Math.floor(Math.random() * 1000);
  const { server, port: actualPort, stop } = await startServer(root, { port, pollMs: 500 });

  try {
    // Health.
    const h = await httpJson('GET', actualPort, '/healthz');
    assert.equal(h.status, 200);
    assert.equal(h.body.ok, true);

    // Register a NEW agent A99 over HTTP.
    const briefPath = path.join(root, 'agents', 'A99-brief.md');
    fs.writeFileSync(briefPath, '# A99\n');
    const reg = await httpJson('POST', actualPort, '/agents/register', {
      id: 'A99', did: 'did:key:z-fake', allowed_tools: ['fs:read'], source_path: briefPath,
    });
    assert.equal(reg.status, 200);
    assert.equal(reg.body.id, 'A99');
    const m = JSON.parse(fs.readFileSync(path.join(root, 'agents', 'A99', 'manifest.json'), 'utf8'));
    assert.deepEqual(m.allowed_tools, ['fs:read']);

    // Seed a todo and claim via HTTP.
    const todoId = '01XAA2ATODO000000000000000';
    const todoDir = path.join(root, 'todo', 'triaged', todoId);
    fs.mkdirSync(todoDir, { recursive: true });
    fs.writeFileSync(path.join(todoDir, 'meta.json'), JSON.stringify({
      schema: 1, id: todoId, primary_role: 'A99', history: [],
    }));
    fs.writeFileSync(path.join(todoDir, 'state'), 'triaged\n');
    fs.writeFileSync(path.join(todoDir, 'events.ndjson'), '');

    const c = await httpJson('POST', actualPort, '/tasks/sendSubscribe', { todo_id: todoId, agent_id: 'A99' });
    assert.equal(c.status, 200, `expected 200, got ${c.status}: ${JSON.stringify(c.body)}`);
    assert.equal(c.body.state, 'claimed');
    assert.deepEqual(c.body.allowed_tools, ['fs:read']);

    // Status via GET /tasks/<id>
    const s = await httpJson('GET', actualPort, `/tasks/${todoId}`);
    assert.equal(s.status, 200);
    assert.equal(s.body.state, 'claimed');
  } finally {
    if (stop) stop();
    await new Promise((res) => server.close(res));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('cross-runtime: tool list shows registered MCP servers', () => {
  const { root, env } = setup();
  run('tool register --id mcp:duckdb --cap query', env);
  run('tool register --id mcp:browser --cap navigate,fill', env);
  const out = run('tool list', env);
  assert.match(out, /mcp:duckdb/);
  assert.match(out, /mcp:browser/);
  fs.rmSync(root, { recursive: true, force: true });
});
