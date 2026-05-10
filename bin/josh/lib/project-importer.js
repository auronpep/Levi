'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseDispatchBlock, parseAgentHeading } = require('./markdown-parser');

function parseCharter(readmePath) {
  const text = fs.readFileSync(readmePath, 'utf8');
  const titleMatch = text.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled Project';

  const dodMatch = text.match(/##\s+Definition\s+Of\s+Done\s*\n+([\s\S]*?)(?:\n##\s+|\n*$)/i);
  const definition_of_done = dodMatch ? dodMatch[1].trim() : null;

  const days = [];
  const dayRowRe = /\|\s*Day\s+(\d+)\s*\|\s*([^|]+?)\s*\|\s*(\[[^\]]+\]\([^)]+\)|[^|]+?)\s*\|\s*([^|]+?)\s*\|/g;
  let m;
  while ((m = dayRowRe.exec(text)) !== null) {
    const folderRaw = m[3].trim();
    const folderMatch = folderRaw.match(/\(([^)]+)\)/);
    const folder = folderMatch
      ? folderMatch[1].replace(/\/.*$/, '')
      : folderRaw;
    days.push({
      day: parseInt(m[1], 10),
      date: m[2].trim(),
      folder,
      goal: m[4].trim(),
    });
  }

  return {
    title,
    definition_of_done,
    days,
    source_path: path.resolve(readmePath),
  };
}

