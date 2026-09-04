// `## ...` inside a fenced code block is not a heading. The "Step-by-step change
// list" section is exactly where diffs, shell snippets and quoted markdown go,
// and a fenced `##` line used to open a phantom section - truncating the real
// section's body, and rejecting the plan as "out of order" when the fenced text
// named a required section.

const test = require('node:test');
const assert = require('node:assert');
const { validatePlan, REQUIRED_SECTIONS } = require('../lib/plan-validator');

function plan(overrides = {}) {
  let s = '---\nid: 01T\nstatus: PENDING\nclaimed_by: claude\nplan_hash: abc\n---\n\n';
  for (const sec of REQUIRED_SECTIONS) {
    // `??` not `||` - an empty override is a deliberately empty section.
    s += `## ${sec}\n${overrides[sec] ?? 'filled in'}\n\n`;
  }
  return s;
}

const titles = (r) => r.sections.map((s) => s.title);

test('a plain plan still validates', () => {
  const r = validatePlan(plan());
  assert.strictEqual(r.ok, true, JSON.stringify(r.errors));
});

test('a plan quoting a required heading inside a fence is not rejected', () => {
  const r = validatePlan(plan({
    'Step-by-step change list': 'Rewrite the doc so it reads:\n\n```markdown\n## Risks + rollback\nnone\n```',
  }));
  assert.strictEqual(r.ok, true, JSON.stringify(r.errors));
  assert.deepStrictEqual(titles(r), REQUIRED_SECTIONS, 'no phantom section may appear');
});

test('a shell comment inside a fence does not become a section', () => {
  const r = validatePlan(plan({
    'Step-by-step change list': '```bash\nmake build\n## run the suite\nmake test\n```',
  }));
  assert.strictEqual(r.ok, true, JSON.stringify(r.errors));
  assert.ok(!titles(r).includes('run the suite'));
});

test('the fenced content stays inside its own section body', () => {
  const fenced = '```bash\nmake build\n## run the suite\nmake test\n```';
  const r = validatePlan(plan({ 'Step-by-step change list': fenced }));
  const section = r.sections.find((s) => s.title === 'Step-by-step change list');
  assert.ok(section.body.includes('make test'), 'the body must not be truncated at the fenced ##');
  assert.ok(section.body.includes('```'), 'the closing fence belongs to the section too');
});

test('tilde fences are handled as well as backtick fences', () => {
  const r = validatePlan(plan({
    'Step-by-step change list': '~~~markdown\n## Test plan\nnope\n~~~',
  }));
  assert.strictEqual(r.ok, true, JSON.stringify(r.errors));
  assert.deepStrictEqual(titles(r), REQUIRED_SECTIONS);
});

test('longer fences and info strings still open and close correctly', () => {
  const r = validatePlan(plan({
    'Step-by-step change list': '````markdown\n## Approval prompt\ntext\n````',
  }));
  assert.strictEqual(r.ok, true, JSON.stringify(r.errors));
  assert.deepStrictEqual(titles(r), REQUIRED_SECTIONS);
});

test('a real heading after a closed fence is still a heading', () => {
  const r = validatePlan(plan({
    'Proposed approach': '```\n## not a heading\n```',
  }));
  assert.strictEqual(r.ok, true, JSON.stringify(r.errors));
  assert.deepStrictEqual(titles(r), REQUIRED_SECTIONS, 'every later section must still be found');
});

test('multiple fences in one section are each tracked', () => {
  const r = validatePlan(plan({
    'Step-by-step change list': '```\n## one\n```\nthen\n```\n## two\n```',
  }));
  assert.strictEqual(r.ok, true, JSON.stringify(r.errors));
  assert.deepStrictEqual(titles(r), REQUIRED_SECTIONS);
});

test('a genuinely missing section is still reported', () => {
  const text = plan().replace('## Test plan\nfilled in\n\n', '');
  const r = validatePlan(text);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some((e) => /missing required section: ## Test plan/.test(e)));
});

test('genuinely out-of-order sections are still reported', () => {
  let s = '---\nid: 01T\nstatus: PENDING\nclaimed_by: claude\nplan_hash: abc\n---\n\n';
  const swapped = [...REQUIRED_SECTIONS];
  [swapped[1], swapped[2]] = [swapped[2], swapped[1]];
  for (const sec of swapped) s += `## ${sec}\nfilled in\n\n`;
  const r = validatePlan(s);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some((e) => /out of order/.test(e)));
});

test('a genuinely empty section is still reported', () => {
  const r = validatePlan(plan({ 'Test plan': '' }));
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some((e) => /section 'Test plan' is empty/.test(e)));
});

test('an unclosed fence swallows the rest, as markdown says it should', () => {
  const r = validatePlan(plan({ 'Fast-Path': '```\nnever closed' }));
  assert.strictEqual(r.ok, false, 'the later sections are inside the fence, so they are missing');
  assert.ok(r.errors.some((e) => /missing required section/.test(e)));
});
