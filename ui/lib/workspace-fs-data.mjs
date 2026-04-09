import fs from 'node:fs';
import path from 'node:path';

export function safeResolveUnder(root, rel) {
  if (rel.includes('..') || path.isAbsolute(rel)) return null;
  const resolved = path.resolve(root, rel);
  const normalizedRoot = path.resolve(root) + path.sep;
  if (!resolved.startsWith(normalizedRoot) && resolved !== path.resolve(root)) return null;
  return resolved;
}

export function normalizeParentRel(parentRel) {
  return String(parentRel ?? '')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');
}

export function buildChildren(dirRel, parentLevel, filesRoot) {
  const absDir = dirRel ? path.join(filesRoot, dirRel) : filesRoot;
  if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) return [];

  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  const level = parentLevel + 1;
  const children = [];

  for (const ent of entries) {
    if (ent.name.startsWith('.')) continue;

    const rel = dirRel ? `${dirRel}/${ent.name}` : ent.name;

    if (ent.isDirectory()) {
      children.push({
        id: rel,
        name: ent.name,
        type: 'folder',
        level,
        children: buildChildren(rel, parentLevel + 1, filesRoot),
      });
    } else {
      const ext = path.extname(ent.name).toLowerCase();
      const type = ext === '.mmd' || ext === '.mermaid' ? 'mermaid' : 'file';
      children.push({
        id: rel,
        name: ent.name,
        type,
        level,
        relPath: rel,
      });
    }
  }

  return children;
}

export function walkAgentMarkdownFiles(agentsRoot, dirRel, acc) {
  const abs = dirRel ? path.join(agentsRoot, dirRel) : agentsRoot;
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) return;
  const entries = fs.readdirSync(abs, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.name.startsWith('.')) continue;
    const rel = dirRel ? `${dirRel}/${ent.name}` : ent.name;
    if (ent.isDirectory()) {
      walkAgentMarkdownFiles(agentsRoot, rel, acc);
    } else if (ent.name.toLowerCase().endsWith('.md')) {
      acc.push(rel);
    }
  }
}

export function readAgentFrontmatterMeta(absPath) {
  const fallbackName = path.basename(absPath, path.extname(absPath));
  let name = fallbackName;
  let description = '';
  try {
    const head = fs.readFileSync(absPath, 'utf8').slice(0, 8192);
    if (!head.startsWith('---')) return { name, description };
    const end = head.indexOf('\n---', 3);
    if (end === -1) return { name, description };
    const fm = head.slice(3, end);
    const nameMatch = fm.match(/^name:\s*(.+)$/m);
    const descMatch = fm.match(/^description:\s*(.+)$/m);
    if (nameMatch) {
      name = nameMatch[1].trim().replace(/^["']|["']$/g, '');
    }
    if (descMatch) {
      description = descMatch[1].trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    /* ignore */
  }
  return { name, description };
}

export const TASK_LISTS_REL = 'tasks/task-lists.json';

export function resolveFilesPath(filesRoot, rel) {
  const n = normalizeParentRel(rel);
  if (!n) return null;
  return safeResolveUnder(filesRoot, n);
}

/**
 * Same JSON shape as GET /api/data-tree (optionally mark deploy snapshot read-only).
 * @param {string} filesRoot
 * @param {{ liveFiles?: boolean }} [opts]
 */
export function buildDataTreePayload(filesRoot, opts = {}) {
  const liveFiles = opts.liveFiles !== false;
  const filesOk = fs.existsSync(filesRoot) && fs.statSync(filesRoot).isDirectory();

  const children = [];
  if (filesOk) {
    children.push(...buildChildren('', 1, filesRoot));
  }

  if (children.length === 0) {
    return {
      id: 'root',
      name: 'Workspace',
      type: 'dashboard',
      level: 1,
      liveFiles,
      summary:
        'Add a `workspace` folder next to `ui/` with `docs/`, `notes/`, `tasks/`, `mindmap/`, etc. (dev server).',
      children: [],
    };
  }

  return {
    id: 'root',
    name: 'Workspace',
    type: 'dashboard',
    level: 1,
    liveFiles,
    summary:
      'Workspace files under workspace/ — use the `docs` folder for project documentation (Markdown). Open items in the main panel.',
    children,
  };
}

export function buildAgentsListPayload(agentsRoot) {
  const list = [];
  if (fs.existsSync(agentsRoot) && fs.statSync(agentsRoot).isDirectory()) {
    walkAgentMarkdownFiles(agentsRoot, '', list);
  }
  list.sort((a, b) => a.localeCompare(b));
  const agents = list.map((rel) => {
    const resolved = path.join(agentsRoot, rel);
    const meta = readAgentFrontmatterMeta(resolved);
    return {
      path: rel.replace(/\\/g, '/'),
      name: meta.name,
      description: meta.description,
    };
  });
  return { agents };
}

/** @returns {{ lists: unknown[] } | { error: string }} */
export function readTasksDataPayload(filesRoot) {
  if (!fs.existsSync(filesRoot)) {
    return { error: 'Workspace directory missing' };
  }
  const resolved = safeResolveUnder(filesRoot, TASK_LISTS_REL);
  if (!resolved || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return { error: 'No task-lists file yet' };
  }
  try {
    const raw = fs.readFileSync(resolved, 'utf8');
    const data = JSON.parse(raw);
    const lists = Array.isArray(data.lists) ? data.lists : [];
    return { lists };
  } catch {
    return { error: 'Invalid task-lists JSON' };
  }
}
