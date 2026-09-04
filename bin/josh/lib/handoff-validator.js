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
  // A `## ...` line inside a fenced code block is not a heading. A handoff's
  // "Verification" and "Files changed" fields are where commands and diffs go,
  // so a fenced `##` used to cut the field short - the field recorded only the
  // opening fence and the command itself landed in a phantom section - and a
  // fence naming another field produced a duplicate entry for it.
  const sections = [];
  const matches = [];
  let offset = 0;
  let fenceChar = null;
  let fenceLen = 0;

  for (const line of text.split('\n')) {
    const fence = line.trim().match(/^(`{3,}|~{3,})/);
    if (fence) {
      const ch = fence[1][0];
      const len = fence[1].length;
      if (fenceChar === null) {
        fenceChar = ch;
        fenceLen = len;
      } else if (ch === fenceChar && len >= fenceLen) {
        fenceChar = null;
        fenceLen = 0;
      }
    } else if (fenceChar === null) {
      const h = line.match(/^##\s+(.+)$/);
      if (h) matches.push({ title: h[1].trim(), start: offset, contentStart: offset + line.length });
    }
    offset += line.length + 1; // +1 for the newline consumed by split
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
