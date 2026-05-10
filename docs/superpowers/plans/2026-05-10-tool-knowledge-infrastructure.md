# Tool Knowledge Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the infrastructure (hook, registry, plugin wiring, /lesson command, sync script, OpenClaw plugin pack, Codex hook config) for the cross-runtime tool knowledge architecture defined in `2026-05-10-tool-knowledge-architecture-design.md`. Tool SKILL.md content is out of scope (handled by a parallel agent using `docs/builders/tool-skill-builder.md`).

**Architecture:** Universal PreToolUse hook reads `skills/tools/*/SKILL.md` frontmatter for `triggers.bash` substrings, matches against the user's Bash command, injects a "load skill X" nudge. Same skill format auto-loads in Claude Code, OpenClaw (via installable plugin pack), and Codex (via user-scope `~/.codex/hooks.json` with feature flag). Sync script distributes skill bodies + hook configs to all three runtimes.

**Tech Stack:** Node.js (CommonJS, Node 14+), PowerShell 7 for sync script, plain `node:assert` for tests, no external deps.

---

## File structure

| Path | Purpose |
|---|---|
| `skills/tools/README.md` | Convention doc for the new axis |
| `hooks/lib/frontmatter.js` | Minimal YAML frontmatter parser |
| `hooks/lib/trigger-registry.js` | Build registry from `skills/tools/*/SKILL.md` + match command |
| `hooks/guards/tool-context-loader.js` | Claude Code PreToolUse hook |
| `.claude-plugin/plugin.json` | Wire hook into Claude Code |
| `bin/levi-lesson.js` | Append logic for `/lesson` |
| `commands/lesson.md` | `/lesson` slash command |
| `openclaw/plugin.json` | OpenClaw plugin manifest |
| `openclaw/hooks/tool-context-loader.json` | OpenClaw hook definition |
| `codex/hooks.json` | Codex user-scope hook config |
| `codex/config-fragment.toml` | `[features] codex_hooks = true` |
| `bin/levi-sync.ps1` | Distribute skills + hook configs |
| `tests/hooks/test-frontmatter.js` | Frontmatter parser tests |
| `tests/hooks/test-trigger-registry.js` | Registry + match tests |
| `tests/hooks/test-tool-context-loader.js` | Hook unit tests |
| `tests/hooks/fixtures/skills/tools/foo/SKILL.md` | Test fixture skill |
| `tests/hooks/fixtures/skills/tools/bar/SKILL.md` | Test fixture skill (empty triggers) |
| `tests/bin/test-levi-lesson.js` | /lesson append tests |

---

## Tasks

### Task 1: Scaffold `skills/tools/` axis

**Files:**
- Create: `skills/tools/README.md`
- Create: `skills/tools/.gitkeep`

- [ ] **Step 1: Create README**

`skills/tools/README.md`:

```markdown
# Tool Knowledge Skills

One SKILL.md per CLI tool, library, or system that Levi-driven agents touch.

The hook layer (`hooks/guards/tool-context-loader.js`) auto-loads the matching
skill when an agent's Bash command matches a `triggers.bash` substring in the
skill's frontmatter.

## Adding a new tool skill

See `docs/builders/tool-skill-builder.md` for the authoring manual. Quickest
path:

1. Hand the builder manual + the architecture spec
   (`docs/superpowers/specs/2026-05-10-tool-knowledge-architecture-design.md`)
   + the tool name to a fresh AI session.
2. Drop the resulting `skills/tools/<name>/SKILL.md` into this directory.
3. Run `bin/levi-sync.ps1` to distribute to OpenClaw and Codex.

## Skill format

See the architecture spec section "Skill format". Frontmatter must include
`name`, `description`, and `triggers.bash` (a list, possibly empty).
```

- [ ] **Step 2: Add `.gitkeep`**

`skills/tools/.gitkeep`: empty file.

- [ ] **Step 3: Commit**

```bash
git add skills/tools/
git commit -m "feat(tools): scaffold skills/tools axis with README"
```

---

### Task 2: Frontmatter parser (TDD)

**Files:**
- Create: `hooks/lib/frontmatter.js`
- Test: `tests/hooks/test-frontmatter.js`

- [ ] **Step 1: Write the failing test**

`tests/hooks/test-frontmatter.js`:

```javascript
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
```

- [ ] **Step 2: Run, verify it fails**

```bash
node tests/hooks/test-frontmatter.js
```

Expected: `Error: Cannot find module '../../hooks/lib/frontmatter'`.

- [ ] **Step 3: Implement parser**

`hooks/lib/frontmatter.js`:

