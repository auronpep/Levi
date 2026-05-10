const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

const joshBin = path.resolve(__dirname, '..', 'josh.js');

function runCli(cmd, env, opts = {}) {
  return execSync(`node "${joshBin}" ${cmd}`, {
    env, stdio: opts.stdio || 'pipe',
  }).toString();
}

function setupRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-enf-'));
  const env = { ...process.env, JOSH_ROOT: root };
  execSync(`node "${joshBin}" init`, { env, stdio: 'pipe' });

  // Seed agent A01 brief.
  const agentDir = path.join(root, 'agents', 'A01');
  fs.mkdirSync(agentDir, { recursive: true });
  const briefPath = path.join(agentDir, 'brief.md');
  fs.writeFileSync(briefPath, '# Agent A01\n');
  fs.writeFileSync(path.join(agentDir, 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A01', source_path: briefPath,
  }, null, 2));

  return { root, env };
}

function seedTodo(root, state, id, meta) {
  const dir = path.join(root, 'todo', state, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({
    schema: 1, id, primary_role: 'A01', history: [], ...meta,
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'state'), state + '\n');
  fs.writeFileSync(path.join(dir, 'events.ndjson'), '');
}

test('enforcement smoke: deps refuse → satisfy → claim succeeds', () => {
  const { root, env } = setupRoot();

  seedTodo(root, 'triaged', '01D002', {
    display_id: 'D1-002', phase: 1,
    depends_on: [], depends_on_display_ids: [],
  });
  seedTodo(root, 'triaged', '01D003', {
    display_id: 'D1-003', phase: 1,
    depends_on: [{ id: '01D002', kind: 'hard' }],
    depends_on_display_ids: ['D1-002'],
  });

  let stderrOut = '';
  try {
    runCli('claim 01D003 --agent A01 --as A01', env);
    throw new Error('expected non-zero exit');
  } catch (e) {
    assert.equal(e.status, 3);
    stderrOut = e.stderr.toString();
  }
  assert.match(stderrOut, /D1-002.*triaged/);

  fs.renameSync(
    path.join(root, 'todo', 'triaged', '01D002'),
    path.join(root, 'todo', 'done', '01D002'),
  );
  fs.writeFileSync(path.join(root, 'todo', 'done', '01D002', 'state'), 'done\n');

  const out = runCli('claim 01D003 --agent A01 --as A01', env);
  assert.match(out, /01D003/);
  assert.equal(fs.existsSync(path.join(root, 'todo', 'claimed', '01D003')), true);

  fs.rmSync(root, { recursive: true, force: true });
});

test('enforcement smoke: backpressure cap blocks new claims', () => {
  const { root, env } = setupRoot();

  fs.writeFileSync(
    path.join(root, 'orchestrator', 'backpressure.json'),
    JSON.stringify({ schema: 1, max_concurrent: 1 })
  );

  seedTodo(root, 'in_progress', '01ALPHA', { display_id: 'D1-001', phase: 1 });
  seedTodo(root, 'triaged',     '01BETA',  {
    display_id: 'D1-002', phase: 1,
    depends_on: [], depends_on_display_ids: [],
  });

  let stderrOut = '';
  try {
    runCli('claim 01BETA --as A01', env);
    throw new Error('expected non-zero exit');
  } catch (e) {
    assert.equal(e.status, 3);
    stderrOut = e.stderr.toString();
  }
  assert.match(stderrOut, /backpressure.*global/);
  assert.equal(fs.existsSync(path.join(root, 'todo', 'triaged', '01BETA')), true);

  fs.rmSync(root, { recursive: true, force: true });
});

test('enforcement smoke: failed × 3 → tick blocks via doom-loop', () => {
  const { root, env } = setupRoot();

  seedTodo(root, 'failed', '01DOOM', {
    display_id: 'D1-007', phase: 1,
    history: [
      { at: '2026-05-10T01:00:00Z', actor: 'A01', event: 'failed', details: { reason: 'r1' } },
      { at: '2026-05-10T02:00:00Z', actor: 'A01', event: 'failed', details: { reason: 'r2' } },
      { at: '2026-05-10T03:00:00Z', actor: 'A01', event: 'failed', details: { reason: 'r3' } },
    ],
  });

  const tickOut = runCli('tick', env);
  assert.match(tickOut, /doom_looped=1/);

  assert.equal(fs.existsSync(path.join(root, 'todo', 'failed', '01DOOM')), false);
  const blockedMeta = JSON.parse(fs.readFileSync(
    path.join(root, 'todo', 'blocked', '01DOOM', 'meta.json'), 'utf8'));
  assert.match(blockedMeta.blocked_reason, /doom-loop-detected:3/);

  fs.rmSync(root, { recursive: true, force: true });
});

test('enforcement smoke: heartbeat extends TTL during long-running claim', () => {
  const { root, env } = setupRoot();

  const id = '01LONG';
  const dir = path.join(root, 'todo', 'in_progress', id);
  fs.mkdirSync(dir, { recursive: true });
  const oldTs = '2026-05-10T00:00:00.000Z';
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({
    schema: 1, id, primary_role: 'A01',
    claim: { by: 'A01', at: oldTs, ttl_sec: 60 },
    history: [{ at: oldTs, actor: 'A01', event: 'claimed' }],
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'state'), 'in_progress\n');
  fs.writeFileSync(path.join(dir, 'events.ndjson'), '');

  runCli(`heartbeat ${id} --as A01`, env);

  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  assert.notEqual(meta.claim.at, oldTs);
  const last = meta.history[meta.history.length - 1];
  assert.equal(last.event, 'heartbeat');

  fs.rmSync(root, { recursive: true, force: true });
});
