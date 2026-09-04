// `.stignore` is a file the operator also edits - it is the only place to exclude
// a local cache or large media from syncing across the fleet. `writeStignore`
// rewrote the whole file, so `josh sync stignore` silently dropped those lines
// and whatever had been excluded started replicating to every other machine.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const st = require('../lib/stignore');

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'josh-sti-'));
}

const OPERATOR = '# local only - do not sync\nbig-cache/\n*.mp4\n';

test('operator patterns survive a regeneration', () => {
  const root = tmpRoot();
  st.writeStignore(root);
  fs.appendFileSync(st.stignorePath(root), `\n${OPERATOR}`);

  st.writeStignore(root);

  const text = st.readStignore(root);
  assert.ok(text.includes('big-cache/'), 'operator directory exclusion must survive');
  assert.ok(text.includes('*.mp4'), 'operator glob must survive');
  assert.ok(text.includes('# local only - do not sync'), 'their comment survives too');
});

test('operator patterns survive repeated regeneration', () => {
  const root = tmpRoot();
  st.writeStignore(root);
  fs.appendFileSync(st.stignorePath(root), `\n${OPERATOR}`);
  for (let i = 0; i < 5; i++) st.writeStignore(root);

  const text = st.readStignore(root);
  assert.strictEqual(text.match(/big-cache\//g).length, 1, 'kept exactly once, not duplicated');
});

test('the managed patterns are all present', () => {
  const root = tmpRoot();
  st.writeStignore(root);
  const text = st.readStignore(root);
  for (const p of st.STIGNORE_PATTERNS) {
    assert.ok(text.includes(p), `managed pattern missing: ${p}`);
  }
});

test('the managed block is not duplicated across writes', () => {
  const root = tmpRoot();
  st.writeStignore(root);
  st.writeStignore(root);
  const text = st.readStignore(root);
  assert.strictEqual(text.split(st.BEGIN_MARKER).length - 1, 1);
  assert.strictEqual(text.match(/\*\.capacity\.json/g).length, 1);
});

test('a pre-existing file with no markers keeps its contents', () => {
  const root = tmpRoot();
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(st.stignorePath(root), 'legacy-pattern/\n');

  st.writeStignore(root);

  const text = st.readStignore(root);
  assert.ok(text.includes('legacy-pattern/'), 'a file written before markers existed is not discarded');
  assert.ok(text.includes('*.capacity.json'), 'and the managed patterns are added');
});

test('an updated managed list replaces the old block, not the operator lines', () => {
  const root = tmpRoot();
  st.writeStignore(root);
  // Simulate a stale managed block by editing inside it.
  const p = st.stignorePath(root);
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('locks/', 'stale-entry/'));
  fs.appendFileSync(p, `\n${OPERATOR}`);

  st.writeStignore(root);

  const text = st.readStignore(root);
  assert.ok(!text.includes('stale-entry/'), 'the stale managed entry is replaced');
  assert.ok(text.includes('locks/'), 'the current managed entry is restored');
  assert.ok(text.includes('big-cache/'), 'the operator lines are untouched');
});

test('the file ends with a newline', () => {
  const root = tmpRoot();
  st.writeStignore(root);
  assert.ok(st.readStignore(root).endsWith('\n'));
});

test('readStignore still returns null when there is no file', () => {
  assert.strictEqual(st.readStignore(tmpRoot()), null);
});

test('writeStignore returns the path it wrote', () => {
  const root = tmpRoot();
  assert.strictEqual(st.writeStignore(root), st.stignorePath(root));
});
