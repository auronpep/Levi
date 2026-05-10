const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateHandoff, REQUIRED_FIELDS } = require('../lib/handoff-validator');

const SAMPLE = fs.readFileSync(path.join(__dirname, 'fixtures/sample-handoff.md'), 'utf8');

test('REQUIRED_FIELDS lists the 9 expected H2s', () => {
  assert.equal(REQUIRED_FIELDS.length, 9);
  for (const f of [
    'Task ID', 'Files changed', 'Decision', 'Open blockers', 'Risks',
    'Downstream unblocked', 'Downstream blocked', 'Verification', 'Human review',
  ]) {
    assert.ok(REQUIRED_FIELDS.includes(f), `missing required field: ${f}`);
  }
});

test('validateHandoff: accepts the sample fixture', () => {
  const r = validateHandoff(SAMPLE);
  assert.equal(r.ok, true, `errors: ${JSON.stringify(r.errors)}`);
  assert.equal(r.fields.length, 9);
});

test('validateHandoff: rejects missing field', () => {
  const broken = SAMPLE.replace(/## Risks[\s\S]*?\n## Downstream unblocked/, '## Downstream unblocked');
  const r = validateHandoff(broken);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /Risks/.test(e)));
});

test('validateHandoff: rejects empty field body', () => {
  const broken = SAMPLE.replace(/## Decision\n\n[^\n]+/, '## Decision\n');
  const r = validateHandoff(broken);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /Decision.*empty/.test(e)));
});

test('validateHandoff: order does not matter', () => {
  // Reverse the section order — should still validate as long as all 9 are present and non-empty.
  const sections = SAMPLE.split(/(?=^## )/m).filter(Boolean);
  const reversed = sections.reverse().join('');
  const r = validateHandoff(reversed);
  assert.equal(r.ok, true, `unexpected errors: ${JSON.stringify(r.errors)}`);
});