function parseTask(taskPath) {
  const text = fs.readFileSync(taskPath, 'utf8');
  const filename = path.basename(taskPath, '.md');
  const displayIdMatch = filename.match(/^(D\d+-\d+)/);
  const display_id = displayIdMatch ? displayIdMatch[1] : null;

  const headingMatch = text.match(/^#\s+.+?Task\s+\d+:\s+(.+)$/m);
  const title = headingMatch ? headingMatch[1].trim() : filename;

  const dispatch = parseDispatchBlock(text) || {};

  return {
    display_id,
    title,
    day: dispatch.day,
    phase: dispatch.phase_num,
    phase_name: dispatch.phase_name,
    primary_role: dispatch.primary_role,
    depends_on_display_ids: dispatch.required_order ? dispatch.required_order.after : [],
    blocks_display_ids: dispatch.required_order ? dispatch.required_order.before : [],
    parallel_safety: dispatch.parallel_safety,
    source_path: path.resolve(taskPath),
  };
}

function parseAgent(agentPath) {
  const text = fs.readFileSync(agentPath, 'utf8');
  const heading = parseAgentHeading(text);
  if (!heading) {
    throw new Error(`No agent heading found in ${agentPath}`);
  }
  const source_path_hash = crypto.createHash('sha256').update(text).digest('hex');

  const missionMatch = text.match(/##\s+Mission\s*\n+([^\n][^\n]*(?:\n[^\n][^\n]*)*?)(?:\n\n|\n##)/);
  const mission_summary = missionMatch ? missionMatch[1].trim() : null;

  return {
    id: heading.id,
    title: heading.title,
    role_group: heading.role_group,
    status: heading.status,
    mission_summary,
    source_path: path.resolve(agentPath),
    source_path_hash,
  };
}

function ulid(now = Date.now()) {
  const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let timeStr = '';
  let t = now;
  for (let i = 9; i >= 0; i--) {
    timeStr = ENCODING[t % 32] + timeStr;
    t = Math.floor(t / 32);
  }
  let randStr = '';
  for (let i = 0; i < 16; i++) {
    randStr += ENCODING[Math.floor(Math.random() * 32)];
  }
  return timeStr + randStr;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJsonAtomic(p, obj) {
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, p);
}

function appendAuditEvent(joshRoot, event) {
  const date = new Date().toISOString().slice(0, 10);
  const auditPath = path.join(joshRoot, 'audit', `${date}.jsonl`);
  ensureDir(path.dirname(auditPath));
  fs.appendFileSync(auditPath, JSON.stringify(event) + '\n');
}

function findTaskFiles(corpusPath) {
  const dispatchDir = path.join(corpusPath, 'FOUR_DAY_FULL_PROJECT_DISPATCH');
  const taskFiles = [];
  for (const dayFolder of fs.readdirSync(dispatchDir)) {
    if (!/^day_\d+_/.test(dayFolder)) continue;
    const dayPath = path.join(dispatchDir, dayFolder);
    if (!fs.statSync(dayPath).isDirectory()) continue;
    for (const file of fs.readdirSync(dayPath)) {
      if (/^D\d+-\d+_.+\.md$/.test(file)) {
        taskFiles.push(path.join(dayPath, file));
      }
    }
  }
  return taskFiles;
}

function findAgentFiles(corpusPath) {
  const agentDir = path.join(corpusPath, 'agent_orchestration', 'agents');
  if (!fs.existsSync(agentDir)) return [];
  return fs.readdirSync(agentDir)
    .filter((f) => /^AGENT_\d+_.+\.md$/.test(f))
    .map((f) => path.join(agentDir, f));
}

function importProject(corpusPath, opts = {}) {
  const joshRoot = opts.joshRoot || path.join(require('os').homedir(), '.josh');
  const actor = opts.actor || 'cli:josh';
  const now = new Date().toISOString();

  const dispatchReadme = path.join(corpusPath, 'FOUR_DAY_FULL_PROJECT_DISPATCH', 'README.md');
  const charter = parseCharter(dispatchReadme);

  const taskFiles = findTaskFiles(corpusPath);
  const tasks = taskFiles.map(parseTask);

  const agentFiles = findAgentFiles(corpusPath);
  const agents = agentFiles.map(parseAgent);

  const project_id = ulid();

  const projectDir = path.join(joshRoot, 'projects', project_id);
  ensureDir(projectDir);
  writeJsonAtomic(path.join(projectDir, 'charter.json'), {
    schema: 1,
    id: project_id,
    title: charter.title,
    source_path: charter.source_path,
    definition_of_done: charter.definition_of_done,
    days: charter.days,
    agent_set_snapshot: agents.map((a) => a.id),
    imported_at: now,
    imported_by: actor,
  });

  appendAuditEvent(joshRoot, {
    schema: 1,
    at: now,
    actor,
    action: 'project.imported',
    id: project_id,
    details: { title: charter.title, todo_count: tasks.length, agent_count: agents.length },
  });

  for (const agent of agents) {
    const agentDir = path.join(joshRoot, 'agents', agent.id);
    ensureDir(agentDir);
    writeJsonAtomic(path.join(agentDir, 'manifest.json'), {
      schema: 1,
      id: agent.id,
      version: 1,
      project_id,
      source_path: agent.source_path,
      source_path_hash: agent.source_path_hash,
      title: agent.title,
      role_group: agent.role_group,
      status: agent.status,
      mission_summary: agent.mission_summary,
      capabilities: [],
      verdict_schema: null,
      budget: { max_tokens_per_claim: 50000, max_wall_seconds: 600, preferred_model: 'sonnet' },
      did: null,
      pubkey_path: null,
      superseded_by: null,
      trust_dimensions: [],
      imported_at: now,
      imported_by: actor,
    });

    appendAuditEvent(joshRoot, {
      schema: 1,
      at: now,
      actor,
      action: 'agent.imported',
      id: agent.id,
      details: { title: agent.title, source_path: agent.source_path },
    });
  }

  const taskUlids = {};
  for (const task of tasks) {
    taskUlids[task.display_id] = ulid();
  }

  const triagedDir = path.join(joshRoot, 'todo', 'triaged');
  ensureDir(triagedDir);
  for (const task of tasks) {
    const todo_id = taskUlids[task.display_id];
    const todoData = {
      schema: 1,
      id: todo_id,
      display_id: task.display_id,
      project_id,
      title: task.title,
      source_path: task.source_path,
      day: task.day,
      phase: task.phase,
      phase_name: task.phase_name,
      primary_role: task.primary_role,
      depends_on: task.depends_on_display_ids
        .map((d) => taskUlids[d])
        .filter(Boolean)
        .map((id) => ({ id, kind: 'hard' })),
      depends_on_display_ids: task.depends_on_display_ids,
      blocks_display_ids: task.blocks_display_ids,
      parallel_safety: task.parallel_safety,
      priority: 'p2',
      labels: [],
      verdict_mode: 'single',
      claim: null,
      created_at: now,
      created_by: actor,
      history: [{ at: now, actor, event: 'imported' }],
    };
    writeJsonAtomic(path.join(triagedDir, `${todo_id}.json`), todoData);

    appendAuditEvent(joshRoot, {
      schema: 1,
      at: now,
      actor,
      action: 'todo.imported',
      id: todo_id,
      details: { display_id: task.display_id, primary_role: task.primary_role },
    });
  }

  return {
    project_id,
    todo_count: tasks.length,
    agent_count: agents.length,
  };
}

module.exports = { parseCharter, parseTask, parseAgent, importProject };
