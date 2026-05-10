const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { loadBrief } = require('../lib/agent-brief');

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'josh-brief-'));
}

test('loadBrief: returns path + contents from manifest source_path', () => {
  const root = tmpRoot();
  const briefSource = path.join(root, 'AGENT_07.md');
  fs.writeFileSync(briefSource, '# Agent A07 - Demo\n\nMission: testing.\n');
  fs.mkdirSync(path.join(root, 'agents', 'A07'), { recursive: true });
  fs.writeFileSync(path.join(root, 'agents', 'A07', 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A07', source_path: briefSource,
  }));
  const r = loadBrief(root, 'A07');
  assert.equal(r.path, briefSource);
  assert.match(r.contents, /Mission: testing/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('loadBrief: throws when manifest missing', () => {
  const root = tmpRoot();
  assert.throws(() => loadBrief(root, 'A99'), /manifest not found/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('loadBrief: throws when source file missing', () => {
  const root = tmpRoot();
  fs.mkdirSync(path.join(root, 'agents', 'A06'), { recursive: true });
  fs.writeFileSync(path.join(root, 'agents', 'A06', 'manifest.json'), JSON.stringify({
    schema: 1, id: 'A06', source_path: path.join(root, 'does-not-exist.md'),
  }));
  assert.throws(() => loadBrief(root, 'A06'), /source brief not found/);
  fs.rmSync(root, { recursive: true, force: true });
});
