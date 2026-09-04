// `source_path` was handed straight to fs, so a relative value resolved against
// process.cwd(). The same agent manifest then produced different brief contents
// and a different integrity hash depending on where the command was run - and
// `spec approve` wrote the evolved brief to whatever sat at that relative path
// in the current directory.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadBrief, resolveSourcePath } = require('../lib/agent-brief');
const { agentBriefHash } = require('../lib/identity');

const ORIGINAL_CWD = process.cwd();
test.after(() => process.chdir(ORIGINAL_CWD));

function rootWithAgent(sourcePath) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-src-'));
  const dir = path.join(root, 'agents', 'A01');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ schema: 1, id: 'A01', source_path: sourcePath }));
  return root;
}

function decoyCwd(body) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-cwd-'));
  fs.writeFileSync(path.join(d, 'BRIEF.md'), body);
  return d;
}

test('a relative source_path resolves against JOSH_ROOT, not the cwd', () => {
  const root = rootWithAgent('BRIEF.md');
  fs.writeFileSync(path.join(root, 'BRIEF.md'), 'MISSION: the real one');

  process.chdir(decoyCwd('MISSION: a decoy in the working directory'));
  assert.strictEqual(loadBrief(root, 'A01').contents, 'MISSION: the real one');
});

test('the brief is the same from any working directory', () => {
  const root = rootWithAgent('BRIEF.md');
  fs.writeFileSync(path.join(root, 'BRIEF.md'), 'MISSION: stable');

  const seen = new Set();
  for (const body of ['decoy one', 'decoy two']) {
    process.chdir(decoyCwd(body));
    seen.add(loadBrief(root, 'A01').contents);
  }
  process.chdir(os.tmpdir());
  seen.add(loadBrief(root, 'A01').contents);

  assert.deepStrictEqual([...seen], ['MISSION: stable'], 'one manifest, one answer');
});

test('the integrity hash no longer depends on the working directory', () => {
  const root = rootWithAgent('BRIEF.md');
  fs.writeFileSync(path.join(root, 'BRIEF.md'), 'MISSION: stable');

  const hashes = new Set();
  for (const body of ['decoy one', 'decoy two']) {
    process.chdir(decoyCwd(body));
    hashes.add(agentBriefHash(root, 'A01'));
  }
  assert.strictEqual(hashes.size, 1, 'a hash that moves with the cwd is not an integrity hash');
});

test('a relative source_path no longer reports "not found" from an unrelated cwd', () => {
  const root = rootWithAgent('BRIEF.md');
  fs.writeFileSync(path.join(root, 'BRIEF.md'), 'MISSION: present');

  process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), 'josh-empty-')));
  assert.strictEqual(loadBrief(root, 'A01').contents, 'MISSION: present');
});

test('an absolute source_path is used exactly as given', () => {
  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-abs-'));
  const brief = path.join(elsewhere, 'A01.md');
  fs.writeFileSync(brief, 'MISSION: absolute');
  const root = rootWithAgent(brief);

  process.chdir(decoyCwd('decoy'));
  const r = loadBrief(root, 'A01');
  assert.strictEqual(r.contents, 'MISSION: absolute');
  assert.strictEqual(r.path, brief);
});

test('loadBrief reports the resolved path, not the raw manifest value', () => {
  const root = rootWithAgent('BRIEF.md');
  fs.writeFileSync(path.join(root, 'BRIEF.md'), 'x');
  assert.strictEqual(loadBrief(root, 'A01').path, path.resolve(root, 'BRIEF.md'));
});

test('a nested relative source_path resolves under JOSH_ROOT', () => {
  const root = rootWithAgent(path.join('agents', 'A01', 'brief.md'));
  fs.writeFileSync(path.join(root, 'agents', 'A01', 'brief.md'), 'MISSION: nested');
  process.chdir(os.tmpdir());
  assert.strictEqual(loadBrief(root, 'A01').contents, 'MISSION: nested');
});

test('a genuinely missing brief still errors', () => {
  const root = rootWithAgent('NOPE.md');
  assert.throws(() => loadBrief(root, 'A01'), /source brief not found/);
});

test('an unset source_path still errors', () => {
  const root = rootWithAgent(undefined);
  assert.throws(() => loadBrief(root, 'A01'), /source brief not found/);
  assert.throws(() => agentBriefHash(root, 'A01'), /no source_path/);
});

test('resolveSourcePath: absolute passes through, relative anchors, empty is null', () => {
  const abs = path.join(os.tmpdir(), 'x.md');
  assert.strictEqual(resolveSourcePath('/root', abs), abs);
  assert.strictEqual(resolveSourcePath(path.sep + 'root', 'a.md'), path.resolve(path.sep + 'root', 'a.md'));
  assert.strictEqual(resolveSourcePath('/root', ''), null);
  assert.strictEqual(resolveSourcePath('/root', undefined), null);
});
