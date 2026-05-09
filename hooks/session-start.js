#!/usr/bin/env node
// SessionStart hook — Levi dispatcher (talk axis only)
//
// Reads the .levi-talk flag, loads the matching skills/talk/<name>/SKILL.md
// body, and emits as hidden SessionStart context.
//
// Silent-fails on every error.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { readFlag } = require('./lib/flag');

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const talkFlag = path.join(claudeDir, '.levi-talk');

const pluginRoot = path.join(__dirname, '..');
const talkDir = path.join(pluginRoot, 'skills', 'talk');

function safeName(n) { return n && /^[a-z0-9_-]+$/i.test(n) ? n : null; }
function stripFrontmatter(c) { return c.replace(/^---[\s\S]*?---\s*/, ''); }
function readSkillBody(p) {
  try { return stripFrontmatter(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

const activeTalk = readFlag(talkFlag);
if (!activeTalk || activeTalk === 'off' || !safeName(activeTalk)) process.exit(0);

const body = readSkillBody(path.join(talkDir, activeTalk, 'SKILL.md'));
if (!body) process.exit(0);

process.stdout.write(`## LEVI TALK: ${activeTalk}\n\n${body.trim()}`);
