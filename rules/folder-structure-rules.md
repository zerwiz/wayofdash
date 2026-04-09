# Folder Structure Rules

## Overview

This document defines the organizational structure and usage rules for the project's folder hierarchy. These rules ensure consistent document management, UI rendering, and information architecture.

**See also:** [Rules index](./README.md) · [Fibonacci Information Architecture](./Fibonacci-Information-Architecture-Rule.md)

---

## 0. Canonical workspace: `workspace/`

All editable workspace content for the dashboard (documentation, notes, task data, mindmap/diagram files, etc.) lives **under the `workspace` directory** next to `ui/`, **not** as loose top-level folders beside the app.

**Required base path (this project):**

`/home/zerwiz/CodeP/Way of/workspace`

**Standard subfolders inside `workspace/`:**

| Folder | Role |
|--------|------|
| **`docs/`** | Project documentation (Markdown, GitHub-flavored rendering in the UI) |
| **`planning/`** | UI / product planning notes (e.g. `ui-planning-document.md`); same dev tree as other `workspace/` folders |
| **`notes/`** | Personal / research notes |
| **`tasks/`** | Task list JSON (`task-lists.json`) and related data |
| **`mindmap/`** | `.mmd` diagram sources (Mermaid syntax) |

The Vite dev server builds the sidebar tree from **`workspace/`** only (via `/api/data-tree`). Name the documentation folder **`docs`** (lowercase) so paths match tooling and conventions (e.g. `workspace/docs/README.md`).

### Other top-level folders (beside `workspace/` and `ui/`)

| Path | Role |
|------|------|
| **`agents/`** | Optional markdown agents for the in-app AI chat (loaded through dev APIs; not part of `workspace/`). |
| **`rules/`** | This documentation set (folder layout, Fibonacci IA). |

---

## 1. User Document Folders

The following folders are designated for **user-generated documents** (under **`workspace/`** as above):

### `docs/`
- **Purpose**: Core documentation and official project information
- **Path**: `workspace/docs/` (folder name **`docs`**)
- **Content Type**: Technical documentation, guides, specifications
- **Access**: Read/write for authorized users (same as other `workspace/` content in dev)

### `notes/`
- **Path**: `workspace/notes/`
- **Purpose**: Personal notes, brainstorming, research
- **Content Type**: Unstructured notes, ideas, drafts
- **Access**: Read/write for all users

### `tasks/` (task lists)
- **Path**: `workspace/tasks/` (e.g. `workspace/tasks/task-lists.json`)
- **Purpose**: Task lists, checklists, action items
- **Content Type**: TODOs, FIXMEs, pending tasks
- **Access**: Read/write for project members

---

## 2. UI Display Folders

### `ui/`
- **Purpose**: Contains UI files and views that render project information
- **Content Type**: HTML, CSS, JavaScript, React/Vue components, templates
- **Display Rules**:
  - Renders markdown files from `workspace/docs/`, `workspace/notes/`, and related paths under `workspace/`
  - Displays structured content with proper formatting
  - Provides navigation between document levels
  - Supports filtering and search functionality
  - Implements the Fibonacci Information Architecture Rule for progressive disclosure

---

## 3. Planning notes (`planning/`)

### `planning/`
- **Path**: `workspace/planning/` (e.g. `workspace/planning/ui-planning-document.md`)
- **Purpose**: Long-form UI and product planning; not a separate dashboard mode—open like any other Markdown under `workspace/` in dev.

---

## 4. Mindmap diagrams (`mindmap/`)

### `mindmap/`
- **Path**: `workspace/mindmap/`
- **Purpose**: Contains visualization files (`.mmd`), particularly the project mindmap
- **Key File**: `mindmap-project.mmd` - Full project structure visualization
- **Display Rules**:
  - Rendered by the UI in the main dashboard
  - Shows hierarchical relationships between all documents
  - Supports zoom in/out navigation (Fibonacci levels)
  - Clickable nodes link to actual document files
  - Animated transitions between levels

