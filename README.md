# Way of — Fibonacci Dashboard

**Canonical repository:** [github.com/zerwiz/wayofdash](https://github.com/zerwiz/wayofdash)

React dashboard for organizing documentation, notes, tasks, and Mermaid diagrams using a **Fibonacci-scaled information architecture** (progressive depth: 1 → 2 → 3 → 5 → 8 …). The UI combines a file tree, GitHub-flavored Markdown previews, mindmaps, tasks, calendar, and an AI chat wired to optional Gemini and local agent definitions.

## Quick start

From the **repository root** (this folder):

```bash
chmod +x start.sh   # once, if needed
./start.sh
```

This installs `ui/` dependencies if missing, starts the Vite dev server, and **opens your browser** to the app (default `http://localhost:5173`). Use `PORT=3000 ./start.sh` for another port.

Or start manually:

```bash
cd ui
npm install
npm run dev -- --open
```

A **placeholder login** stores a session in `localStorage` so refresh keeps you on the dashboard; replace with real auth when ready.

**Live file operations** (`workspace/` tree, create/move/delete, tasks sync) require this dev server: they are implemented by `ui/vite-plugin-data-api.js`. **Static hosting** (e.g. Netlify without functions) serves the UI only—see [`ui/README.md`](ui/README.md#netlify).

## Repository layout

| Path | Purpose |
|------|---------|
| [`workspace/`](workspace/) | **Editable workspace** for the app: `docs/`, `planning/`, `notes/`, `tasks/`, `mindmap/`, etc. The dev API `/api/data-tree` mirrors this tree. |
| [`ui/`](ui/) | Vite + React SPA: runbook in [`ui/README.md`](ui/README.md). |
| [`agents/`](agents/) | Markdown agent files and YAML used by the **AI** tab in dev. |
| [`rules/`](rules/) | Folder structure, Fibonacci IA, and Markdown rendering rules. |
| [`docs/`](docs/) | **Repo** documentation index—not the same as `workspace/docs/` (dashboard content). |

Details: **[`docs/README.md`](docs/README.md)**.

## Conventions

- **Dashboard docs** (what users edit in the sidebar) live under **`workspace/docs/`** and siblings. **`docs/`** at repo root explains the project layout only.
- Naming and structure: **[`rules/folder-structure-rules.md`](rules/folder-structure-rules.md)** · Fibonacci usage: **[`rules/Fibonacci-Information-Architecture-Rule.md`](rules/Fibonacci-Information-Architecture-Rule.md)** · Markdown UI: **[`rules/markdown-rendering-rules.md`](rules/markdown-rendering-rules.md)**.

## Deploy

[`netlify.toml`](netlify.toml) builds from `ui/` and publishes `dist/`. For production file APIs, add serverless backends or another host that runs Node beside the static bundle.

## License

Use the license file or standard you choose for this repository (add a `LICENSE` if you want GitHub to detect it).
