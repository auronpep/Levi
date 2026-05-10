'use strict';

const fs = require('node:fs');
const path = require('node:path');

const LIFECYCLE_KINDS = ['start', 'heartbeat', 'done', 'failed', 'interrupted'];
const STREAM_KINDS = [
  'backend_ref',
  'run_started',
  'text_delta',
  'tool_call',
  'pending_input',
  'pending_input_resolved',
  'plan_artifact',
  'settings_changed',
  'run_completed',
];
const EVENT_KINDS = [...LIFECYCLE_KINDS, ...STREAM_KINDS];
const EVENT_KINDS_SET = new Set(EVENT_KINDS);

function appendEvent(joshRoot, state, todoId, event) {
  if (!event || typeof event.kind !== 'string') {
    throw new Error('event must have a "kind" string field');
  }
  if (!EVENT_KINDS_SET.has(event.kind)) {
    throw new Error(`unknown event kind: ${event.kind}. expected one of: ${EVENT_KINDS.join(', ')}`);
  }
  const folderDir = path.join(joshRoot, 'todo', state, todoId);
  if (!fs.existsSync(folderDir)) {
    throw new Error(`todo folder does not exist: ${folderDir}`);
  }
  const out = path.join(folderDir, 'events.ndjson');
  const enriched = { ts: new Date().toISOString(), ...event };
  fs.appendFileSync(out, JSON.stringify(enriched) + '\n', 'utf8');
}

module.exports = {
  LIFECYCLE_KINDS,
  STREAM_KINDS,
  EVENT_KINDS,
  appendEvent,
};
