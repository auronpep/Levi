// A lesson body containing a newline must survive the write→read round-trip.
// Before the fix, everything after the first newline was silently dropped by
// readLessons() (the entry regex is anchored per-line), so the lesson was
// recorded on disk but could never be read back.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const lessons = require('../lib/lessons');

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'josh-lessons-'));
}

test('appendLesson/readLessons: multi-line body round-trips losslessly', () => {
  const root = tmpRoot();
  const body = 'line one\nline two: still the same lesson\nline three';
  lessons.appendLesson(root, 'claude', body);

  const { entries } = lessons.readLessons(root, 'claude');
  assert.strictEqual(entries.length, 1, 'a multi-line lesson is still exactly one entry');
  assert.strictEqual(entries[0].text, body);
});

test('appendLesson: a multi-line lesson does not swallow the next lesson', () => {
  const root = tmpRoot();
  lessons.appendLesson(root, 'claude', 'first\nsecond half');
  lessons.appendLesson(root, 'claude', 'after');

  const { entries } = lessons.readLessons(root, 'claude');
  assert.strictEqual(entries.length, 2);
  assert.strictEqual(entries[0].text, 'first\nsecond half');
  assert.strictEqual(entries[1].text, 'after');
});

test('appendLesson: CRLF and lone CR normalise to \\n on read', () => {
  const root = tmpRoot();
  lessons.appendLesson(root, 'codex', 'a\r\nb\rc');

  const { entries } = lessons.readLessons(root, 'codex');
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].text, 'a\nb\nc');
});

test('appendLesson: literal backslashes survive the round-trip', () => {
  const root = tmpRoot();
  const body = 'use C:\\path\\to\\thing and a literal \\n sequence';
  lessons.appendLesson(root, 'claude', body);

  const { entries } = lessons.readLessons(root, 'claude');
  assert.strictEqual(entries[0].text, body);
});

test('appendLesson: single-line bodies are byte-identical to before', () => {
  const root = tmpRoot();
  lessons.appendLesson(root, 'claude', 'plain lesson', { at: '2026-01-01T00:00:00.000Z', actor: 'human' });

  const text = fs.readFileSync(lessons.lessonsPath(root, 'claude'), 'utf8');
  assert.ok(text.includes('- [2026-01-01T00:00:00.000Z] (human) plain lesson\n'));
});

test('escapeBody/unescapeBody: inverse pair', () => {
  for (const s of ['', 'a', 'a\nb', '\\', '\\n', 'a\\\nb', 'mixed \\ and \n']) {
    assert.strictEqual(lessons.unescapeBody(lessons.escapeBody(s)), s, `failed for ${JSON.stringify(s)}`);
  }
});

test('appendLesson: null/undefined body does not throw and reads back empty-ish', () => {
  const root = tmpRoot();
  const r = lessons.appendLesson(root, 'claude', null);
  assert.ok(r.line.endsWith('\n'));
  assert.ok(!r.line.includes('null'), 'null should not be stringified into the log');
});
