/**
 * Levi tool-trigger-bootstrap hook handler.
 *
 * Fires at agent:bootstrap. Reads installed tool-* skills from
 * ~/.openclaw/skills and emits guidance text the agent should use to
 * auto-load matching skills when running Bash commands.
 *
 * The exact OpenClaw plugin SDK contract for hook handlers is not yet
 * documented locally, so this handler exports both a default function and
 * a `handle` named export. The handler signature follows common patterns
 * (event in, structured object out). If OpenClaw's actual contract differs,
 * update the export shape — the inner logic (reading skills, building
 * guidance text) remains valid.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

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

function buildGuidance() {
  const skillsDir = join(homedir(), '.openclaw', 'skills');
  let entries = [];
  try { entries = readdirSync(skillsDir, { withFileTypes: true }); }
  catch { return null; }
  const tools = [];
  for (const d of entries) {
    if (!d.isDirectory() || !d.name.startsWith('tool-')) continue;
    let content;
    try { content = readFileSync(join(skillsDir, d.name, 'SKILL.md'), 'utf8'); }
    catch { continue; }
    const fm = parseFrontmatter(content);
    if (!fm || !fm.name) continue;
    const patterns = fm.triggers && Array.isArray(fm.triggers.bash) ? fm.triggers.bash : [];
    if (patterns.length === 0) continue;
    tools.push({ name: fm.name, patterns });
  }
  if (tools.length === 0) return null;
  const lines = [
    'Tool-skill trigger contract: before running any Bash command, scan the',
    'command text for substrings matching any of the following patterns. If',
    'there\'s a match, invoke the corresponding skill before continuing.',
    '',
  ];
  for (const t of tools) {
    lines.push(`- ${t.name}: ${t.patterns.map((p) => '\`' + p + '\`').join(', ')}`);
  }
  lines.push('');
  lines.push('Skills loaded once per session. After the first match, the body sits in context.');
  return lines.join('\n');
}

export async function handle(_event) {
  const guidance = buildGuidance();
  if (!guidance) return null;
  return { additionalContext: guidance };
}

export default handle;