```javascript
'use strict';

function parseFrontmatter(text) {
  if (!text.startsWith('---\n')) return null;
  const end = text.indexOf('\n---', 4);
  if (end === -1) return null;
  const block = text.slice(4, end);
  const lines = block.split('\n');
  const result = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '' || line.startsWith('#')) { i++; continue; }
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (!m) { i++; continue; }
    const [, key, valueRaw] = m;
    const value = valueRaw.trim();
    if (value === '[]') {
      result[key] = [];
      i++;
    } else if (value === '') {
      const nested = {};
      i++;
      while (i < lines.length) {
        const l = lines[i];
        if (l.trim() === '') { i++; continue; }
        if (!l.startsWith('  ')) break;
        const cm = l.match(/^  ([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
        if (!cm) { i++; continue; }
        const [, ck, cvRaw] = cm;
        const cv = cvRaw.trim();
        if (cv === '[]') {
          nested[ck] = [];
          i++;
        } else if (cv === '') {
          const list = [];
          i++;
          while (i < lines.length && lines[i].startsWith('    - ')) {
            list.push(lines[i].slice(6).trim());
            i++;
          }
          nested[ck] = list;
        } else {
          nested[ck] = cv;
          i++;
        }
      }
      result[key] = nested;
    } else {
      result[key] = value;
      i++;
    }
  }
  return result;
}

module.exports = { parseFrontmatter };
```

- [ ] **Step 4: Run, verify pass**

```bash
node tests/hooks/test-frontmatter.js
```

Expected: `PASS test-frontmatter`.

- [ ] **Step 5: Commit**

```bash
git add hooks/lib/frontmatter.js tests/hooks/test-frontmatter.js
git commit -m "feat(hooks): add minimal YAML frontmatter parser"
```

---

### Task 3: Trigger registry (TDD)

**Files:**
- Create: `hooks/lib/trigger-registry.js`
- Test: `tests/hooks/test-trigger-registry.js`
- Create: `tests/hooks/fixtures/skills/tools/foo/SKILL.md`
- Create: `tests/hooks/fixtures/skills/tools/bar/SKILL.md`
- Create: `tests/hooks/fixtures/skills/tools/empty/SKILL.md`

- [ ] **Step 1: Create fixture skills**

`tests/hooks/fixtures/skills/tools/foo/SKILL.md`:

```markdown
---
name: tool-foo
description: foo skill
triggers:
  bash:
    - foo
    - python -m foo
---

# foo
body
```

`tests/hooks/fixtures/skills/tools/bar/SKILL.md`:

```markdown
---
name: tool-bar
description: bar skill
triggers:
  bash:
    - bar-cli
---

# bar
body
```

`tests/hooks/fixtures/skills/tools/empty/SKILL.md`:

```markdown
---
name: tool-empty
description: pure library, no CLI
triggers:
  bash: []
---

# empty
body
```

- [ ] **Step 2: Write the failing test**

`tests/hooks/test-trigger-registry.js`:

```javascript
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
```

- [ ] **Step 3: Run, verify fail**

```bash
node tests/hooks/test-trigger-registry.js
```

Expected: module-not-found error.

- [ ] **Step 4: Implement**

`hooks/lib/trigger-registry.js`:

```javascript
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('./frontmatter');

function buildRegistry(toolsDir) {
  const entries = [];
  let dirs;
  try { dirs = fs.readdirSync(toolsDir, { withFileTypes: true }); }
  catch { return entries; }
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const skillPath = path.join(toolsDir, d.name, 'SKILL.md');
    let content;
    try { content = fs.readFileSync(skillPath, 'utf8'); }
    catch { continue; }
    const fm = parseFrontmatter(content);
    if (!fm || !fm.name) continue;
    const patterns =
      fm.triggers && Array.isArray(fm.triggers.bash) ? fm.triggers.bash : [];
    if (patterns.length === 0) continue;
    entries.push({ skillName: fm.name, patterns });
  }
  return entries;
}

function commandMatches(command, pattern) {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(^|[^A-Za-z0-9_])' + escaped + '($|[^A-Za-z0-9_])');
  return re.test(command);
}

function matchCommand(command, registry) {
  const matches = [];
  for (const entry of registry) {
    for (const pattern of entry.patterns) {
      if (commandMatches(command, pattern)) {
        matches.push(entry.skillName);
        break;
      }
    }
  }
  return matches;
}

module.exports = { buildRegistry, matchCommand, commandMatches };
```

- [ ] **Step 5: Run, verify pass**

```bash
node tests/hooks/test-trigger-registry.js
```

Expected: `PASS test-trigger-registry`.

- [ ] **Step 6: Commit**

```bash
git add hooks/lib/trigger-registry.js tests/hooks/
git commit -m "feat(hooks): add trigger registry with word-bounded match"
```

---

### Task 4: Tool context loader hook (TDD)

**Files:**
- Create: `hooks/guards/tool-context-loader.js`
- Test: `tests/hooks/test-tool-context-loader.js`

- [ ] **Step 1: Write the failing test**

`tests/hooks/test-tool-context-loader.js`:

```javascript
'use strict';
const assert = require('node:assert');
const path = require('node:path');
const { processEvent } =
  require('../../hooks/guards/tool-context-loader');

const fixtures = path.join(__dirname, 'fixtures', 'skills', 'tools');

// 1: PreToolUse Bash with matching command -> nudge output
{
  const event = {
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command: 'foo --help' },
  };
  const out = processEvent(event, fixtures);
  assert.ok(out);
  assert.strictEqual(out.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.match(out.hookSpecificOutput.additionalContext, /tool-foo/);
}

// 2: PreToolUse Bash with no match -> null (silent)
{
  const event = {
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command: 'echo hello' },
  };
  assert.strictEqual(processEvent(event, fixtures), null);
}

// 3: non-Bash tool -> null
{
  const event = {
    hook_event_name: 'PreToolUse',
    tool_name: 'Read',
    tool_input: { file_path: '/tmp/foo' },
  };
  assert.strictEqual(processEvent(event, fixtures), null);
}

// 4: multiple matches in one command -> all listed
{
  const event = {
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command: 'foo --help && bar-cli' },
  };
  const out = processEvent(event, fixtures);
  assert.ok(out);
  const ctx = out.hookSpecificOutput.additionalContext;
  assert.match(ctx, /tool-foo/);
  assert.match(ctx, /tool-bar/);
}

// 5: missing tool_input handled gracefully
{
  const event = {
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
  };
  assert.strictEqual(processEvent(event, fixtures), null);
}

console.log('PASS test-tool-context-loader');
```

- [ ] **Step 2: Run, verify fail**

```bash
node tests/hooks/test-tool-context-loader.js
```

Expected: module-not-found.

- [ ] **Step 3: Implement**

`hooks/guards/tool-context-loader.js`:

```javascript
#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { buildRegistry, matchCommand } = require('../lib/trigger-registry');

function processEvent(event, toolsDir) {
  if (!event || event.hook_event_name !== 'PreToolUse') return null;
  if (event.tool_name !== 'Bash') return null;
  const command =
    event.tool_input && typeof event.tool_input.command === 'string'
      ? event.tool_input.command
      : null;
  if (!command) return null;
  const registry = buildRegistry(toolsDir);
  const matches = matchCommand(command, registry);
  if (matches.length === 0) return null;
  const skillList = matches.map((s) => '`' + s + '`').join(', ');
  const ctx =
    'Tool detected in Bash command. Load the matching skill(s) before ' +
    'running if not already loaded: ' + skillList +
    '. The skill body has the canonical capability surface, auth, error ' +
    'handling, traps, and lessons for this tool.';
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: ctx,
    },
  };
}

function main() {
  let stdin = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { stdin += chunk; });
  process.stdin.on('end', () => {
    let event;
    try { event = JSON.parse(stdin); }
    catch { process.exit(0); }
    const toolsDir = path.join(
      process.env.CLAUDE_PLUGIN_ROOT || path.join(__dirname, '..', '..'),
      'skills', 'tools'
    );
    const out = processEvent(event, toolsDir);
    if (out) process.stdout.write(JSON.stringify(out));
    process.exit(0);
  });
}

if (require.main === module) main();

module.exports = { processEvent };
```

- [ ] **Step 4: Run, verify pass**

```bash
node tests/hooks/test-tool-context-loader.js
```

Expected: `PASS test-tool-context-loader`.

- [ ] **Step 5: Commit**

```bash
git add hooks/guards/tool-context-loader.js tests/hooks/test-tool-context-loader.js
git commit -m "feat(hooks): add PreToolUse hook for tool skill auto-load nudges"
```

---

### Task 5: Wire hook in `.claude-plugin/plugin.json`

**Files:**
- Modify: `.claude-plugin/plugin.json`

- [ ] **Step 1: Read current plugin.json**

```bash
cat .claude-plugin/plugin.json
```

- [ ] **Step 2: Add hooks block**

If the file currently has no `hooks` key, add:

```json
"hooks": {
  "PreToolUse": [
    {
      "matcher": "Bash",
      "hooks": [
        {
          "type": "command",
          "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/guards/tool-context-loader.js\"",
          "timeout": 5
        }
      ]
    }
  ]
}
```

If a `hooks` key already exists, merge: add the `PreToolUse` array (or append to it if it exists). Preserve existing entries verbatim.

- [ ] **Step 3: Smoke test the hook end-to-end**

```bash
echo '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"foo --help"}}' | CLAUDE_PLUGIN_ROOT="$(pwd)/tests/hooks/fixtures" node hooks/guards/tool-context-loader.js
```

Wait — this points at fixtures with foo/bar skills. Use:

```bash
echo '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"foo --help"}}' | node hooks/guards/tool-context-loader.js
```

Expected: empty output (no real `skills/tools/foo/` exists in production tree).

```bash
echo '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"echo hi"}}' | node hooks/guards/tool-context-loader.js
```

Expected: empty output.

