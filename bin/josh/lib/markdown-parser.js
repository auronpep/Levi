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
  // Both clauses stop at the other one. The `after` clause already did; `before`
  // ran to end-of-line, so when an author wrote the clauses the other way round —
  // "before `B`, after `A`" — the `before` capture swallowed the `after` clause
  // too and `A` was recorded as both a prerequisite and something this task
  // blocks. A contradictory edge, from a line that reads perfectly well.
  const afterMatch = text.match(/after\s+(.+?)(?:,\s*before\b|$)/i);
  const beforeMatch = text.match(/before\s+(.+?)(?:,\s*after\b|$)/i);
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

function parseDispatchBlock(text) {
  const dispatchIdx = text.indexOf('## Dispatch');
  if (dispatchIdx === -1) return null;
  const afterDispatch = text.slice(dispatchIdx + '## Dispatch'.length);
  const nextH2 = afterDispatch.search(/\n## /);
  const block = nextH2 === -1 ? afterDispatch : afterDispatch.slice(0, nextH2);

  const findField = (label) => {
    const re = new RegExp(`-\\s+${label}:\\s+(.+)`, 'i');
    const m = block.match(re);
    return m ? m[1].trim() : null;
  };

  const dayLine = findField('Day');
  let day = null, dayDate = null;
  if (dayLine) {
    const dayMatch = dayLine.match(/^(\d+)\s*-\s*(.+)$/);
    if (dayMatch) {
      day = parseInt(dayMatch[1], 10);
      dayDate = dayMatch[2].trim();
    }
  }

  const phaseLine = findField('Phase');
  let phaseNum = null, phaseName = null;
  if (phaseLine) {
    const phaseMatch = phaseLine.match(/^(\d+)\s*-\s*(.+)$/);
    if (phaseMatch) {
      phaseNum = parseInt(phaseMatch[1], 10);
      phaseName = phaseMatch[2].trim();
    }
  }

  const primaryRoleLine = findField('Primary role');
  let primaryRole = null;
  if (primaryRoleLine) {
    const roleMatch = primaryRoleLine.match(/^([AE]\d{2})\b/);
    primaryRole = roleMatch ? roleMatch[1] : primaryRoleLine.split(/\s/)[0];
  }

  const requiredOrderLine = findField('Required order');
  const requiredOrder = parseRequiredOrder(requiredOrderLine || '');

  const parallelSafety = findField('Parallel safety');

  return {
    day,
    day_date: dayDate,
    phase_num: phaseNum,
    phase_name: phaseName,
    primary_role: primaryRole,
    required_order: requiredOrder,
    parallel_safety: parallelSafety,
  };
}

function parseAgentHeading(text) {
  const headingMatch = text.match(/^#\s+Agent\s+([AE]\d{2})\s*-\s*(.+)$/m);
  if (!headingMatch) return null;
  const id = headingMatch[1];
  const title = headingMatch[2].trim();
  const role_group = title
    .toLowerCase()
    .replace(/[,]/g, '')
    .replace(/\s+/g, '_');
  const statusMatch = text.match(/^Status:\s+(\w+)/m);
  const status = statusMatch ? statusMatch[1] : null;
  return { id, title, role_group, status };
}

module.exports = { extractFrontmatter, parseRequiredOrder, parseDispatchBlock, parseAgentHeading };
