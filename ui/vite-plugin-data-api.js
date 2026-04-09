import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function safeResolveUnder(root, rel) {
  if (rel.includes('..') || path.isAbsolute(rel)) return null;
  const resolved = path.resolve(root, rel);
  const normalizedRoot = path.resolve(root) + path.sep;
  if (!resolved.startsWith(normalizedRoot) && resolved !== path.resolve(root)) return null;
  return resolved;
}

/** Single path segment or filename (no slashes, no reserved junk). */
function safeFileSegment(name) {
  const n = String(name ?? '').trim();
  if (!n || n.includes('/') || n.includes('\\') || n === '.' || n === '..') return null;
  if (/[\x00-\x1f]/.test(n)) return null;
  return n;
}

function normalizeParentRel(parentRel) {
  return String(parentRel ?? '')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');
}

function buildChildren(dirRel, parentLevel, filesRoot) {
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

function walkAgentMarkdownFiles(agentsRoot, dirRel, acc) {
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

function readAgentFrontmatterMeta(absPath) {
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

function safeAgentSubpath(folder) {
  if (folder == null || String(folder).trim() === '') return '';
  const parts = String(folder).split(/[/\\]+/).filter(Boolean);
  for (const p of parts) {
    if (p === '..' || p === '.' || /[^\w.-]/i.test(p)) return null;
  }
  return parts.join(path.sep);
}

function slugifyAgentId(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'new-agent';
}

const TASK_LISTS_REL = 'tasks/task-lists.json';

/** Resolve a path under `workspace/` for reads and writes (e.g. `docs/README.md`). */
function resolveFilesPath(filesRoot, rel) {
  const n = normalizeParentRel(rel);
  if (!n) return null;
  return safeResolveUnder(filesRoot, n);
}

export function dataApiPlugin() {
  const filesRoot = path.resolve(__dirname, '../workspace');
  const agentsRoot = path.resolve(__dirname, '../agents');

  return {
    name: 'vite-plugin-data-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method === 'POST' && req.url?.startsWith('/api/agents-create')) {
          let raw = '';
          req.on('data', (chunk) => {
            raw += chunk;
          });
          req.on('end', () => {
            try {
              const body = JSON.parse(raw || '{}');
              const slug = slugifyAgentId(body.slug || body.name || body.id);
              const displayName = String(body.displayName || body.name || slug).trim() || slug;
              const description = String(body.description || '').trim();
              const instructions = String(body.instructions || body.body || '').trim();
              const sub = safeAgentSubpath(body.folder || body.subfolder || '');
              if (sub === null) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Invalid folder path' }));
                return;
              }
              const relPath = sub ? `${sub.replace(/\\/g, '/')}/${slug}.md` : `${slug}.md`;
              const resolved = safeResolveUnder(agentsRoot, relPath);
              if (!resolved) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Invalid agent path' }));
                return;
              }
              if (fs.existsSync(resolved)) {
                res.statusCode = 409;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'An agent with this id already exists' }));
                return;
              }
              fs.mkdirSync(path.dirname(resolved), { recursive: true });
              const inner =
                instructions ||
                'You are a helpful specialist agent. Answer clearly and follow the user’s goals.';
              const fileContent = `---
name: ${JSON.stringify(displayName)}
description: ${JSON.stringify(description)}
---

${inner}
`;
              fs.writeFileSync(resolved, fileContent, 'utf8');
              res.statusCode = 201;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true, path: relPath.replace(/\\/g, '/') }));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: String(err.message || err) }));
            }
          });
          return;
        }

        if (req.method === 'POST' && req.url?.startsWith('/api/files-mutate')) {
          let raw = '';
          req.on('data', (chunk) => {
            raw += chunk;
          });
          req.on('end', () => {
            try {
              const body = JSON.parse(raw || '{}');
              const action = body.action;
              const jsonErr = (code, msg) => {
                res.statusCode = code;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: msg }));
              };

              if (action === 'mkdir') {
                const parentRel = normalizeParentRel(body.parentRel);
                const seg = safeFileSegment(body.name);
                if (!seg) {
                  jsonErr(400, 'Invalid folder name');
                  return;
                }
                if (parentRel) {
                  const parentResolved = safeResolveUnder(filesRoot, parentRel);
                  if (
                    !parentResolved ||
                    !fs.existsSync(parentResolved) ||
                    !fs.statSync(parentResolved).isDirectory()
                  ) {
                    jsonErr(400, 'Invalid parent folder');
                    return;
                  }
                }
                const rel = parentRel ? `${parentRel}/${seg}` : seg;
                const resolved = safeResolveUnder(filesRoot, rel);
                if (!resolved) {
                  jsonErr(400, 'Invalid path');
                  return;
                }
                if (fs.existsSync(resolved)) {
                  jsonErr(409, 'Already exists');
                  return;
                }
                fs.mkdirSync(resolved);
                res.statusCode = 201;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: true, path: rel.replace(/\\/g, '/') }));
                return;
              }

              if (action === 'writeFile') {
                const parentRel = normalizeParentRel(body.parentRel);
                let seg = safeFileSegment(body.name);
                if (!seg) {
                  jsonErr(400, 'Invalid file name');
                  return;
                }
                if (!seg.includes('.')) {
                  seg += '.md';
                }
                if (parentRel) {
                  const parentResolved = safeResolveUnder(filesRoot, parentRel);
                  if (
                    !parentResolved ||
                    !fs.existsSync(parentResolved) ||
                    !fs.statSync(parentResolved).isDirectory()
                  ) {
                    jsonErr(400, 'Invalid parent folder');
                    return;
                  }
                }
                const rel = parentRel ? `${parentRel}/${seg}` : seg;
                const resolved = safeResolveUnder(filesRoot, rel);
                if (!resolved) {
                  jsonErr(400, 'Invalid path');
                  return;
                }
                if (fs.existsSync(resolved)) {
                  jsonErr(409, 'Already exists');
                  return;
                }
                fs.writeFileSync(resolved, String(body.content ?? ''), 'utf8');
                res.statusCode = 201;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: true, path: rel.replace(/\\/g, '/') }));
                return;
              }

              if (action === 'delete') {
                const rel = normalizeParentRel(body.path);
                if (!rel) {
                  jsonErr(400, 'Cannot delete root');
                  return;
                }
                const resolved = safeResolveUnder(filesRoot, rel);
                if (!resolved || !fs.existsSync(resolved)) {
                  jsonErr(404, 'Not found');
                  return;
                }
                fs.rmSync(resolved, { recursive: true, force: true });
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: true }));
                return;
              }

              if (action === 'move') {
                const fromRel = normalizeParentRel(body.from);
                const toParentRel = normalizeParentRel(body.toParent);
                if (!fromRel) {
                  jsonErr(400, 'Invalid source path');
                  return;
                }
                const fromResolved = safeResolveUnder(filesRoot, fromRel);
                if (!fromResolved || !fs.existsSync(fromResolved)) {
                  jsonErr(404, 'Source not found');
                  return;
                }
                if (toParentRel) {
                  const parentResolved = safeResolveUnder(filesRoot, toParentRel);
                  if (
                    !parentResolved ||
                    !fs.existsSync(parentResolved) ||
                    !fs.statSync(parentResolved).isDirectory()
                  ) {
                    jsonErr(400, 'Invalid destination folder');
                    return;
                  }
                }
                const baseName = path.posix.basename(fromRel) || fromRel;
                const toRel = toParentRel ? `${toParentRel}/${baseName}` : baseName;
                if (fromRel === toRel) {
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ ok: true, path: toRel.replace(/\\/g, '/') }));
                  return;
                }
                const toResolved = safeResolveUnder(filesRoot, toRel);
                if (!toResolved) {
                  jsonErr(400, 'Invalid destination path');
                  return;
                }
                let fromStat;
                try {
                  fromStat = fs.statSync(fromResolved);
                } catch {
                  jsonErr(404, 'Source not found');
                  return;
                }
                if (fromStat.isDirectory()) {
                  const slash = fromRel.endsWith('/') ? fromRel.slice(0, -1) : fromRel;
                  if (toRel === slash || toRel.startsWith(`${slash}/`)) {
                    jsonErr(400, 'Cannot move a folder into itself');
                    return;
                  }
                }
                if (fs.existsSync(toResolved)) {
                  jsonErr(409, 'A file or folder with that name already exists here');
                  return;
                }
                fs.mkdirSync(path.dirname(toResolved), { recursive: true });
                fs.renameSync(fromResolved, toResolved);
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: true, path: toRel.replace(/\\/g, '/') }));
                return;
              }

              if (action === 'rename') {
                const fromRel = normalizeParentRel(body.from);
                const newSeg = safeFileSegment(body.newName);
                if (!fromRel || !newSeg) {
                  jsonErr(400, 'Invalid path or name');
                  return;
                }
                const fromResolved = safeResolveUnder(filesRoot, fromRel);
                if (!fromResolved || !fs.existsSync(fromResolved)) {
                  jsonErr(404, 'Not found');
                  return;
                }
                const slash = fromRel.lastIndexOf('/');
                const parentRel = slash <= 0 ? '' : fromRel.slice(0, slash);
                const toRel = parentRel ? `${parentRel}/${newSeg}` : newSeg;
                if (fromRel === toRel) {
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ ok: true, path: toRel.replace(/\\/g, '/') }));
                  return;
                }
                const toResolved = safeResolveUnder(filesRoot, toRel);
                if (!toResolved) {
                  jsonErr(400, 'Invalid destination path');
                  return;
                }
                if (fs.existsSync(toResolved)) {
                  jsonErr(409, 'A file or folder with that name already exists');
                  return;
                }
                fs.renameSync(fromResolved, toResolved);
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: true, path: toRel.replace(/\\/g, '/') }));
                return;
              }

              jsonErr(400, 'Unknown action');
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: String(err.message || err) }));
            }
          });
          return;
        }

        if (req.method === 'POST' && req.url?.startsWith('/api/tasks-data')) {
          let raw = '';
          req.on('data', (chunk) => {
            raw += chunk;
          });
          req.on('end', () => {
            try {
              const data = JSON.parse(raw || '{}');
              const lists = data.lists;
              const jsonErr = (code, msg) => {
                res.statusCode = code;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: msg }));
              };
              if (!Array.isArray(lists)) {
                jsonErr(400, 'lists must be an array');
                return;
              }
              for (const l of lists) {
                if (!l || typeof l.name !== 'string' || !Array.isArray(l.todos)) {
                  jsonErr(400, 'Invalid list entry');
                  return;
                }
              }
              if (!fs.existsSync(filesRoot)) {
                jsonErr(400, 'Workspace directory missing');
                return;
              }
              const tasksDirRel = 'tasks';
              const tasksDirResolved = safeResolveUnder(filesRoot, tasksDirRel);
              if (!tasksDirResolved) {
                jsonErr(400, 'Invalid tasks path');
                return;
              }
              if (!fs.existsSync(tasksDirResolved)) {
                fs.mkdirSync(tasksDirResolved, { recursive: true });
              }
              const fileResolved = safeResolveUnder(filesRoot, TASK_LISTS_REL);
              if (!fileResolved) {
                jsonErr(400, 'Invalid file path');
                return;
              }
              fs.writeFileSync(fileResolved, `${JSON.stringify({ lists }, null, 2)}\n`, 'utf8');
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true }));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: String(err.message || err) }));
            }
          });
          return;
        }

        try {
          const url = new URL(req.url || '/', 'http://localhost');

          if (req.method === 'GET' && url.pathname === '/api/agents-list') {
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
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ agents }));
            return;
          }

          if (req.method === 'GET' && url.pathname === '/api/agents-content') {
            const rel = url.searchParams.get('path') || '';
            const resolved = safeResolveUnder(agentsRoot, rel);
            if (!resolved || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Invalid agent path' }));
              return;
            }
            if (!resolved.toLowerCase().endsWith('.md')) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Not a markdown agent file' }));
              return;
            }
            const content = fs.readFileSync(resolved, 'utf8');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ content }));
            return;
          }

          if (req.method === 'GET' && url.pathname === '/api/data-tree') {
            const filesOk = fs.existsSync(filesRoot) && fs.statSync(filesRoot).isDirectory();

            const children = [];
            if (filesOk) {
              children.push(...buildChildren('', 1, filesRoot));
            }

            if (children.length === 0) {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  id: 'root',
                  name: 'Workspace',
                  type: 'dashboard',
                  level: 1,
                  liveFiles: true,
                  summary:
                    'Add a `workspace` folder next to `ui/` with `docs/`, `notes/`, `tasks/`, `mindmap/`, etc. (dev server).',
                  children: [],
                })
              );
              return;
            }

            const payload = {
              id: 'root',
              name: 'Workspace',
              type: 'dashboard',
              level: 1,
              liveFiles: true,
              summary:
                'Workspace files under workspace/ — use the `docs` folder for project documentation (Markdown). Open items in the main panel.',
              children,
            };
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(payload));
            return;
          }

          if (req.method === 'GET' && url.pathname === '/api/data-content') {
            const rel = url.searchParams.get('path') || '';
            const resolved = resolveFilesPath(filesRoot, rel);
            if (!resolved || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
              res.statusCode = 400;
              res.end('Invalid path');
              return;
            }
            const content = fs.readFileSync(resolved, 'utf8');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ content }));
            return;
          }

          if (req.method === 'GET' && url.pathname === '/api/tasks-data') {
            if (!fs.existsSync(filesRoot)) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Workspace directory missing' }));
              return;
            }
            const resolved = safeResolveUnder(filesRoot, TASK_LISTS_REL);
            if (!resolved || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'No task-lists file yet' }));
              return;
            }
            try {
              const raw = fs.readFileSync(resolved, 'utf8');
              const data = JSON.parse(raw);
              const lists = Array.isArray(data.lists) ? data.lists : [];
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ lists }));
            } catch {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Invalid task-lists JSON' }));
            }
            return;
          }
        } catch (e) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain');
          res.end(String(e.message || e));
          return;
        }

        next();
      });
    },
  };
}
