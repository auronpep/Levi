#!/usr/bin/env node
'use strict';
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
