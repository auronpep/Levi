// The removal test marks a brief line for deletion when no gold-set failure
// correlates with it. With no recorded failures nothing correlates, so the whole
// brief was marked for removal - mission, acceptance gates and the Do Not Do
// list included. An agent with a clean record got a recommendation to delete the
// rules that produced it.
//
// This module had no test file at all; these are its first.

const test = require('node:test');
const assert = require('node:assert');
const { applyRemovalTest, tokenize } = require('../lib/removal-test');

const BRIEF = [
  '# Agent A01',
  '',
  'Status: READY',
  '',
  '## Mission',
  'Coordinate the launch.',
  '',
  '## Acceptance Gates',
  'Every public asset has clearance before release.',
  '',
  '## Do Not Do',
  'Never publish without sign-off.',
].join('\n');

const failure = (rubric, claim) => ({ rubric, expected_verdict: { claim_text: claim || '' } });
const pruned = (r) => r.annotated.filter((a) => a.decision === 'prune').map((a) => a.line.trim());

test('with no failure data nothing is recommended for removal', () => {
  const r = applyRemovalTest(BRIEF, []);
  assert.strictEqual(r.prune_count, 0);
  assert.deepStrictEqual(pruned(r), []);
});

test('the no-evidence case is distinguishable from a genuinely clean brief', () => {
  const none = applyRemovalTest(BRIEF, []);
  const withData = applyRemovalTest(BRIEF, [failure('coordinate launch clearance release publish sign')]);

  assert.strictEqual(none.have_failure_data, false, 'cannot tell');
  assert.strictEqual(withData.have_failure_data, true, 'did have something to reason from');
});

test('the mission, gate and prohibition survive a no-evidence run', () => {
  const r = applyRemovalTest(BRIEF, []);
  for (const line of [
    'Coordinate the launch.',
    'Every public asset has clearance before release.',
    'Never publish without sign-off.',
  ]) {
    const entry = r.annotated.find((a) => a.line.trim() === line);
    assert.strictEqual(entry.decision, 'keep', `${line} must not be marked for removal`);
    assert.strictEqual(entry.reason, 'no_failure_data');
  }
});

test('undefined and null failure lists behave the same as an empty one', () => {
  for (const failures of [undefined, null, []]) {
    assert.strictEqual(applyRemovalTest(BRIEF, failures).prune_count, 0);
  }
});

test('with failure data, uncorrelated lines are still pruned', () => {
  const r = applyRemovalTest(BRIEF, [failure('clearance release')]);
  assert.strictEqual(r.have_failure_data, true);
  assert.ok(r.prune_count > 0, 'the test still does its job');
  assert.ok(pruned(r).includes('Coordinate the launch.'), 'a line no failure touches is a candidate');
});

test('with failure data, correlated lines are kept and say why', () => {
  const r = applyRemovalTest(BRIEF, [failure('clearance release')]);
  const gate = r.annotated.find((a) => a.line.includes('clearance before release'));
  assert.strictEqual(gate.decision, 'keep');
  assert.match(gate.reason, /correlated_failure/);
});

test('headings are protected', () => {
  const r = applyRemovalTest(BRIEF, [failure('nothing matches here')]);
  for (const h of ['## Mission', '## Acceptance Gates', '## Do Not Do']) {
    assert.strictEqual(r.annotated.find((a) => a.line === h).decision, 'keep');
  }
});

test('structural section lines are protected', () => {
  const r = applyRemovalTest(BRIEF, [failure('nothing matches here')]);
  assert.strictEqual(r.annotated.find((a) => a.line.startsWith('Status:')).decision, 'keep');
});

test('protectHeadings:false still protects structural lines', () => {
  const r = applyRemovalTest(BRIEF, [failure('nothing')], { protectHeadings: false });
  assert.strictEqual(r.annotated.find((a) => a.line.startsWith('Status:')).decision, 'keep');
  assert.strictEqual(r.annotated.find((a) => a.line === '## Mission').decision, 'prune');
});

test('blank lines are always kept', () => {
  const r = applyRemovalTest(BRIEF, [failure('clearance')]);
  for (const a of r.annotated.filter((x) => x.line.trim() === '')) {
    assert.strictEqual(a.decision, 'keep');
    assert.strictEqual(a.reason, 'blank');
  }
});

test('counts add up to the number of lines', () => {
  for (const failures of [[], [failure('clearance release')]]) {
    const r = applyRemovalTest(BRIEF, failures);
    assert.strictEqual(r.keep_count + r.prune_count, BRIEF.split('\n').length);
  }
});

test('an empty brief produces no annotations to act on', () => {
  const r = applyRemovalTest('', [failure('x')]);
  assert.strictEqual(r.prune_count, 0);
});

test('tokenize: lowercases and drops words shorter than three characters', () => {
  assert.deepStrictEqual(tokenize('Every ASSET has a Clearance'), ['every', 'asset', 'has', 'clearance']);
  assert.deepStrictEqual(tokenize(''), []);
  assert.deepStrictEqual(tokenize(null), []);
});
