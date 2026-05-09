#!/usr/bin/env node
// UserPromptSubmit hook — Levi dispatcher (talk axis only)
//
// Parses /talk slash commands, natural-language toggles, and updates the
// .levi-talk flag file. Emits per-turn reinforcement when talk mode is active.
//
// Silent-fails on every error.

const path = require('path');
const os = require('os');
const { writeFlag, deleteFlag, readFlag } = require('./lib/flag');

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const talkFlag = path.join(claudeDir, '.levi-talk');

const SAFE_NAME_RX = /^[a-z0-9_-]+$/i;

let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  let inputData = {};
  try { inputData = JSON.parse(input); } catch (e) { process.exit(0); }
  const prompt = (inputData.prompt || '').trim();

  // === /talk <name> | /talk off | /talk ===
  const talkMatch = prompt.match(/^\/talk(?:\s+(\S.*?))?\s*$/i);
  if (talkMatch) {
    const arg = (talkMatch[1] || '').trim().toLowerCase();
    if (arg === 'off') {
      deleteFlag(talkFlag);
    } else if (arg && SAFE_NAME_RX.test(arg)) {
      writeFlag(talkFlag, arg);
    }
    // Empty arg → no-op (slash command lists modes)
    process.exit(0);
  }

  // === Natural-language disable ===
  if (/\b(stop|disable|turn off)\s+(caveman)\b/i.test(prompt) ||
      /\btalk\s+normally\b/i.test(prompt) ||
      /\bnormal\s+mode\b/i.test(prompt) ||
      /\b(stop|quit)\s+talking\s+like\s+\w+/i.test(prompt)) {
    deleteFlag(talkFlag);
    process.exit(0);
  }

  // === Natural-language activation: "talk like a caveman" ===
  const natMatch = prompt.match(/\btalk\s+like\s+(?:a\s+|an\s+)?(\w[\w-]*)/i);
  if (natMatch) {
    const arg = natMatch[1].toLowerCase();
    if (SAFE_NAME_RX.test(arg)) writeFlag(talkFlag, arg);
    // Don't exit — let prompt continue to Claude.
  }

  // === Per-turn reinforcement ===
  const activeTalk = readFlag(talkFlag);
  if (activeTalk) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext:
          `Levi active: talk="${activeTalk}". ` +
          `Apply rules from SessionStart context. ` +
          `Drop mode for: irreversible actions, security warnings, or when user is confused.`
      }
    }));
  }
});
