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
  const sections = [];
  const re = /^##\s+(.+)$/gm;
  const matches = [];
  let m;
  while ((m = re.exec(body)) !== null) {
    matches.push({ title: m[1].trim(), start: m.index, contentStart: m.index + m[0].length });
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
