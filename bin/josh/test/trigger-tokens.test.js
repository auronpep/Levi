const test = require('node:test');
const assert = require('node:assert/strict');
const { detectTrigger, applyAutoAccept, REQUIRES_E08, AUTO_ACCEPT } = require('../lib/trigger-tokens');

test('REQUIRES_E08 / AUTO_ACCEPT constants', () => {
  assert.match(REQUIRES_E08, /JOSH_VERDICT_REQUIRES_E08/);
  assert.match(AUTO_ACCEPT, /JOSH_VERDICT_AUTO_ACCEPT/);
});

test('detectTrigger: reads envelope.sentinel first', () => {
  assert.equal(detectTrigger({ sentinel: 'requires_e08' }), 'requires_e08');
  assert.equal(detectTrigger({ sentinel: 'auto_accept' }), 'auto_accept');
});

test('detectTrigger: scans payload.claim_text for literal sentinel strings', () => {
  const env = { payload: { claim_text: 'Approve. ⚠️ JOSH_VERDICT_REQUIRES_E08' } };
  assert.equal(detectTrigger(env), 'requires_e08');
  const env2 = { payload: { claim_text: 'Approve. ✅ JOSH_VERDICT_AUTO_ACCEPT' } };
  assert.equal(detectTrigger(env2), 'auto_accept');
});

test('detectTrigger: returns null when no trigger', () => {
  assert.equal(detectTrigger({ payload: { claim_text: 'plain text' } }), null);
  assert.equal(detectTrigger({}), null);
});

test('applyAutoAccept: refuses when confidence < 0.9', () => {
  const env = { sentinel: 'auto_accept', confidence: 0.85 };
  const r = applyAutoAccept(env, { risk: 'low' });
  assert.equal(r.accept, false);
  assert.match(r.reason, /confidence/);
});

test('applyAutoAccept: refuses when risk = high', () => {
  const env = { sentinel: 'auto_accept', confidence: 0.95 };
  const r = applyAutoAccept(env, { risk: 'high' });
  assert.equal(r.accept, false);
  assert.match(r.reason, /risk/);
});

test('applyAutoAccept: accepts when sentinel + conf>=0.9 + risk!=high', () => {
  const env = { sentinel: 'auto_accept', confidence: 0.95 };
  const r = applyAutoAccept(env, { risk: 'medium' });
  assert.equal(r.accept, true);
});

test('applyAutoAccept: refuses without sentinel', () => {
  const env = { confidence: 0.95 };
  const r = applyAutoAccept(env, { risk: 'low' });
  assert.equal(r.accept, false);
  assert.match(r.reason, /sentinel/);
});
