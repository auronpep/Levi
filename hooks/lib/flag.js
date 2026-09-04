// Flag-file utilities for Levi plugin.
// The flag file holds the current mode as plain text (e.g. "caveman").
// Symlink-safe: refuses to write through symlinks (defense against a local
// attacker pointing the predictable flag path at a sensitive file).

const fs = require('fs');
const crypto = require('crypto');

function isSafe(filePath) {
  try {
    const stat = fs.lstatSync(filePath);
    if (stat.isSymbolicLink()) return false;
  } catch (e) { /* doesn't exist yet — safe to create */ }
  return true;
}

exports.writeFlag = function (flagPath, content) {
  if (!isSafe(flagPath)) return;

  // The symlink guard used to be applied only to `flagPath`, while the write
  // went to the fixed, equally predictable `flagPath + '.tmp'`. Pointing *that*
  // at a sensitive file defeated the stated defence entirely: the write followed
  // the link, and the subsequent rename left the flag itself a symlink to the
  // target.
  //
  // Two changes close it without a check-then-use window:
  //   - a unique scratch name, so there is nothing predictable to pre-plant
  //   - 'wx' (O_CREAT|O_EXCL), which refuses to open an existing path at all,
  //     symlink or not, rather than following it
  const tmp = `${flagPath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(tmp, String(content), { flag: 'wx', mode: 0o600 });
    fs.renameSync(tmp, flagPath);
  } catch (e) {
    // Never block the hook — but do not leave scratch files behind either.
    try { fs.unlinkSync(tmp); } catch (e2) { /* nothing to clean up */ }
  }
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
