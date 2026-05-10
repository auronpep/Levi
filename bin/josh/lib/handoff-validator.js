'use strict';

const REQUIRED_FIELDS = [
  'Task ID',
  'Files changed',
  'Decision',
  'Open blockers',
  'Risks',
  'Downstream unblocked',
  'Downstream blocked',
  'Verification',
  'Human review',
];

function extractH2Sections(text) {
  const sections = [];
  const re = /^##\s+(.+)$/gm;
  const matches = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    matches.push({ title: m[1].trim(), start: m.index, contentStart: m.index + m[0].length });
  }
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const next = matches[i + 1];
    const body = text.slice(cur.contentStart, next ? next.start : text.length).trim();
    sections.push({ title: cur.title, body });
  }
  return sections;
}

function validateHandoff(text) {
  const errors = [];
  const sections = extractH2Sections(text);
  const titleSet = new Set(sections.map((s) => s.title));
  for (const req of REQUIRED_FIELDS) {
    if (!titleSet.has(req)) {
      errors.push(`missing required field: ## ${req}`);
    }
  }
  for (const s of sections) {
    if (REQUIRED_FIELDS.includes(s.title) && !s.body) {
      errors.push(`field '${s.title}' is empty`);
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    fields: sections.filter((s) => REQUIRED_FIELDS.includes(s.title)),
  };
}

module.exports = { REQUIRED_FIELDS, validateHandoff };
