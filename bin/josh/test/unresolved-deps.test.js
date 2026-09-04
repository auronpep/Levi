// `.filter(Boolean)` turned "I cannot resolve this ordering constraint" into
// "there is no ordering constraint". A task whose brief says
// `Required order: after D1-002` was imported with depends_on_display_ids
// recording the declaration and depends_on - the list the orchestrator actually
// enforces - left empty. The task became immediately claimable, and nothing said so.
//
// The repo's own fixture corpus exhibits this: D1-003 depends on D1-002, and
// D1-002 has no task file.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { importProject } = require('../lib/project-importer');
const { applySync } = require('../lib/project-sync');
const tf = require('../lib/todo-folder');
const { checkDependencies } = require('../lib/dependency-checker');

function setupFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-unres-'));
  for (const d of ['projects', 'agents', 'todo/triaged', 'audit']) {
    fs.mkdirSync(path.join(root, d), { recursive: true });
  }
  const corpus = path.join(root, 'corpus');
  fs.cpSync(path.join(__dirname, 'fixtures/corpus'), corpus, { recursive: true });
  return { root, corpus };
}

const byDisplay = (root, id) =>
  tf.listTodosInState(root, 'triaged').find((t) => t.display_id === id);

test('an unresolvable dependency is kept, not dropped', () => {
  const { root, corpus } = setupFixture();
  importProject(corpus, { joshRoot: root, actor: 'cli:test' });

  const d1003 = byDisplay(root, 'D1-003');
  assert.deepEqual(d1003.depends_on_display_ids, ['D1-002'], 'precondition: it declares the dependency');
  assert.equal(d1003.depends_on.length, 1, 'the enforced list must not be empty');
  assert.equal(d1003.depends_on[0].display_id, 'D1-002');
  assert.equal(d1003.depends_on[0].unresolved, true);
  assert.equal(d1003.depends_on[0].kind, 'hard');
});

test('the unresolved dependency actually blocks the task', () => {
  const { root, corpus } = setupFixture();
  importProject(corpus, { joshRoot: root, actor: 'cli:test' });

  const r = checkDependencies(root, byDisplay(root, 'D1-003'));
  assert.equal(r.ok, false, 'a task whose prerequisite does not exist must not be claimable');
  assert.equal(r.blocked_by[0].state, 'missing');
  assert.equal(r.blocked_by[0].display_id, 'D1-002');
});

test('a task with no declared dependencies is still unblocked', () => {
  const { root, corpus } = setupFixture();
  importProject(corpus, { joshRoot: root, actor: 'cli:test' });

  const d1001 = byDisplay(root, 'D1-001');
  assert.deepEqual(d1001.depends_on, []);
  assert.equal(checkDependencies(root, d1001).ok, true);
});

test('a resolvable dependency still resolves to a real ULID', () => {
  const { root, corpus } = setupFixture();
  importProject(corpus, { joshRoot: root, actor: 'cli:test' });

  // Point D1-001 at D1-003, which does exist in the corpus.
  const src = path.join(corpus, 'FOUR_DAY_FULL_PROJECT_DISPATCH/day_1_lock_scope_and_command/D1-001_freeze_four_day_launch_definition.md');
  const text = fs.readFileSync(src, 'utf8').replace(
    /- Required order:.*/,
    '- Required order: after `D1-003`, before `none`',
  );
  fs.writeFileSync(src, text);

  const projects = fs.readdirSync(path.join(root, 'projects'));
  applySync(projects[0].replace(/\.json$/, ''), { joshRoot: root, actor: 'cli:test' });

  const d1001 = byDisplay(root, 'D1-001');
  const d1003 = byDisplay(root, 'D1-003');
  assert.equal(d1001.depends_on.length, 1);
  assert.equal(d1001.depends_on[0].id, d1003.id, 'resolved to the real ULID');
  assert.equal(d1001.depends_on[0].unresolved, undefined, 'and is not marked unresolved');
});

test('sync keeps an unresolvable dependency rather than clearing it', () => {
  const { root, corpus } = setupFixture();
  const projects0 = importProject(corpus, { joshRoot: root, actor: 'cli:test' });

  const src = path.join(corpus, 'FOUR_DAY_FULL_PROJECT_DISPATCH/day_1_lock_scope_and_command/D1-001_freeze_four_day_launch_definition.md');
  const text = fs.readFileSync(src, 'utf8').replace(
    /- Required order:.*/,
    '- Required order: after `D9-999`, before `none`',
  );
  fs.writeFileSync(src, text);

  applySync(projects0.project_id, { joshRoot: root, actor: 'cli:test' });

  const d1001 = byDisplay(root, 'D1-001');
  assert.equal(d1001.depends_on.length, 1);
  assert.equal(d1001.depends_on[0].display_id, 'D9-999');
  assert.equal(d1001.depends_on[0].unresolved, true);
  assert.equal(checkDependencies(root, d1001).ok, false);
});

test('depends_on_display_ids is unchanged - the declaration was never the problem', () => {
  const { root, corpus } = setupFixture();
  importProject(corpus, { joshRoot: root, actor: 'cli:test' });
  assert.deepEqual(byDisplay(root, 'D1-003').depends_on_display_ids, ['D1-002']);
  assert.deepEqual(byDisplay(root, 'D1-001').depends_on_display_ids, []);
});
