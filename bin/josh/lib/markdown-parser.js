'use strict';

function extractFrontmatter(text) {
  const empty = { frontmatter: {}, body: text };
  if (!text.startsWith('---\n')) return empty;
  const closeIdx = text.indexOf('\n---\n', 4);
  if (closeIdx === -1) return empty;
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
  return { frontmatter, body };
}

function parseRequiredOrder(text) {
  const result = { after: [], before: [] };
  if (!text) return result;
  const afterMatch = text.match(/after\s+(.+?)(?:,\s*before|$)/i);
  const beforeMatch = text.match(/before\s+(.+)$/i);
  const extractIds = (s) => {
    if (!s) return [];
    const ids = [];
    const re = /`([^`]+)`/g;
    let m;
    while ((m = re.exec(s)) !== null) {
      if (m[1] !== 'none') ids.push(m[1]);
    }
    return ids;
  };
  result.after = extractIds(afterMatch ? afterMatch[1] : '');
  result.before = extractIds(beforeMatch ? beforeMatch[1] : '');
  return result;
}

module.exports = { extractFrontmatter, parseRequiredOrder };
