// A handoff is the durable record of what an agent did, and `josh complete`
// requires a valid one. "Verification" and "Files changed" are where commands
// and diffs go, so a `##` line inside a fence cut the field short: the field
// recorded only the opening fence, the real content landed in a phantom
// section, and a fence naming another field produced a duplicate entry for it.

const test = require('node:test');
const assert = require('node:assert');
const { validateHandoff, REQUIRED_FIELDS } = require('../lib/handoff-validator');

function handoff(overrides = {}) {
  let s = '# Handoff\n\n';
  for (const f of REQUIRED_FIELDS) {
    s += `## ${f}\n${overrides[f] ?? 'done'}\n\n`;
  }
  return s;
}

const field = (r, name) => r.fields.filter((f) => f.title === name);

test('a plain handoff still validates', () => {
  const r = validateHandoff(handoff());
  assert.strictEqual(r.ok, true, JSON.stringify(r.errors));
});

test('a fenced command block is recorded in full', () => {
  const verification = '```sh\n## run the suite\nnpm test -- --coverage\n```';
  const r = validateHandoff(handoff({ Verification: verification }));

  assert.strictEqual(r.ok, true, JSON.stringify(r.errors));
  const [v] = field(r, 'Verification');
  assert.ok(v.body.includes('npm test -- --coverage'), 'the command that was run must be in the record');
  assert.strictEqual(v.body, verification, 'the whole fence belongs to the field');
});

test('a fence naming another field does not create a duplicate entry', () => {
  const r = validateHandoff(handoff({ 'Files changed': '```sh\ngit diff\n## Verification\n```' }));
  assert.strictEqual(field(r, 'Verification').length, 1);
  assert.strictEqual(r.fields.length, REQUIRED_FIELDS.length);
});

test('a fenced diff is kept intact', () => {
  const diff = '```diff\n--- a/x\n+++ b/x\n## context line\n```';
  const r = validateHandoff(handoff({ 'Files changed': diff }));
  assert.strictEqual(field(r, 'Files changed')[0].body, diff);
});

test('tilde fences and long fences are handled', () => {
  for (const body of ['~~~sh\n## step\nrun\n~~~', '````sh\n## step\nrun\n````']) {
    const r = validateHandoff(handoff({ Verification: body }));
    assert.strictEqual(r.ok, true, JSON.stringify(r.errors));
    assert.strictEqual(field(r, 'Verification')[0].body, body);
  }
});

test('fields after a closed fence are still found', () => {
  const r = validateHandoff(handoff({ Decision: '```\n## not a field\n```' }));
  assert.strictEqual(r.ok, true, JSON.stringify(r.errors));
  assert.deepStrictEqual(r.fields.map((f) => f.title), REQUIRED_FIELDS);
});

test('a genuinely missing field is still reported', () => {
  const text = handoff().replace('## Verification\ndone\n\n', '');
  const r = validateHandoff(text);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some((e) => /missing required field: ## Verification/.test(e)));
});

test('a genuinely empty field is still reported', () => {
  const r = validateHandoff(handoff({ Risks: '' }));
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some((e) => /field 'Risks' is empty/.test(e)));
});

test('a real H2 in the body is still treated as a heading', () => {
  // Not fenced, so `## none identified` genuinely is a heading and Risks is empty.
  const r = validateHandoff(handoff({ Risks: '## none identified' }));
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some((e) => /field 'Risks' is empty/.test(e)));
});
