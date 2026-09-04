'use strict';
// prompt-tracker is the UserPromptSubmit hook — it runs on every prompt in a
// session. CLAUDE.md's hook contract is "Always process.exit(0) cleanly even on
// error" and "Silent-fail on filesystem errors", but three payload shapes threw
// out of the stdin 'end' handler and exited 1.
//
// This hook had no test file; these are its first.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const HOOK = path.join(__dirname, '..', '..', 'hooks', 'prompt-tracker.js');

// Run the hook as a real hook would: JSON on stdin, read the exit code.
function runHook(payload, configDir) {
  const env = { ...process.env };
  if (configDir) env.CLAUDE_CONFIG_DIR = configDir;
  try {
    const stdout = execFileSync(process.execPath, [HOOK], {
      input: payload, env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status, stdout: String(e.stdout || ''), stderr: String(e.stderr || '') };
  }
}

const tmpConfig = () => fs.mkdtempSync(path.join(os.tmpdir(), 'levi-hook-'));

// 1: every payload shape exits 0 — the documented contract.
{
  const payloads = [
    ['normal prompt', '{"prompt":"hello"}'],
    ['empty stdin', ''],
    ['invalid JSON', '{ not json'],
    ['JSON null', 'null'],
    ['JSON number', '123'],
    ['JSON array', '[]'],
    ['JSON string', '"hi"'],
    ['prompt is a number', '{"prompt":123}'],
    ['prompt is an object', '{"prompt":{"a":1}}'],
    ['prompt is an array', '{"prompt":["x"]}'],
    ['prompt is null', '{"prompt":null}'],
    ['no prompt key', '{"other":"x"}'],
  ];
  for (const [label, payload] of payloads) {
    const r = runHook(payload, tmpConfig());
    assert.strictEqual(r.code, 0, `${label} should exit 0, got ${r.code}: ${r.stderr || ''}`);
  }
}

// 2: a non-string prompt produces no output rather than a crash.
{
  const r = runHook('{"prompt":123}', tmpConfig());
  assert.strictEqual(r.code, 0);
  assert.strictEqual(r.stdout, '');
}

// 3: /talk <name> writes the flag.
{
  const dir = tmpConfig();
  runHook('{"prompt":"/talk caveman"}', dir);
  assert.strictEqual(fs.readFileSync(path.join(dir, '.levi-talk'), 'utf8').trim(), 'caveman');
}

// 4: /talk off deletes the flag.
{
  const dir = tmpConfig();
  runHook('{"prompt":"/talk caveman"}', dir);
  runHook('{"prompt":"/talk off"}', dir);
  assert.strictEqual(fs.existsSync(path.join(dir, '.levi-talk')), false);
}

// 5: an unsafe mode name is not written.
{
  const dir = tmpConfig();
  runHook('{"prompt":"/talk ../escape"}', dir);
  assert.strictEqual(fs.existsSync(path.join(dir, '.levi-talk')), false);
}

// 6: bare /talk is a no-op and does not clear an active mode.
{
  const dir = tmpConfig();
  runHook('{"prompt":"/talk caveman"}', dir);
  runHook('{"prompt":"/talk"}', dir);
  assert.strictEqual(fs.readFileSync(path.join(dir, '.levi-talk'), 'utf8').trim(), 'caveman');
}

// 7: natural-language activation writes the flag.
{
  const dir = tmpConfig();
  runHook('{"prompt":"please talk like a caveman from now on"}', dir);
  assert.strictEqual(fs.readFileSync(path.join(dir, '.levi-talk'), 'utf8').trim(), 'caveman');
}

// 8: natural-language disable clears it.
{
  const dir = tmpConfig();
  runHook('{"prompt":"/talk caveman"}', dir);
  runHook('{"prompt":"talk normally please"}', dir);
  assert.strictEqual(fs.existsSync(path.join(dir, '.levi-talk')), false);
}

// 9: handlePrompt is exported and requiring the module does not wire stdin.
{
  const { handlePrompt } = require(HOOK);
  assert.strictEqual(typeof handlePrompt, 'function');
  for (const bad of [null, undefined, 123, 'str', [], { prompt: 42 }, { prompt: {} }]) {
    assert.doesNotThrow(() => handlePrompt(bad), `handlePrompt(${JSON.stringify(bad)}) threw`);
  }
}

// 10: with no active mode there is nothing to inject.
{
  const dir = tmpConfig();
  const r = runHook('{"prompt":"just a normal question"}', dir);
  assert.strictEqual(r.code, 0);
  assert.strictEqual(r.stdout, '');
}

console.log('ok — prompt-tracker: 10 groups passed');
