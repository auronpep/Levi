'use strict';

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
    if (value === '[]') {
      result[key] = [];
      i++;
    } else if (value === '') {
      const nested = {};
      i++;
      while (i < lines.length) {
        const l = lines[i];
        if (l.trim() === '') { i++; continue; }
        if (!l.startsWith('  ')) break;
        const cm = l.match(/^  ([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
        if (!cm) { i++; continue; }
        const [, ck, cvRaw] = cm;
        const cv = cvRaw.trim();
        if (cv === '[]') {
          nested[ck] = [];
          i++;
        } else if (cv === '') {
          const list = [];
          i++;
          while (i < lines.length && lines[i].startsWith('    - ')) {
            list.push(lines[i].slice(6).trim());
            i++;
          }
          nested[ck] = list;
        } else {
          nested[ck] = cv;
          i++;
        }
      }
      result[key] = nested;
    } else {
      result[key] = value;
      i++;
    }
  }
  return result;
}

module.exports = { parseFrontmatter };
