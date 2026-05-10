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
