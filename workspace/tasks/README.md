# Tasks (`workspace/tasks/`)

**Purpose:** Workspace files for task tracking. The dashboard **TASKS** tab selects this folder in the sidebar and syncs the Fibonacci board with the JSON below.

**Files:**

- **`task-lists.json`** — canonical store: `{ "lists": [ { "id", "name", "todos": [ … ] } ] }`. In dev (`npm run dev`), edits on the board write this file via `POST /api/tasks-data`; opening the file in the UI shows the same data.

**Setup:** None beyond the Way of UI dev server.
