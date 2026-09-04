// `parseInt('abc', 10)` is NaN, JSON.stringify writes NaN as null, and
// backpressure's Number.isFinite guard then ignores it. A mistyped cap was
// accepted, reported as "wrote capacity", and had no effect - the machine kept
// running at the default while the operator believed it was limited.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { currentHost } = require('../lib/host');
const bp = require('../lib/backpressure');

const JOSH = path.join(__dirname, '..', 'josh.js');

function run(root, args) {
  return execFileSync(process.execPath, [JOSH, ...args], {
    env: { ...process.env, JOSH_ROOT: root }, encoding: 'utf8',
  });
}

function tryRun(root, args) {
  try { return { code: 0, stdout: run(root, args), stderr: '' }; }
  catch (e) { return { code: e.status, stdout: String(e.stdout || ''), stderr: String(e.stderr || '') }; }
}

function initRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-hc-'));
  run(root, ['init']);
  return root;
}

const capFile = (root, host = currentHost()) => path.join(root, `${host}.capacity.json`);
const capExists = (root, host) => fs.existsSync(capFile(root, host));

test('a non-numeric cap is refused and writes nothing', () => {
  const root = initRoot();
  const r = tryRun(root, ['host', 'capacity-set', '--max-concurrent', 'abc']);

  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /--max-concurrent must be a non-negative integer, got 'abc'/);
  assert.strictEqual(capExists(root), false, 'no capacity file may be written');
});

test('the cap that was refused does not silently fall back to the default', () => {
  const root = initRoot();
  tryRun(root, ['host', 'capacity-set', '--max-concurrent', 'abc']);
  // Nothing was written, so the operator can see there is no host capacity at all
  // rather than a file that looks set but is not.
  assert.strictEqual(capExists(root), false);
  assert.strictEqual(bp.readBackpressureConfig(root).max_concurrent, bp.DEFAULTS.max_concurrent);
});

test('a valid cap is written and actually applied', () => {
  const root = initRoot();
  assert.strictEqual(tryRun(root, ['host', 'capacity-set', '--max-concurrent', '3']).code, 0);

  assert.strictEqual(JSON.parse(fs.readFileSync(capFile(root), 'utf8')).max_concurrent, 3);
  assert.strictEqual(bp.readBackpressureConfig(root).max_concurrent, 3);
});

test('every numeric flag is validated', () => {
  for (const flag of ['max-concurrent', 'max-concurrent-per-phase', 'max-concurrent-per-agent']) {
    const root = initRoot();
    const r = tryRun(root, ['host', 'capacity-set', `--${flag}`, 'x']);
    assert.strictEqual(r.code, 1, `--${flag} should be validated`);
    assert.match(r.stderr, new RegExp(`--${flag} must be a non-negative integer`));
  }
});

test('a negative cap is refused', () => {
  const root = initRoot();
  const r = tryRun(root, ['host', 'capacity-set', '--max-concurrent=-5']);
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /non-negative/);
});

test('a partly-numeric value like "3x" is refused rather than truncated to 3', () => {
  const root = initRoot();
  const r = tryRun(root, ['host', 'capacity-set', '--max-concurrent', '3x']);
  assert.strictEqual(r.code, 1);
  assert.strictEqual(capExists(root), false);
});

test('zero is a real cap and is accepted', () => {
  const root = initRoot();
  assert.strictEqual(tryRun(root, ['host', 'capacity-set', '--max-concurrent', '0']).code, 0);
  assert.strictEqual(JSON.parse(fs.readFileSync(capFile(root), 'utf8')).max_concurrent, 0);
});

test('capacity-set with no flags writes nothing', () => {
  const root = initRoot();
  const r = tryRun(root, ['host', 'capacity-set']);
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /at least one of/);
  assert.strictEqual(capExists(root), false);
});

test('all three caps can be set together', () => {
  const root = initRoot();
  run(root, ['host', 'capacity-set', '--max-concurrent', '5',
    '--max-concurrent-per-phase', '3', '--max-concurrent-per-agent', '1']);

  const cfg = bp.readBackpressureConfig(root);
  assert.strictEqual(cfg.max_concurrent, 5);
  assert.strictEqual(cfg.max_concurrent_per_phase, 3);
  assert.strictEqual(cfg.max_concurrent_per_agent, 1);
});

test('--host still targets another machine', () => {
  const root = initRoot();
  run(root, ['host', 'capacity-set', '--host', 'PRAISEJESUS', '--max-concurrent', '2']);
  assert.strictEqual(capExists(root, 'PRAISEJESUS'), true);
  assert.strictEqual(JSON.parse(fs.readFileSync(capFile(root, 'PRAISEJESUS'), 'utf8')).max_concurrent, 2);
});
