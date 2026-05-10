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
