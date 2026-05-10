const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

const JOSH_BIN = path.resolve(__dirname, '..', 'josh.js');

function runCli(args, env) {
  return execSync(`node "${JOSH_BIN}" ${args}`, {
    env: { ...process.env, ...env },
    stdio: 'pipe',
  }).toString();
}

function setupRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-cli-'));
  runCli('init', { JOSH_ROOT: root });
  return root;
}

test('cli: claim flow works against folder layout', () => {
  const root = setupRoot();
  // Push a todo via the CLI (creates folder layout in incoming/)
  const out = runCli('push todo "do a thing"', { JOSH_ROOT: root });
  // The push CLI prints the new id on the last non-empty line
  const id = out.trim().split('\n').filter(Boolean).pop().trim();

  // Tick to triage it (push goes to incoming → triaged)
  runCli('tick', { JOSH_ROOT: root });

  // Verify folder layout in triaged
  const triagedDir = path.join(root, 'todo', 'triaged', id);
  assert.equal(fs.existsSync(path.join(triagedDir, 'meta.json')), true,
    `expected ${triagedDir}/meta.json after tick`);
  assert.equal(fs.readFileSync(path.join(triagedDir, 'state'), 'utf8').trim(), 'triaged');

  // Claim — moves into in_progress (Phase 2A keeps existing claim semantics for now;
  // the new --agent + claimed state lands in Task 11.)
  runCli(`claim ${id} --as test`, { JOSH_ROOT: root });
  const ipDir = path.join(root, 'todo', 'in_progress', id);
  assert.equal(fs.existsSync(path.join(ipDir, 'meta.json')), true, 'expected meta.json in in_progress');

  fs.rmSync(root, { recursive: true, force: true });
});
