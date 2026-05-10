const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { parseCharter } = require('../lib/project-importer');

const FIXTURE_DISPATCH = path.join(__dirname, 'fixtures/corpus/FOUR_DAY_FULL_PROJECT_DISPATCH');

test('parseCharter: extracts title, definition_of_done, days', () => {
  const result = parseCharter(path.join(FIXTURE_DISPATCH, 'README.md'));
  assert.equal(result.title, 'Four-Day Full Project Dispatch');
  assert.match(result.definition_of_done, /approved launch path is live/);
  assert.equal(result.days.length, 4);
  assert.equal(result.days[0].day, 1);
  assert.equal(result.days[0].date, 'May 9, 2026');
  assert.equal(result.days[0].folder, 'day_1_lock_scope_and_command');
  assert.match(result.days[0].goal, /launch definition/);
  assert.equal(result.source_path, path.resolve(path.join(FIXTURE_DISPATCH, 'README.md')));
});

const { parseTask } = require('../lib/project-importer');

test('parseTask: extracts display_id, title, dispatch metadata', () => {
  const taskPath = path.join(FIXTURE_DISPATCH, 'day_1_lock_scope_and_command', 'D1-001_freeze_four_day_launch_definition.md');
  const result = parseTask(taskPath);
  assert.equal(result.display_id, 'D1-001');
  assert.equal(result.title, 'Freeze four-day launch definition');
  assert.equal(result.day, 1);
  assert.equal(result.phase, 1);
  assert.equal(result.primary_role, 'A01');
  assert.deepEqual(result.depends_on_display_ids, []);
  assert.deepEqual(result.blocks_display_ids, ['D1-002']);
  assert.match(result.parallel_safety, /same phase/);
  assert.equal(result.source_path, path.resolve(taskPath));
});

test('parseTask: D1-003 has D1-002 as upstream', () => {
  const taskPath = path.join(FIXTURE_DISPATCH, 'day_1_lock_scope_and_command', 'D1-003_map_dependency_chain.md');
  const result = parseTask(taskPath);
  assert.equal(result.display_id, 'D1-003');
  assert.deepEqual(result.depends_on_display_ids, ['D1-002']);
  assert.deepEqual(result.blocks_display_ids, ['D1-004']);
});