### Mindmap Requirements:
```mermaid
mindmap
  root((Fibonacci<br/>Project Map))
    docs
    planning
    notes
    tasks
    mindmap
      mindmap-project
```

---

## 5. UI Display Requirements

### File Discovery
- UI must scan and index all markdown files under `workspace/docs/`, `workspace/notes/`, and other `workspace/` subtrees as configured
- UI must detect `.md`, `.mmd`, and other supported file types
- UI must maintain a searchable index of all documents

### Rendering Rules
1. **Markdown (`.md`)**: GitHub-flavored Markdown (GFM) in the main panel: headings, lists, tables, task lists, fenced code; styling via scoped **github-markdown-css** (GitHub-like spacing and typography). See **[markdown-rendering-rules.md](./markdown-rendering-rules.md)**.
2. **Diagrams**: `workspace/mindmap/*.mmd` and optional ` ```mermaid ` fenced blocks inside Markdown use the same Mermaid renderer as standalone `.mmd` files.
3. **Navigation**: Breadcrumbs in the browser view; sidebar tree matches `workspace/` (overlay drawer on narrow screens).
4. **Progressive disclosure**: Align depth and task/plan **levels** with the [Fibonacci rule](./Fibonacci-Information-Architecture-Rule.md) where applicable.

### Navigation Structure
```
Dashboard → [All Documents]
    ├─ docs/ → [Documentation under workspace/docs/]
    ├─ planning/ → [Planning docs under workspace/planning/]
    ├─ notes/ → [Notes under workspace/notes/]
    ├─ tasks/ → [Task data under workspace/tasks/]
    └─ mindmap → [Diagrams / .mmd]

Level 1 → Level 2 → Level 3 → Level 4 → Level 5
```

---

## 6. File Naming Conventions

### Documentation
- `workspace/docs/[topic].md` (e.g., `workspace/docs/api-reference.md`)
- `workspace/docs/[year]-[summary].md`

### Notes
- `workspace/notes/[YYYY-MM-DD]_[description].md`
- `workspace/notes/[tag]-[content].md`

### Tasks (JSON lists)
- `workspace/tasks/task-lists.json` (primary task store in this project)

### UI Files
- `ui/[component].html`
- `ui/[component].css`
- `ui/[component].js`

### Mindmap files
- `workspace/mindmap/[diagram-name].mmd`
- `workspace/mindmap/[view].mmd`

---

## 7. Version Control

Track under version control as appropriate:

- `workspace/docs/` — formal documentation
- `workspace/notes/` — drafts and research
- `workspace/tasks/` — task JSON and related data
- `ui/` — application source
- `workspace/mindmap/` — diagram sources

---

## 8. Security and Access

| Folder (`workspace/…`) | Typical use |
|--------------------|-------------|
| `docs/` | Documentation; editable in dev (APIs under `workspace/`) |
| `notes/` | Notes tree |
| `tasks/` | Task list persistence |
| `mindmap/` | `.mmd` diagram sources |

Fine-grained authentication is out of scope here; the Vite dev server assumes a **trusted local** environment.

---

## 9. Fibonacci Information Architecture

All UI views must implement the Fibonacci Information Architecture Rule:

- **Level 1**: Executive summary (1 node)
- **Level 2**: Primary categories (2 nodes)
- **Level 3**: Functional subdivisions (3 nodes)
- **Level 4**: Implementation details (5 nodes)
- **Level 5**: Deep technical specs (8 nodes)

UI navigation must support:

- Zoom in to deeper Fibonacci levels
- Zoom out to higher levels
- Parent-child navigation links
- Visual indicators of current depth

---

## 10. Document maintenance

- **Last aligned with codebase:** 2026-04-09 (`docs`, `planning/`, `mindmap` folder names, GFM rendering, `workspace/`-only data tree).
- When folder names or API behavior change, update this file and [rules/README.md](./README.md).
