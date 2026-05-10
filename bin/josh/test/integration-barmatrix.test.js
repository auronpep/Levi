const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { importProject } = require('../lib/project-importer');
const { renderDailyReview } = require('../lib/project-status');

const SHOULD_RUN = process.env.RUN_BARMATRIX_INTEGRATION === '1';
const BARMATRIX_CORPUS = process.env.BARMATRIX_CORPUS_PATH ||
  'C:/AINC/MEV/experiments/mbe_tension_matrix';

test('integration: import real BarMatrix corpus', { skip: !SHOULD_RUN }, () => {
  if (!fs.existsSync(BARMATRIX_CORPUS)) {
    throw new Error(`BarMatrix corpus not found at ${BARMATRIX_CORPUS}`);
  }
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-bm-'));
  fs.mkdirSync(path.join(tmpRoot, 'projects'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'agents'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'todo', 'triaged'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'audit'), { recursive: true });

  const result = importProject(BARMATRIX_CORPUS, { joshRoot: tmpRoot, actor: 'cli:integration' });
  assert.ok(result.todo_count >= 400, `expected >=400 tasks, got ${result.todo_count}`);
  assert.ok(result.todo_count <= 420, `expected <=420 tasks, got ${result.todo_count}`);
  assert.equal(result.agent_count, 10, `expected 10 agents (A01-A10), got ${result.agent_count}`);

  const status = renderDailyReview(result.project_id, { joshRoot: tmpRoot });
  assert.match(status, /Day 1/);
  assert.match(status, /Day 4/);
  assert.match(status, /A01/);
  assert.match(status, /A10/);

  fs.rmSync(tmpRoot, { recursive: true, force: true });
});
