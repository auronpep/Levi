'use strict';
// parseFrontmatter compared against '---\n' and split on '\n'. A Windows checkout
// produces CRLF, so every SKILL.md began '---\r\n', failed the first check and
// parsed as null. buildRegistry then returned [] and the PreToolUse hook matched
// nothing — the tool-context feature was inert, and two root tests failed.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseFrontmatter } = require('../../hooks/lib/frontmatter');
const { buildRegistry } = require('../../hooks/lib/trigger-registry');

const SKILL_LF = [
  '---',
  'name: tool-foo',
  'description: foo skill',
  'triggers:',
  '  bash:',
  '    - foo',
  '    - python -m foo',
  '---',
  '',
  '# foo',
  'body',
].join('\n');

const SKILL_CRLF = SKILL_LF.replace(/\n/g, '\r\n');

// 1: a CRLF document parses identically to the LF one.
{
  const lf = parseFrontmatter(SKILL_LF);
  const crlf = parseFrontmatter(SKILL_CRLF);
  assert.notStrictEqual(crlf, null, 'CRLF frontmatter must parse');
  assert.deepStrictEqual(crlf, lf);
}

// 2: nested list values survive CRLF.
{
  const fm = parseFrontmatter(SKILL_CRLF);
  assert.deepStrictEqual(fm.triggers.bash, ['foo', 'python -m foo']);
  assert.strictEqual(fm.name, 'tool-foo');
}

// 3: a lone CR does not smuggle itself into a value.
{
  const fm = parseFrontmatter(SKILL_CRLF);
  for (const v of [fm.name, fm.description, ...fm.triggers.bash]) {
    assert.ok(!String(v).includes('\r'), `value still contains CR: ${JSON.stringify(v)}`);
  }
}

// 4: buildRegistry finds CRLF skills on disk.
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'levi-fm-'));
  fs.mkdirSync(path.join(dir, 'foo'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'foo', 'SKILL.md'), SKILL_CRLF);

  const registry = buildRegistry(dir);
  assert.strictEqual(registry.length, 1, 'a CRLF skill must register');
  assert.strictEqual(registry[0].skillName, 'tool-foo');
  assert.deepStrictEqual(registry[0].patterns, ['foo', 'python -m foo']);
}

// 5: the repo's own shipped skills register.
{
  const registry = buildRegistry(path.join(__dirname, '..', '..', 'skills', 'tools'));
  assert.ok(registry.length > 0, 'the shipped tool skills must produce a non-empty registry');
  assert.ok(registry.some((e) => e.skillName === 'tool-git'), 'tool-git should be present');
}

// 6: non-frontmatter input is still null, and hostile input does not throw.
{
  assert.strictEqual(parseFrontmatter('no frontmatter here'), null);
  assert.strictEqual(parseFrontmatter(''), null);
  for (const bad of [null, undefined, 123, {}, []]) {
    assert.doesNotThrow(() => parseFrontmatter(bad), `parseFrontmatter(${JSON.stringify(bad)}) threw`);
    assert.strictEqual(parseFrontmatter(bad), null);
  }
}

// 7: an unterminated frontmatter block is still null under both line endings.
{
  assert.strictEqual(parseFrontmatter('---\nname: x\n'), null);
  assert.strictEqual(parseFrontmatter('---\r\nname: x\r\n'), null);
}

console.log('ok — frontmatter CRLF: 7 groups passed');
