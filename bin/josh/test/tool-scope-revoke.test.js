// Revoking an agent's last tool used to grant it every tool.
//
// `resolveAllowedTools` collapsed a present-but-empty allowed_tools to `null`,
// and `null` means unrestricted. `checkScope` has always read `[]` as deny-all,
// so the two halves of this module disagreed - and the disagreement resolved in
// favour of access, on the exact code path whose purpose is to remove access.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const scope = require('../lib/tool-scoping');

function agentRoot(allowed) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'josh-scope-'));
  const dir = path.join(root, 'agents', 'claude');
  fs.mkdirSync(dir, { recursive: true });
  const manifest = { schema: 1, id: 'claude' };
  if (allowed !== undefined) manifest.allowed_tools = allowed;
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return root;
}

function can(root, toolId) {
  return scope.checkScope(scope.resolveAllowedTools(root, 'claude'), toolId).allowed;
}

test('revoking the last tool leaves the agent with nothing, not everything', () => {
  const root = agentRoot(['fs:read']);
  assert.strictEqual(can(root, 'fs:read'), true, 'precondition: the one grant works');
  assert.strictEqual(can(root, 'shell:rm'), false, 'precondition: it is genuinely scoped');

  scope.removeAllowedTool(root, 'claude', 'fs:read');

  assert.strictEqual(can(root, 'shell:rm'), false, 'revocation must not grant shell:rm');
  assert.strictEqual(can(root, 'fs:read'), false, 'the revoked tool is gone too');
  assert.deepStrictEqual(scope.resolveAllowedTools(root, 'claude'), []);
});

test('setAllowedTools(agent, []) denies everything', () => {
  const root = agentRoot(['fs:read', 'mcp:duckdb']);
  scope.setAllowedTools(root, 'claude', []);
  assert.strictEqual(can(root, 'fs:read'), false);
  assert.strictEqual(can(root, 'anything:at:all'), false);
});

test('an absent allowed_tools is still full access - the real v1 case', () => {
  const root = agentRoot(undefined);
  assert.strictEqual(scope.resolveAllowedTools(root, 'claude'), null);
  assert.strictEqual(can(root, 'shell:rm'), true);
});

test('a non-array allowed_tools is still full access', () => {
  for (const junk of [null, 'fs:read', 42, { '0': 'fs:read' }]) {
    const root = agentRoot(junk);
    assert.strictEqual(scope.resolveAllowedTools(root, 'claude'), null, `${JSON.stringify(junk)} → unrestricted`);
  }
});

test("['*'] is still the explicit way to say unrestricted", () => {
  const root = agentRoot(['*']);
  assert.strictEqual(scope.resolveAllowedTools(root, 'claude'), null);
  assert.strictEqual(can(root, 'shell:rm'), true);
});

test('a missing agent is still unrestricted, as before', () => {
  const root = agentRoot(['fs:read']);
  assert.strictEqual(scope.resolveAllowedTools(root, 'nobody'), null);
});

test('removing one of several tools removes exactly that one', () => {
  const root = agentRoot(['fs:read', 'mcp:duckdb', 'shell:ls']);
  scope.removeAllowedTool(root, 'claude', 'mcp:duckdb');
  assert.deepStrictEqual(scope.resolveAllowedTools(root, 'claude'), ['fs:read', 'shell:ls']);
  assert.strictEqual(can(root, 'fs:read'), true);
  assert.strictEqual(can(root, 'mcp:duckdb'), false);
});

test('removing a tool the agent never had does not widen the scope', () => {
  const root = agentRoot(['fs:read']);
  scope.removeAllowedTool(root, 'claude', 'shell:rm');
  assert.deepStrictEqual(scope.resolveAllowedTools(root, 'claude'), ['fs:read']);
  assert.strictEqual(can(root, 'shell:rm'), false);
});

test('revocation is durable - it survives a re-read from disk', () => {
  const root = agentRoot(['fs:read']);
  scope.removeAllowedTool(root, 'claude', 'fs:read');
  const onDisk = JSON.parse(fs.readFileSync(path.join(root, 'agents', 'claude', 'manifest.json'), 'utf8'));
  assert.deepStrictEqual(onDisk.allowed_tools, [], 'the empty list is what is actually stored');
  assert.strictEqual(can(root, 'shell:rm'), false);
});

test('adding a tool back after full revocation restores exactly it', () => {
  const root = agentRoot(['fs:read']);
  scope.removeAllowedTool(root, 'claude', 'fs:read');
  scope.addAllowedTool(root, 'claude', 'mcp:duckdb');
  assert.strictEqual(can(root, 'mcp:duckdb'), true);
  assert.strictEqual(can(root, 'fs:read'), false);
});

test('wildcard and exact matching are unchanged by this fix', () => {
  const root = agentRoot(['mcp:*', 'fs:read']);
  assert.strictEqual(can(root, 'mcp:duckdb'), true, 'category wildcard');
  assert.strictEqual(can(root, 'mcp'), true, 'bare category');
  assert.strictEqual(can(root, 'fs:read'), true, 'exact');
  assert.strictEqual(can(root, 'fs:write'), false, 'sibling not granted');
});
