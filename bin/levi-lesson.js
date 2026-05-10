#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');

function appendEntry({ root, tool, section, text, today }) {
  const valid = { trap: 'Traps', lesson: 'Lessons' };
  const heading = valid[section];
  if (!heading) {
    return { ok: false, error: 'section must be "trap" or "lesson"' };
  }
  const skillPath = path.join(root, 'skills', 'tools', tool, 'SKILL.md');
  if (!fs.existsSync(skillPath)) {
    return { ok: false, error: 'skill not found at ' + skillPath };
  }
  const body = fs.readFileSync(skillPath, 'utf8');
  // Match the section body. Use `\n## ` as the leading sentinel and `$` (end
  // of string, no `m` flag) as the trailing alternative so the lazy capture
  // doesn't bail at end-of-line. Real SKILL.md files always have content
  // before any `## Traps` / `## Lessons`, so the leading newline is safe.
  const headingRe = new RegExp(
    '(\\n## ' + heading + '\\n)([\\s\\S]*?)(?=\\n## |$)'
  );
  const m = body.match(headingRe);
  if (!m) {
    return {
      ok: false,
      error: 'section "## ' + heading + '" not found in skill',
    };
  }
  const newEntry = '- ' + today + ': ' + text + '\n';
  const sectionBody = m[2];
  let updatedSection;
  if (sectionBody.trim() === '' || /^_Append-only/m.test(sectionBody)) {
    updatedSection = '\n' + newEntry;
  } else {
    updatedSection = sectionBody.replace(/\s*$/, '') + '\n' + newEntry;
  }
  const updated = body.replace(headingRe, m[1] + updatedSection);
  fs.writeFileSync(skillPath, updated);
  return { ok: true, path: skillPath };
}

function parseArgs(argv) {
  const out = { tool: null, section: null, text: null };
  const rest = [];
  for (const a of argv) {
    const m = a.match(/^(tool|section)=(.+)$/);
    if (m) out[m[1]] = m[2];
    else rest.push(a);
  }
  if (rest.length > 0) out.text = rest.join(' ');
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.tool || !args.section || !args.text) {
    process.stderr.write(
      'Usage: levi-lesson tool=<name> section=<trap|lesson> "<text>"\n'
    );
    process.exit(1);
  }
  const today = new Date().toISOString().slice(0, 10);
  const root = process.env.LEVI_ROOT || path.join(__dirname, '..');
  const result = appendEntry({ ...args, root, today });
  if (!result.ok) {
    process.stderr.write('Error: ' + result.error + '\n');
    process.exit(1);
  }
  process.stdout.write(
    'Appended to ' + result.path + ': - ' + today + ': ' + args.text + '\n'
  );
}

if (require.main === module) main();

module.exports = { appendEntry, parseArgs };
