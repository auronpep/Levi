const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { appendEvent, EVENT_KINDS } = require('../lib/events-writer');
const tf = require('../lib/todo-folder');

function tmpRoot() {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-ev-'));
  fs.mkdirSync(path.join(r, 'todo', 'in_progress'), { recursive: true });
  return r;
}

test('EVENT_KINDS exposes all 14 event types', () => {
  assert.equal(EVENT_KINDS.length, 14);
  for (const k of ['start', 'heartbeat', 'done', 'failed', 'interrupted',
    'backend_ref', 'run_started', 'text_delta', 'tool_call', 'pending_input',
    'pending_input_resolved', 'plan_artifact', 'settings_changed', 'run_completed']) {
    assert.ok(EVENT_KINDS.includes(k), `missing event kind: ${k}`);
  }
});

test('appendEvent: writes one JSON line', () => {
  const root = tmpRoot();
  const id = '01HXEVT00000000000000001';
  tf.writeMeta(root, 'in_progress', id, { schema: 1, id, title: 't' });
  appendEvent(root, 'in_progress', id, { kind: 'start', actor: 'A01' });
  const lines = fs.readFileSync(path.join(root, 'todo', 'in_progress', id, 'events.ndjson'), 'utf8').trim().split('\n');
  assert.equal(lines.length, 1);
  const ev = JSON.parse(lines[0]);
  assert.equal(ev.kind, 'start');
  assert.equal(ev.actor, 'A01');
  assert.match(ev.ts, /^\d{4}-\d{2}-\d{2}T/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('appendEvent: rejects unknown kind', () => {
  const root = tmpRoot();
  const id = '01HXEVT00000000000000002';
  tf.writeMeta(root, 'in_progress', id, { schema: 1, id });
  assert.throws(() => appendEvent(root, 'in_progress', id, { kind: 'gibberish' }), /unknown event kind/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('appendEvent: appends without overwriting prior events', () => {
  const root = tmpRoot();
  const id = '01HXEVT00000000000000003';
  tf.writeMeta(root, 'in_progress', id, { schema: 1, id });
  appendEvent(root, 'in_progress', id, { kind: 'start' });
  appendEvent(root, 'in_progress', id, { kind: 'heartbeat' });
  appendEvent(root, 'in_progress', id, { kind: 'done' });
  const lines = fs.readFileSync(path.join(root, 'todo', 'in_progress', id, 'events.ndjson'), 'utf8').trim().split('\n');
  assert.equal(lines.length, 3);
  assert.equal(JSON.parse(lines[0]).kind, 'start');
  assert.equal(JSON.parse(lines[2]).kind, 'done');
  fs.rmSync(root, { recursive: true, force: true });
});
