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
