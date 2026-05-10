'use strict';
const assert = require('node:assert');
const { parseFrontmatter } = require('../../hooks/lib/frontmatter');

// 1: simple frontmatter with nested triggers list
{
  const input = `---
name: tool-foo
description: Load when working with foo
triggers:
  bash:
    - foo
    - python -m foo
---

body content`;
  const r = parseFrontmatter(input);
  assert.strictEqual(r.name, 'tool-foo');
  assert.strictEqual(r.description, 'Load when working with foo');
  assert.deepStrictEqual(r.triggers.bash, ['foo', 'python -m foo']);
}

// 2: missing frontmatter returns null
assert.strictEqual(parseFrontmatter('# heading\nbody'), null);

// 3: empty inline list
{
  const input = `---
name: tool-bar
description: bar
triggers:
  bash: []
---
body`;
  const r = parseFrontmatter(input);
  assert.deepStrictEqual(r.triggers.bash, []);
}

// 4: malformed (no closing) returns null
assert.strictEqual(parseFrontmatter('---\nname: foo\nbody'), null);

// 5: extra whitespace tolerated
{
  const input = `---
name:  tool-baz
description:    spaced
triggers:
  bash:
    - baz
---
body`;
  const r = parseFrontmatter(input);
  assert.strictEqual(r.name, 'tool-baz');
  assert.strictEqual(r.description, 'spaced');
}

console.log('PASS test-frontmatter');
