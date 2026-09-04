'use strict';

const fs = require('node:fs');
const path = require('node:path');

// A manifest has to mean the same thing wherever josh is run from.
//
// `source_path` was handed straight to fs, so a relative value resolved against
// `process.cwd()`: the same agent yielded different brief contents and a
// different integrity hash depending on the directory the command was invoked
// in, and "not found" from a third. project-importer writes `path.resolve(...)`,
// but the a2a `/agents/register` endpoint copies `body.source_path` verbatim out
// of an unauthenticated request, so a relative path is reachable from outside.
//
// Anchoring on JOSH_ROOT makes a relative source_path mean one fixed location.
// Absolute paths are untouched.
function resolveSourcePath(joshRoot, sourcePath) {
  if (!sourcePath) return null;
  return path.isAbsolute(sourcePath) ? sourcePath : path.resolve(joshRoot, sourcePath);
}

function loadBrief(joshRoot, agentId) {
  const manifestPath = path.join(joshRoot, 'agents', agentId, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`agent manifest not found: ${manifestPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const resolved = resolveSourcePath(joshRoot, manifest.source_path);
  if (!resolved || !fs.existsSync(resolved)) {
    throw new Error(`agent source brief not found: ${resolved || '<unset>'}`);
  }
  const contents = fs.readFileSync(resolved, 'utf8');
  return { path: resolved, contents };
}

module.exports = { loadBrief, resolveSourcePath };
