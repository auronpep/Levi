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

test('applySync: also updates depends_on (resolved ULIDs) when display_ids change', () => {
  const { tmpRoot, corpus } = setupFixture();
  const { project_id } = importProject(corpus, { joshRoot: tmpRoot, actor: 'cli:test' });

  // D1-001 originally has after `none`, before `D1-002`.
  // Mutate the source to change its upstream to D1-003.
  const d1001Source = path.join(corpus, 'FOUR_DAY_FULL_PROJECT_DISPATCH/day_1_lock_scope_and_command/D1-001_freeze_four_day_launch_definition.md');
  const original = fs.readFileSync(d1001Source, 'utf8');
  const mutated = original.replace(
    'Required order: after `none`, before `D1-002`',
    'Required order: after `D1-003`, before `D1-002`'
  );
  fs.writeFileSync(d1001Source, mutated);

  applySync(project_id, { joshRoot: tmpRoot, actor: 'cli:test' });

  // Find D1-001's todo file
  let d1001Todo = null;
  let d1003Todo = null;
  for (const file of fs.readdirSync(path.join(tmpRoot, 'todo/triaged'))) {
    if (!file.endsWith('.json')) continue;
    const todo = JSON.parse(fs.readFileSync(path.join(tmpRoot, 'todo/triaged', file), 'utf8'));
    if (todo.display_id === 'D1-001') d1001Todo = todo;
    if (todo.display_id === 'D1-003') d1003Todo = todo;
  }
  assert.ok(d1001Todo, 'D1-001 todo should exist');
  assert.ok(d1003Todo, 'D1-003 todo should exist');

  // depends_on_display_ids was updated (this already works pre-fix)
  assert.deepEqual(d1001Todo.depends_on_display_ids, ['D1-003']);

  // depends_on (resolved ULIDs) MUST also be updated — this is what the orchestrator reads
  assert.equal(d1001Todo.depends_on.length, 1);
  assert.equal(d1001Todo.depends_on[0].id, d1003Todo.id);
  assert.equal(d1001Todo.depends_on[0].kind, 'hard');

  fs.rmSync(tmpRoot, { recursive: true, force: true });
});
