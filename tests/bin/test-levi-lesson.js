'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { appendEntry } = require('../../bin/levi-lesson');

function makeFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'levi-lesson-'));
  const skillDir = path.join(dir, 'skills', 'tools', 'icloudpd');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    `---
name: tool-icloudpd
description: test
triggers:
  bash:
    - icloudpd
---

# icloudpd

## Traps

_Append-only._

## Lessons

_Append-only._
`
  );
  return dir;
}

// 1: append a trap
{
  const root = makeFixture();
  const result = appendEntry({
    root,
    tool: 'icloudpd',
    section: 'trap',
    text: 'Cookie expires after 60 days',
    today: '2026-05-10',
  });
  assert.ok(result.ok);
  const body = fs.readFileSync(
    path.join(root, 'skills', 'tools', 'icloudpd', 'SKILL.md'),
    'utf8'
  );
  assert.match(body, /## Traps[\s\S]*- 2026-05-10: Cookie expires after 60 days/);
  // Lessons untouched
  assert.match(body, /## Lessons\n\n_Append-only\._/);
}

// 2: append a lesson
{
  const root = makeFixture();
  appendEntry({
    root,
    tool: 'icloudpd',
    section: 'lesson',
    text: 'audio extraction with -vn keeps codec',
    today: '2026-05-10',
  });
  const body = fs.readFileSync(
    path.join(root, 'skills', 'tools', 'icloudpd', 'SKILL.md'),
    'utf8'
  );
  assert.match(body, /## Lessons[\s\S]*- 2026-05-10: audio extraction/);
}

// 3: missing tool dir returns error
{
  const root = makeFixture();
  const result = appendEntry({
    root,
    tool: 'nonexistent',
    section: 'trap',
    text: 'x',
    today: '2026-05-10',
  });
  assert.strictEqual(result.ok, false);
  assert.match(result.error, /not found/);
}

// 4: invalid section returns error
{
  const root = makeFixture();
  const result = appendEntry({
    root,
    tool: 'icloudpd',
    section: 'wrongtype',
    text: 'x',
    today: '2026-05-10',
  });
  assert.strictEqual(result.ok, false);
  assert.match(result.error, /section/);
}

// 5: appending preserves prior entries
{
  const root = makeFixture();
  appendEntry({ root, tool: 'icloudpd', section: 'trap', text: 'first', today: '2026-05-10' });
  appendEntry({ root, tool: 'icloudpd', section: 'trap', text: 'second', today: '2026-05-10' });
  const body = fs.readFileSync(
    path.join(root, 'skills', 'tools', 'icloudpd', 'SKILL.md'),
    'utf8'
  );
  assert.match(body, /- 2026-05-10: first/);
  assert.match(body, /- 2026-05-10: second/);
}

console.log('PASS test-levi-lesson');
