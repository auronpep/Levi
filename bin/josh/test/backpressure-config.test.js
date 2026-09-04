// Every backpressure check is `count >= cap`. JS coerces rather than complains,
// so a non-numeric cap does not error - it silently changes the answer. A single
// `null` in backpressure.json made `0 >= null` true and refused every claim
// forever, reporting "global in_progress cap reached: 0/null".

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const bp = require('../lib/backpressure');

function rootWith(cfg) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-bp-'));
  fs.mkdirSync(path.join(root, 'orchestrator'), { recursive: true });
  fs.mkdirSync(path.join(root, 'todo', 'in_progress'), { recursive: true });
  if (cfg !== undefined) {
    fs.writeFileSync(
      path.join(root, 'orchestrator', 'backpressure.json'),
      typeof cfg === 'string' ? cfg : JSON.stringify(cfg),
    );
  }
  return root;
}

const TODO = { phase: 'build', primary_role: 'claude' };

function inProgress(root, n, meta = {}) {
  for (let i = 0; i < n; i++) {
    const d = path.join(root, 'todo', 'in_progress', `T${i}`);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'meta.json'), JSON.stringify({ id: `T${i}`, ...meta }));
  }
}

test('a null cap no longer deadlocks the queue', () => {
  const root = rootWith({ max_concurrent: null });
  assert.strictEqual(bp.readBackpressureConfig(root).max_concurrent, bp.DEFAULTS.max_concurrent);
  assert.strictEqual(bp.checkBackpressure(root, TODO).ok, true, 'an empty queue must accept work');
});

test('non-numeric caps of every shape fall back to the default', () => {
  for (const bad of [null, '50', true, [], {}, undefined, NaN]) {
    const root = rootWith({ max_concurrent: bad });
    assert.strictEqual(
      bp.readBackpressureConfig(root).max_concurrent,
      bp.DEFAULTS.max_concurrent,
      `${JSON.stringify(bad)} should not become a cap`,
    );
  }
});

test('a negative cap is rejected rather than blocking everything', () => {
  const root = rootWith({ max_concurrent: -1 });
  assert.strictEqual(bp.readBackpressureConfig(root).max_concurrent, bp.DEFAULTS.max_concurrent);
  assert.strictEqual(bp.checkBackpressure(root, TODO).ok, true);
});

test('a valid numeric cap is still honoured', () => {
  const root = rootWith({ max_concurrent: 50 });
  assert.strictEqual(bp.readBackpressureConfig(root).max_concurrent, 50);
});

test('zero is a real cap and still stops work', () => {
  const root = rootWith({ max_concurrent: 0 });
  assert.strictEqual(bp.readBackpressureConfig(root).max_concurrent, 0);
  const r = bp.checkBackpressure(root, TODO);
  assert.strictEqual(r.ok, false, 'an explicit 0 is a deliberate halt, not a mistake');
  assert.strictEqual(r.scope, 'global');
});

test('all three caps are validated independently', () => {
  const root = rootWith({ max_concurrent: 50, max_concurrent_per_phase: null, max_concurrent_per_agent: 7 });
  const cfg = bp.readBackpressureConfig(root);
  assert.strictEqual(cfg.max_concurrent, 50);
  assert.strictEqual(cfg.max_concurrent_per_phase, bp.DEFAULTS.max_concurrent_per_phase);
  assert.strictEqual(cfg.max_concurrent_per_agent, 7);
});

test('an unknown key cannot masquerade as a cap', () => {
  const root = rootWith({ max_concurrency: 50 });
  const cfg = bp.readBackpressureConfig(root);
  assert.strictEqual(cfg.max_concurrent, bp.DEFAULTS.max_concurrent);
  assert.strictEqual(cfg.max_concurrency, undefined, 'junk keys do not ride along in the config');
});

test('a config that is not an object is ignored', () => {
  for (const body of ['[]', '"nope"', '42', 'null']) {
    const root = rootWith(body);
    assert.deepStrictEqual(bp.readBackpressureConfig(root), { ...bp.DEFAULTS });
  }
});

test('unparseable JSON still falls back to defaults', () => {
  const root = rootWith('{ not json');
  assert.deepStrictEqual(bp.readBackpressureConfig(root), { ...bp.DEFAULTS });
});

test('no config file at all yields the defaults', () => {
  assert.deepStrictEqual(bp.readBackpressureConfig(rootWith(undefined)), { ...bp.DEFAULTS });
});

test('the global cap still trips when it is genuinely reached', () => {
  const root = rootWith({ max_concurrent: 2 });
  inProgress(root, 2);
  const r = bp.checkBackpressure(root, TODO);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.scope, 'global');
  assert.strictEqual(r.current, 2);
  assert.strictEqual(r.max, 2);
});

test('the per-agent cap still trips independently of the global one', () => {
  const root = rootWith({ max_concurrent: 100, max_concurrent_per_agent: 1 });
  inProgress(root, 1, { primary_role: 'claude', phase: 'build' });
  const r = bp.checkBackpressure(root, TODO);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.scope, 'agent');
});

test('a host capacity file still overrides the config file', () => {
  const root = rootWith({ max_concurrent: 50 });
  const { writeCapacity, currentHost } = require('../lib/host');
  fs.writeFileSync(path.join(root, `${currentHost()}.capacity.json`), JSON.stringify({ schema: 1, max_concurrent: 3 }));
  assert.strictEqual(bp.readBackpressureConfig(root).max_concurrent, 3);
});

test('an invalid host capacity does not override a valid config file', () => {
  const root = rootWith({ max_concurrent: 50 });
  const { currentHost } = require('../lib/host');
  fs.writeFileSync(path.join(root, `${currentHost()}.capacity.json`), JSON.stringify({ schema: 1, max_concurrent: null }));
  assert.strictEqual(bp.readBackpressureConfig(root).max_concurrent, 50);
});
