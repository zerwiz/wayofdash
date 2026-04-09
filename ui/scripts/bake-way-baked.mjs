/**
 * Copies workspace/ + agents/ into public/way-baked/ and writes JSON indexes
 * so Netlify static hosting serves the same tree and file contents as the dev API.
 * Run before `vite build` when WAY_BAKED=1 (see netlify.toml).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildDataTreePayload,
  buildAgentsListPayload,
  readTasksDataPayload,
} from '../lib/workspace-fs-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(uiRoot, '..');
const filesRoot = path.join(repoRoot, 'workspace');
const agentsRoot = path.join(repoRoot, 'agents');
const outDir = path.join(uiRoot, 'public', 'way-baked');

function writeJson(p, obj) {
  fs.writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

if (fs.existsSync(filesRoot) && fs.statSync(filesRoot).isDirectory()) {
  fs.cpSync(filesRoot, path.join(outDir, 'workspace'), { recursive: true });
} else {
  fs.mkdirSync(path.join(outDir, 'workspace'), { recursive: true });
}

if (fs.existsSync(agentsRoot) && fs.statSync(agentsRoot).isDirectory()) {
  fs.cpSync(agentsRoot, path.join(outDir, 'agents'), { recursive: true });
} else {
  fs.mkdirSync(path.join(outDir, 'agents'), { recursive: true });
}

const tree = buildDataTreePayload(filesRoot, { liveFiles: false });
tree.netlifyBaked = true;
writeJson(path.join(outDir, 'data-tree.json'), tree);

writeJson(path.join(outDir, 'agents-list.json'), buildAgentsListPayload(agentsRoot));

const tasksPayload = readTasksDataPayload(filesRoot);
const tasksJson =
  'lists' in tasksPayload && Array.isArray(tasksPayload.lists)
    ? { lists: tasksPayload.lists }
    : { lists: [] };
writeJson(path.join(outDir, 'tasks-data.json'), tasksJson);

console.log('way-baked: wrote', outDir);
