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
