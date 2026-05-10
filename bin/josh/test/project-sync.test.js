const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { importProject } = require('../lib/project-importer');
const { diffProject, applySync } = require('../lib/project-sync');

function setupFixture() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-sync-'));
  fs.mkdirSync(path.join(tmpRoot, 'projects'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'agents'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'todo', 'triaged'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'audit'), { recursive: true });

  const corpus = path.join(tmpRoot, 'corpus');
  fs.cpSync(path.join(__dirname, 'fixtures/corpus'), corpus, { recursive: true });
  return { tmpRoot, corpus };
}

test('diffProject: returns empty changes when nothing changed', () => {
  const { tmpRoot, corpus } = setupFixture();
  const { project_id } = importProject(corpus, { joshRoot: tmpRoot, actor: 'cli:test' });
  const diff = diffProject(project_id, { joshRoot: tmpRoot });
  assert.equal(diff.agents_changed.length, 0);
  assert.equal(diff.tasks_changed.length, 0);
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test('diffProject: detects changed agent file', () => {
  const { tmpRoot, corpus } = setupFixture();
  const { project_id } = importProject(corpus, { joshRoot: tmpRoot, actor: 'cli:test' });
  const a01Source = path.join(corpus, 'agent_orchestration/agents/AGENT_01_COMMAND_CENTER.md');
  fs.appendFileSync(a01Source, '\n## New Section\n\nAdded line.');
  const diff = diffProject(project_id, { joshRoot: tmpRoot });
  assert.equal(diff.agents_changed.length, 1);
  assert.equal(diff.agents_changed[0].id, 'A01');
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test('applySync: updates manifest hash after change', () => {
  const { tmpRoot, corpus } = setupFixture();
  const { project_id } = importProject(corpus, { joshRoot: tmpRoot, actor: 'cli:test' });
  const a01Source = path.join(corpus, 'agent_orchestration/agents/AGENT_01_COMMAND_CENTER.md');
  fs.appendFileSync(a01Source, '\n## New Section\n\nAdded line.');
  const result = applySync(project_id, { joshRoot: tmpRoot, actor: 'cli:test' });
  assert.equal(result.agents_updated, 1);
  const manifest = JSON.parse(fs.readFileSync(path.join(tmpRoot, 'agents/A01/manifest.json'), 'utf8'));
  assert.match(manifest.source_path_hash, /^[a-f0-9]{64}$/);
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});
