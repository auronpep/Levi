'use strict';

const REQUIRED_SECTIONS = [
  'Fast-Path',
  'Problem statement',
  'Current state evidence',
  'Proposed approach',
  'Step-by-step change list',
  'Risks + rollback',
  'Test plan',
  'Approval prompt',
];

const REQUIRED_FRONTMATTER = ['id', 'status', 'claimed_by', 'plan_hash'];
const VALID_STATUS = ['PENDING', 'APPROVED', 'REVISED'];

function parseFrontmatter(text) {
  if (!text.startsWith('---\n')) return { found: false, frontmatter: {}, body: text };
  const closeIdx = text.indexOf('\n---\n', 4);
  if (closeIdx === -1) return { found: false, frontmatter: {}, body: text };
  const block = text.slice(4, closeIdx);
  const body = text.slice(closeIdx + 5);
  const frontmatter = {};
  for (const line of block.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (key) frontmatter[key] = value;
  }
  return { found: true, frontmatter, body };
}

function extractSections(body) {
  // Each H2 heading starts a section. Returns [{title, body}] in order.
  //
  // Headings inside fenced code blocks are NOT headings. A plan's
  // "Step-by-step change list" is exactly where diffs, shell snippets and
  // quoted markdown live, and a `## ...` line inside a fence used to open a
  // phantom section: it truncated the real section's body, and if the fenced
  // text happened to name a required section it produced a duplicate and the
  // plan was rejected for being "out of order" while in perfect order.
  const sections = [];
  const matches = [];
  let offset = 0;
  let fenceChar = null;
  let fenceLen = 0;

  for (const line of body.split('\n')) {
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
    const sectionBody = body.slice(cur.contentStart, next ? next.start : body.length).trim();
    sections.push({ title: cur.title, body: sectionBody });
  }
  return sections;
}

function validatePlan(text) {
  text = text.replace(/\r\n/g, '\n');
  const errors = [];
  const fm = parseFrontmatter(text);
  if (!fm.found) {
    errors.push('plan must start with YAML frontmatter delimited by --- ... ---');
    return { ok: false, errors, frontmatter: {}, sections: [] };
  }
  for (const k of REQUIRED_FRONTMATTER) {
    if (!fm.frontmatter[k]) errors.push(`frontmatter missing required field: ${k}`);
  }
  if (fm.frontmatter.status && !VALID_STATUS.includes(fm.frontmatter.status)) {
    errors.push(`frontmatter status must be one of PENDING / APPROVED / REVISED (got: ${fm.frontmatter.status})`);
  }
  const sections = extractSections(fm.body);
  // Check each required section exists in correct order.
  const titles = sections.map((s) => s.title);
  for (const req of REQUIRED_SECTIONS) {
    if (!titles.includes(req)) {
      errors.push(`missing required section: ## ${req}`);
    }
  }
  // Order check: filter the section titles to the required ones, then compare.
  const filtered = titles.filter((t) => REQUIRED_SECTIONS.includes(t));
  for (let i = 0; i < filtered.length; i++) {
    if (filtered[i] !== REQUIRED_SECTIONS[i]) {
      errors.push(`sections out of order: expected '${REQUIRED_SECTIONS[i]}' at position ${i + 1}, got '${filtered[i]}'`);
      break;
    }
  }
  // Each required section must have a non-empty body.
  for (const s of sections) {
    if (REQUIRED_SECTIONS.includes(s.title) && !s.body) {
      errors.push(`section '${s.title}' is empty`);
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    frontmatter: fm.frontmatter,
    sections,
  };
}

module.exports = {
  REQUIRED_SECTIONS,
  REQUIRED_FRONTMATTER,
  VALID_STATUS,
  validatePlan,
};
