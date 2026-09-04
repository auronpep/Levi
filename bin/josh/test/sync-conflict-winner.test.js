// A conflict name is the canonical name with `.sync-conflict-<stamp>-<host>`
// spliced in, so comparing the two raw names compares the canonical extension
// against the literal text `sync-conflict-...`. Before the fix that meant the
// winner was chosen by the alphabet: `.json` and `.md` files always lost their
// canonical copy to the conflict, `.txt` and `.yaml` files always kept it.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sync = require('../lib/sync-conflict');

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'josh-syncw-'));
}

const MARKER = 'sync-conflict-20260510-150000-KUDBLQD';

function seedPair(root, base, ext) {
  const dir = path.join(root, 'todo', 'triaged');
  fs.mkdirSync(dir, { recursive: true });
  const suffix = ext ? `.${ext}` : '';
  const canonical = path.join(dir, `${base}${suffix}`);
  const conflict = path.join(dir, `${base}.${MARKER}${suffix}`);
  fs.writeFileSync(canonical, 'canonical');
  fs.writeFileSync(conflict, 'conflict');
  return { canonical, conflict };
}

test('pickWinner: the outcome does not depend on the file extension', () => {
  const winners = new Set();
  for (const ext of ['json', 'md', 'txt', 'yaml', 'ndjson', 'js', 'log']) {
    winners.add(sync.pickWinner(`note.${ext}`, `note.${MARKER}.${ext}`));
  }
  assert.strictEqual(winners.size, 1, `extension changed the winner: ${[...winners].join(', ')}`);
  assert.deepStrictEqual([...winners], ['canonical']);
});

test('pickWinner: an extensionless name resolves the same way as any other', () => {
  assert.strictEqual(sync.pickWinner('note', `note.${MARKER}`), 'canonical');
});

test('resolveAll: a .json canonical is no longer replaced by its conflict copy', () => {
  const root = tmpRoot();
  const { canonical, conflict } = seedPair(root, 'note', 'json');

  const r = sync.resolveAll(root);

  assert.strictEqual(r.count, 1);
  assert.strictEqual(r.results[0].winner, 'canonical');
  assert.strictEqual(fs.readFileSync(canonical, 'utf8'), 'canonical', 'canonical content must survive');
  assert.strictEqual(fs.existsSync(conflict), false, 'the conflict copy is cleared away');
});

test('resolveAll: the losing copy is archived, never deleted', () => {
  const root = tmpRoot();
  seedPair(root, 'note', 'json');

  const r = sync.resolveAll(root);

  const archived = r.results[0].archived;
  assert.ok(archived, 'an archive path is reported');
  assert.strictEqual(fs.readFileSync(archived, 'utf8'), 'conflict', 'the losing bytes are recoverable');
});

test('resolveAll: every extension keeps its canonical and archives its conflict', () => {
  for (const ext of ['json', 'md', 'txt', 'yaml']) {
    const root = tmpRoot();
    const { canonical } = seedPair(root, 'note', ext);
    sync.resolveAll(root);
    assert.strictEqual(fs.readFileSync(canonical, 'utf8'), 'canonical', `.${ext} lost its canonical`);
  }
});

test('pickWinner: a genuinely greater ULID still wins, which is the documented rule', () => {
  const older = '01HX0000000000000000000A';
  const newer = '01HX0000000000000000000B';
  assert.strictEqual(sync.pickWinner(`${older}.json`, `${newer}.${MARKER}.json`), 'conflict');
  assert.strictEqual(sync.pickWinner(`${newer}.json`, `${older}.${MARKER}.json`), 'canonical');
});

test('pickWinner: the same ULID on both copies is a tie and canonical holds it', () => {
  const id = '01HX0000000000000000000A';
  assert.strictEqual(sync.pickWinner(`${id}.json`, `${id}.${MARKER}.json`), 'canonical');
  assert.strictEqual(sync.pickWinner(id, `${id}.${MARKER}`), 'canonical');
});

test('canonicalSiblingPath still strips the marker for files and directories', () => {
  assert.strictEqual(
    path.basename(sync.canonicalSiblingPath(path.join('a', `foo.${MARKER}.txt`))),
    'foo.txt',
  );
  assert.strictEqual(
    path.basename(sync.canonicalSiblingPath(path.join('a', `somedir.${MARKER}`))),
    'somedir',
  );
});

test('resolveAll: an orphan conflict is still promoted when no canonical exists', () => {
  const root = tmpRoot();
  const dir = path.join(root, 'todo', 'triaged');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `lonely.${MARKER}.json`), 'only copy');

  sync.resolveAll(root);

  assert.strictEqual(fs.readFileSync(path.join(dir, 'lonely.json'), 'utf8'), 'only copy');
});
