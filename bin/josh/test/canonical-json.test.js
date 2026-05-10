const test = require('node:test');
const assert = require('node:assert/strict');
const { canonicalJson } = require('../lib/canonical-json');

test('canonicalJson: primitive types', () => {
  assert.equal(canonicalJson(null), 'null');
  assert.equal(canonicalJson(true), 'true');
  assert.equal(canonicalJson(42), '42');
  assert.equal(canonicalJson('x'), '"x"');
});

test('canonicalJson: sorts keys lexicographically', () => {
  const x = { b: 1, a: 2, c: 3 };
  const y = { c: 3, a: 2, b: 1 };
  assert.equal(canonicalJson(x), '{"a":2,"b":1,"c":3}');
  assert.equal(canonicalJson(x), canonicalJson(y));
});

test('canonicalJson: nested objects sorted at every level', () => {
  const o = { z: { b: 2, a: 1 }, a: 1 };
  assert.equal(canonicalJson(o), '{"a":1,"z":{"a":1,"b":2}}');
});

test('canonicalJson: arrays preserve order', () => {
  assert.equal(canonicalJson([3, 1, 2]), '[3,1,2]');
});

test('canonicalJson: no whitespace', () => {
  const o = { a: 1, b: { c: [1, 2] } };
  const s = canonicalJson(o);
  assert.equal(s.includes(' '), false);
  assert.equal(s.includes('\n'), false);
  assert.equal(s, '{"a":1,"b":{"c":[1,2]}}');
});

test('canonicalJson: deterministic across reordered builds', () => {
  const a = JSON.parse('{"y":2,"x":1,"nested":{"b":2,"a":1}}');
  const b = JSON.parse('{"x":1,"y":2,"nested":{"a":1,"b":2}}');
  assert.equal(canonicalJson(a), canonicalJson(b));
});

test('canonicalJson: handles undefined by skipping (matches JSON.stringify behavior)', () => {
  const o = { a: 1, b: undefined };
  assert.equal(canonicalJson(o), '{"a":1}');
});
