'use strict';

// Canonical JSON v1 — locked algorithm.
//
// Rules:
//   - Object keys sorted lexicographically (Array.prototype.sort default order on UTF-16).
//   - Recursively applied at every nesting level.
//   - Arrays preserve insertion order.
//   - Primitives encoded via JSON.stringify (preserves Number/String/null/bool semantics).
//   - undefined values dropped (matches JSON.stringify semantics).
//   - No whitespace.
//
// Deliberately simple — sufficient for HMAC-chain integrity. Not RFC 8785 compliant
// (no number normalization, no Unicode normalization). Locked v1 — bumping it
// would require a chain re-bake.

function canonicalJson(v) {
  if (v === null) return 'null';
  if (typeof v === 'undefined') return undefined;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error('canonicalJson: non-finite number');
    return JSON.stringify(v);
  }
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) {
    const parts = v.map((x) => {
      const s = canonicalJson(x);
      return typeof s === 'undefined' ? 'null' : s;
    });
    return '[' + parts.join(',') + ']';
  }
  if (typeof v === 'object') {
    const keys = Object.keys(v).sort();
    const parts = [];
    for (const k of keys) {
      const sv = canonicalJson(v[k]);
      if (typeof sv === 'undefined') continue;
      parts.push(JSON.stringify(k) + ':' + sv);
    }
    return '{' + parts.join(',') + '}';
  }
  throw new Error('canonicalJson: unsupported type ' + typeof v);
}

module.exports = { canonicalJson };
