'use strict';

const fs = require('node:fs');
const path = require('node:path');

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

module.exports = { parseCharter };