(Real skill matching gets tested once a SKILL.md is in `skills/tools/`. The hook is wired correctly if it exits 0 cleanly with no output.)

- [ ] **Step 4: Commit**

```bash
git add .claude-plugin/plugin.json
git commit -m "feat(plugin): wire tool-context-loader as PreToolUse Bash hook"
```

---

### Task 6: `/lesson` append script (TDD)

**Files:**
- Create: `bin/levi-lesson.js`
- Test: `tests/bin/test-levi-lesson.js`

- [ ] **Step 1: Write the failing test**

`tests/bin/test-levi-lesson.js`:

```javascript
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

// 5: appending to a section that already has entries preserves them
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
```

- [ ] **Step 2: Run, verify fail**

```bash
node tests/bin/test-levi-lesson.js
```

- [ ] **Step 3: Implement**

`bin/levi-lesson.js`:

```javascript
#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');

function appendEntry({ root, tool, section, text, today }) {
  const valid = { trap: 'Traps', lesson: 'Lessons' };
  const heading = valid[section];
  if (!heading) {
    return { ok: false, error: 'section must be "trap" or "lesson"' };
  }
  const skillPath = path.join(root, 'skills', 'tools', tool, 'SKILL.md');
  if (!fs.existsSync(skillPath)) {
    return { ok: false, error: 'skill not found at ' + skillPath };
  }
  const body = fs.readFileSync(skillPath, 'utf8');
  const headingRe = new RegExp('(^## ' + heading + '\\n)([\\s\\S]*?)(?=\\n## |$)', 'm');
  const m = body.match(headingRe);
  if (!m) {
    return { ok: false, error: 'section "## ' + heading + '" not found in skill' };
  }
  const newEntry = '- ' + today + ': ' + text + '\n';
  const sectionBody = m[2];
  let updatedSection;
  if (sectionBody.trim() === '' || /^_Append-only/m.test(sectionBody)) {
    updatedSection = '\n' + newEntry;
  } else {
    updatedSection = sectionBody.replace(/\s*$/, '') + '\n' + newEntry;
  }
  const updated = body.replace(headingRe, m[1] + updatedSection);
  fs.writeFileSync(skillPath, updated);
  return { ok: true, path: skillPath };
}

function parseArgs(argv) {
  const out = { tool: null, section: null, text: null };
  const rest = [];
  for (const a of argv) {
    const m = a.match(/^(tool|section)=(.+)$/);
    if (m) out[m[1]] = m[2];
    else rest.push(a);
  }
  if (rest.length > 0) out.text = rest.join(' ');
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.tool || !args.section || !args.text) {
    process.stderr.write(
      'Usage: levi-lesson tool=<name> section=<trap|lesson> "<text>"\n'
    );
    process.exit(1);
  }
  const today = new Date().toISOString().slice(0, 10);
  const root = process.env.LEVI_ROOT || path.join(__dirname, '..');
  const result = appendEntry({ ...args, root, today });
  if (!result.ok) {
    process.stderr.write('Error: ' + result.error + '\n');
    process.exit(1);
  }
  process.stdout.write(
    'Appended to ' + result.path + ': - ' + today + ': ' + args.text + '\n'
  );
}

if (require.main === module) main();

module.exports = { appendEntry, parseArgs };
```

- [ ] **Step 4: Run, verify pass**

```bash
node tests/bin/test-levi-lesson.js
```

Expected: `PASS test-levi-lesson`.

- [ ] **Step 5: Commit**

```bash
git add bin/levi-lesson.js tests/bin/test-levi-lesson.js
git commit -m "feat(lesson): add append script for /lesson trap+lesson entries"
```

---

### Task 7: `/lesson` slash command

**Files:**
- Create: `commands/lesson.md`

- [ ] **Step 1: Create slash command**

`commands/lesson.md`:

```markdown
---
description: Append a date-stamped trap or lesson entry to a tool skill (skills/tools/<name>/SKILL.md). Usage `/lesson tool=<name> section=<trap|lesson> "<text>"`.
argument-hint: tool=<name> section=<trap|lesson> "<text>"
allowed-tools: Bash
---

Run the lesson append script with the provided arguments and report the result.

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/levi-lesson.js" $ARGUMENTS
```

If the script reports success, confirm the path and the line that was added. If
it reports an error, show the error verbatim and stop — do not attempt to fix
or guess.
```

- [ ] **Step 2: Smoke test**

(Manual — fire `/lesson tool=foo section=trap "test"` against a fixture in a session. Skip during automated execution; verified end-to-end by Task 11.)

- [ ] **Step 3: Commit**

```bash
git add commands/lesson.md
git commit -m "feat(commands): add /lesson slash command"
```

---

### Task 8: OpenClaw plugin pack

**Files:**
- Create: `openclaw/plugin.json`
- Create: `openclaw/hooks/tool-context-loader.json`
- Create: `openclaw/README.md`

- [ ] **Step 1: Verify OpenClaw hook format**

Run:

```powershell
openclaw hooks list --json
```

If any existing hooks are listed, run:

```powershell
openclaw hooks info <existing-hook-name> --json
```

Capture the schema. If no hooks exist locally, fetch the format from
`https://docs.openclaw.ai/cli/hooks` (operator may need to do this manually
if WebFetch is unavailable in the execution environment).

