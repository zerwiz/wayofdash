/** Netlify (and similar) builds set `WAY_BAKED=1` during `vite build` after `bake-way-baked.mjs`. */
export function isWayBakedDeploy() {
  return typeof __WAY_BAKED__ !== 'undefined' && __WAY_BAKED__;
}

export function wayDataTreeUrl() {
  return isWayBakedDeploy() ? '/way-baked/data-tree.json' : '/api/data-tree';
}

export function wayTasksDataUrl() {
  return isWayBakedDeploy() ? '/way-baked/tasks-data.json' : '/api/tasks-data';
}

export function wayAgentsListUrl() {
  return isWayBakedDeploy() ? '/way-baked/agents-list.json' : '/api/agents-list';
}

/** @param {string} relPath workspace-relative path */
export function wayDataContentUrl(relPath) {
  if (!isWayBakedDeploy()) {
    return `/api/data-content?path=${encodeURIComponent(relPath)}`;
  }
  const segs = String(relPath).split('/').filter(Boolean).map(encodeURIComponent);
  return `/way-baked/workspace/${segs.join('/')}`;
}

/** @param {string} agentPath agents-relative path */
export function wayAgentsContentUrl(agentPath) {
  if (!isWayBakedDeploy()) {
    return `/api/agents-content?path=${encodeURIComponent(agentPath)}`;
  }
  const segs = String(agentPath).split('/').filter(Boolean).map(encodeURIComponent);
  return `/way-baked/agents/${segs.join('/')}`;
}

/**
 * @param {Response} r
 * @returns {Promise<{ content: string }>}
 */
export async function wayParseWorkspaceOrAgentBody(r) {
  if (!r.ok) throw new Error('load-failed');
  if (isWayBakedDeploy()) {
    const content = await r.text();
    return { content };
  }
  return r.json();
}
