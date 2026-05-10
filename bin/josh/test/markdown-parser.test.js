const test = require('node:test');
const assert = require('node:assert/strict');
const { extractFrontmatter } = require('../lib/markdown-parser');

test('extractFrontmatter: parses YAML frontmatter block', () => {
  const input = '---\nstatus: READY\nday: 1\n---\nbody text\nmore body';
  const result = extractFrontmatter(input);
  assert.deepEqual(result.frontmatter, { status: 'READY', day: '1' });
  assert.equal(result.body, 'body text\nmore body');
});

test('extractFrontmatter: returns empty frontmatter when none present', () => {
  const input = '# Heading\n\nNo frontmatter here.';
  const result = extractFrontmatter(input);
  assert.deepEqual(result.frontmatter, {});
  assert.equal(result.body, '# Heading\n\nNo frontmatter here.');
});

test('extractFrontmatter: handles missing closing delimiter', () => {
  const input = '---\nbroken: yes\n# heading';
  const result = extractFrontmatter(input);
  assert.deepEqual(result.frontmatter, {});
  assert.equal(result.body, input);
});

test('extractFrontmatter: trims values', () => {
  const input = '---\nname:   bar  \n---\nbody';
  const result = extractFrontmatter(input);
  assert.equal(result.frontmatter.name, 'bar');
});

const { parseRequiredOrder } = require('../lib/markdown-parser');

test('parseRequiredOrder: simple after/before', () => {
  const result = parseRequiredOrder('after `D1-002`, before `D1-004`');
  assert.deepEqual(result.after, ['D1-002']);
  assert.deepEqual(result.before, ['D1-004']);
});

test('parseRequiredOrder: after none', () => {
  const result = parseRequiredOrder('after `none`, before `D1-002`');
  assert.deepEqual(result.after, []);
  assert.deepEqual(result.before, ['D1-002']);
});

test('parseRequiredOrder: multiple ids', () => {
  const result = parseRequiredOrder('after `D1-001` and `D1-002`, before `D1-004`');
  assert.deepEqual(result.after, ['D1-001', 'D1-002']);
  assert.deepEqual(result.before, ['D1-004']);
});

test('parseRequiredOrder: empty input', () => {
  const result = parseRequiredOrder('');
  assert.deepEqual(result.after, []);
  assert.deepEqual(result.before, []);
});

const { parseDispatchBlock } = require('../lib/markdown-parser');

const SAMPLE_DISPATCH = `## Dispatch

- Day: 1 - May 9, 2026
- Phase: 01 - Command Center And Sequence Lock
- Primary role: A01 Command Center
- Required order: after \`none\`, before \`D1-002\`
- Parallel safety: this task may run in parallel only with tasks in the same phase that do not edit the same output file.

## Why This Task Exists`;

test('parseDispatchBlock: extracts all fields', () => {
  const result = parseDispatchBlock(SAMPLE_DISPATCH);
  assert.equal(result.day, 1);
  assert.equal(result.day_date, 'May 9, 2026');
  assert.equal(result.phase_num, 1);
  assert.equal(result.phase_name, 'Command Center And Sequence Lock');
  assert.equal(result.primary_role, 'A01');
  assert.deepEqual(result.required_order.after, []);
  assert.deepEqual(result.required_order.before, ['D1-002']);
  assert.match(result.parallel_safety, /same phase/);
});

test('parseDispatchBlock: returns null for missing dispatch section', () => {
  const result = parseDispatchBlock('# Some doc with no dispatch section');
  assert.equal(result, null);
});

const { parseAgentHeading } = require('../lib/markdown-parser');

test('parseAgentHeading: extracts id and role group', () => {
  const result = parseAgentHeading('# Agent A03 - Claims, Compliance, And Source Safety\n\nStatus: READY');
  assert.equal(result.id, 'A03');
  assert.equal(result.title, 'Claims, Compliance, And Source Safety');
  assert.equal(result.role_group, 'claims_compliance_and_source_safety');
  assert.equal(result.status, 'READY');
});

test('parseAgentHeading: A01 with multi-word title', () => {
  const result = parseAgentHeading('# Agent A01 - Command Center And Integration\n\nStatus: READY');
  assert.equal(result.id, 'A01');
  assert.equal(result.title, 'Command Center And Integration');
  assert.equal(result.role_group, 'command_center_and_integration');
});

test('parseAgentHeading: unknown id returns null', () => {
  const result = parseAgentHeading('# Some other heading');
  assert.equal(result, null);
});
