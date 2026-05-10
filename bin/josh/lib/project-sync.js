'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { parseAgent, parseTask } = require('./project-importer');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function writeJsonAtomic(p, obj) {
  const tmp = p + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, p);
}

function appendAuditEvent(joshRoot, event) {
  const date = new Date().toISOString().slice(0, 10);
  const auditPath = path.join(joshRoot, 'audit', `${date}.jsonl`);
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  fs.appendFileSync(auditPath, JSON.stringify(event) + '\n');
}

function fileHash(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function diffProject(projectId, opts = {}) {
  const joshRoot = opts.joshRoot || path.join(os.homedir(), '.josh');
  const result = { agents_changed: [], agents_missing: [], tasks_changed: [], tasks_missing: [] };

  const agentsDir = path.join(joshRoot, 'agents');
  if (fs.existsSync(agentsDir)) {
    for (const id of fs.readdirSync(agentsDir)) {
      const manifestPath = path.join(agentsDir, id, 'manifest.json');
      if (!fs.existsSync(manifestPath)) continue;
      const manifest = readJson(manifestPath);
      if (manifest.project_id !== projectId) continue;
      if (!fs.existsSync(manifest.source_path)) {
        result.agents_missing.push({ id: manifest.id, source_path: manifest.source_path });
        continue;
      }
      const currentHash = fileHash(manifest.source_path);
      if (currentHash !== manifest.source_path_hash) {
        result.agents_changed.push({ id: manifest.id, old_hash: manifest.source_path_hash, new_hash: currentHash });
      }
    }
  }

  const states = ['incoming', 'triaged', 'in_progress', 'done', 'blocked', 'failed', 'cancelled'];
  for (const state of states) {
    const dir = path.join(joshRoot, 'todo', state);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      let todo;
      try { todo = readJson(path.join(dir, file)); } catch (e) { continue; }
      if (todo.project_id !== projectId) continue;
      if (!fs.existsSync(todo.source_path)) {
        result.tasks_missing.push({ id: todo.id, display_id: todo.display_id, source_path: todo.source_path });
        continue;
      }
      const fresh = parseTask(todo.source_path);
      const changed =
        fresh.title !== todo.title ||
        fresh.day !== todo.day ||
        fresh.phase !== todo.phase ||
        fresh.primary_role !== todo.primary_role ||
        JSON.stringify(fresh.depends_on_display_ids) !== JSON.stringify(todo.depends_on_display_ids) ||
        JSON.stringify(fresh.blocks_display_ids) !== JSON.stringify(todo.blocks_display_ids);
      if (changed) {
        result.tasks_changed.push({ id: todo.id, display_id: todo.display_id, state });
      }
    }
  }

  return result;
}

function applySync(projectId, opts = {}) {
  const joshRoot = opts.joshRoot || path.join(os.homedir(), '.josh');
  const actor = opts.actor || 'cli:josh';
  const dryRun = !!opts.dryRun;
  const now = new Date().toISOString();
  const diff = diffProject(projectId, { joshRoot });
  let agents_updated = 0;
  let tasks_updated = 0;

  // Build display_id -> ulid lookup for resolving dependencies.
  const displayToUlid = {};
  if (!dryRun) {
    const states = ['incoming', 'triaged', 'in_progress', 'done', 'blocked', 'failed', 'cancelled'];
    for (const state of states) {
      const dir = path.join(joshRoot, 'todo', state);
      if (!fs.existsSync(dir)) continue;
      for (const file of fs.readdirSync(dir)) {
        if (!file.endsWith('.json')) continue;
        let todo;
        try { todo = readJson(path.join(dir, file)); } catch (e) { continue; }
        if (todo.project_id !== projectId) continue;
        if (todo.display_id) displayToUlid[todo.display_id] = todo.id;
      }
    }
  }

  if (!dryRun) {
    for (const change of diff.agents_changed) {
      const manifestPath = path.join(joshRoot, 'agents', change.id, 'manifest.json');
      const manifest = readJson(manifestPath);
      const fresh = parseAgent(manifest.source_path);
      manifest.source_path_hash = fresh.source_path_hash;
      manifest.title = fresh.title;
      manifest.role_group = fresh.role_group;
      manifest.status = fresh.status;
      manifest.mission_summary = fresh.mission_summary;
      manifest.synced_at = now;
      manifest.synced_by = actor;
      writeJsonAtomic(manifestPath, manifest);
      agents_updated++;
      appendAuditEvent(joshRoot, {
        schema: 1, at: now, actor, action: 'agent.synced', id: change.id,
        details: { old_hash: change.old_hash, new_hash: change.new_hash },
      });
    }

    const states = ['incoming', 'triaged', 'in_progress', 'done', 'blocked', 'failed', 'cancelled'];
    for (const change of diff.tasks_changed) {
      let todoPath = null;
      for (const state of states) {
        const candidate = path.join(joshRoot, 'todo', state, `${change.id}.json`);
        if (fs.existsSync(candidate)) { todoPath = candidate; break; }
      }
      if (!todoPath) continue;
      const todo = readJson(todoPath);
      const fresh = parseTask(todo.source_path);
      todo.title = fresh.title;
      todo.day = fresh.day;
      todo.phase = fresh.phase;
      todo.phase_name = fresh.phase_name;
      todo.primary_role = fresh.primary_role;
      todo.depends_on_display_ids = fresh.depends_on_display_ids;
      todo.depends_on = fresh.depends_on_display_ids
        .map((d) => displayToUlid[d])
        .filter(Boolean)
        .map((id) => ({ id, kind: 'hard' }));
      todo.blocks_display_ids = fresh.blocks_display_ids;
      todo.parallel_safety = fresh.parallel_safety;
      todo.synced_at = now;
      todo.synced_by = actor;
      todo.history = todo.history || [];
      todo.history.push({ at: now, actor, event: 'synced' });
      writeJsonAtomic(todoPath, todo);
      tasks_updated++;
      appendAuditEvent(joshRoot, {
        schema: 1, at: now, actor, action: 'todo.synced', id: todo.id,
        details: { display_id: todo.display_id },
      });
    }
  }

  return {
    project_id: projectId,
    dry_run: dryRun,
    agents_changed: diff.agents_changed.length,
    agents_missing: diff.agents_missing.length,
    agents_updated,
    tasks_changed: diff.tasks_changed.length,
    tasks_missing: diff.tasks_missing.length,
    tasks_updated,
  };
}

module.exports = { diffProject, applySync };
