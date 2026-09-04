#!/usr/bin/env node
'use strict';
// Runs every test suite in the repo and fails if any of them fails.
//
// There are two, written in different styles:
//
//   bin/josh/test/**       node:test files, run by `node --test`
//   tests/**               plain scripts that throw on failure and print `ok`
//
// Only the first had a runner (`bin/josh/package.json`), and the second was
// referenced solely in a design document. Nothing executed it, which is how two
// of its four files came to be failing on main without anyone noticing.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `\n      ${detail}`}\n`);
}

// --- suite 1: bin/josh (node:test) ------------------------------------------
function runJoshSuite() {
  const cwd = path.join(ROOT, 'bin', 'josh');
  if (!fs.existsSync(path.join(cwd, 'test'))) return;
  const r = spawnSync(process.execPath, ['--test'], { cwd, encoding: 'utf8' });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const pass = (out.match(/(?:^|\n).\s*pass (\d+)/) || [])[1];
  const fail = (out.match(/(?:^|\n).\s*fail (\d+)/) || [])[1];
  record(
    `bin/josh/test  (${pass || '?'} pass, ${fail || '?'} fail)`,
    r.status === 0,
    r.status === 0 ? null : out.split('\n').filter((l) => /^not ok|✖/.test(l)).slice(0, 5).join('\n      '),
  );
}

// --- suite 2: tests/** (plain scripts) --------------------------------------
function listScripts(dir) {
  const out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'fixtures' || e.name === 'node_modules') continue;
      out.push(...listScripts(full));
    } else if (e.isFile() && e.name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

function runRootScripts() {
  for (const file of listScripts(path.join(ROOT, 'tests')).sort()) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const r = spawnSync(process.execPath, [file], { cwd: ROOT, encoding: 'utf8' });
    const err = `${r.stderr || ''}`.split('\n').find((l) => /Error|Assertion/.test(l));
    record(rel, r.status === 0, err || `exit ${r.status}`);
  }
}

runJoshSuite();
runRootScripts();

const failed = results.filter((r) => !r.ok);
process.stdout.write(`\n${results.length - failed.length}/${results.length} suites passed\n`);
if (failed.length > 0) {
  process.stdout.write(`failed: ${failed.map((f) => f.name).join(', ')}\n`);
  process.exit(1);
}