Document the schema fields used by an OpenClaw hook config in a comment at
the top of `openclaw/hooks/tool-context-loader.json` so the manifest stays
self-documenting.

- [ ] **Step 2: Author plugin manifest**

`openclaw/plugin.json` (best-effort — schema may need adjustment after Step 1):

```json
{
  "name": "levi-tool-knowledge",
  "version": "0.1.0",
  "description": "Auto-load tool skills (skills/tools/*) on matching Bash commands.",
  "author": "Levi",
  "hooks": [
    {
      "id": "tool-context-loader",
      "config": "hooks/tool-context-loader.json"
    }
  ]
}
```

`openclaw/hooks/tool-context-loader.json`:

```json
{
  "id": "tool-context-loader",
  "event": "pre-tool-use",
  "matcher": { "tool": "bash" },
  "command": "node",
  "args": [
    "${OPENCLAW_PLUGIN_ROOT}/runtime/tool-context-loader.js"
  ],
  "timeout_ms": 5000,
  "description": "Inject load-skill nudge when a Bash command matches a tool skill trigger."
}
```

`openclaw/README.md`:

```markdown
# Levi OpenClaw plugin pack

Installs the Levi tool-knowledge hook into OpenClaw.

## Install

```powershell
openclaw plugins install C:\Levi\openclaw
openclaw hooks list --json
openclaw hooks check --json
```

The plugin reads tool skills from `~/.openclaw/skills/tool-*/SKILL.md` (populated
by `bin/levi-sync.ps1`).

## Schema verification

The hook event/matcher/command schema in `hooks/tool-context-loader.json` is a
best-effort match against the OpenClaw hook format. Run `openclaw hooks info
tool-context-loader --json` after install to verify, and update the manifest if
the runtime reports schema errors.
```

- [ ] **Step 3: Copy hook script into pack**

`openclaw/runtime/tool-context-loader.js`: copy from `hooks/guards/tool-context-loader.js`. (Adjust path resolution if OpenClaw uses a different env var than `CLAUDE_PLUGIN_ROOT`. Per the JSON above, use `OPENCLAW_PLUGIN_ROOT`.)

Modify the copy so that `toolsDir` falls back to `OPENCLAW_PLUGIN_ROOT`-relative path:

```javascript
const toolsDir = path.join(
  process.env.OPENCLAW_PLUGIN_ROOT || process.env.CLAUDE_PLUGIN_ROOT
    || path.join(__dirname, '..', '..'),
  'skills', 'tools'
);
```

