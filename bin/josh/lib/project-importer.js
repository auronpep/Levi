'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseDispatchBlock } = require('./markdown-parser');

function parseCharter(readmePath) {
  const text = fs.readFileSync(readmePath, 'utf8');
  const titleMatch = text.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled Project';

  const dodMatch = text.match(/##\s+Definition\s+Of\s+Done\s*\n+([\s\S]*?)(?:\n##\s+|\n*$)/i);
  const definition_of_done = dodMatch ? dodMatch[1].trim() : null;

  const days = [];
  const dayRowRe = /\|\s*Day\s+(\d+)\s*\|\s*([^|]+?)\s*\|\s*(\[[^\]]+\]\([^)]+\)|[^|]+?)\s*\|\s*([^|]+?)\s*\|/g;
  let m;
  while ((m = dayRowRe.exec(text)) !== null) {
    const folderRaw = m[3].trim();
    const folderMatch = folderRaw.match(/\(([^)]+)\)/);
    const folder = folderMatch
      ? folderMatch[1].replace(/\/.*$/, '')
      : folderRaw;
    days.push({
      day: parseInt(m[1], 10),
      date: m[2].trim(),
      folder,
      goal: m[4].trim(),
    });
  }

  return {
    title,
    definition_of_done,
    days,
    source_path: path.resolve(readmePath),
  };
}

function parseTask(taskPath) {
  const text = fs.readFileSync(taskPath, 'utf8');
  const filename = path.basename(taskPath, '.md');
  const displayIdMatch = filename.match(/^(D\d+-\d+)/);
  const display_id = displayIdMatch ? displayIdMatch[1] : null;

  const headingMatch = text.match(/^#\s+.+?Task\s+\d+:\s+(.+)$/m);
  const title = headingMatch ? headingMatch[1].trim() : filename;

  const dispatch = parseDispatchBlock(text) || {};

  return {
    display_id,
    title,
    day: dispatch.day,
    phase: dispatch.phase_num,
    phase_name: dispatch.phase_name,
    primary_role: dispatch.primary_role,
    depends_on_display_ids: dispatch.required_order ? dispatch.required_order.after : [],
    blocks_display_ids: dispatch.required_order ? dispatch.required_order.before : [],
    parallel_safety: dispatch.parallel_safety,
    source_path: path.resolve(taskPath),
  };
}

module.exports = { parseCharter, parseTask };
