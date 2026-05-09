#!/usr/bin/env node
// UserPromptSubmit hook — Levi dispatcher (talk axis only)
//
// Parses /talk slash commands, natural-language toggles, and updates the
// .levi-talk flag file. When a talk mode is active, injects the full
// SKILL.md body into the model's context for the current turn — this is
// what makes mid-session /talk activations actually take effect (the
// SessionStart hook only fires once at session boot).
//
// Silent-fails on every error.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { writeFlag, deleteFlag, readFlag } = require('./lib/flag');

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const talkFlag = path.join(claudeDir, '.levi-talk');

const pluginRoot = path.join(__dirname, '..');
const talkDir = path.join(pluginRoot, 'skills', 'talk');

const SAFE_NAME_RX = /^[a-z0-9_-]+$/i;

function stripFrontmatter(c) { return c.replace(/^---[\s\S]*?---\s*/, ''); }
function readSkillBody(p) {
  try { return stripFrontmatter(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

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

  // === Per-turn injection: load and emit the full SKILL body ===
  // SessionStart only fires once at session boot, so mid-session activations
  // would be invisible to the model without this. The SKILL body is small
  // (~1.5KB) so emitting it every turn is acceptable.
  const activeTalk = readFlag(talkFlag);
  if (activeTalk && SAFE_NAME_RX.test(activeTalk) && activeTalk !== 'off') {
    const body = readSkillBody(path.join(talkDir, activeTalk, 'SKILL.md'));
    if (body) {
      const context =
        `## LEVI TALK ACTIVE: ${activeTalk}\n\n` +
        `Apply the following voice rules to this response and every response ` +
        `until /talk off or a natural-language disable phrase. ` +
        `Drop the voice for: irreversible actions, security warnings, or when the user is confused.\n\n` +
        body.trim();
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: context
        }
      }));
    }
  }
});
