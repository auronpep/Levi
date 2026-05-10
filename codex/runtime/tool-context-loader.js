#!/usr/bin/env node
'use strict';

/**
 * Levi tool-context-loader (Codex variant).
 *
 * Reads a Codex hook event from stdin. Detects whether the session is about to
 * run a tool that has a Levi tool skill (~/.codex/skills/tool-*), and emits a
 * one-line nudge telling the agent to load the matching skill before
 * continuing.
 *
 * Wire via ~/.codex/config.toml under [hooks]. Event name should be the
 * Codex equivalent of pre-tool-use (e.g. pre_tool_use, tool_use_pre, or
 * session_start as a fallback). Verify against current Codex docs at
 * https://developers.openai.com/codex/hooks before activating.
 *
 * Cross-platform stdin via fd 0. Exits 0 even on error. Never throws.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

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
    const patterns =
      fm.triggers && Array.isArray(fm.triggers.bash) ? fm.triggers.bash : [];
    if (patterns.length === 0) continue;
    entries.push({ skillName: fm.name, patterns });
  }
  return entries;
}

function commandMatches(command, pattern) {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^|[^A-Za-z0-9_])' + escaped + '($|[^A-Za-z0-9_])').test(command);
}

function extractCommand(event) {
  if (!event || typeof event !== 'object') return null;
  if (typeof event.command === 'string') return event.command;
  if (event.tool_input && typeof event.tool_input.command === 'string') {
    return event.tool_input.command;
  }
  if (event.input && typeof event.input.command === 'string') {
    return event.input.command;
  }
  return null;
}

function main() {
  let raw = '';
  try { raw = fs.readFileSync(0, 'utf8'); } catch { process.exit(0); }
  let event = {};
  try { event = JSON.parse(raw); } catch { /* fall through */ }

  const skillsDir = path.join(os.homedir(), '.codex', 'skills');
  const registry = readSkills(skillsDir);

  const cmd = extractCommand(event);
  if (cmd) {
    const matches = [];
    for (const e of registry) {
      for (const p of e.patterns) {
        if (commandMatches(cmd, p)) { matches.push(e.skillName); break; }
      }
    }
    if (matches.length > 0) {
      const list = matches.map((s) => '`' + s + '`').join(', ');
      process.stdout.write(JSON.stringify({
        additionalContext:
          'Tool detected. Load matching skill(s) before running: ' + list + '.',
      }));
    }
    process.exit(0);
  }

  // No command in event (e.g., session_start fallback). Inject general guidance.
  if (registry.length > 0) {
    const names = registry.map((e) => e.skillName).join(', ');
    process.stdout.write(JSON.stringify({
      additionalContext:
        'Tool skills available: ' + names + '. Before running any Bash command,'
        + ' check the command against each skill\'s triggers.bash list and load the'
        + ' matching skill if one applies.',
    }));
  }
  process.exit(0);
}

main();
