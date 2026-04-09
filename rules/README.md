# Rules

Governance and architecture notes for the **Way of** workspace. These files are the **source of truth** for folder layout, naming, and Fibonacci-based information design. They live in-repo next to `ui/` and `workspace/` so humans and tools can find them quickly.

## Contents

| Document | Purpose |
|----------|---------|
| [folder-structure-rules.md](./folder-structure-rules.md) | Canonical **`workspace/`** layout: `docs/`, `notes/`, `tasks/`, `mindmap/`; how the UI discovers content; markdown and diagram rendering expectations. |
| [markdown-rendering-rules.md](./markdown-rendering-rules.md) | How **Markdown** previews MUST be rendered (GitHub-like typography via scoped **github-markdown-css**, GFM, theme sync, `MarkdownDoc` shell). |
| [Fibonacci-Information-Architecture-Rule.md](./Fibonacci-Information-Architecture-Rule.md) | Fibonacci scaling for hierarchy depth, tasks, and planning; when to use or avoid the pattern. |

## Project paths (this machine)

- Workspace root: `/home/zerwiz/CodeP/Way of`
- Editable file tree for the dashboard: **`/home/zerwiz/CodeP/Way of/workspace`**
- React app: **`/home/zerwiz/CodeP/Way of/ui`**

## Practical notes

- **Documentation** belongs in **`workspace/docs/`** (folder name `docs`, lowercase).
- **Diagram sources** (`.mmd`) belong in **`workspace/mindmap/`** (Mermaid syntax; rendered in the UI).
- **Dev-only APIs** (`/api/data-tree`, `/api/data-content`, `/api/files-mutate`, etc.) are provided by the Vite plugin when you run `npm run dev` from `ui/`. Static hosting without a backend only serves the built UI, not live `workspace/` editing.

## Keeping rules current

When you rename workspace folders or change how the UI loads files, update **folder-structure-rules.md** and any links from **ui/README.md** or planning docs so they stay aligned. When you change Markdown rendering (dependencies, shell classes, or theme scoping), update **markdown-rendering-rules.md**.
