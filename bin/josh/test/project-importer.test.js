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

const { parseAgent } = require('../lib/project-importer');
const FIXTURE_AGENT_DIR = path.join(__dirname, 'fixtures/corpus/agent_orchestration/agents');

test('parseAgent: A01 extracts id, title, role_group, source_path, source_path_hash', () => {
  const result = parseAgent(path.join(FIXTURE_AGENT_DIR, 'AGENT_01_COMMAND_CENTER.md'));
  assert.equal(result.id, 'A01');
  assert.equal(result.title, 'Command Center And Integration');
  assert.equal(result.role_group, 'command_center_and_integration');
  assert.equal(result.status, 'READY');
  assert.equal(result.source_path, path.resolve(path.join(FIXTURE_AGENT_DIR, 'AGENT_01_COMMAND_CENTER.md')));
  assert.match(result.source_path_hash, /^[a-f0-9]{64}$/);
});

test('parseAgent: A03 includes mission and gates', () => {
  const result = parseAgent(path.join(FIXTURE_AGENT_DIR, 'AGENT_03_CLAIMS_SOURCE_SAFETY.md'));
  assert.equal(result.id, 'A03');
  assert.match(result.mission_summary, /unsupported claims/);
});

const { importProject } = require('../lib/project-importer');
const fs = require('node:fs');
const os = require('node:os');

const FIXTURE_CORPUS = path.join(__dirname, 'fixtures/corpus');

test('importProject: writes charter, todos, agent manifests under JOSH_ROOT', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-test-'));
  fs.mkdirSync(path.join(tmpRoot, 'projects'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'agents'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'todo', 'triaged'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'audit'), { recursive: true });

  const result = importProject(FIXTURE_CORPUS, { joshRoot: tmpRoot, actor: 'cli:test' });

  assert.equal(result.todo_count, 2);
  assert.equal(result.agent_count, 2);
  assert.equal(typeof result.project_id, 'string');

  const charterPath = path.join(tmpRoot, 'projects', result.project_id, 'charter.json');
  assert.equal(fs.existsSync(charterPath), true);
  const charter = JSON.parse(fs.readFileSync(charterPath, 'utf8'));
  assert.equal(charter.title, 'Four-Day Full Project Dispatch');
  assert.equal(charter.imported_by, 'cli:test');

  const a01Path = path.join(tmpRoot, 'agents', 'A01', 'manifest.json');
  assert.equal(fs.existsSync(a01Path), true);
  const a01 = JSON.parse(fs.readFileSync(a01Path, 'utf8'));
  assert.equal(a01.id, 'A01');
  assert.equal(a01.version, 1);
  assert.match(a01.source_path_hash, /^[a-f0-9]{64}$/);

  const triaged = fs.readdirSync(path.join(tmpRoot, 'todo', 'triaged'));
  assert.equal(triaged.length, 2);

  const auditFiles = fs.readdirSync(path.join(tmpRoot, 'audit'));
  assert.ok(auditFiles.length > 0);

  fs.rmSync(tmpRoot, { recursive: true, force: true });
});
