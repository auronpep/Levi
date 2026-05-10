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