The OpenClaw runtime reads skills from `~/.openclaw/skills/tool-*/SKILL.md` (a different layout than Claude Code's `skills/tools/*/SKILL.md`). The OpenClaw runtime needs its own resolver that knows about `~/.openclaw/skills/`. Adapt:

Create `openclaw/runtime/tool-context-loader.js`:

```javascript
#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function readSkills(skillsDir) {
  const entries = [];
  let dirs;
  try { dirs = fs.readdirSync(skillsDir, { withFileTypes: true }); }
  catch { return entries; }
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    if (!d.name.startsWith('tool-')) continue;
    const skillPath = path.join(skillsDir, d.name, 'SKILL.md');
    let content;
    try { content = fs.readFileSync(skillPath, 'utf8'); }
    catch { continue; }
    const fm = parseFrontmatter(content);
    if (!fm || !fm.name) continue;
    const patterns = fm.triggers && Array.isArray(fm.triggers.bash) ? fm.triggers.bash : [];
    if (patterns.length === 0) continue;
    entries.push({ skillName: fm.name, patterns });
  }
  return entries;
}

function parseFrontmatter(text) {
  // (inline copy of hooks/lib/frontmatter.js parseFrontmatter)
  if (!text.startsWith('---\n')) return null;
  const end = text.indexOf('\n---', 4);
  if (end === -1) return null;
  const block = text.slice(4, end);
  const lines = block.split('\n');
  const result = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '' || line.startsWith('#')) { i++; continue; }
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (!m) { i++; continue; }
    const [, key, valueRaw] = m;
    const value = valueRaw.trim();
    if (value === '[]') { result[key] = []; i++; }
    else if (value === '') {
      const nested = {}; i++;
      while (i < lines.length) {
        const l = lines[i];
        if (l.trim() === '') { i++; continue; }
        if (!l.startsWith('  ')) break;
        const cm = l.match(/^  ([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
        if (!cm) { i++; continue; }
        const [, ck, cvRaw] = cm;
        const cv = cvRaw.trim();
        if (cv === '[]') { nested[ck] = []; i++; }
        else if (cv === '') {
          const list = []; i++;
          while (i < lines.length && lines[i].startsWith('    - ')) {
            list.push(lines[i].slice(6).trim()); i++;
          }
          nested[ck] = list;
        } else { nested[ck] = cv; i++; }
      }
      result[key] = nested;
    } else { result[key] = value; i++; }
  }
  return result;
}

function commandMatches(command, pattern) {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^|[^A-Za-z0-9_])' + escaped + '($|[^A-Za-z0-9_])').test(command);
}

function main() {
  let stdin = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { stdin += c; });
  process.stdin.on('end', () => {
    let event;
    try { event = JSON.parse(stdin); } catch { process.exit(0); }
    const cmd = event && event.tool_input && event.tool_input.command;
    if (typeof cmd !== 'string') process.exit(0);
    const skillsDir = path.join(os.homedir(), '.openclaw', 'skills');
    const registry = readSkills(skillsDir);
    const matches = [];
    for (const e of registry) {
      for (const p of e.patterns) {
        if (commandMatches(cmd, p)) { matches.push(e.skillName); break; }
      }
    }
    if (matches.length === 0) process.exit(0);
    const list = matches.map((s) => '`' + s + '`').join(', ');
    process.stdout.write(JSON.stringify({
      additionalContext:
        'Tool detected. Load matching skill(s) before running: ' + list + '.',
    }));
    process.exit(0);
  });
}

if (require.main === module) main();
```

- [ ] **Step 4: Smoke test (if OpenClaw available locally)**

```powershell
openclaw plugins install C:\Levi\openclaw
openclaw hooks list --json
```

Expected: `tool-context-loader` appears in the list. If schema mismatch, `openclaw plugins install` will report the error — adjust `plugin.json` / `hooks/tool-context-loader.json` accordingly.

If OpenClaw is not available, leave a TODO at the top of the README noting that schema verification was deferred.

- [ ] **Step 5: Commit**

```bash
git add openclaw/
git commit -m "feat(openclaw): add tool-knowledge plugin pack (best-effort schema)"
```

---

### Task 9: Codex hook config

**Files:**
- Create: `codex/hooks.json`
- Create: `codex/config-fragment.toml`
- Create: `codex/runtime/tool-context-loader.js`
- Create: `codex/README.md`

- [ ] **Step 1: Verify Codex hook format**

Reference: https://developers.openai.com/codex/hooks

If the operator can browse, capture the exact hook JSON schema and the hook
script invocation contract. If not, use the best-effort scaffold below and
flag for verification in the README.

- [ ] **Step 2: Build hooks.json**

`codex/hooks.json` (best-effort — schema may need adjustment):

```json
{
  "hooks": [
    {
      "id": "levi-tool-context-loader",
      "event": "pre_tool_use",
      "matcher": { "tool": "bash" },
      "command": "node",
      "args": ["~/.codex/runtime/levi/tool-context-loader.js"],
      "timeout_ms": 5000
    }
  ]
}
```

- [ ] **Step 3: Build config fragment**

`codex/config-fragment.toml`:

```toml
[features]
codex_hooks = true
```

- [ ] **Step 4: Build runtime script**

`codex/runtime/tool-context-loader.js`: copy from `openclaw/runtime/tool-context-loader.js` but adjust `skillsDir` to point at the Codex skill location (TBD per docs — leave as a placeholder constant `CODEX_SKILLS_DIR` resolved via env var, defaulting to `~/.codex/skills/`).

- [ ] **Step 5: Build README**

`codex/README.md`:

```markdown
# Levi Codex hook config

Installs the Levi tool-knowledge hook into Codex (user-scope).

## Install

Copy `hooks.json` into `~/.codex/hooks.json` (or merge if existing) and
ensure `~/.codex/config.toml` includes:

```toml
[features]
codex_hooks = true
```

`bin/levi-sync.ps1` performs both steps idempotently.

## Schema verification

The hook event/matcher/command schema is a best-effort match. Reference:
https://developers.openai.com/codex/hooks. Verify after install and update if
the runtime reports schema errors.
```

- [ ] **Step 6: Commit**

```bash
git add codex/
git commit -m "feat(codex): add tool-knowledge hook config (user-scope, feature-flagged)"
```

---

### Task 10: Sync script `bin/levi-sync.ps1`

**Files:**
- Create: `bin/levi-sync.ps1`

- [ ] **Step 1: Implement script**

`bin/levi-sync.ps1`:

```powershell
#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Distribute Levi tool skills + hook configs to OpenClaw and Codex.

.DESCRIPTION
    Idempotent. Safe to re-run after editing any skills/tools/<name>/SKILL.md.
    Use -WhatIf for a dry run.

.EXAMPLE
    pwsh -NoProfile -File bin/levi-sync.ps1
    pwsh -NoProfile -File bin/levi-sync.ps1 -WhatIf
#>
[CmdletBinding(SupportsShouldProcess)]
param()

$ErrorActionPreference = 'Stop'
$LeviRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ToolsDir = Join-Path $LeviRoot 'skills\tools'

function Write-Section($name) {
    Write-Host ""
    Write-Host "=== $name ===" -ForegroundColor Cyan
}

function Sync-Directory {
    param([string]$Source, [string]$Target)
    if (-not (Test-Path $Source)) { return @{ Copied = 0; Skipped = 0 } }
    if ($PSCmdlet.ShouldProcess($Target, "Mirror from $Source")) {
        New-Item -ItemType Directory -Force -Path $Target | Out-Null
    }
    $copied = 0; $skipped = 0
    Get-ChildItem -LiteralPath $Source -Directory | ForEach-Object {
        $skill = Join-Path $_.FullName 'SKILL.md'
        if (-not (Test-Path -LiteralPath $skill)) { return }
        $destDir = Join-Path $Target ("tool-" + $_.Name)
        $destFile = Join-Path $destDir 'SKILL.md'
        if ((Test-Path -LiteralPath $destFile) -and
            ((Get-FileHash -LiteralPath $skill).Hash -eq (Get-FileHash -LiteralPath $destFile).Hash)) {
            $skipped++
            return
        }
        if ($PSCmdlet.ShouldProcess($destFile, "Copy SKILL.md")) {
            New-Item -ItemType Directory -Force -Path $destDir | Out-Null
            Copy-Item -LiteralPath $skill -Destination $destFile -Force
        }
        $copied++
    }
    return @{ Copied = $copied; Skipped = $skipped }
}

# 1. Validate
Write-Section "Validate"
if (-not (Test-Path -LiteralPath $ToolsDir)) {
    Write-Host "skills/tools/ does not exist; nothing to sync." -ForegroundColor Yellow
    exit 0
}
$skillCount = (Get-ChildItem -LiteralPath $ToolsDir -Directory | Where-Object {
    Test-Path -LiteralPath (Join-Path $_.FullName 'SKILL.md')
}).Count
Write-Host "Levi root:  $LeviRoot"
Write-Host "Tools dir:  $ToolsDir"
Write-Host "Skill count: $skillCount"

# 2. OpenClaw
Write-Section "OpenClaw"
$ocSkillsDir = Join-Path $env:USERPROFILE '.openclaw\skills'
$ocResult = Sync-Directory -Source $ToolsDir -Target $ocSkillsDir
Write-Host ("Skills synced to {0}: {1} copied, {2} unchanged" -f $ocSkillsDir, $ocResult.Copied, $ocResult.Skipped)

$ocPlugin = Join-Path $LeviRoot 'openclaw'
if (Test-Path -LiteralPath $ocPlugin) {
    if (Get-Command openclaw -ErrorAction SilentlyContinue) {
        if ($PSCmdlet.ShouldProcess($ocPlugin, "openclaw plugins install")) {
            Write-Host "Installing OpenClaw plugin pack..."
            & openclaw plugins install $ocPlugin
            if ($LASTEXITCODE -ne 0) {
                Write-Host "openclaw plugins install reported a non-zero exit code." -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "openclaw CLI not found in PATH; skipping plugin install." -ForegroundColor Yellow
    }
}

# 3. Codex
Write-Section "Codex"
$codexDir = Join-Path $env:USERPROFILE '.codex'
$codexSkillsDir = Join-Path $codexDir 'skills'
$cxResult = Sync-Directory -Source $ToolsDir -Target $codexSkillsDir
Write-Host ("Skills synced to {0}: {1} copied, {2} unchanged" -f $codexSkillsDir, $cxResult.Copied, $cxResult.Skipped)

# Hooks JSON
$hooksSrc = Join-Path $LeviRoot 'codex\hooks.json'
$hooksDest = Join-Path $codexDir 'hooks.json'
if (Test-Path -LiteralPath $hooksSrc) {
    if (Test-Path -LiteralPath $hooksDest) {
        if ((Get-FileHash -LiteralPath $hooksSrc).Hash -eq (Get-FileHash -LiteralPath $hooksDest).Hash) {
            Write-Host "$hooksDest already current."
        } else {
            Write-Host "$hooksDest exists with different content; not overwriting. Diff manually if needed." -ForegroundColor Yellow
        }
    } else {
        if ($PSCmdlet.ShouldProcess($hooksDest, "Copy hooks.json")) {
            New-Item -ItemType Directory -Force -Path $codexDir | Out-Null
            Copy-Item -LiteralPath $hooksSrc -Destination $hooksDest -Force
            Write-Host "Wrote $hooksDest"
        }
    }
}

# Config fragment merge
$configFragSrc = Join-Path $LeviRoot 'codex\config-fragment.toml'
$configDest = Join-Path $codexDir 'config.toml'
if (Test-Path -LiteralPath $configFragSrc) {
    $fragment = Get-Content -LiteralPath $configFragSrc -Raw
    $existing = ''
    if (Test-Path -LiteralPath $configDest) {
        $existing = Get-Content -LiteralPath $configDest -Raw
    }
    if ($existing -match '(?m)^\s*codex_hooks\s*=\s*true') {
        Write-Host "codex_hooks=true already present in $configDest."
    } else {
        if ($PSCmdlet.ShouldProcess($configDest, "Append config fragment")) {
            New-Item -ItemType Directory -Force -Path $codexDir | Out-Null
            Add-Content -LiteralPath $configDest -Value "`n$fragment"
            Write-Host "Appended fragment to $configDest"
        }
    }
}

