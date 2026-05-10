'use strict';

const fs = require('node:fs');
const path = require('node:path');

function loadBrief(joshRoot, agentId) {
  const manifestPath = path.join(joshRoot, 'agents', agentId, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`agent manifest not found: ${manifestPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!manifest.source_path || !fs.existsSync(manifest.source_path)) {
    throw new Error(`agent source brief not found: ${manifest.source_path || '<unset>'}`);
  }
  const contents = fs.readFileSync(manifest.source_path, 'utf8');
  return { path: manifest.source_path, contents };
}

module.exports = { loadBrief };
