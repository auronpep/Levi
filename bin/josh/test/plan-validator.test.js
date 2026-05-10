const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validatePlan } = require('../lib/plan-validator');

const SAMPLE = fs.readFileSync(path.join(__dirname, 'fixtures/sample-plan.md'), 'utf8');

test('validatePlan: accepts the sample fixture', () => {
  const r = validatePlan(SAMPLE);
  assert.equal(r.ok, true, `errors: ${JSON.stringify(r.errors)}`);
  assert.equal(r.frontmatter.id, '01HXPLAN00000000000000001');
  assert.equal(r.frontmatter.status, 'PENDING');
  assert.equal(r.sections.length, 8);
});

test('validatePlan: rejects missing frontmatter', () => {
  const r = validatePlan('## Fast-Path\n\ntext\n');
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /frontmatter/i.test(e)));
});

test('validatePlan: rejects missing required frontmatter field', () => {
  const broken = SAMPLE.replace(/\nclaimed_by: A01/, '');
  const r = validatePlan(broken);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /claimed_by/.test(e)));
});

test('validatePlan: rejects invalid status', () => {
  const broken = SAMPLE.replace(/\nstatus: PENDING/, '\nstatus: WHATEVER');
  const r = validatePlan(broken);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /status.*PENDING.*APPROVED.*REVISED/.test(e)));
});

test('validatePlan: rejects missing required section', () => {
  const broken = SAMPLE.replace(/\n## Risks \+ rollback\n[\s\S]*?\n## Test plan/, '\n## Test plan');
  const r = validatePlan(broken);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /Risks \+ rollback/.test(e)));
});

test('validatePlan: rejects sections in wrong order', () => {
  const swapped = SAMPLE.replace(
    /## Problem statement([\s\S]*?)\n## Current state evidence/,
    '## Current state evidence$1\n## Problem statement'
  );
  const r = validatePlan(swapped);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /order/i.test(e)));
});
