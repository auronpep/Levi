'use strict';

const REQUIRES_E08 = '⚠️ JOSH_VERDICT_REQUIRES_E08';
const AUTO_ACCEPT  = '✅ JOSH_VERDICT_AUTO_ACCEPT';

function detectTrigger(envelope) {
  if (!envelope) return null;
  if (envelope.sentinel === 'requires_e08' || envelope.sentinel === 'auto_accept') {
    return envelope.sentinel;
  }
  const text = envelope && envelope.payload && envelope.payload.claim_text;
  if (typeof text !== 'string') return null;
  if (text.includes('JOSH_VERDICT_REQUIRES_E08')) return 'requires_e08';
  if (text.includes('JOSH_VERDICT_AUTO_ACCEPT'))  return 'auto_accept';
  return null;
}

function applyAutoAccept(envelope, todo) {
  const trig = detectTrigger(envelope);
  if (trig !== 'auto_accept') {
    return { accept: false, reason: 'no auto_accept sentinel' };
  }
  const conf = (envelope && envelope.confidence) || 0;
  if (conf < 0.9) {
    return { accept: false, reason: `confidence ${conf} < 0.9` };
  }
  const risk = todo && todo.risk;
  if (risk === 'high') {
    return { accept: false, reason: 'todo risk=high; matrix required' };
  }
  return { accept: true, reason: 'auto_accept allowed' };
}

module.exports = { detectTrigger, applyAutoAccept, REQUIRES_E08, AUTO_ACCEPT };
