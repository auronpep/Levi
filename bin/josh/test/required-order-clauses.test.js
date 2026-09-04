// `Required order:` carries two clauses. The `after` capture stopped at
// `, before`, but the `before` capture ran to end-of-line — so when an author
// wrote the clauses the other way round, `before` swallowed the `after` clause
// and its ids were recorded as *both* prerequisites and things the task blocks.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseRequiredOrder } = require('../lib/markdown-parser');
const { parseTask } = require('../lib/project-importer');

test('the documented ordering is unchanged', () => {
  assert.deepStrictEqual(parseRequiredOrder('after `A`, before `B`'), { after: ['A'], before: ['B'] });
});

test('the clauses may be written in either order', () => {
  assert.deepStrictEqual(parseRequiredOrder('before `B`, after `A`'), { after: ['A'], before: ['B'] });
});

test('an id is never both a prerequisite and a blocked task', () => {
  for (const text of ['after `A`, before `B`', 'before `B`, after `A`']) {
    const r = parseRequiredOrder(text);
    const both = r.after.filter((id) => r.before.includes(id));
    assert.deepStrictEqual(both, [], `${text} produced a contradictory edge: ${both}`);
  }
});

test('multiple ids survive in both orderings', () => {
  assert.deepStrictEqual(parseRequiredOrder('after `A`, `B`, before `C`'), { after: ['A', 'B'], before: ['C'] });
  assert.deepStrictEqual(parseRequiredOrder('before `C`, after `A`, `B`'), { after: ['A', 'B'], before: ['C'] });
});

test('a single clause still works on its own', () => {
  assert.deepStrictEqual(parseRequiredOrder('after `A`'), { after: ['A'], before: [] });
  assert.deepStrictEqual(parseRequiredOrder('before `B`'), { after: [], before: ['B'] });
});

test('`none` is still filtered out in both positions', () => {
  assert.deepStrictEqual(parseRequiredOrder('after `none`, before `none`'), { after: [], before: [] });
  assert.deepStrictEqual(parseRequiredOrder('before `none`, after `A`'), { after: ['A'], before: [] });
});

test('empty and missing input are still empty', () => {
  assert.deepStrictEqual(parseRequiredOrder(''), { after: [], before: [] });
  assert.deepStrictEqual(parseRequiredOrder(undefined), { after: [], before: [] });
  assert.deepStrictEqual(parseRequiredOrder('no clauses here'), { after: [], before: [] });
});

test('an id containing the word "after" is not treated as a clause boundary', () => {
  // The boundary requires a comma and a word break, so `D1-after` stays an id.
  assert.deepStrictEqual(parseRequiredOrder('after `D1-afterparty`'), { after: ['D1-afterparty'], before: [] });
});

test('parseTask carries the corrected clauses through', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-ro-'));
  const p = path.join(dir, 'D1-001_x.md');
  fs.writeFileSync(p, [
    '# Day 1 - X Task 001: Title', '', '## Dispatch', '',
    '- Day: 1 - May 9, 2026',
    '- Phase: 01 - Cmd',
    '- Primary role: A01 Command',
    '- Required order: before `D1-004`, after `D1-002`',
    '', '## Why', 'text', '',
  ].join('\n'));

  const t = parseTask(p);
  assert.deepStrictEqual(t.depends_on_display_ids, ['D1-002']);
  assert.deepStrictEqual(t.blocks_display_ids, ['D1-004']);
});

test('parseTask on the documented ordering is unchanged', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-ro-'));
  const p = path.join(dir, 'D1-001_x.md');
  fs.writeFileSync(p, [
    '# Day 1 - X Task 001: Title', '', '## Dispatch', '',
    '- Day: 1 - May 9, 2026',
    '- Phase: 01 - Cmd',
    '- Primary role: A01 Command',
    '- Required order: after `D1-002`, before `D1-004`',
    '', '## Why', 'text', '',
  ].join('\n'));

  const t = parseTask(p);
  assert.deepStrictEqual(t.depends_on_display_ids, ['D1-002']);
  assert.deepStrictEqual(t.blocks_display_ids, ['D1-004']);
});