# Runtime scripts
foreach ($pair in @(
    @{ Src = Join-Path $LeviRoot 'codex\runtime\tool-context-loader.js'; Dest = Join-Path $codexDir 'runtime\levi\tool-context-loader.js' }
)) {
    if (Test-Path -LiteralPath $pair.Src) {
        if ($PSCmdlet.ShouldProcess($pair.Dest, "Copy runtime script")) {
            New-Item -ItemType Directory -Force -Path (Split-Path $pair.Dest) | Out-Null
            Copy-Item -LiteralPath $pair.Src -Destination $pair.Dest -Force
            Write-Host ("Copied " + $pair.Dest)
        }
    }
}

Write-Section "Done"
Write-Host "Sync complete."
```

- [ ] **Step 2: Smoke test dry-run**

```bash
pwsh -NoProfile -File bin/levi-sync.ps1 -WhatIf
```

Expected: prints what it would do for each section without writing anything.

- [ ] **Step 3: Smoke test real run (if no real skills exist yet, this is a no-op)**

```bash
pwsh -NoProfile -File bin/levi-sync.ps1
```

Expected: completes without error. No-op or minimal output if `skills/tools/` is empty.

- [ ] **Step 4: Commit**

```bash
git add bin/levi-sync.ps1
git commit -m "feat(sync): add levi-sync.ps1 to distribute skills + hook configs"
```

---

### Task 11: Final integration smoke test

- [ ] **Step 1: Re-run all unit tests**

```bash
node tests/hooks/test-frontmatter.js
node tests/hooks/test-trigger-registry.js
node tests/hooks/test-tool-context-loader.js
node tests/bin/test-levi-lesson.js
```

Expected: all four print `PASS …`.

- [ ] **Step 2: Manual end-to-end check with a temp skill**

Create a temp skill `skills/tools/_smoketest/SKILL.md`:

```markdown
---
name: tool-_smoketest
description: smoke test
triggers:
  bash:
    - _smoketest_token
