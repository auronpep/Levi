'use strict';

const fs = require('node:fs');
const path = require('node:path');

function lessonsPath(joshRoot, agentId) {
  return path.join(joshRoot, 'agents', agentId, 'lessons.md');
}

// The on-disk format is one lesson per line, so a lesson body containing a
// newline would split into two lines and everything after the first would be
// dropped by readLessons(). Escape newlines (and the escape character itself)
// on write, and reverse it on read, so the round-trip is lossless.
function escapeBody(text) {
  return String(text == null ? '' : text)
    .replace(/\\/g, '\\\\')
    .replace(/\r\n?|\n/g, '\\n');
}

function unescapeBody(text) {
  return String(text).replace(/\\(n|\\)/g, (_, c) => (c === 'n' ? '\n' : '\\'));
}

function appendLesson(joshRoot, agentId, text, opts = {}) {
  const p = lessonsPath(joshRoot, agentId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, `# Lessons — ${agentId}\n\n`);
  }
  const at = opts.at || new Date().toISOString();
  const actor = opts.actor || 'human';
  const line = `- [${at}] (${actor}) ${escapeBody(text)}\n`;
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
    entries.push({ at: m[1], actor: m[2], text: unescapeBody(m[3]) });
  }
  return { entries, path: p };
}

module.exports = { appendLesson, readLessons, lessonsPath, escapeBody, unescapeBody };
