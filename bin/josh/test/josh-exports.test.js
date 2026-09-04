// Requiring josh.js must not run the CLI or exit the process, and must expose
// the internal helpers so they can be unit-tested directly.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const josh = require(path.join(__dirname, '..', 'josh.js'));

test('require(josh.js) does not exit the process and returns exports', () => {
  assert.ok(josh, 'josh.js should export an object when required');
  assert.strictEqual(typeof josh, 'object');
});

test('exports: core helpers are functions', () => {
  for (const name of [
    'main', 'readJson', 'writeJsonAtomic', 'ulid', 'appendAudit', 'countDir',
    'refreshQueueCounts', 'emptyStatus', 'formatAge', 'walkTree', 'findById',
    'findTodoFolderById', 'defaultActor', 'resolveActor'
  ]) {
    assert.strictEqual(typeof josh[name], 'function', `${name} should be exported as a function`);
  }
});

test('exports: COMMANDS is a non-empty command table', () => {
  assert.strictEqual(typeof josh.COMMANDS, 'object');
  const keys = Object.keys(josh.COMMANDS);
  assert.ok(keys.length > 0, 'COMMANDS should not be empty');
  for (const k of keys) {
    assert.strictEqual(typeof josh.COMMANDS[k], 'function', `COMMANDS.${k} should be a function`);
  }
});

test('exports: ulid() produces a 26-char Crockford base32 id', () => {
  const id = josh.ulid();
  assert.strictEqual(id.length, 26);
  assert.match(id, /^[0-9A-HJKMNP-TV-Z]{26}$/);
});

test('exports: JOSH_ROOT is a string path', () => {
  assert.strictEqual(typeof josh.JOSH_ROOT, 'string');
  assert.ok(josh.JOSH_ROOT.length > 0);
});
