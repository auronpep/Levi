const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { importProject } = require('../lib/project-importer');
const { renderDailyReview } = require('../lib/project-status');

const FIXTURE_CORPUS = path.join(__dirname, 'fixtures/corpus');

test('renderDailyReview: includes title, day-by-day breakdown, agent list', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-status-'));
  fs.mkdirSync(path.join(tmpRoot, 'projects'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'agents'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'todo', 'triaged'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'audit'), { recursive: true });

  const result = importProject(FIXTURE_CORPUS, { joshRoot: tmpRoot, actor: 'cli:test' });
  const output = renderDailyReview(result.project_id, { joshRoot: tmpRoot });

  assert.match(output, /Four-Day Full Project Dispatch/);
  assert.match(output, /Day 1.*May 9, 2026/);
  assert.match(output, /A01/);
  assert.match(output, /A03/);
  assert.match(output, /todos: 2/i);

  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test('renderDailyReview: throws on missing project', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-status-'));
  assert.throws(() => renderDailyReview('NONEXISTENT', { joshRoot: tmpRoot }));
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});
