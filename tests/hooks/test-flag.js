'use strict';
// flag.js states: "Symlink-safe: refuses to write through symlinks (defense
// against a local attacker pointing the predictable flag path at a sensitive
// file)." The guard was applied to `flagPath`, but the write went to the fixed,
// equally predictable `flagPath + '.tmp'` — so pointing that at a file
// overwrote it, and the following rename left the flag itself a symlink.
//
// flag.js had no test file; these are its first.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writeFlag, readFlag, deleteFlag } = require('../../hooks/lib/flag');

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'levi-flag-'));

function canSymlink(dir) {
  const a = path.join(dir, '_probe_target');
  const b = path.join(dir, '_probe_link');
  fs.writeFileSync(a, 'x');
  try { fs.symlinkSync(a, b); fs.unlinkSync(b); return true; }
  catch (e) { return false; }
  finally { try { fs.unlinkSync(a); } catch (e) { /* ignore */ } }
}

// 1: round-trip.
{
  const dir = tmpDir();
  const flag = path.join(dir, '.levi-talk');
  writeFlag(flag, 'caveman');
  assert.strictEqual(readFlag(flag), 'caveman');
  deleteFlag(flag);
  assert.strictEqual(readFlag(flag), null);
}

// 2: no scratch file is left behind.
{
  const dir = tmpDir();
  writeFlag(path.join(dir, '.levi-talk'), 'caveman');
  assert.deepStrictEqual(fs.readdirSync(dir), ['.levi-talk']);
}

// 3: a symlink planted at the scratch path is not written through.
{
  const dir = tmpDir();
  if (canSymlink(dir)) {
    const secret = path.join(dir, 'SECRET.txt');
    fs.writeFileSync(secret, 'original contents');
    const flag = path.join(dir, '.levi-talk');
    fs.symlinkSync(secret, flag + '.tmp');

    writeFlag(flag, 'caveman');

    assert.strictEqual(fs.readFileSync(secret, 'utf8'), 'original contents',
      'the target file must be untouched');
    assert.strictEqual(fs.lstatSync(flag).isSymbolicLink(), false,
      'the flag must not become a symlink');
  }
}

// 4: a symlink at the flag path itself is still refused (the original guard).
{
  const dir = tmpDir();
  if (canSymlink(dir)) {
    const secret = path.join(dir, 'SECRET.txt');
    fs.writeFileSync(secret, 'original contents');
    const flag = path.join(dir, '.levi-talk');
    fs.symlinkSync(secret, flag);

    writeFlag(flag, 'caveman');
    assert.strictEqual(fs.readFileSync(secret, 'utf8'), 'original contents');
  }
}

// 5: readFlag refuses to read through a symlink.
{
  const dir = tmpDir();
  if (canSymlink(dir)) {
    const secret = path.join(dir, 'SECRET.txt');
    fs.writeFileSync(secret, 'sensitive');
    const flag = path.join(dir, '.levi-talk');
    fs.symlinkSync(secret, flag);
    assert.strictEqual(readFlag(flag), null);
  }
}

// 6: a stale scratch file from a previous crash does not wedge writes.
{
  const dir = tmpDir();
  const flag = path.join(dir, '.levi-talk');
  fs.writeFileSync(flag + '.tmp', 'stale');       // the old fixed name
  writeFlag(flag, 'caveman');
  assert.strictEqual(readFlag(flag), 'caveman', 'a stale .tmp must not block the write');
}

// 7: concurrent writers do not share a scratch file.
{
  const dir = tmpDir();
  const flag = path.join(dir, '.levi-talk');
  for (let i = 0; i < 20; i++) writeFlag(flag, `mode${i}`);
  assert.strictEqual(readFlag(flag), 'mode19');
  assert.deepStrictEqual(fs.readdirSync(dir).filter((f) => f.includes('.tmp')), []);
}

// 8: an unwritable directory fails silently rather than throwing.
{
  const missing = path.join(tmpDir(), 'does', 'not', 'exist', '.levi-talk');
  assert.doesNotThrow(() => writeFlag(missing, 'caveman'));
  assert.strictEqual(readFlag(missing), null);
}

// 9: deleteFlag on a missing file is a no-op.
{
  assert.doesNotThrow(() => deleteFlag(path.join(tmpDir(), 'nope')));
}

console.log('ok — flag: 9 groups passed');
