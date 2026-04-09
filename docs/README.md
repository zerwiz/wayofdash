# Way of — documentation index

This folder holds **repository-level** documentation: how the project is laid out and what each part is for. It is **not** the same as **`workspace/docs/`**, which is the **editable workspace** documented in the dashboard (see below).

---

## Top-level layout

| Path | Role |
|------|------|
| **`agents/`** | Markdown agent definitions (frontmatter + instructions) and YAML (`agent-chain.yaml`, `teams.yaml`). Used by the UI’s **AI** tab in dev: `/api/agents-list`, `/api/agents-content`, `/api/agents-create`. Subfolder **`domain-specialists/`** groups many specialist personas by domain. |
| **`docs/`** | **This directory** — human-oriented map of the repo (this file). Add guides here that describe the *project*, not necessarily user-facing files in `workspace/`. |
| **`workspace/`** | **Workspace root for the Fibonacci dashboard.** The dev server exposes the full tree at `/api/data-tree`. Everything users browse, create, move, or delete in the sidebar (when live) lives under here. |
| **`rules/`** | Formal rules: [folder structure](../rules/folder-structure-rules.md), [Fibonacci IA](../rules/Fibonacci-Information-Architecture-Rule.md), and [rules README](../rules/README.md). |
| **`ui/`** | Vite + React SPA: [`ui/README.md`](../ui/README.md), source in `ui/src/`, dev APIs in `ui/vite-plugin-data-api.js`. |
| **`netlify.toml`** | Static deploy settings (build from `ui/`, publish `dist/`). |
| **`Way of.code-workspace`** | VS Code / Cursor multi-root workspace file. |

---

## `workspace/` — what each folder is for

These paths are **canonical** for dashboard content (see [folder structure rules](../rules/folder-structure-rules.md)).

```
workspace/
├── docs/           # Project documentation (.md). Rendered as GitHub-flavored Markdown in the UI.
├── planning/       # UI / product planning notes (e.g. ui-planning-document.md), not shown as a special tab—browse as files in dev.
├── tasks/          # Task persistence, e.g. task-lists.json (synced with the TASKS view in dev).
└── mindmap/        # Diagram sources (.mmd, Mermaid syntax). Rendered in the UI like embedded ```mermaid blocks.
```

Optional folders (e.g. **`notes/`**) follow the same rules document; add them under `workspace/` as needed.

**Important:** **`/docs` (repo root)** vs **`workspace/docs/`**:

- **`…/Way of/docs/`** — meta / repo documentation (this index, future onboarding).
- **`…/Way of/workspace/docs/`** — content the app lists in the **Workspace** sidebar and opens in the main panel.

---

## `ui/` — main subfolders

```
ui/
├── src/            # React entry (App.jsx), Markdown viewer (MarkdownDoc.jsx), Mermaid host (MermaidDiagram.jsx), utilities.
├── public/         # Static assets copied to dist (e.g. Netlify `_redirects`).
├── dist/           # Production build output (generated; not hand-edited).
├── index.html      # HTML shell; loads theme from localStorage before React.
├── vite.config.js  # Bundler config; wires Dev middleware for /api/*.
└── vite-plugin-data-api.js  # Implements data-tree, file CRUD, agents, tasks APIs in dev.
```

---

## `agents/` — main subfolders

```
agents/
├── *.md                    # Top-level agent files (e.g. planner, documenter, reviewer).
├── agent-chain.yaml        # Chain / pipeline configuration.
├── teams.yaml              # Team groupings for agents.
└── domain-specialists/     # Numbered categories (01–10) of domain-specific agents (many .md files).
```

---

## Quick links

| Topic | Where |
|--------|--------|
| Folder naming & `workspace/` rules | [rules/folder-structure-rules.md](../rules/folder-structure-rules.md) |
| Fibonacci levels & navigation | [rules/Fibonacci-Information-Architecture-Rule.md](../rules/Fibonacci-Information-Architecture-Rule.md) |
| Run, build, Netlify | [ui/README.md](../ui/README.md) |
| Rules index | [rules/README.md](../rules/README.md) |

---

*Last updated to match repo layout: 2026-04-09.*
