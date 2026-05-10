'use strict';

const fs = require('node:fs');
const path = require('node:path');

const STIGNORE_PATTERNS = [
  '# josh per-host artifacts (do not sync)',
  '*.capacity.json',
  '# locks (per-host claim primitives)',
  'locks/',
  'orchestrator/orchestrator.lock',
  '# ephemeral/atomic write tempfiles',
  '*.tmp',
  '*.tmp.*',
  '# stop-flag for the A2A bridge',
  'a2a/.stop',
  '# pause/drain markers (per-host)',
  'orchestrator/.paused',
  'orchestrator/.draining',
];

function stignorePath(joshRoot) {
  return path.join(joshRoot, '.stignore');
}

function writeStignore(joshRoot) {
  const p = stignorePath(joshRoot);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, STIGNORE_PATTERNS.join('\n') + '\n');
  return p;
}

function readStignore(joshRoot) {
  const p = stignorePath(joshRoot);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf8');
}

module.exports = { STIGNORE_PATTERNS, writeStignore, readStignore, stignorePath };
