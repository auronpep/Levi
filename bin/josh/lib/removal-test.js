'use strict';

// "Removal test": for each line of the brief, mark candidate-for-removal if no
// gold-set failure correlates with it. Implementation: simple keyword overlap
// between brief lines and gold rubrics for failed items. Lines whose words
// appear in failure rubrics are kept; everything else is candidate-for-prune.

function tokenize(s) {
  return (s || '').toLowerCase().match(/[a-z0-9_]{3,}/g) || [];
}

function buildFailureKeywordSet(goldFailures) {
  const set = new Set();
  for (const f of goldFailures || []) {
    for (const kw of tokenize(f.rubric || '')) set.add(kw);
    for (const kw of tokenize((f.expected_verdict && f.expected_verdict.claim_text) || '')) set.add(kw);
  }
  return set;
}

function applyRemovalTest(brief, goldFailures, opts = {}) {
  const lines = (brief || '').split('\n');
  const failureWords = buildFailureKeywordSet(goldFailures || []);
  const protectHeadings = opts.protectHeadings !== false;

  // With no failure keywords there is nothing for any line to correlate with, so
  // the rule "prune what no failure touches" marked the entire brief for removal
  // - mission, acceptance gates and the Do Not Do list included. An agent with a
  // clean record got a recommendation to delete the rules that produced it.
  //
  // No evidence is not evidence for removal. When there is no failure data the
  // honest answer is that this test cannot say anything, so it keeps everything
  // and says why.
  const haveEvidence = failureWords.size > 0;
  const out = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return { line, decision: 'keep', reason: 'blank' };
    if (!haveEvidence) return { line, decision: 'keep', reason: 'no_failure_data' };
    if (protectHeadings && /^#+\s/.test(trimmed)) {
      return { line, decision: 'keep', reason: 'heading' };
    }
    if (/^Status:|^Mission:|^Acceptance Gates:|^Do Not Do:/.test(trimmed)) {
      return { line, decision: 'keep', reason: 'structural-section' };
    }
    const words = tokenize(line);
    const hits = words.filter((w) => failureWords.has(w));
    if (hits.length > 0) {
      return { line, decision: 'keep', reason: `correlated_failure: ${hits.slice(0, 3).join(',')}` };
    }
    return { line, decision: 'prune', reason: 'no_correlation' };
  });
  return {
    annotated: out,
    keep_count: out.filter((x) => x.decision === 'keep').length,
    prune_count: out.filter((x) => x.decision === 'prune').length,
    // Whether this run had anything to reason from. A prune_count of 0 with
    // have_failure_data false means "cannot tell", not "nothing to remove".
    have_failure_data: haveEvidence,
  };
}

module.exports = { applyRemovalTest, tokenize };
