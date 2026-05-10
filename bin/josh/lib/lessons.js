'use strict';

const fs = require('node:fs');
const path = require('node:path');

function lessonsPath(joshRoot, agentId) {
  return path.join(joshRoot, 'agents', agentId, 'lessons.md');
}

function appendLesson(joshRoot, agentId, text, opts = {}) {
  const p = lessonsPath(joshRoot, agentId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, `# Lessons — ${agentId}\n\n`);
  }
  const at = opts.at || new Date().toISOString();
  const actor = opts.actor || 'human';
  const line = `- [${at}] (${actor}) ${text}\n`;
  fs.appendFileSync(p, line);
  return { path: p, line };
}

function readLessons(joshRoot, agentId) {
  const p = lessonsPath(joshRoot, agentId);
  if (!fs.existsSync(p)) return { entries: [], path: p };
  const text = fs.readFileSync(p, 'utf8');
  const entries = [];
  const re = /^- \[([^\]]+)\]\s+\(([^)]+)\)\s+(.+)$/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    entries.push({ at: m[1], actor: m[2], text: m[3] });
  }
  return { entries, path: p };
}

module.exports = { appendLesson, readLessons, lessonsPath };
