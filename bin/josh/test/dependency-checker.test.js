const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { checkDependencies } = require('../lib/dependency-checker');

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-dep-'));
  for (const s of ['triaged', 'in_progress', 'done', 'failed', 'blocked']) {
    fs.mkdirSync(path.join(root, 'todo', s), { recursive: true });
  }
  return root;
}

function seedTodo(root, state, id, meta) {
  const dir = path.join(root, 'todo', state, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ id, ...meta }, null, 2));
  fs.writeFileSync(path.join(dir, 'state'), state + '\n');
}

test('checkDependencies: ok when no deps', () => {
  const root = makeRoot();
  const r = checkDependencies(root, { id: '01A', depends_on: [] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.blocked_by, []);
  fs.rmSync(root, { recursive: true, force: true });
});

test('checkDependencies: ok when all hard deps are in done/', () => {
  const root = makeRoot();
  seedTodo(root, 'done', '01DEP1', { display_id: 'D1-001' });
  seedTodo(root, 'done', '01DEP2', { display_id: 'D1-002' });
  const todo = {
    id: '01A',
    depends_on: [{ id: '01DEP1', kind: 'hard' }, { id: '01DEP2', kind: 'hard' }],
    depends_on_display_ids: ['D1-001', 'D1-002'],
  };
  const r = checkDependencies(root, todo);
  assert.equal(r.ok, true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('checkDependencies: blocked when a hard dep is in triaged/', () => {
  const root = makeRoot();
  seedTodo(root, 'done',    '01DEP1', { display_id: 'D1-001' });
  seedTodo(root, 'triaged', '01DEP2', { display_id: 'D1-002' });
  const todo = {
    id: '01A',
    depends_on: [{ id: '01DEP1', kind: 'hard' }, { id: '01DEP2', kind: 'hard' }],
    depends_on_display_ids: ['D1-001', 'D1-002'],
  };
  const r = checkDependencies(root, todo);
  assert.equal(r.ok, false);
  assert.equal(r.blocked_by.length, 1);
  assert.equal(r.blocked_by[0].id, '01DEP2');
  assert.equal(r.blocked_by[0].display_id, 'D1-002');
  assert.equal(r.blocked_by[0].state, 'triaged');
  fs.rmSync(root, { recursive: true, force: true });
});

test('checkDependencies: ignores soft deps', () => {
  const root = makeRoot();
  seedTodo(root, 'triaged', '01SOFT', { display_id: 'D1-009' });
  const todo = {
    id: '01A',
    depends_on: [{ id: '01SOFT', kind: 'soft' }],
    depends_on_display_ids: ['D1-009'],
  };
  const r = checkDependencies(root, todo);
  assert.equal(r.ok, true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('checkDependencies: dep not found anywhere → reported as state=missing', () => {
  const root = makeRoot();
  const todo = {
    id: '01A',
    depends_on: [{ id: '01GHOST', kind: 'hard' }],
    depends_on_display_ids: ['D1-999'],
  };
  const r = checkDependencies(root, todo);
  assert.equal(r.ok, false);
  assert.equal(r.blocked_by[0].state, 'missing');
  assert.equal(r.blocked_by[0].display_id, 'D1-999');
  fs.rmSync(root, { recursive: true, force: true });
});

test('checkDependencies: missing depends_on field treated as no deps', () => {
  const root = makeRoot();
  const r = checkDependencies(root, { id: '01A' });
  assert.equal(r.ok, true);
  fs.rmSync(root, { recursive: true, force: true });
});
