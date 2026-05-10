'use strict';
const assert = require('node:assert');
const path = require('node:path');
const { buildRegistry, matchCommand, commandMatches } =
  require('../../hooks/lib/trigger-registry');

const fixtures = path.join(__dirname, 'fixtures', 'skills', 'tools');

// 1: builds entries for skills with non-empty triggers, skips empty-trigger skills
{
  const registry = buildRegistry(fixtures);
  const names = registry.map((e) => e.skillName).sort();
  assert.deepStrictEqual(names, ['tool-bar', 'tool-foo']);
  const foo = registry.find((e) => e.skillName === 'tool-foo');
  assert.deepStrictEqual(foo.patterns, ['foo', 'python -m foo']);
}

// 2: matchCommand returns matching skill names
{
  const registry = buildRegistry(fixtures);
  assert.deepStrictEqual(matchCommand('foo --help', registry), ['tool-foo']);
  assert.deepStrictEqual(matchCommand('python -m foo download', registry), ['tool-foo']);
  assert.deepStrictEqual(matchCommand('bar-cli', registry), ['tool-bar']);
  assert.deepStrictEqual(matchCommand('echo hello', registry), []);
}

// 3: word-boundary semantics
assert.strictEqual(commandMatches('myfoo-helper', 'foo'), false);
assert.strictEqual(commandMatches('foo --help', 'foo'), true);
assert.strictEqual(commandMatches('"foo"', 'foo'), true);
assert.strictEqual(commandMatches('bash -c "foo --help"', 'foo'), true);
assert.strictEqual(commandMatches('foobar', 'foo'), false);

// 4: missing directory returns empty registry
assert.deepStrictEqual(buildRegistry('/nonexistent/path/abc'), []);

// 5: multi-word patterns match
assert.strictEqual(commandMatches('python -m foo download', 'python -m foo'), true);
assert.strictEqual(commandMatches('python -m foobar', 'python -m foo'), false);

console.log('PASS test-trigger-registry');
