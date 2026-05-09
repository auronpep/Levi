// Flag-file utilities for Levi plugin.
// The flag file holds the current mode as plain text (e.g. "caveman").
// Symlink-safe: refuses to write through symlinks (defense against a local
// attacker pointing the predictable flag path at a sensitive file).

const fs = require('fs');

function isSafe(filePath) {
  try {
    const stat = fs.lstatSync(filePath);
    if (stat.isSymbolicLink()) return false;
  } catch (e) { /* doesn't exist yet — safe to create */ }
  return true;
}

exports.writeFlag = function (flagPath, content) {
  if (!isSafe(flagPath)) return;
  const tmp = flagPath + '.tmp';
  try {
    fs.writeFileSync(tmp, String(content), { mode: 0o600 });
    fs.renameSync(tmp, flagPath);
  } catch (e) { /* silent — never block the hook */ }
};

exports.readFlag = function (flagPath) {
  try {
    if (!isSafe(flagPath)) return null;
    return fs.readFileSync(flagPath, 'utf8').trim();
  } catch (e) { return null; }
};

exports.deleteFlag = function (flagPath) {
  try { fs.unlinkSync(flagPath); } catch (e) {}
};