---

# _smoketest

## Traps

_Append-only._

## Lessons

_Append-only._
```

Run hook against a matching command:

```bash
echo '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"_smoketest_token --help"}}' | node hooks/guards/tool-context-loader.js
```

Expected: JSON output with `additionalContext` mentioning `tool-_smoketest`.

Append a trap:

```bash
node bin/levi-lesson.js tool=_smoketest section=trap "smoke test entry"
```

Verify:

```bash
cat skills/tools/_smoketest/SKILL.md
```

Expected: a `- 2026-MM-DD: smoke test entry` line under `## Traps`.

Run sync dry-run:

```bash
pwsh -NoProfile -File bin/levi-sync.ps1 -WhatIf
```

Expected: shows `_smoketest` skill being synced.

Cleanup:

```bash
rm -rf skills/tools/_smoketest
```

- [ ] **Step 3: Final commit (if any cleanup needed)**

If cleanup leaves uncommitted changes, no-op. Otherwise:

```bash
git status
```

Should be clean.

---

## Self-review checklist

- [x] Spec coverage: every architecture spec section maps to at least one task
  (skills/tools axis → 1; SKILL.md format → handled by external builder; hooks
  per runtime → 4, 5, 8, 9; sync script → 10; /lesson → 6, 7; testing → 11).
- [x] No "TODO/TBD" placeholders in steps (only in commented "verify schema"
  callouts, which are explicit operational items, not vague tasks).
- [x] Type/name consistency: `parseFrontmatter`, `buildRegistry`,
  `matchCommand`, `commandMatches`, `processEvent`, `appendEntry` — used
  consistently across tasks.
- [x] All file paths exact; all commands runnable; all code copy-pasteable.

## Known acceptance items at completion

- All four test files pass.
- Claude Code hook fires on Bash with no errors.
- `/lesson` slash command writes a date-stamped entry.
- `bin/levi-sync.ps1 -WhatIf` runs cleanly.
- OpenClaw plugin pack and Codex hook config exist with best-effort schema; both
  flagged for live-runtime verification in their respective READMEs.
