// `listTodosInState` already skips todos it cannot read, so the todo half of the
// report survives a partial sync. The agent half threw on the first damaged
// manifest, so `josh project status` produced nothing at all.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { importProject } = require('../lib/project-importer');
const { renderDailyReview } = require('../lib/project-status');

function imported() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-ps-'));
  for (const d of ['projects', 'agents', 'todo/triaged', 'audit']) {
    fs.mkdirSync(path.join(root, d), { recursive: true });
  }
  const corpus = path.join(root, 'corpus');
  fs.cpSync(path.join(__dirname, 'fixtures/corpus'), corpus, { recursive: true });
  const { project_id } = importProject(corpus, { joshRoot: root, actor: 'cli:test' });
  return { root, project_id };
}

const manifestPath = (root, id) => path.join(root, 'agents', id, 'manifest.json');

test('a truncated manifest no longer takes down the whole report', () => {
  const { root, project_id } = imported();
  const p = manifestPath(root, 'A01');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').slice(0, 60));

  const out = renderDailyReview(project_id, { joshRoot: root });
  assert.match(out, /^# Four-Day Full Project Dispatch/);
});

test('the surviving agents are still listed', () => {
  const { root, project_id } = imported();
  const p = manifestPath(root, 'A01');
  fs.writeFileSync(p, '{ broken');

  const out = renderDailyReview(project_id, { joshRoot: root });
  assert.match(out, /- A03:/, 'the readable agent is still reported');
});

test('the damaged manifest is reported, not silently dropped', () => {
  const { root, project_id } = imported();
  fs.writeFileSync(manifestPath(root, 'A01'), '{ broken');

  const out = renderDailyReview(project_id, { joshRoot: root });
  assert.match(out, /## Unreadable agent manifests \(1\)/);
  assert.match(out, /- A01:/);
});

test('a manifest that parses to a non-object is reported too', () => {
  const { root, project_id } = imported();
  fs.writeFileSync(manifestPath(root, 'A01'), '"just a string"');

  const out = renderDailyReview(project_id, { joshRoot: root });
  assert.match(out, /## Unreadable agent manifests/);
  assert.match(out, /not a JSON object/);
});

test('the todo counts are unaffected by a damaged agent manifest', () => {
  const { root, project_id } = imported();
  const clean = renderDailyReview(project_id, { joshRoot: root });
  fs.writeFileSync(manifestPath(root, 'A01'), '{ broken');
  const after = renderDailyReview(project_id, { joshRoot: root });

  const todosLine = (s) => s.split('\n').find((l) => l.startsWith('- todos:'));
  assert.equal(todosLine(after), todosLine(clean));
});

test('a manifest with no id does not break the sort', () => {
  const { root, project_id } = imported();
  const p = manifestPath(root, 'A01');
  const m = JSON.parse(fs.readFileSync(p, 'utf8'));
  delete m.id;
  fs.writeFileSync(p, JSON.stringify(m));

  assert.doesNotThrow(() => renderDailyReview(project_id, { joshRoot: root }));
});

test('a clean project reports no unreadable section at all', () => {
  const { root, project_id } = imported();
  const out = renderDailyReview(project_id, { joshRoot: root });
  assert.ok(!out.includes('Unreadable agent manifests'));
  assert.match(out, /- A01:/);
  assert.match(out, /- A03:/);
});

test('a missing project still throws, as before', () => {
  const { root } = imported();
  assert.throws(() => renderDailyReview('NOPE', { joshRoot: root }), /not found/);
});
