import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import MermaidDiagram from './MermaidDiagram';
import MarkdownDoc from './MarkdownDoc';
import LoginPage from './LoginPage';
import HostMessageModal from './HostMessageModal';
import { useDarkMode } from './useDarkMode';
import {
  LS_NOTIFY_SNOOZE,
  readNotifySnoozes,
  buildOverdueAlerts,
  parseLocalDateTime,
  getPlanDeadline,
  normalizeCalendarEvent,
} from './notificationUtils';
import {
  LayoutDashboard,
  ChevronRight,
  Folder,
  File,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeftOpen,
  Maximize2,
  Minimize2,
  Workflow,
  MessageSquare,
  Send,
  Plus,
  Bot,
  User,
  Save,
  Trash2,
  Sparkles,
  Calendar,
  Share2,
  CheckSquare,
  Circle,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  X,
  RefreshCw,
  ChevronLeft,
  Bell,
  FileText,
  GripVertical,
  FolderInput,
  LogOut,
  Info,
  Pencil,
} from 'lucide-react';

/** Prefer tap-to-move when primary input is touch (HTML5 DnD is unreliable). */
function useCoarsePointer() {
  const [coarse, setCoarse] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const onChange = () => setCoarse(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return coarse;
}

// --- Constants & Config ---
const apiKey = ""; // Environment provides this at runtime
const MODEL_NAME = "gemini-2.5-flash-preview-09-2025";

const SIDEBAR_W_MIN = 200;
const SIDEBAR_W_MAX = 640;
const SIDEBAR_W_DEFAULT = 320;
const LS_SIDEBAR_W = 'way-of-sidebar-w';
const LS_SIDEBAR_OPEN = 'way-of-sidebar-open';
const LS_CHAT_AGENT = 'way-of-chat-agent';
/** Set to `'1'` after placeholder login; cleared on sign out. Real auth can replace this key later. */
const LS_LOGGED_IN = 'way-of-logged-in';

function readStoredLoggedIn() {
  try {
    return localStorage.getItem(LS_LOGGED_IN) === '1';
  } catch {
    return false;
  }
}

const DEFAULT_CHAT_SYSTEM = `You are a project assistant for a Fibonacci-based Information Architecture.
You help users organize information.
If the user wants to create a document, format your response to include a JSON block like:
{ "action": "create_doc", "title": "Title", "content": "Content", "target_folder": "docs|notes|tasks|mindmap" }.
Otherwise, respond naturally. Use the Fibonacci sequence (1, 2, 3, 5, 8) as your structural logic.`;

function readStoredSidebarWidth() {
  try {
    const n = parseInt(localStorage.getItem(LS_SIDEBAR_W) || '', 10);
    if (Number.isFinite(n) && n >= SIDEBAR_W_MIN && n <= SIDEBAR_W_MAX) return n;
  } catch { /* ignore */ }
  return SIDEBAR_W_DEFAULT;
}

function readStoredSidebarOpen() {
  try {
    const v = localStorage.getItem(LS_SIDEBAR_OPEN);
    if (v === '0') return false;
    if (v === '1') return true;
  } catch { /* ignore */ }
  return true;
}

function readStoredChatAgentPath() {
  try {
    const v = localStorage.getItem(LS_CHAT_AGENT);
    return typeof v === 'string' ? v : '';
  } catch { /* ignore */ }
  return '';
}

const LS_CALENDAR_EVENTS = 'way-of-calendar-events';
const LS_TASK_LISTS = 'way-of-task-lists';
/** Fibonacci complexity levels used for milestones (summary → technical spec). */
const FIBONACCI_LEVELS = [1, 2, 3, 5, 8];

const DEFAULT_TASK_LISTS = [
  {
    id: 'list-main',
    name: 'Project Backlog',
    todos: [
      { id: 1, text: 'Establish Level 1 Dashboard', completed: true, level: 1, details: '', dueAt: '' },
      { id: 2, text: 'Define Knowledge Base Pillars', completed: true, level: 2, details: '', dueAt: '' },
      { id: 3, text: 'Draft Architecture Docs', completed: false, level: 3, details: '', dueAt: '' },
      { id: 4, text: 'Implement Fibonacci Logic', completed: false, level: 5, details: '', dueAt: '' },
      { id: 5, text: 'Optimize Performance Metrics', completed: false, level: 8, details: '', dueAt: '' },
    ],
  },
];

function normalizeTodoShape(t) {
  const lv = Number(t.level);
  const rawDetails = t.details ?? t.note;
  const rawDue = t.dueAt;
  return {
    id: t.id ?? `t-${Date.now()}-${Math.random()}`,
    text: String(t.text ?? ''),
    completed: Boolean(t.completed),
    level: Number.isFinite(lv) && lv >= 1 ? Math.min(99, Math.floor(lv)) : 1,
    details: typeof rawDetails === 'string' ? rawDetails : '',
    dueAt: typeof rawDue === 'string' && rawDue.trim() ? rawDue.trim() : '',
  };
}

function cloneDefaultTaskLists() {
  return DEFAULT_TASK_LISTS.map((l) => ({
    ...l,
    todos: l.todos.map((t) => normalizeTodoShape(t)),
  }));
}

/** Normalize API / file payload (same shape as localStorage). */
function normalizeTaskListsFromParsed(lists) {
  if (!Array.isArray(lists)) return [];
  return lists
    .filter((l) => l && typeof l.name === 'string' && Array.isArray(l.todos))
    .map((l) => ({
      id: String(l.id || `list-${Date.now()}-${Math.random()}`),
      name: l.name,
      todos: l.todos.map((t) => normalizeTodoShape(t)),
    }));
}

function readStoredTaskLists() {
  try {
    const raw = localStorage.getItem(LS_TASK_LISTS);
    if (!raw) return cloneDefaultTaskLists();
    const parsed = JSON.parse(raw);
    const lists = Array.isArray(parsed) ? parsed : parsed?.lists;
    if (!Array.isArray(lists) || lists.length === 0) {
      return cloneDefaultTaskLists();
    }
    const normalized = normalizeTaskListsFromParsed(lists);
    if (normalized.length === 0) return cloneDefaultTaskLists();
    return normalized;
  } catch {
    return cloneDefaultTaskLists();
  }
}

function dateKeyFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateKey(key) {
  const [y, m, day] = key.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !day) return new Date();
  return new Date(y, m - 1, day);
}

function readStoredCalendarEvents() {
  try {
    const raw = localStorage.getItem(LS_CALENDAR_EVENTS);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((e) => normalizeCalendarEvent(e));
  } catch {
    return [];
  }
}

/** 42 cells: Monday-first week rows for the month containing (year, month). */
function buildMonthGridCells(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const padMondayFirst = (firstOfMonth.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - padMondayFirst);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTs = today.getTime();
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const dNorm = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    cells.push({
      date: dNorm,
      inMonth: dNorm.getMonth() === month,
      isToday: dNorm.getTime() === todayTs,
    });
  }
  return cells;
}

function countEventsByDateKey(events) {
  const map = new Map();
  for (const e of events) {
    if (!e?.dateKey) continue;
    map.set(e.dateKey, (map.get(e.dateKey) || 0) + 1);
  }
  return map;
}

function sidebarMaxPx() {
  if (typeof window === 'undefined') return SIDEBAR_W_MAX;
  return Math.min(SIDEBAR_W_MAX, Math.max(SIDEBAR_W_MIN, Math.floor(window.innerWidth * 0.5)));
}

/** Full-height drawer width on phones; keeps main content usable. */
function mobileSidebarDrawerWidthPx(sidebarW) {
  if (typeof window === 'undefined') return sidebarW;
  return Math.min(sidebarW, Math.floor(window.innerWidth * 0.92), SIDEBAR_W_MAX);
}

/** Live tree items use `name` / `relPath`; treat `.md` as rendered markdown. */
function isMarkdownFileItem(item) {
  if (!item || item.type !== 'file') return false;
  const name = String(item.name || '').toLowerCase();
  const rel = String(item.relPath || item.id || '').toLowerCase();
  return name.endsWith('.md') || rel.endsWith('.md');
}

const MAIN_NAV_TABS = [
  { id: 'notes', icon: FileText, label: 'NOTES' },
  { id: 'browser', icon: Folder, label: 'DOCS' },
  { id: 'ai-chat', icon: MessageSquare, label: 'AI' },
  { id: 'mindmap', icon: Workflow, label: 'MAP' },
  { id: 'calendar', icon: Calendar, label: 'PLAN' },
  { id: 'todos', icon: CheckSquare, label: 'TASKS' },
];

// --- Initial Mock Data ---
const INITIAL_PROJECT_STRUCTURE = {
  id: 'root',
  name: 'Project Alpha Dashboard',
  level: 1,
  type: 'dashboard',
  summary: 'The centralized source of truth for the Fibonacci-scaled information architecture.',
  children: [
    {
      id: 'knowledge',
      name: 'Knowledge Base',
      level: 2,
      type: 'branch',
      children: [
        {
          id: 'docs',
          name: 'docs',
          level: 3,
          type: 'folder',
          children: [
            { id: 'arch', name: 'System Architecture', type: 'file', content: '# Architecture\nDetailed system overview...', category: 'spec' },
            { id: 'flow', name: 'User Experience Flow', type: 'file', content: '# UX Flow\nVisualizing the path...', category: 'guide' }
          ]
        },
        {
          id: 'notes',
          name: 'Research Notes',
          level: 3,
          type: 'folder',
          children: [
            { id: 'n1', name: 'Market Analysis', type: 'file', content: 'Draft of competitive landscape...' }
          ]
        },
        {
          id: 'tasks',
          name: 'Tasks',
          level: 3,
          type: 'folder',
          children: []
        }
      ]
    },
    {
      id: 'structure',
      name: 'System Structure',
      level: 2,
      type: 'branch',
      children: [
        {
          id: 'mindmap',
          name: 'mindmap',
          level: 3,
          type: 'folder',
          children: [
            { id: 'm1', name: 'Logic Flow', type: 'mermaid', content: 'graph TD\nA-->B; B-->C;' }
          ]
        }
      ]
    }
  ]
};

/** Parent folder rel path for creating a new item next to the current selection. */
function parentRelForNewItem(item) {
  if (!item || item.id === 'root' || item.type === 'dashboard') return '';
  if (item.type === 'folder' || item.type === 'branch') return item.id;
  if (item.type === 'file' || item.type === 'mermaid') {
    const p = item.relPath || item.id;
    const i = p.lastIndexOf('/');
    return i <= 0 ? '' : p.slice(0, i);
  }
  return '';
}

/** Relative path for delete API (under workspace/). */
function filesDeleteRelPath(item) {
  if (!item || item.id === 'root' || item.type === 'dashboard') return '';
  if (item.type === 'folder' || item.type === 'branch') return item.id;
  return item.relPath || item.id;
}

/** Path from root to node (inclusive), or null if not found */
function findPathToNode(node, targetId) {
  if (node.id === targetId) return [node];
  if (!node.children?.length) return null;
  for (const child of node.children) {
    const sub = findPathToNode(child, targetId);
    if (sub) return [node, ...sub];
  }
  return null;
}

/** First descendant (or self) with this id, or null */
function findFirstNodeById(node, targetId) {
  if (node.id === targetId) return node;
  for (const child of node.children ?? []) {
    const found = findFirstNodeById(child, targetId);
    if (found) return found;
  }
  return null;
}

/** Selection is inside the Notes branch (mock tree or live `notes/` paths). */
function isItemUnderNotesFolder(item, treeRoot) {
  if (!item || item.id === treeRoot.id) return false;
  const path = findPathToNode(treeRoot, item.id);
  if (!path) return false;
  if (path.some((n) => n.id === 'notes')) return true;
  const leaf = item.relPath || item.id;
  return typeof leaf === 'string' && (leaf === 'notes' || leaf.startsWith('notes/'));
}

/** Selection is under `workspace/tasks/` (live tree uses id/relPath like `tasks`, `tasks/foo.md`). */
function isItemUnderTasksFolder(item, treeRoot) {
  if (!item || item.id === treeRoot.id) return false;
  const path = findPathToNode(treeRoot, item.id);
  if (!path) return false;
  if (path.some((n) => n.id === 'tasks')) return true;
  const leaf = item.relPath || item.id;
  return typeof leaf === 'string' && (leaf === 'tasks' || leaf.startsWith('tasks/'));
}

/** Canonical file that backs the task board (`{ "lists": [...] }`). */
function isTaskListsJsonItem(item) {
  if (!item || item.type !== 'file') return false;
  const r = String(item.relPath || item.id || '')
    .replace(/\\/g, '/')
    .toLowerCase();
  return r === 'tasks/task-lists.json' || r.endsWith('/task-lists.json');
}

function nextDocsViewForSelection(item, treeRoot) {
  if (!item || item.id === treeRoot.id) return 'root';
  if (isItemUnderNotesFolder(item, treeRoot)) return 'notes';
  return 'root';
}

function patchNodeById(root, id, updates) {
  if (root.id === id) return { ...root, ...updates };
  if (!root.children?.length) return root;
  return { ...root, children: root.children.map((c) => patchNodeById(c, id, updates)) };
}

function MermaidPanel({ title, definition, isDark }) {
  const [showSource, setShowSource] = useState(false);
  const loading = definition === undefined;

  return (
    <div className="col-span-full space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm animate-in dark:border-slate-700 dark:bg-slate-900 sm:space-y-6 sm:rounded-3xl sm:p-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-black uppercase tracking-tight dark:text-slate-100">{title}</h2>
        <button
          type="button"
          onClick={() => setShowSource((v) => !v)}
          className="self-start rounded-xl border-2 border-indigo-200 px-4 py-2 text-xs font-black uppercase tracking-widest text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-800 dark:border-indigo-500/40 dark:text-indigo-400 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300 sm:self-auto"
        >
          {showSource ? 'Hide source' : 'Show source'}
        </button>
      </div>
      {loading ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm font-medium text-slate-400 dark:border-slate-600 dark:text-slate-500">
          Loading diagram…
        </div>
      ) : (
        <>
          <MermaidDiagram definition={definition} isDark={isDark} />
          {showSource ? (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Mermaid source</p>
              <div className="overflow-x-auto whitespace-pre-wrap rounded-2xl border border-slate-100 bg-slate-50 p-6 font-mono text-sm leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                {definition}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

// --- API Helper ---
const callGemini = async (messages, systemInstructionOverride = null) => {
  if (!apiKey.trim()) {
    return 'Add a Gemini API key in `App.jsx` (`apiKey`) to enable live AI. You can still browse docs, mindmap, tasks, and calendar.';
  }

  const userPrompt = messages[messages.length - 1].content;
  const systemPrompt =
    typeof systemInstructionOverride === 'string' && systemInstructionOverride.trim()
      ? systemInstructionOverride.trim()
      : DEFAULT_CHAT_SYSTEM;

  const payload = {
    contents: [{ parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] }
  };

  const fetchWithRetry = async (retries = 2, delay = 800) => {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );
      if (!response.ok) throw new Error("API Error");
      return await response.json();
    } catch (err) {
      if (retries > 0) {
        await new Promise(r => setTimeout(r, delay));
        return fetchWithRetry(retries - 1, delay * 2);
      }
      throw err;
    }
  };

  try {
    const result = await fetchWithRetry();
    return result.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't process that.";
  } catch {
    return "AI service unavailable. Check your API key and network, then try again.";
  }
};

// --- Helper Components ---

const SidebarItem = ({
  item,
  depth = 0,
  onSelect,
  activeId,
  liveFiles,
  onDeleteItem,
  onRenameItem,
  mutateBusy,
  onMoveDrop,
  pendingMoveFrom,
  onStartTapMove,
  onCompletePendingMove,
  showMoveTapTarget,
}) => {
  const [isOpen, setIsOpen] = useState(depth === 0 && Boolean(item.children?.length));
  const [dropOver, setDropOver] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(item.name);
  const renameInputRef = useRef(null);

  useEffect(() => {
    setRenameValue(item.name);
  }, [item.name, item.id]);

  useEffect(() => {
    if (!isRenaming) return;
    const t = window.requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(t);
  }, [isRenaming]);
  const isSelected = activeId === item.id;
  const isRepoDoc = Boolean(item.repoDocs);
  const canDelete =
    Boolean(
      liveFiles && onDeleteItem && !isRepoDoc && item.id !== 'root' && item.type !== 'dashboard'
    );
  const canDrag = Boolean(
    liveFiles && onMoveDrop && !isRepoDoc && item.id !== 'root' && item.type !== 'dashboard'
  );
  const isDropZone = Boolean(
    liveFiles &&
      onMoveDrop &&
      !isRepoDoc &&
      (item.type === 'dashboard' || item.type === 'folder' || item.type === 'branch')
  );
  const sourceRel = filesDeleteRelPath(item);
  const tapMoveActive = Boolean(pendingMoveFrom);
  const isTapMoveTarget = Boolean(
    tapMoveActive && isDropZone && pendingMoveFrom && filesDeleteRelPath(item) !== pendingMoveFrom
  );
  const canRename = Boolean(
    liveFiles &&
      onRenameItem &&
      !isRepoDoc &&
      !tapMoveActive &&
      !mutateBusy &&
      !isRenaming &&
      item.id !== 'root' &&
      item.type !== 'dashboard'
  );

  const onDragStartHandle = (e) => {
    if (!canDrag || !sourceRel) {
      e.preventDefault();
      return;
    }
    e.stopPropagation();
    e.dataTransfer.setData('application/x-way-of-files', sourceRel);
    e.dataTransfer.setData('text/plain', sourceRel);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOverRow = (e) => {
    if (!isDropZone) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDragEnterRow = (e) => {
    if (!isDropZone) return;
    e.preventDefault();
    setDropOver(true);
  };

  const onDragLeaveRow = (e) => {
    if (!isDropZone) return;
    const next = e.relatedTarget;
    if (!(next instanceof Node) || !e.currentTarget.contains(next)) {
      setDropOver(false);
    }
  };

  const onDropRow = (e) => {
    if (!isDropZone || !onMoveDrop) return;
    e.preventDefault();
    e.stopPropagation();
    setDropOver(false);
    const from =
      e.dataTransfer.getData('application/x-way-of-files') ||
      e.dataTransfer.getData('text/plain');
    if (!from) return;
    const toParentRel = item.type === 'dashboard' ? '' : item.id;
    void onMoveDrop(from, toParentRel);
  };

  const targetParentRel = item.type === 'dashboard' ? '' : item.id;

  const rowMainClick = () => {
    if (pendingMoveFrom) {
      if (isDropZone) {
        onCompletePendingMove?.(targetParentRel);
        return;
      }
      return;
    }
    setIsOpen(!isOpen);
    onSelect(item);
  };

  return (
    <div className="select-none">
      <div
        onDragOver={isDropZone ? onDragOverRow : undefined}
        onDragEnter={isDropZone ? onDragEnterRow : undefined}
        onDragLeave={isDropZone ? onDragLeaveRow : undefined}
        onDrop={isDropZone ? onDropRow : undefined}
        className={`group flex cursor-pointer items-center gap-1 rounded-md py-2 pl-2 pr-3 transition-colors ${
          dropOver
            ? 'bg-indigo-100 ring-2 ring-indigo-400 dark:bg-indigo-950/50 dark:ring-indigo-500'
            : isTapMoveTarget
              ? 'bg-amber-50 ring-2 ring-amber-400/80 dark:bg-amber-950/40 dark:ring-amber-500/60'
              : isSelected
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/80'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <button
          type="button"
          draggable={false}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen((o) => !o);
          }}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
            isSelected
              ? 'text-white hover:bg-white/15'
              : 'text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700'
          }`}
          title={item.children?.length ? (isOpen ? 'Collapse' : 'Expand') : undefined}
          aria-expanded={item.children?.length ? isOpen : undefined}
        >
          {item.children?.length ? (
            <ChevronRight
              size={14}
              className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}
            />
          ) : (
            <span className="inline-block w-[14px]" />
          )}
        </button>
        {isRenaming ? (
          <div
            className="flex min-w-0 flex-1 items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {item.type === 'folder' || item.type === 'branch' ? (
              <Folder size={16} className="shrink-0" />
            ) : (
              <File size={16} className="shrink-0" />
            )}
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => {
                void (async () => {
                  const next = renameValue.trim();
                  if (!next || next === item.name) {
                    setIsRenaming(false);
                    setRenameValue(item.name);
                    return;
                  }
                  await onRenameItem?.(item, next);
                  setIsRenaming(false);
                })();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setRenameValue(item.name);
                  setIsRenaming(false);
                }
              }}
              className={`min-w-0 flex-1 rounded-md border border-indigo-400 bg-white px-1.5 py-0.5 text-sm font-medium text-slate-900 outline-none ring-1 ring-indigo-400/30 focus:ring-2 dark:bg-slate-950 dark:text-slate-100 ${
                isSelected ? 'border-white ring-white/40' : ''
              }`}
              aria-label={`Rename ${item.name}`}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={rowMainClick}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            {item.type === 'folder' || item.type === 'branch' ? (
              <Folder size={16} className="shrink-0" />
            ) : (
              <File size={16} className="shrink-0" />
            )}
            <span className="min-w-0 flex-1 text-sm font-medium truncate">{item.name}</span>
          </button>
        )}
        {canDrag && sourceRel && !isRenaming ? (
          <span
            draggable
            onDragStart={onDragStartHandle}
            onClick={(e) => e.stopPropagation()}
            className={`touch-none shrink-0 cursor-grab rounded p-1 active:cursor-grabbing ${
              isSelected
                ? 'text-indigo-100 hover:bg-white/20 hover:text-white'
                : 'text-slate-400 hover:bg-slate-200 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200'
            }`}
            title="Drag into another folder"
            aria-label={`Drag to move ${item.name}`}
          >
            <GripVertical size={14} />
          </span>
        ) : null}
        {showMoveTapTarget && canDrag && sourceRel && !isRenaming ? (
          <button
            type="button"
            draggable={false}
            onClick={(e) => {
              e.stopPropagation();
              onStartTapMove?.(sourceRel);
            }}
            className={`shrink-0 rounded p-1 ${
              isSelected
                ? 'text-indigo-100 hover:bg-white/20 hover:text-white'
                : 'text-slate-400 hover:bg-slate-200 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200'
            }`}
            title="Choose destination folder (touch)"
            aria-label={`Move ${item.name}`}
          >
            <FolderInput size={14} />
          </button>
        ) : null}
        {canRename ? (
          <button
            type="button"
            draggable={false}
            onClick={(e) => {
              e.stopPropagation();
              setRenameValue(item.name);
              setIsRenaming(true);
            }}
            className={`shrink-0 rounded p-1 ${
              isSelected
                ? 'text-indigo-100 hover:bg-white/20 hover:text-white'
                : 'text-slate-400 hover:bg-slate-200 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200'
            }`}
            title="Rename"
            aria-label={`Rename ${item.name}`}
          >
            <Pencil size={14} />
          </button>
        ) : null}
        {canDelete && !isRenaming ? (
          <button
            type="button"
            draggable={false}
            onClick={(e) => {
              e.stopPropagation();
              onDeleteItem(item);
            }}
            className={`shrink-0 rounded p-1 ${
              isSelected
                ? 'text-indigo-100 hover:bg-white/20 hover:text-white'
                : 'text-slate-400 hover:bg-slate-200 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200'
            }`}
            title="Delete"
            aria-label={`Delete ${item.name}`}
          >
            <Trash2 size={14} />
          </button>
        ) : null}
      </div>
      {isOpen && item.children?.length ? (
        <div className="mt-1">
          {item.children.map((child) => (
            <SidebarItem
              key={child.id}
              item={child}
              depth={depth + 1}
              onSelect={onSelect}
              activeId={activeId}
              liveFiles={liveFiles}
              onDeleteItem={onDeleteItem}
              onRenameItem={onRenameItem}
              mutateBusy={mutateBusy}
              onMoveDrop={onMoveDrop}
              pendingMoveFrom={pendingMoveFrom}
              onStartTapMove={onStartTapMove}
              onCompletePendingMove={onCompletePendingMove}
              showMoveTapTarget={showMoveTapTarget}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

/** Lines like `workspace/mindmap/file.mmd` for the whole project tree (mindmap export). */
function mindmapExportLines(node, prefix = '') {
  const seg = node.name ?? String(node.id);
  const path = prefix ? `${prefix}/${seg}` : seg;
  const lines = [path];
  for (const c of node.children ?? []) {
    lines.push(...mindmapExportLines(c, path));
  }
  return lines;
}

const MindmapTreeNode = ({ node, onSelectNode, depth = 0 }) => {
  const children = node.children ?? [];
  const hasChildren = children.length > 0;
  const isDashboard = node.type === 'dashboard';
  const isLeaf = !hasChildren;
  const isFolderish =
    isDashboard ||
    node.type === 'folder' ||
    node.type === 'branch' ||
    (hasChildren && node.type !== 'file' && node.type !== 'mermaid');

  const cardBase =
    'rounded-xl shadow-md flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-transform hover:scale-[1.02] hover:shadow-lg text-center break-words outline-none focus-visible:ring-2 focus-visible:ring-indigo-400';

  let cardClass = `${cardBase} `;
  if (isDashboard) {
    cardClass +=
      'bg-indigo-600 text-white border-2 border-indigo-800 min-w-[8rem] max-w-[16rem] px-3 py-3 font-bold text-sm';
  } else if (isFolderish) {
    cardClass +=
      'min-w-[6rem] max-w-[14rem] border-2 border-indigo-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-900 hover:border-indigo-500 sm:text-sm dark:border-indigo-500/40 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-indigo-400';
  } else {
    cardClass +=
      'min-w-[5rem] max-w-[12rem] border border-slate-300 bg-slate-100 px-2 py-2 text-[11px] font-semibold text-slate-800 hover:border-indigo-400 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-indigo-500';
  }

  const Icon = isLeaf && !isDashboard ? File : Folder;
  const iconSize = depth === 0 ? 20 : depth === 1 ? 17 : 14;

  return (
    <div className="flex flex-col items-center">
      <button type="button" onClick={() => onSelectNode(node)} className={cardClass}>
        <Icon
          size={iconSize}
          strokeWidth={2}
          className={
            isDashboard
              ? 'shrink-0 text-indigo-100'
              : isFolderish
                ? 'shrink-0 text-indigo-500 dark:text-indigo-400'
                : 'shrink-0 text-slate-500 dark:text-slate-400'
          }
        />
        <span className="leading-snug">{node.name}</span>
      </button>
      {hasChildren ? (
        <div className="mt-4 flex w-full flex-col items-center border-t-2 border-dashed border-slate-200 pt-6 dark:border-slate-600">
          <div className="flex max-w-[95vw] flex-row flex-wrap items-start justify-center gap-x-6 gap-y-10 px-1">
            {children.map((child) => (
              <MindmapTreeNode key={child.id} node={child} onSelectNode={onSelectNode} depth={depth + 1} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const MindmapView = ({ data, onSelectNode, onExport }) => {
  const childCount = data?.children?.length ?? 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-slate-900">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-950 sm:px-6 sm:py-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Project Topology Map</p>
          <p className="truncate text-xs font-medium text-slate-600 dark:text-slate-300">
            Mirrors folders and files from{' '}
            <span className="font-bold text-slate-800 dark:text-slate-100">{data?.name ?? 'workspace'}</span>
            {childCount ? ` · ${childCount} top-level ${childCount === 1 ? 'item' : 'items'}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onExport}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 dark:border-indigo-500/40 dark:bg-slate-800 dark:text-indigo-400 dark:hover:bg-indigo-950/50"
          title="Copy full path list to clipboard"
        >
          <Share2 size={14} /> Export
        </button>
      </div>
          <div className="min-h-0 flex-1 overflow-auto bg-slate-50 dark:bg-slate-900">
        {!childCount ? (
          <div className="flex h-full min-h-[12rem] items-center justify-center p-4 text-center text-sm font-medium text-slate-500 dark:text-slate-400 sm:p-8">
            No folders or files yet. Add directories under{' '}
            <code className="mx-1 rounded bg-slate-200 px-1.5 py-0.5 text-slate-800 dark:bg-slate-700 dark:text-slate-200">workspace/</code>{' '}
            (dev server maps them here).
          </div>
        ) : (
          <div className="flex min-h-full justify-center px-2 py-6 pb-16 sm:px-4 sm:py-10 sm:pb-20">
            <MindmapTreeNode node={data} onSelectNode={onSelectNode} depth={0} />
          </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() =>
    typeof window !== 'undefined' ? readStoredLoggedIn() : false
  );

  const completeLogin = useCallback(() => {
    try {
      localStorage.setItem(LS_LOGGED_IN, '1');
    } catch {
      /* ignore */
    }
    setIsLoggedIn(true);
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(LS_LOGGED_IN);
    } catch {
      /* ignore */
    }
    setIsLoggedIn(false);
  }, []);

  // Navigation State
  const [view, setView] = useState('browser'); // 'browser', 'ai-chat', 'mindmap', 'calendar', 'todos'
  /** When view is browser: root file tree vs jump to `notes` folder */
  const [docsView, setDocsView] = useState('root');
  const [projectData, setProjectData] = useState(INITIAL_PROJECT_STRUCTURE);
  const [activeItem, setActiveItem] = useState(INITIAL_PROJECT_STRUCTURE);
  const [navPath, setNavPath] = useState([INITIAL_PROJECT_STRUCTURE]);

  const activeItemRef = useRef(activeItem);
  useEffect(() => {
    activeItemRef.current = activeItem;
  }, [activeItem]);

  const [filesCreateKind, setFilesCreateKind] = useState(null);
  const [filesCreateName, setFilesCreateName] = useState('');
  const [filesMutateBusy, setFilesMutateBusy] = useState(false);
  const [showFilesMoveHelp, setShowFilesMoveHelp] = useState(false);
  /** `api` when `/api/data-tree` works (e.g. `npm run dev`); otherwise demo tree without mutations. */
  const [filesTreeSource, setFilesTreeSource] = useState('loading');
  const [pendingMoveFrom, setPendingMoveFrom] = useState(null);
  const pendingMoveFromRef = useRef(null);
  useEffect(() => {
    pendingMoveFromRef.current = pendingMoveFrom;
  }, [pendingMoveFrom]);
  const coarsePointer = useCoarsePointer();

  const refreshFilesTree = useCallback(async (opts) => {
    try {
      const r = await fetch('/api/data-tree');
      if (!r.ok) return;
      const tree = await r.json();
      if (!tree?.id) return;
      setProjectData(tree);
      const prefer = opts?.preferSelectionId;
      const id = prefer ?? activeItemRef.current.id;
      let pathArr = findPathToNode(tree, id);
      if (!pathArr && prefer) {
        pathArr = findPathToNode(tree, prefer);
      }
      const nextItem = pathArr ? pathArr[pathArr.length - 1] : tree;
      setActiveItem(nextItem);
      setNavPath(pathArr || [tree]);
      setDocsView(nextDocsViewForSelection(nextItem, tree));
    } catch {
      /* ignore */
    }
  }, []);

  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(() => readStoredSidebarOpen());
  const [sidebarWidth, setSidebarWidth] = useState(() => readStoredSidebarWidth());
  const [sidebarResizing, setSidebarResizing] = useState(false);
  const sidebarDragRef = useRef(false);
  const sidebarWidthWhileDragRef = useRef(readStoredSidebarWidth());
  const [viewMode, setViewMode] = useState('standard');
  const [isNarrowViewport, setIsNarrowViewport] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false
  );

  const persistSidebarOpen = (open) => {
    setSidebarOpen(open);
    try {
      localStorage.setItem(LS_SIDEBAR_OPEN, open ? '1' : '0');
    } catch { /* ignore */ }
  };

  const toggleSidebar = () => persistSidebarOpen(!sidebarOpen);

  const collapseSidebarOnMobile = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      persistSidebarOpen(false);
    }
  };

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = () => setIsNarrowViewport(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!isNarrowViewport || !sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isNarrowViewport, sidebarOpen]);

  useEffect(() => {
    sidebarWidthWhileDragRef.current = sidebarWidth;
  }, [sidebarWidth]);

  useEffect(() => {
    const onMove = (e) => {
      if (!sidebarDragRef.current) return;
      const cap = sidebarMaxPx();
      const next = Math.min(cap, Math.max(SIDEBAR_W_MIN, e.clientX));
      sidebarWidthWhileDragRef.current = next;
      setSidebarWidth(next);
    };
    const onUp = () => {
      if (!sidebarDragRef.current) return;
      sidebarDragRef.current = false;
      setSidebarResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try {
        localStorage.setItem(LS_SIDEBAR_W, String(sidebarWidthWhileDragRef.current));
      } catch { /* ignore */ }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('blur', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('blur', onUp);
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      const cap = sidebarMaxPx();
      setSidebarWidth((w) => Math.min(cap, Math.max(SIDEBAR_W_MIN, w)));
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Chat State
  const [chats, setChats] = useState([
    { id: '1', title: 'Welcome Chat', messages: [{ role: 'assistant', content: 'Hello! I can help you organize your project using Fibonacci principles. Would you like to create a new research note?' }] }
  ]);
  const [activeChatId, setActiveChatId] = useState('1');
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  const [agentsList, setAgentsList] = useState([]);
  const [agentsLoadError, setAgentsLoadError] = useState(null);
  const [selectedAgentPath, setSelectedAgentPath] = useState(readStoredChatAgentPath);
  const [newAgentOpen, setNewAgentOpen] = useState(false);
  const [newAgentSlug, setNewAgentSlug] = useState('');
  const [newAgentDisplayName, setNewAgentDisplayName] = useState('');
  const [newAgentDescription, setNewAgentDescription] = useState('');
  const [newAgentInstructions, setNewAgentInstructions] = useState('');
  const [newAgentFolder, setNewAgentFolder] = useState('');
  const [newAgentSaving, setNewAgentSaving] = useState(false);
  const [newAgentError, setNewAgentError] = useState(null);

  // Task lists (multiple boards; overview + per-list detail)
  const [taskLists, setTaskLists] = useState(readStoredTaskLists);
  const [activeTaskListId, setActiveTaskListId] = useState(null);
  const [newTodo, setNewTodo] = useState('');
  const [newTodoLevel, setNewTodoLevel] = useState(1);
  const [taskDetailTodoId, setTaskDetailTodoId] = useState(null);
  const [newTaskListName, setNewTaskListName] = useState('');
  /** After first `/api/tasks-data` fetch attempt (avoid overwriting server with stale POST). */
  const [tasksRemoteReady, setTasksRemoteReady] = useState(false);

  const [calMonth, setCalMonth] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });
  const [calSelectedKey, setCalSelectedKey] = useState(() => dateKeyFromDate(new Date()));
  const [calEvents, setCalEvents] = useState(readStoredCalendarEvents);
  const [calFormTitle, setCalFormTitle] = useState('');
  const [calFormLevel, setCalFormLevel] = useState(3);
  const [calFormNote, setCalFormNote] = useState('');
  const [calFormDueTime, setCalFormDueTime] = useState('');

  const [notifySnoozes, setNotifySnoozes] = useState(readNotifySnoozes);
  const [notifyPanelOpen, setNotifyPanelOpen] = useState(false);
  const [notifyTick, setNotifyTick] = useState(0);
  const browserNotifyShownRef = useRef(new Set());

  const activeChat = chats.find(c => c.id === activeChatId) || chats[0];
  const { dark, toggle: toggleDark } = useDarkMode();

  const [hostDialog, setHostDialog] = useState(null);

  const openConfirm = useCallback((message, title) => {
    return new Promise((resolve) => {
      setHostDialog({
        variant: 'confirm',
        title: title ?? (typeof window !== 'undefined' ? window.location.host : 'Confirm'),
        message,
        resolve,
      });
    });
  }, []);

  const openAlert = useCallback((message, title) => {
    return new Promise((resolve) => {
      setHostDialog({
        variant: 'alert',
        title: title ?? (typeof window !== 'undefined' ? window.location.host : 'Notice'),
        message,
        resolve,
      });
    });
  }, []);

  const closeHostDialog = useCallback((value) => {
    setHostDialog((current) => {
      if (current?.resolve) {
        try {
          current.resolve(value);
        } catch {
          /* ignore */
        }
      }
      return null;
    });
  }, []);

  const handleDeleteFileTreeItem = useCallback(
    async (item) => {
      if (!projectData.liveFiles || item.repoDocs) return;
      const rel = filesDeleteRelPath(item);
      if (!rel) return;
      const label = item.name || rel;
      const ok = await openConfirm(`Delete "${label}"? This cannot be undone.`);
      if (!ok) return;
      setFilesMutateBusy(true);
      try {
        const r = await fetch('/api/files-mutate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', path: rel }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          await openAlert(j.error || r.statusText || 'Delete failed');
          return;
        }
        await refreshFilesTree();
      } finally {
        setFilesMutateBusy(false);
      }
    },
    [projectData.liveFiles, refreshFilesTree, openConfirm, openAlert]
  );

  const handleRenameFileTreeItem = useCallback(
    async (item, newName) => {
      if (!projectData.liveFiles || item.repoDocs) return;
      const fromRel = filesDeleteRelPath(item);
      if (!fromRel) return;
      const seg = String(newName ?? '').trim();
      if (!seg || seg === item.name) return;
      const slash = fromRel.lastIndexOf('/');
      const parentRel = slash <= 0 ? '' : fromRel.slice(0, slash);
      const newRel = parentRel ? `${parentRel}/${seg}` : seg;
      setFilesMutateBusy(true);
      try {
        const r = await fetch('/api/files-mutate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'rename', from: fromRel, newName: seg }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          await openAlert(j.error || r.statusText || 'Rename failed');
          return;
        }
        await refreshFilesTree({ preferSelectionId: newRel });
      } finally {
        setFilesMutateBusy(false);
      }
    },
    [projectData.liveFiles, refreshFilesTree, openAlert]
  );

  const handleFileTreeMove = useCallback(
    async (fromRel, toParentRel) => {
      if (!projectData.liveFiles) return;
      const from = String(fromRel || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
      const toP = String(toParentRel ?? '')
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\/+|\/+$/g, '');
      if (!from) return;
      if (toP === from || toP.startsWith(`${from}/`)) {
        await openAlert('Cannot move a folder into itself or its subfolders.');
        return;
      }
      const i = from.lastIndexOf('/');
      const base = i < 0 ? from : from.slice(i + 1);
      const dest = toP ? `${toP}/${base}` : base;
      if (dest === from) return;
      try {
        const r = await fetch('/api/files-mutate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'move', from, toParent: toP }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          await openAlert(j.error || r.statusText || 'Move failed');
          return;
        }
        await refreshFilesTree();
      } catch {
        await openAlert('Move failed');
      }
    },
    [projectData.liveFiles, refreshFilesTree, openAlert]
  );

  const completePendingTreeMove = useCallback(
    (toParentRel) => {
      const from = pendingMoveFromRef.current;
      if (!from) return;
      setPendingMoveFrom(null);
      void handleFileTreeMove(from, toParentRel);
    },
    [handleFileTreeMove]
  );

  const submitFilesCreate = useCallback(
    async (e) => {
      e.preventDefault();
      if (!filesCreateKind || !projectData.liveFiles) return;
      const name = filesCreateName.trim();
      if (!name) return;
      const parentRel = parentRelForNewItem(activeItemRef.current);
      const action = filesCreateKind === 'folder' ? 'mkdir' : 'writeFile';
      setFilesMutateBusy(true);
      try {
        const r = await fetch('/api/files-mutate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, parentRel, name }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          await openAlert(j.error || r.statusText || 'Create failed');
          return;
        }
        setFilesCreateKind(null);
        setFilesCreateName('');
        await refreshFilesTree();
      } finally {
        setFilesMutateBusy(false);
      }
    },
    [filesCreateKind, filesCreateName, projectData.liveFiles, refreshFilesTree, openAlert]
  );

  const refreshAgentsList = useCallback(() => {
    return fetch('/api/agents-list')
      .then((r) => {
        if (!r.ok) throw new Error('agents-list failed');
        return r.json();
      })
      .then((d) => {
        setAgentsList(Array.isArray(d.agents) ? d.agents : []);
        setAgentsLoadError(null);
      })
      .catch(() => {
        setAgentsList([]);
        setAgentsLoadError('Agent files load when you run the dev server (`npm run dev` in `ui/`).');
      });
  }, []);

  useEffect(() => {
    void refreshAgentsList();
  }, [refreshAgentsList]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_CHAT_AGENT, selectedAgentPath);
    } catch { /* ignore */ }
  }, [selectedAgentPath]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_CALENDAR_EVENTS, JSON.stringify(calEvents));
    } catch { /* ignore */ }
  }, [calEvents]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_NOTIFY_SNOOZE, JSON.stringify(notifySnoozes));
    } catch { /* ignore */ }
  }, [notifySnoozes]);

  const overdueAlerts = useMemo(() => {
    return buildOverdueAlerts(taskLists, calEvents, new Date(), notifySnoozes);
  }, [taskLists, calEvents, notifySnoozes, notifyTick]);

  useEffect(() => {
    const tick = () => setNotifyTick((n) => n + 1);
    const id = window.setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const activeKeys = new Set(overdueAlerts.map((a) => a.key));
    for (const k of [...browserNotifyShownRef.current]) {
      if (!activeKeys.has(k)) browserNotifyShownRef.current.delete(k);
    }
    for (const a of overdueAlerts) {
      if (browserNotifyShownRef.current.has(a.key)) continue;
      browserNotifyShownRef.current.add(a.key);
      try {
        new Notification(a.kind === 'plan' ? 'Plan milestone overdue' : 'Task overdue', {
          body: a.title,
          tag: a.key,
        });
      } catch { /* ignore */ }
    }
  }, [overdueAlerts]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_TASK_LISTS, JSON.stringify(taskLists));
    } catch { /* ignore */ }
  }, [taskLists]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/tasks-data')
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (cancelled || !data || !Array.isArray(data.lists)) return;
        setTaskLists(normalizeTaskListsFromParsed(data.lists));
      })
      .catch(() => {
        /* no dev server or no file yet */
      })
      .finally(() => {
        if (!cancelled) setTasksRemoteReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!tasksRemoteReady) return;
    const t = window.setTimeout(() => {
      void fetch('/api/tasks-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lists: taskLists }),
      }).catch(() => {
        /* preview / no API */
      });
    }, 450);
    return () => window.clearTimeout(t);
  }, [taskLists, tasksRemoteReady]);

  useEffect(() => {
    if (activeTaskListId && !taskLists.some((l) => l.id === activeTaskListId)) {
      setActiveTaskListId(null);
    }
  }, [taskLists, activeTaskListId]);

  useEffect(() => {
    setTaskDetailTodoId(null);
  }, [activeTaskListId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages, isTyping]);

  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    fetch('/api/data-tree')
      .then((r) => {
        if (!r.ok) throw new Error('no-api');
        return r.json();
      })
      .then((tree) => {
        if (cancelled || !tree?.id) return;
        setFilesTreeSource('api');
        setProjectData(tree);
        setActiveItem(tree);
        setNavPath([tree]);
        setDocsView('root');
      })
      .catch(() => {
        if (!cancelled) setFilesTreeSource('mock');
        /* keep INITIAL_PROJECT_STRUCTURE when not running Vite dev or API missing */
      });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const item = activeItem;
    if (!item?.relPath) return;
    if (item.type !== 'file' && item.type !== 'mermaid') return;
    if (isTaskListsJsonItem(item)) return;
    if (item.content !== undefined) return;

    const ac = new AbortController();
    fetch(`/api/data-content?path=${encodeURIComponent(item.relPath)}`, { signal: ac.signal })
      .then((r) => {
        if (!r.ok) throw new Error('load-failed');
        return r.json();
      })
      .then(({ content }) => {
        const text = content ?? '';
        setProjectData((prev) => patchNodeById(prev, item.id, { content: text }));
        setActiveItem((prev) => (prev.id === item.id ? { ...prev, content: text } : prev));
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        const err = 'Could not load file (is the dev server running?).';
        setProjectData((prev) => patchNodeById(prev, item.id, { content: err }));
        setActiveItem((prev) => (prev.id === item.id ? { ...prev, content: err } : prev));
      });

    return () => ac.abort();
  }, [isLoggedIn, activeItem?.id, activeItem?.relPath, activeItem?.type, activeItem?.content]);

  /** Keep tree node content for `task-lists.json` aligned with board state (docs-style open in sidebar). */
  useEffect(() => {
    if (!isLoggedIn || !projectData.liveFiles) return;
    const fileId = 'tasks/task-lists.json';
    const text = `${JSON.stringify({ lists: taskLists }, null, 2)}\n`;
    setProjectData((prev) => patchNodeById(prev, fileId, { content: text }));
    setActiveItem((prev) => (prev.id === fileId ? { ...prev, content: text } : prev));
  }, [taskLists, isLoggedIn, projectData.liveFiles]);

  // Handlers
  const handleSaveDoc = (doc) => {
    const newData = JSON.parse(JSON.stringify(projectData));
    const targetFolderId = doc.target_folder || 'notes';

    const addToFileTree = (nodes) => {
      for (let node of nodes) {
        if (node.id === targetFolderId) {
          node.children.push({
            id: `doc-${Date.now()}`,
            name: doc.title || 'New Document',
            type: targetFolderId === 'mindmap' ? 'mermaid' : 'file',
            content: doc.content || '',
            level: 4
          });
          return true;
        }
        if (node.children && addToFileTree(node.children)) return true;
      }
      return false;
    };

    addToFileTree([newData]);
    setProjectData(newData);
    setView('browser');
    setDocsView('root');
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const newMessage = { role: 'user', content: chatInput };
    const updatedMessages = [...activeChat.messages, newMessage];
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: updatedMessages } : c));
    setChatInput('');
    setIsTyping(true);

    try {
      let systemOverride = null;
      if (selectedAgentPath.trim()) {
        const ar = await fetch(`/api/agents-content?path=${encodeURIComponent(selectedAgentPath)}`);
        if (ar.ok) {
          const j = await ar.json();
          systemOverride = j.content ?? null;
        }
      }
      const response = await callGemini(updatedMessages, systemOverride);
      let parsedDoc = null;
      try {
        const jsonMatch = response.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          const possibleDoc = JSON.parse(jsonMatch[0]);
          if (possibleDoc.action === 'create_doc') parsedDoc = possibleDoc;
        }
      } catch (e) {}

      setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...updatedMessages, { role: 'assistant', content: response, doc: parsedDoc }] } : c));
    } catch (err) {
      setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...updatedMessages, { role: 'assistant', content: "Error: AI engine unreachable." }] } : c));
    } finally {
      setIsTyping(false);
    }
  };

  const handleSelect = (item) => {
    setActiveItem(item);
    const newPath =
      item.id === projectData.id
        ? [projectData]
        : findPathToNode(projectData, item.id) || [projectData];
    setNavPath(newPath);

    if (isItemUnderTasksFolder(item, projectData)) {
      setView('todos');
      if (item.type === 'folder') {
        setActiveTaskListId(null);
      } else if (isTaskListsJsonItem(item)) {
        setActiveTaskListId(null);
      }
      collapseSidebarOnMobile();
      return;
    }

    if (isItemUnderNotesFolder(item, projectData)) {
      setView('browser');
      setDocsView('notes');
      collapseSidebarOnMobile();
      return;
    }

    setView('browser');
    setDocsView(nextDocsViewForSelection(item, projectData));
    collapseSidebarOnMobile();
  };

  const activeTaskList = taskLists.find((l) => l.id === activeTaskListId);
  const todos = activeTaskList?.todos ?? [];

  const updateListTodos = (listId, updater) => {
    setTaskLists((prev) =>
      prev.map((l) =>
        l.id === listId
          ? { ...l, todos: typeof updater === 'function' ? updater(l.todos) : updater }
          : l
      )
    );
  };

  const patchTodo = (id, patch) => {
    if (!activeTaskListId) return;
    updateListTodos(activeTaskListId, (arr) =>
      arr.map((t) => (t.id === id ? { ...t, ...patch } : t))
    );
  };

  const toggleTodo = (id) => {
    if (!activeTaskListId) return;
    updateListTodos(activeTaskListId, (arr) =>
      arr.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const commitNewTodo = () => {
    if (!newTodo.trim() || !activeTaskListId) return;
    updateListTodos(activeTaskListId, (arr) => [
      ...arr,
      {
        id: Date.now(),
        text: newTodo.trim(),
        completed: false,
        level: newTodoLevel,
        details: '',
        dueAt: '',
      },
    ]);
    setNewTodo('');
  };

  const addTodo = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commitNewTodo();
    }
  };

  const deleteTodo = (id) => {
    if (!activeTaskListId) return;
    updateListTodos(activeTaskListId, (arr) => arr.filter((t) => t.id !== id));
    setTaskDetailTodoId((cur) => (cur === id ? null : cur));
  };

  const detailTodo = taskDetailTodoId ? todos.find((t) => t.id === taskDetailTodoId) : null;

  const addTaskList = () => {
    const name = newTaskListName.trim();
    if (!name) return;
    setTaskLists((prev) => [...prev, { id: `list-${Date.now()}`, name, todos: [] }]);
    setNewTaskListName('');
  };

  const deleteTaskList = (listId, e) => {
    e?.stopPropagation();
    setTaskLists((prev) => prev.filter((l) => l.id !== listId));
    setActiveTaskListId((cur) => (cur === listId ? null : cur));
  };

  const snoozeAlert = (key) => {
    setNotifySnoozes((prev) => ({ ...prev, [key]: Date.now() + 24 * 60 * 60 * 1000 }));
    browserNotifyShownRef.current.delete(key);
  };

  const openAlertTarget = (a) => {
    if (a.kind === 'plan') {
      const ev = calEvents.find((e) => e.id === a.eventId);
      if (ev?.dateKey) setCalSelectedKey(ev.dateKey);
      setView('calendar');
    } else {
      setActiveTaskListId(a.listId);
      setTaskDetailTodoId(a.taskId);
      setView('todos');
      const tnode = findFirstNodeById(projectData, 'tasks');
      if (tnode) {
        setActiveItem(tnode);
        setNavPath(findPathToNode(projectData, tnode.id) || [projectData]);
      }
    }
    setNotifyPanelOpen(false);
    collapseSidebarOnMobile();
  };

  const requestBrowserNotify = () => {
    if (typeof Notification === 'undefined') return;
    void Notification.requestPermission();
  };

  /** In TASKS view, a file under `workspace/tasks/` opens like DOCS (board stays in sidebar under `tasks/`). */
  const tasksSideFileView =
    view === 'todos' &&
    activeItem &&
    isItemUnderTasksFolder(activeItem, projectData) &&
    (activeItem.type === 'file' || activeItem.type === 'mermaid');

  /** Live `workspace/tasks/` node — same children as the sidebar; drives the TASKS header file strip. */
  const tasksFolderNode = useMemo(() => findFirstNodeById(projectData, 'tasks'), [projectData]);
  const tasksFolderFiles = useMemo(
    () => (Array.isArray(tasksFolderNode?.children) ? tasksFolderNode.children : []),
    [tasksFolderNode]
  );

  if (!isLoggedIn) {
    return <LoginPage onLoggedIn={completeLogin} dark={dark} onToggleDark={toggleDark} />;
  }

  return (
    <div className="flex h-[100dvh] min-h-0 overflow-hidden bg-slate-50 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Sidebar: overlay drawer on narrow viewports so main stays full-width */}
      <aside
        style={
          isNarrowViewport
            ? { width: 0, minWidth: 0 }
            : sidebarOpen
              ? { width: sidebarWidth, minWidth: sidebarWidth }
              : { width: 0, minWidth: 0 }
        }
        className={`relative flex min-h-0 shrink-0 flex-col overflow-visible bg-transparent ${
          isNarrowViewport
            ? ''
            : `border-r border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900 ${
                sidebarResizing ? '' : 'transition-[width,min-width] duration-200 ease-out'
              }`
        }`}
      >
        {sidebarOpen ? (
          <>
            {isNarrowViewport ? (
              <button
                type="button"
                className="fixed inset-0 z-30 bg-slate-900/45 backdrop-blur-[1px] md:hidden"
                aria-label="Close sidebar"
                onClick={() => persistSidebarOpen(false)}
              />
            ) : null}
            <div
              className={`flex min-h-0 flex-col overflow-hidden bg-white dark:bg-slate-900 ${
                isNarrowViewport
                  ? 'fixed left-0 top-0 z-40 h-[100dvh] max-h-[100dvh] border-r border-slate-200 shadow-2xl dark:border-slate-700'
                  : 'relative h-full shadow-lg'
              }`}
              style={
                isNarrowViewport
                  ? {
                      width: mobileSidebarDrawerWidthPx(sidebarWidth),
                      paddingTop: 'env(safe-area-inset-top, 0px)',
                    }
                  : undefined
              }
            >
            {!isNarrowViewport ? (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize sidebar"
              title="Drag to resize · Double-click to reset width"
              onMouseDown={(e) => {
                e.preventDefault();
                sidebarDragRef.current = true;
                setSidebarResizing(true);
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
              }}
              onDoubleClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const w = SIDEBAR_W_DEFAULT;
                setSidebarWidth(Math.min(sidebarMaxPx(), w));
                try {
                  localStorage.setItem(LS_SIDEBAR_W, String(Math.min(sidebarMaxPx(), w)));
                } catch { /* ignore */ }
              }}
              className="group/handle absolute -mr-1.5 right-0 top-0 z-30 flex h-full w-3 cursor-col-resize justify-center hover:bg-indigo-500/15 active:bg-indigo-500/25 dark:hover:bg-indigo-400/20"
            >
              <span className="h-full w-px rounded-full bg-slate-200 group-hover/handle:bg-indigo-400 dark:bg-slate-600 dark:group-hover/handle:bg-indigo-500" />
            </div>
            ) : null}
            <div className="flex min-w-0 items-center justify-between gap-2 border-b border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 sm:p-4">
              <div className="flex min-w-0 items-center gap-2 font-black text-indigo-700 dark:text-indigo-400">
                <LayoutDashboard size={22} className="shrink-0" />
                <span className="truncate uppercase tracking-tight">Dashboard OS</span>
              </div>
              <button
                type="button"
                onClick={() => persistSidebarOpen(false)}
                className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                title="Hide sidebar"
                aria-label="Hide sidebar"
              >
                <PanelLeftClose size={20} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-2 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-3">
              {(view === 'browser' || view === 'mindmap' || view === 'todos' || view === 'calendar') ? (
                <div className="space-y-1">
                  {filesTreeSource === 'mock' ? (
                    <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/95 px-2.5 py-2 text-[10px] font-medium leading-snug text-amber-950 dark:border-amber-500/35 dark:bg-amber-950/40 dark:text-amber-100">
                      <strong className="font-bold">Preview mode.</strong> Drag-and-drop and live{' '}
                      <code className="rounded bg-amber-100/90 px-0.5 font-mono dark:bg-amber-900/50">workspace/</code>{' '}
                      edits need the dev server. From the{' '}
                      <code className="rounded bg-amber-100/90 px-0.5 font-mono dark:bg-amber-900/50">ui</code>{' '}
                      folder run <code className="font-mono">npm run dev</code>, then open the local URL (not static
                      hosting).
                    </div>
                  ) : null}
                  {projectData.liveFiles && pendingMoveFrom ? (
                    <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/90 px-2.5 py-2 text-[10px] font-medium text-indigo-900 dark:border-indigo-500/40 dark:bg-indigo-950/50 dark:text-indigo-100">
                      <span className="min-w-0 flex-1">
                        Tap a <strong>folder</strong> or <strong>Workspace</strong> row to move into it. Open subfolders
                        with <strong className="inline-flex items-center gap-0.5">▸</strong> first if needed.
                      </span>
                      <button
                        type="button"
                        onClick={() => setPendingMoveFrom(null)}
                        className="shrink-0 rounded-lg border border-indigo-300 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-800 hover:bg-indigo-50 dark:border-indigo-500/50 dark:bg-slate-900 dark:text-indigo-200 dark:hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : null}
                  {projectData.liveFiles ? (
                    <div className="mb-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          disabled={filesMutateBusy}
                          onClick={() => {
                            setFilesCreateKind('folder');
                            setFilesCreateName('');
                          }}
                          className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50/80 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-500/35 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/50 min-[280px]:flex-none min-[280px]:flex-initial"
                        >
                          <Folder size={14} strokeWidth={2} /> New folder
                        </button>
                        <button
                          type="button"
                          disabled={filesMutateBusy}
                          onClick={() => {
                            setFilesCreateKind('file');
                            setFilesCreateName('');
                          }}
                          className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 min-[280px]:flex-none min-[280px]:flex-initial"
                        >
                          <File size={14} strokeWidth={2} /> New file
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowFilesMoveHelp((v) => !v)}
                          className={`flex h-8 w-8 shrink-0 touch-manipulation items-center justify-center rounded-lg border text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 ${
                            showFilesMoveHelp
                              ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-950/50'
                              : 'border-slate-200 dark:border-slate-600'
                          }`}
                          title={showFilesMoveHelp ? 'Hide tree help' : 'How to move items in the tree'}
                          aria-expanded={showFilesMoveHelp}
                          aria-controls="files-move-help"
                          aria-label="How to move items in the workspace tree"
                        >
                          <Info size={16} strokeWidth={2} className="shrink-0" aria-hidden />
                        </button>
                      </div>
                      {showFilesMoveHelp ? (
                        <div
                          id="files-move-help"
                          className="rounded-xl border border-slate-200 bg-slate-50/95 px-2.5 py-2 text-[10px] font-medium leading-snug text-slate-600 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-300"
                          role="region"
                          aria-label="Moving items in the workspace tree"
                        >
                          <strong className="font-semibold text-slate-700 dark:text-slate-200">Drag</strong> the grip⋮⋮ onto
                          a folder or <span className="font-semibold text-slate-800 dark:text-slate-100">Workspace</span>{' '}
                          root. On touch screens, use the folder icon to pick a target, then tap a destination folder.
                          Project docs live in{' '}
                          <code className="rounded bg-white px-0.5 font-mono text-[9px] dark:bg-slate-900">workspace/docs/</code>.
                        </div>
                      ) : null}
                      {filesCreateKind ? (
                        <form
                          onSubmit={submitFilesCreate}
                          className="rounded-xl border border-slate-200 bg-slate-50/90 p-2 dark:border-slate-600 dark:bg-slate-800/80"
                        >
                          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            {filesCreateKind === 'folder' ? 'New folder in' : 'New file in'}{' '}
                            <span className="normal-case text-slate-800 dark:text-slate-200">
                              {parentRelForNewItem(activeItem) ? parentRelForNewItem(activeItem) : 'workspace'}
                            </span>
                          </p>
                          <div className="flex flex-col gap-2">
                            <input
                              type="text"
                              value={filesCreateName}
                              onChange={(ev) => setFilesCreateName(ev.target.value)}
                              placeholder={
                                filesCreateKind === 'folder' ? 'folder-name' : 'note.md'
                              }
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                            />
                            <div className="flex gap-2">
                              <button
                                type="submit"
                                disabled={filesMutateBusy || !filesCreateName.trim()}
                                className="flex-1 rounded-lg bg-indigo-600 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                              >
                                Create
                              </button>
                              <button
                                type="button"
                                disabled={filesMutateBusy}
                                onClick={() => {
                                  setFilesCreateKind(null);
                                  setFilesCreateName('');
                                }}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                  <SidebarItem
                    item={projectData}
                    onSelect={handleSelect}
                    activeId={activeItem.id}
                    liveFiles={Boolean(projectData.liveFiles)}
                    onDeleteItem={handleDeleteFileTreeItem}
                    onRenameItem={handleRenameFileTreeItem}
                    mutateBusy={filesMutateBusy}
                    onMoveDrop={handleFileTreeMove}
                    pendingMoveFrom={pendingMoveFrom}
                    onStartTapMove={(rel) => setPendingMoveFrom(rel)}
                    onCompletePendingMove={completePendingTreeMove}
                    showMoveTapTarget={coarsePointer && Boolean(projectData.liveFiles)}
                  />
                </div>
              ) : view === 'ai-chat' ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      const newChat = { id: Date.now().toString(), title: `Chat ${chats.length + 1}`, messages: [{ role: 'assistant', content: 'Ready to assist.' }] };
                      setChats([newChat, ...chats]);
                      setActiveChatId(newChat.id);
                    }}
                    className="mb-4 flex w-full items-center gap-2 rounded-xl border-2 border-dashed border-indigo-200 px-3 py-2.5 text-xs font-bold text-indigo-600 transition-all hover:bg-indigo-50 dark:border-indigo-500/40 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                  >
                    <Plus size={16} /> NEW CONVERSATION
                  </button>
                  {chats.map(chat => (
                    <div key={chat.id} onClick={() => setActiveChatId(chat.id)} className={`group relative cursor-pointer rounded-xl border-2 p-3 transition-all ${activeChatId === chat.id ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40' : 'border-transparent bg-transparent text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/80'}`}>
                      <div className="flex items-center gap-2 truncate pr-6">
                        <MessageSquare size={14} className={activeChatId === chat.id ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500'} />
                        <span className="text-xs font-bold truncate">{chat.title}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            </div>
          </>
        ) : null}
      </aside>

      {/* Main Content Area */}
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-20 flex min-h-14 shrink-0 flex-col gap-3 border-b border-slate-200 bg-white px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top,0px))] dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2 sm:px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
              aria-expanded={sidebarOpen}
              aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
            </button>
            <nav
              className="flex min-w-0 touch-pan-x flex-1 items-center gap-0.5 overflow-x-auto overscroll-x-contain rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-600 dark:bg-slate-800/80 sm:flex-none sm:gap-1 [-webkit-overflow-scrolling:touch]"
              aria-label="Main sections"
            >
              {MAIN_NAV_TABS.map((tab) => {
                const active =
                  tab.id === 'notes'
                    ? view === 'browser' && docsView === 'notes'
                    : tab.id === 'browser'
                      ? view === 'browser' && docsView === 'root'
                      : view === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      try {
                        if (tab.id === 'todos') {
                          setActiveTaskListId(null);
                          setView('todos');
                          void refreshFilesTree({ preferSelectionId: 'tasks' });
                          void fetch('/api/tasks-data')
                            .then((r) => (r.ok ? r.json() : null))
                            .then((data) => {
                              if (data?.lists)
                                setTaskLists(normalizeTaskListsFromParsed(data.lists));
                            })
                            .catch(() => {});
                          return;
                        }
                        if (tab.id === 'notes') {
                          setView('browser');
                          setDocsView('notes');
                          const node = findFirstNodeById(projectData, 'notes');
                          if (node) {
                            setActiveItem(node);
                            setNavPath(findPathToNode(projectData, node.id) || [projectData]);
                          } else {
                            setActiveItem(projectData);
                            setNavPath([projectData]);
                          }
                          return;
                        }
                        if (tab.id === 'browser') {
                          setView('browser');
                          setDocsView('root');
                          setActiveItem(projectData);
                          setNavPath([projectData]);
                          return;
                        }
                        setView(tab.id);
                      } finally {
                        collapseSidebarOnMobile();
                      }
                    }}
                    aria-current={active ? 'page' : undefined}
                    className={`inline-flex min-h-9 shrink-0 touch-manipulation items-center gap-1.5 rounded-lg px-2.5 py-2 text-[10px] font-black tracking-wide transition-all sm:min-h-0 sm:px-3 sm:text-xs ${
                      active
                        ? 'bg-white text-indigo-600 shadow-md dark:bg-slate-950 dark:text-indigo-400'
                        : 'text-slate-500 hover:bg-white/60 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-100'
                    }`}
                  >
                    <tab.icon size={16} className="shrink-0" strokeWidth={2.25} aria-hidden />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifyPanelOpen((o) => !o)}
                className="relative flex h-10 w-10 touch-manipulation items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                title={`Alerts${overdueAlerts.length ? ` (${overdueAlerts.length} overdue)` : ''}`}
                aria-expanded={notifyPanelOpen}
                aria-label={`Notifications, ${overdueAlerts.length} overdue`}
              >
                <Bell size={18} />
                {overdueAlerts.length > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-black text-white">
                    {overdueAlerts.length > 9 ? '9+' : overdueAlerts.length}
                  </span>
                ) : null}
              </button>
              {notifyPanelOpen ? (
                <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-slate-200 bg-white py-3 shadow-xl dark:border-slate-600 dark:bg-slate-900 max-sm:left-1/2 max-sm:right-auto max-sm:-translate-x-1/2">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 pb-2 dark:border-slate-700">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Missed & overdue</p>
                    {typeof Notification !== 'undefined' && Notification.permission !== 'granted' ? (
                      <button
                        type="button"
                        onClick={requestBrowserNotify}
                        className="shrink-0 text-[10px] font-black uppercase tracking-wider text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        Browser alerts
                      </button>
                    ) : typeof Notification !== 'undefined' && Notification.permission === 'granted' ? (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Browser on</span>
                    ) : null}
                  </div>
                  <div className="custom-scrollbar max-h-80 overflow-y-auto px-2 pt-2">
                    {overdueAlerts.length === 0 ? (
                      <p className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                        Nothing overdue. Plan milestones past their day/time and tasks with a due date and time appear here.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {overdueAlerts.map((a) => (
                          <li
                            key={a.key}
                            className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/80"
                          >
                            <p className="text-xs font-black uppercase tracking-wide text-amber-700 dark:text-amber-400">
                              {a.kind === 'plan' ? 'Plan' : 'Task'}
                            </p>
                            <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">{a.title}</p>
                            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{a.subtitle}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => openAlertTarget(a)}
                                className="rounded-lg bg-indigo-600 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white hover:bg-indigo-500"
                              >
                                Open
                              </button>
                              <button
                                type="button"
                                onClick={() => snoozeAlert(a.key)}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                Snooze 24h
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={toggleDark}
              className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              title={dark ? 'Light mode' : 'Dark mode'}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              type="button"
              onClick={logout}
              className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'full' ? 'standard' : 'full')}
              className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              title={viewMode === 'full' ? 'Standard width' : 'Full width'}
              aria-label={viewMode === 'full' ? 'Use standard content width' : 'Expand content to full width'}
            >
              {viewMode === 'full' ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-xs font-black text-white">
              AD
            </div>
          </div>

          {view === 'todos' ? (
            <div
              className="flex w-full basis-full flex-col gap-2 border-t border-slate-200 pt-2 dark:border-slate-700 sm:flex-row sm:items-center sm:gap-2 sm:pt-2.5"
              role="region"
              aria-label="Files in workspace/tasks"
            >
              <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                workspace/tasks/
              </span>
              <div className="flex min-h-0 min-w-0 flex-1 flex-wrap items-center gap-1.5">
                {tasksFolderNode ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSelect(tasksFolderNode)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                        activeItem?.id === tasksFolderNode.id && activeItem?.type === 'folder'
                          ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-300'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500/50'
                      }`}
                    >
                      <CheckSquare size={14} className="shrink-0" aria-hidden />
                      Board
                    </button>
                    {tasksFolderFiles.length === 0 ? (
                      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                        {projectData.liveFiles
                          ? 'Empty folder — use New file in the sidebar with tasks/ selected'
                          : 'Dev tree not loaded'}
                      </span>
                    ) : (
                      tasksFolderFiles.map((node) => {
                        const isFile = node.type === 'file' || node.type === 'mermaid';
                        const Icon = isFile ? FileText : Folder;
                        const selected = activeItem?.id === node.id;
                        return (
                          <button
                            key={node.id}
                            type="button"
                            onClick={() => handleSelect(node)}
                            className={`inline-flex max-w-[14rem] items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition-colors ${
                              selected
                                ? 'border-indigo-400 bg-indigo-50 text-indigo-800 dark:border-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-200'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-indigo-500/50'
                            }`}
                            title={node.relPath || node.id}
                          >
                            <Icon size={14} className="shrink-0 opacity-80" aria-hidden />
                            <span className="truncate">{node.name}</span>
                          </button>
                        );
                      })
                    )}
                  </>
                ) : (
                  <span className="text-[10px] font-medium text-amber-800 dark:text-amber-200/90">
                    No <code className="rounded bg-amber-100/90 px-1 font-mono dark:bg-amber-900/50">tasks</code> folder in
                    the workspace tree.
                  </span>
                )}
              </div>
            </div>
          ) : null}
        </header>

        <div className={`flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col transition-all ${viewMode === 'full' ? 'max-w-none' : 'max-w-6xl mx-auto w-full'}`}>

          {view === 'browser' && (
            <div className="flex-1 min-h-0 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
              <nav className="mb-6 flex shrink-0 items-center gap-2 truncate border-b border-slate-100 pb-2 text-[10px] font-bold text-slate-400 dark:border-slate-700 dark:text-slate-500">
                {navPath.map((item, idx) => (
                  <button key={item.id} onClick={() => handleSelect(item)} className={`flex items-center gap-1 uppercase hover:text-indigo-600 dark:hover:text-indigo-400 ${idx === navPath.length - 1 ? 'text-slate-800 dark:text-slate-100' : ''}`}>
                    {idx > 0 && <ChevronRight size={14} />} {item.name}
                  </button>
                ))}
              </nav>

              <div className="flex gap-1 mb-8 h-1">
                {[1, 2, 3, 5, 8].map((n, i) => (
                  <div key={i} className={`flex-1 rounded-full transition-all duration-500 ${i < activeItem.level ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                ))}
              </div>

              {activeItem.type === 'dashboard' ? (
                <div className="space-y-8 animate-in">
                  <div className="relative overflow-hidden rounded-2xl bg-slate-900 p-5 text-white shadow-2xl sm:rounded-3xl sm:p-10 dark:border dark:border-slate-700 dark:bg-slate-800">
                    <div className="absolute right-0 top-0 p-4 opacity-10"><Workflow size={120} className="max-sm:max-h-24 max-sm:w-auto" /></div>
                    <h2 className="relative z-10 mb-3 text-2xl font-black tracking-tight sm:mb-4 sm:text-4xl">{activeItem.name}</h2>
                    <p className="relative z-10 max-w-2xl text-base font-medium leading-relaxed text-slate-400 dark:text-slate-300 sm:text-lg">{activeItem.summary}</p>
                    <div className="relative z-10 mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:gap-4">
                      <button type="button" onClick={() => setView('ai-chat')} className="flex touch-manipulation items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-xs font-black uppercase shadow-xl shadow-indigo-900/20 transition-all hover:bg-indigo-500 sm:px-8"><Sparkles size={18} /> Ask AI Assistant</button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTaskListId(null);
                          setView('todos');
                          void refreshFilesTree({ preferSelectionId: 'tasks' });
                          void fetch('/api/tasks-data')
                            .then((r) => (r.ok ? r.json() : null))
                            .then((data) => {
                              if (data?.lists)
                                setTaskLists(normalizeTaskListsFromParsed(data.lists));
                            })
                            .catch(() => {});
                        }}
                        className="flex touch-manipulation items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-6 py-3 text-xs font-black uppercase backdrop-blur-md transition-all hover:bg-white/20 sm:px-8"
                      >
                        <CheckSquare size={18} /> Manage Tasks
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeItem.children?.map(entry => {
                    const isContainer = entry.type === 'folder' || entry.type === 'branch' || Boolean(entry.children?.length);
                    const Icon = isContainer ? Folder : File;
                    return (
                      <div key={entry.id} onClick={() => handleSelect(entry)} className="group flex min-h-[140px] cursor-pointer flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-indigo-400 hover:shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:hover:border-indigo-500 sm:min-h-[160px] sm:p-6">
                        <div>
                          <div className={`mb-4 w-fit rounded-xl p-3 ${isContainer ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                            <Icon size={24} />
                          </div>
                          <h4 className="truncate text-sm font-black uppercase tracking-wide text-slate-800 group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400">{entry.name}</h4>
                        </div>
                        <div className="mt-4 flex items-center text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Level {entry.level ?? 'NA'} Node</div>
                      </div>
                    );
                  })}
                  {activeItem.type === 'file' && (
                    <div className="col-span-full animate-in rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:rounded-3xl sm:p-10">
                      <h2 className="mb-6 text-2xl font-black uppercase tracking-tight dark:text-slate-100">{activeItem.name}</h2>
                      {activeItem.content === undefined ? (
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading…</p>
                      ) : isMarkdownFileItem(activeItem) ? (
                        <div className="rounded-2xl border border-slate-100 bg-white px-2 py-3 sm:px-6 dark:border-slate-700 dark:bg-slate-950/50">
                          <MarkdownDoc source={activeItem.content} isDark={dark} />
                        </div>
                      ) : (
                        <div className="overflow-x-auto whitespace-pre-wrap rounded-2xl border border-slate-100 bg-slate-50 p-6 font-mono text-sm leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                          {activeItem.content}
                        </div>
                      )}
                    </div>
                  )}
                  {activeItem.type === 'mermaid' && (
                    <MermaidPanel title={activeItem.name} definition={activeItem.content} isDark={dark} />
                  )}
                </div>
              )}
            </div>
          )}

          {view === 'todos' &&
            (tasksSideFileView ? (
              <div className="custom-scrollbar flex min-h-0 flex-1 overflow-y-auto p-4 sm:p-8">
                <div className="mx-auto w-full max-w-4xl space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => {
                        const node = findFirstNodeById(projectData, 'tasks');
                        if (node) {
                          setActiveItem(node);
                          setNavPath(findPathToNode(projectData, node.id) || [projectData]);
                        }
                        setActiveTaskListId(null);
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-indigo-200 hover:text-indigo-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500/40"
                    >
                      <ChevronLeft size={18} /> Task board
                    </button>
                    <code className="max-w-[min(100%,36rem)] truncate text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                      workspace/{activeItem.relPath}
                    </code>
                  </div>
                  {activeItem.content === undefined && !isTaskListsJsonItem(activeItem) ? (
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading…</p>
                  ) : activeItem.type === 'mermaid' ? (
                    <MermaidPanel title={activeItem.name} definition={activeItem.content} isDark={dark} />
                  ) : isMarkdownFileItem(activeItem) ? (
                    <div className="rounded-2xl border border-slate-100 bg-white px-2 py-3 sm:px-6 dark:border-slate-700 dark:bg-slate-950/50">
                      <MarkdownDoc source={activeItem.content ?? ''} isDark={dark} />
                    </div>
                  ) : isTaskListsJsonItem(activeItem) ? (
                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        Same structure as <span className="font-mono text-[11px]">task-lists.json</span> — updating tasks on
                        the board writes this file in dev (this preview stays in sync).
                      </p>
                      <pre className="max-h-[min(70vh,48rem)] overflow-auto whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                        {JSON.stringify({ lists: taskLists }, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <div className="overflow-x-auto whitespace-pre-wrap rounded-2xl border border-slate-100 bg-slate-50 p-6 font-mono text-sm leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                      {activeItem.content ?? ''}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="custom-scrollbar flex min-h-0 flex-1 overflow-y-auto p-4 sm:p-8">
                <div className="mx-auto w-full max-w-4xl space-y-8">
                {!activeTaskListId ? (
                  <>
                    <div className="flex flex-col gap-4 border-b-2 border-slate-200 pb-4 dark:border-slate-700 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">Task lists</h2>
                        <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                          {taskLists.length} list{taskLists.length === 1 ? '' : 's'} · click one to open
                        </p>
                        <p className="mt-2 max-w-xl text-[11px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                          With <code className="rounded bg-slate-100 px-1 py-px font-mono text-[10px] dark:bg-slate-800">npm run dev</code>, the board matches{' '}
                          <code className="rounded bg-slate-100 px-1 py-px font-mono text-[10px] dark:bg-slate-800">workspace/tasks/task-lists.json</code>
                          . The sidebar selects the <code className="font-mono text-[10px]">tasks</code> folder (like DOCS for docs); open any file there for a
                          doc-style viewer — <code className="font-mono text-[10px]">task-lists.json</code> previews the live <code className="font-mono text-[10px]">{`{ "lists": ... }`}</code> data.
                        </p>
                      </div>
                      <div className="rounded-xl bg-indigo-50 px-4 py-2 text-xs font-black text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                        Fibonacci levels inside each list
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <input
                        type="text"
                        placeholder="New list name…"
                        value={newTaskListName}
                        onChange={(e) => setNewTaskListName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addTaskList()}
                        className="min-w-0 flex-1 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 font-bold shadow-sm outline-none transition-all focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                      />
                      <button
                        type="button"
                        onClick={addTaskList}
                        disabled={!newTaskListName.trim()}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg hover:bg-indigo-500 disabled:opacity-45"
                      >
                        <Plus size={18} /> Add list
                      </button>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      {taskLists.map((list) => {
                        const pending = list.todos.filter((t) => !t.completed).length;
                        const total = list.todos.length;
                        return (
                          <div
                            key={list.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setActiveTaskListId(list.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setActiveTaskListId(list.id);
                              }
                            }}
                            className="group relative flex cursor-pointer flex-col rounded-2xl border-2 border-slate-200 bg-white p-6 text-left shadow-sm transition-all hover:border-indigo-400 hover:shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:hover:border-indigo-500"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                                  <CheckSquare size={22} />
                                </div>
                                <div className="min-w-0">
                                  <h3 className="truncate font-black text-slate-900 dark:text-slate-100">{list.name}</h3>
                                  <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                                    {pending} pending · {total} total
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => deleteTaskList(list.id, e)}
                                className="shrink-0 rounded-lg p-2 text-slate-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/50"
                                aria-label={`Delete list ${list.name}`}
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                            <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Open list →</p>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-4 border-b-2 border-slate-200 pb-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
                        <button
                          type="button"
                          onClick={() => setActiveTaskListId(null)}
                          className="inline-flex w-fit items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-indigo-200 hover:text-indigo-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500/40"
                        >
                          <ChevronLeft size={18} /> All lists
                        </button>
                        <div className="min-w-0">
                          <h2 className="truncate text-3xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                            {activeTaskList?.name ?? 'List'}
                          </h2>
                          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                            Status: {todos.filter((t) => !t.completed).length} items pending
                          </p>
                        </div>
                      </div>
                      <div className="rounded-xl bg-indigo-50 px-4 py-2 text-xs font-black text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                        Fibonacci Grouping
                      </div>
                    </div>

                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Pick a <span className="font-bold text-indigo-600 dark:text-indigo-400">Fibonacci level</span> before adding. Click a task to edit title, level, and long notes.
                    </p>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                      <div className="group relative min-w-0 flex-1">
                        <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                          <Plus size={20} />
                        </div>
                        <input
                          type="text"
                          placeholder="New task title… (Enter to add)"
                          className="w-full rounded-2xl border-2 border-slate-200 bg-white py-4 pl-12 pr-4 font-bold shadow-sm outline-none transition-all focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                          value={newTodo}
                          onChange={(e) => setNewTodo(e.target.value)}
                          onKeyDown={addTodo}
                        />
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <select
                          value={newTodoLevel}
                          onChange={(e) => setNewTodoLevel(Number(e.target.value))}
                          aria-label="Fibonacci level for new task"
                          className="rounded-2xl border-2 border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 sm:min-w-[8.5rem]"
                        >
                          {FIBONACCI_LEVELS.map((lv) => (
                            <option key={lv} value={lv}>
                              Level {lv}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={commitNewTodo}
                          disabled={!newTodo.trim()}
                          className="rounded-2xl bg-indigo-600 px-4 py-3 text-xs font-black uppercase tracking-widest text-white shadow-md hover:bg-indigo-500 disabled:opacity-40"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {todos.map((todo) => {
                        const dueAtDt = parseLocalDateTime(todo.dueAt);
                        const taskOverdue =
                          Boolean(dueAtDt) && dueAtDt.getTime() < Date.now() && !todo.completed;
                        return (
                        <div
                          key={todo.id}
                          onClick={() => setTaskDetailTodoId(todo.id)}
                          className={`group flex cursor-pointer items-start gap-4 rounded-2xl border-2 p-5 transition-all ${todo.completed ? 'border-slate-100 bg-slate-50 opacity-90 dark:border-slate-800 dark:bg-slate-900/60' : 'border-white bg-white shadow-md hover:border-indigo-100 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/40'} ${taskDetailTodoId === todo.id ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-950' : ''} ${taskOverdue ? 'border-amber-200 bg-amber-50/40 dark:border-amber-600/40 dark:bg-amber-950/15' : ''}`}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTodo(todo.id);
                            }}
                            className={`mt-0.5 shrink-0 transition-colors ${todo.completed ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-500 dark:text-slate-600 dark:hover:text-indigo-400'}`}
                            aria-label={todo.completed ? 'Mark incomplete' : 'Mark complete'}
                          >
                            {todo.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-bold ${todo.completed ? 'text-slate-400 line-through dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}>
                              {todo.text || 'Untitled task'}
                            </p>
                            {todo.details?.trim() ? (
                              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{todo.details}</p>
                            ) : null}
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-tighter text-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-400">
                                Level {todo.level}
                              </span>
                              {dueAtDt ? (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                  Due {dueAtDt.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                              ) : null}
                              {taskOverdue ? (
                                <span className="flex items-center gap-1 text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">
                                  <AlertCircle size={10} /> Overdue
                                </span>
                              ) : null}
                              {todo.level >= 5 && !todo.completed && (
                                <span className="flex items-center gap-1 text-[10px] font-black uppercase text-amber-500">
                                  <AlertCircle size={10} /> High Complexity
                                </span>
                              )}
                              {todo.details?.trim() ? (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Has notes</span>
                              ) : null}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTodo(todo.id);
                            }}
                            className="mt-0.5 shrink-0 rounded-lg p-2 text-slate-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:text-slate-600 dark:hover:bg-red-950/40"
                            aria-label="Delete task"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                        );
                      })}
                    </div>

                    {taskDetailTodoId && detailTodo ? (
                      <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
                        role="presentation"
                        onClick={() => setTaskDetailTodoId(null)}
                      >
                        <div
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="task-detail-title"
                          className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-600 dark:bg-slate-900"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="mb-4 flex items-start justify-between gap-2">
                            <h2 id="task-detail-title" className="text-lg font-black uppercase tracking-tight dark:text-slate-100">
                              Task details
                            </h2>
                            <button
                              type="button"
                              onClick={() => setTaskDetailTodoId(null)}
                              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                              aria-label="Close"
                            >
                              <X size={20} />
                            </button>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Title</label>
                              <input
                                type="text"
                                value={detailTodo.text}
                                onChange={(e) => patchTodo(detailTodo.id, { text: e.target.value })}
                                className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Fibonacci level</label>
                              <select
                                value={detailTodo.level}
                                onChange={(e) => patchTodo(detailTodo.id, { level: Number(e.target.value) })}
                                className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                              >
                                {[...new Set([...FIBONACCI_LEVELS, Number(detailTodo.level) || 1])].sort((a, b) => a - b).map((lv) => (
                                  <option key={lv} value={lv}>
                                    Level {lv}
                                    {lv === 1 ? ' — summary' : ''}
                                    {lv === 8 ? ' — technical depth' : ''}
                                    {!FIBONACCI_LEVELS.includes(lv) ? ' (legacy)' : ''}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                              <input
                                type="checkbox"
                                checked={detailTodo.completed}
                                onChange={() => patchTodo(detailTodo.id, { completed: !detailTodo.completed })}
                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              Completed
                            </label>
                            <div>
                              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                Due date and time (optional, local)
                              </label>
                              <input
                                type="datetime-local"
                                value={detailTodo.dueAt || ''}
                                onChange={(e) => patchTodo(detailTodo.id, { dueAt: e.target.value })}
                                className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                              />
                              <p className="mt-1 text-[10px] text-slate-400">Alerts when this moment passes and the task is still open.</p>
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                Notes & context (long text)
                              </label>
                              <textarea
                                rows={8}
                                value={detailTodo.details ?? ''}
                                onChange={(e) => patchTodo(detailTodo.id, { details: e.target.value })}
                                placeholder="Specs, links, subtasks, meeting notes…"
                                className="w-full resize-y rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                              />
                            </div>
                          </div>

                          <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-700">
                            <button
                              type="button"
                              onClick={() => {
                                deleteTodo(detailTodo.id);
                              }}
                              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-red-700 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950/50"
                            >
                              Delete task
                            </button>
                            <button
                              type="button"
                              onClick={() => setTaskDetailTodoId(null)}
                              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-indigo-500"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
                </div>
              </div>
            ))}

          {view === 'ai-chat' && (
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden border-l border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
              <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
                <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <label htmlFor="agent-select" className="shrink-0 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Agent
                    </label>
                    <select
                      id="agent-select"
                      value={selectedAgentPath}
                      onChange={(e) => setSelectedAgentPath(e.target.value)}
                      className="min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <option value="">Default assistant (Fibonacci + create_doc)</option>
                      {agentsList.map((a) => (
                        <option key={a.path} value={a.path}>
                          {a.name} — {a.path}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void refreshAgentsList()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      title="Reload agents from disk"
                    >
                      <RefreshCw size={14} /> Refresh
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewAgentError(null);
                        setNewAgentOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-sm transition-colors hover:bg-indigo-500 dark:border-indigo-500/40"
                    >
                      <UserPlus size={14} /> New agent
                    </button>
                  </div>
                </div>
                {agentsLoadError ? (
                  <p className="mx-auto mt-2 max-w-4xl text-xs font-medium text-amber-700 dark:text-amber-400">{agentsLoadError}</p>
                ) : null}
                {selectedAgentPath ? (
                  <p className="mx-auto mt-2 max-w-4xl truncate text-xs text-slate-500 dark:text-slate-400" title={selectedAgentPath}>
                    Using system prompt from <code className="rounded bg-slate-200 px-1 dark:bg-slate-800">{selectedAgentPath}</code>
                  </p>
                ) : null}
              </div>

              {newAgentOpen ? (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
                  role="presentation"
                  onClick={() => !newAgentSaving && setNewAgentOpen(false)}
                >
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="new-agent-title"
                    className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-600 dark:bg-slate-900"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="mb-4 flex items-start justify-between gap-2">
                      <h2 id="new-agent-title" className="text-lg font-black uppercase tracking-tight dark:text-slate-100">
                        New agent
                      </h2>
                      <button
                        type="button"
                        disabled={newAgentSaving}
                        onClick={() => setNewAgentOpen(false)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        aria-label="Close"
                      >
                        <X size={20} />
                      </button>
                    </div>
                    <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                      Creates a markdown file under <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">agents/</code> with the same frontmatter shape as other agents. Requires dev server.
                    </p>
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">File id (slug)</label>
                        <input
                          type="text"
                          value={newAgentSlug}
                          onChange={(e) => setNewAgentSlug(e.target.value)}
                          placeholder="my-specialist"
                          className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Display name</label>
                        <input
                          type="text"
                          value={newAgentDisplayName}
                          onChange={(e) => setNewAgentDisplayName(e.target.value)}
                          placeholder="My specialist"
                          className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Subfolder (optional)</label>
                        <input
                          type="text"
                          value={newAgentFolder}
                          onChange={(e) => setNewAgentFolder(e.target.value)}
                          placeholder="custom"
                          className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                        />
                        <p className="mt-1 text-[10px] text-slate-400">Leave empty to save at <code className="rounded bg-slate-100 px-0.5 dark:bg-slate-800">agents/&lt;slug&gt;.md</code>. Only letters, numbers, dots, hyphens, underscores; nested folders with <code className="rounded bg-slate-100 px-0.5 dark:bg-slate-800">/</code>.</p>
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Short description</label>
                        <input
                          type="text"
                          value={newAgentDescription}
                          onChange={(e) => setNewAgentDescription(e.target.value)}
                          placeholder="One-line summary for the dropdown"
                          className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">System instructions (markdown body)</label>
                        <textarea
                          rows={6}
                          value={newAgentInstructions}
                          onChange={(e) => setNewAgentInstructions(e.target.value)}
                          placeholder="You are a …"
                          className="w-full resize-y rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </div>
                    </div>
                    {newAgentError ? <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">{newAgentError}</p> : null}
                    <div className="mt-6 flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={newAgentSaving}
                        onClick={() => setNewAgentOpen(false)}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={newAgentSaving || !newAgentSlug.trim()}
                        onClick={async () => {
                          setNewAgentSaving(true);
                          setNewAgentError(null);
                          try {
                            const r = await fetch('/api/agents-create', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                slug: newAgentSlug,
                                displayName: newAgentDisplayName.trim() || newAgentSlug.trim(),
                                description: newAgentDescription,
                                instructions: newAgentInstructions,
                                folder: newAgentFolder.trim() || undefined,
                              }),
                            });
                            const data = await r.json().catch(() => ({}));
                            if (!r.ok) {
                              throw new Error(data.error || `HTTP ${r.status}`);
                            }
                            await refreshAgentsList();
                            setSelectedAgentPath(data.path);
                            setNewAgentOpen(false);
                            setNewAgentSlug('');
                            setNewAgentDisplayName('');
                            setNewAgentDescription('');
                            setNewAgentInstructions('');
                            setNewAgentFolder('');
                          } catch (err) {
                            setNewAgentError(err?.message || String(err));
                          } finally {
                            setNewAgentSaving(false);
                          }
                        }}
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white shadow-lg hover:bg-indigo-500 disabled:opacity-50"
                      >
                        {newAgentSaving ? 'Saving…' : 'Create agent file'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="custom-scrollbar min-h-0 flex-1 space-y-6 overflow-y-auto p-4 lg:p-8">
                {activeChat.messages.map((msg, i) => (
                  <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-lg"><Bot size={20} /></div>}
                    <div className="max-w-[85%] flex flex-col gap-2">
                      <div className={`rounded-3xl border-2 p-5 text-sm font-medium leading-relaxed ${msg.role === 'user' ? 'border-indigo-600 bg-indigo-600 text-white shadow-xl shadow-indigo-100 dark:shadow-indigo-900/30' : 'border-slate-100 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>
                        {msg.content}
                      </div>
                      {msg.doc && (
                        <div className="animate-in flex items-center justify-between gap-4 rounded-2xl border-2 border-emerald-100 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/40">
                           <div className="flex items-center gap-4"><div className="rounded-xl bg-emerald-100 p-3 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-400"><Plus size={20} /></div><div><p className="text-[10px] font-black uppercase tracking-widest text-emerald-800 dark:text-emerald-300">New Resource</p><p className="max-w-[150px] truncate text-sm font-bold text-emerald-600 dark:text-emerald-400">{msg.doc.title}</p></div></div>
                           <button onClick={() => handleSaveDoc(msg.doc)} className="px-5 py-2.5 bg-emerald-600 text-white text-xs font-black rounded-xl hover:bg-emerald-700 transition-all uppercase tracking-tight flex items-center gap-2 shadow-lg shadow-emerald-900/10"><Save size={16} /> Save to Docs</button>
                        </div>
                      )}
                    </div>
                    {msg.role === 'user' && <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200"><User size={20} /></div>}
                  </div>
                ))}
                {isTyping && <div className="flex animate-pulse gap-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-400 dark:bg-indigo-950/60 dark:text-indigo-300"><Bot size={20} /></div><div className="rounded-3xl border-2 border-slate-100 bg-slate-50 px-6 py-3 text-sm font-bold text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500">Synchronizing...</div></div>}
                <div ref={chatEndRef} />
              </div>
              <div className="border-t border-slate-200 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-4 dark:border-slate-700 dark:bg-slate-900 sm:p-6">
                <div className="mx-auto flex max-w-4xl flex-col items-stretch gap-2 sm:flex-row sm:items-end sm:gap-3">
                  <textarea
                    rows="1"
                    placeholder="Ask AI to structure your next level..."
                    className="min-h-[3rem] flex-1 resize-none rounded-2xl border-2 border-slate-100 bg-slate-100 p-3 text-sm font-bold outline-none transition-all focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 sm:min-h-0 sm:p-4"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                  />
                  <button type="button" onClick={handleSendMessage} className="flex shrink-0 touch-manipulation items-center justify-center rounded-2xl bg-indigo-600 p-3 text-white shadow-xl transition-all hover:bg-indigo-500 sm:p-4">
                    <Send size={22} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {view === 'mindmap' && (
            <MindmapView
              data={projectData}
              onSelectNode={handleSelect}
              onExport={() => {
                const text = mindmapExportLines(projectData).join('\n');
                void navigator.clipboard.writeText(text);
              }}
            />
          )}

          {view === 'calendar' && (() => {
            const calCells = buildMonthGridCells(calMonth.y, calMonth.m);
            const eventCounts = countEventsByDateKey(calEvents);
            const selectedDate = parseDateKey(calSelectedKey);
            const dayEvents = calEvents.filter((e) => e.dateKey === calSelectedKey);
            const monthTitle = new Date(calMonth.y, calMonth.m).toLocaleString(undefined, {
              month: 'long',
              year: 'numeric',
            });
            const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

            const goMonth = (delta) => {
              setCalMonth((prev) => {
                const d = new Date(prev.y, prev.m + delta, 1);
                return { y: d.getFullYear(), m: d.getMonth() };
              });
            };
            const goToday = () => {
              const n = new Date();
              setCalMonth({ y: n.getFullYear(), m: n.getMonth() });
              setCalSelectedKey(dateKeyFromDate(n));
            };

            return (
              <div className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto bg-white dark:bg-slate-900">
                <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-8">
                  <div className="mb-8 flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
                    <div className="flex items-start gap-4">
                      <div className="hidden rounded-3xl bg-indigo-50 p-6 shadow-inner dark:bg-indigo-950/50 sm:block">
                        <Calendar size={48} className="text-indigo-600 dark:text-indigo-400" aria-hidden />
                      </div>
                      <div>
                        <h2 className="text-3xl font-black uppercase tracking-tight dark:text-slate-100">Timeline Planning</h2>
                        <p className="mt-2 max-w-xl text-sm font-bold text-slate-500 dark:text-slate-400">
                          Align your project milestones with Fibonacci complexity cycles. Plan by Level 1 (summary) or Level 8
                          (technical spec). Days match the real calendar; click a date to view and add milestones.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={goToday}
                      className="shrink-0 rounded-xl border-2 border-indigo-200 bg-indigo-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-700 hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-950"
                    >
                      Today
                    </button>
                  </div>

                  <div className="grid gap-8 lg:grid-cols-[1fr_minmax(280px,340px)]">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950/50 sm:p-6">
                      <div className="mb-4 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => goMonth(-1)}
                          className="rounded-xl p-2 text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800"
                          aria-label="Previous month"
                        >
                          <ChevronLeft size={22} />
                        </button>
                        <h3 className="text-center text-lg font-black text-slate-800 dark:text-slate-100">{monthTitle}</h3>
                        <button
                          type="button"
                          onClick={() => goMonth(1)}
                          className="rounded-xl p-2 text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800"
                          aria-label="Next month"
                        >
                          <ChevronRight size={22} />
                        </button>
                      </div>
                      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 sm:gap-2">
                        {weekdayLabels.map((w) => (
                          <div key={w} className="py-1">
                            {w}
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1 sm:gap-2">
                        {calCells.map((cell, idx) => {
                          const key = dateKeyFromDate(cell.date);
                          const n = eventCounts.get(key) || 0;
                          const sel = key === calSelectedKey;
                          return (
                            <button
                              key={`${key}-${idx}`}
                              type="button"
                              onClick={() => setCalSelectedKey(key)}
                              className={`relative flex aspect-square min-h-[2.5rem] flex-col items-center justify-center rounded-2xl border-2 text-xs font-black transition-all sm:min-h-[2.75rem] sm:text-sm ${
                                !cell.inMonth
                                  ? 'border-transparent text-slate-300 opacity-45 hover:opacity-70 dark:text-slate-600'
                                  : sel
                                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:border-indigo-500 dark:bg-indigo-600 dark:shadow-indigo-900/40'
                                    : cell.isToday
                                      ? 'border-indigo-400 bg-white text-indigo-700 dark:border-indigo-500 dark:bg-slate-800 dark:text-indigo-300'
                                      : 'border-slate-100 bg-white text-slate-700 hover:border-indigo-200 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-indigo-500/50'
                              }`}
                            >
                              <span>{cell.date.getDate()}</span>
                              {n > 0 ? (
                                <span
                                  className={`absolute bottom-1 left-1/2 flex h-1.5 w-1.5 -translate-x-1/2 rounded-full ${sel ? 'bg-white' : 'bg-indigo-500 dark:bg-indigo-400'}`}
                                  title={`${n} milestone${n === 1 ? '' : 's'}`}
                                />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:rounded-3xl sm:p-6">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Selected day</p>
                      <p className="mt-1 text-xl font-black text-slate-900 dark:text-slate-100">
                        {selectedDate.toLocaleString(undefined, {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                      <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">{calSelectedKey}</p>

                      <div className="mt-6 flex-1 space-y-3 overflow-y-auto">
                        {dayEvents.length === 0 ? (
                          <p className="text-sm font-medium text-slate-400 dark:text-slate-500">No milestones yet — add one below.</p>
                        ) : (
                          dayEvents.map((ev) => {
                            const deadline = getPlanDeadline(ev);
                            const overdue = deadline && deadline.getTime() < Date.now() && !ev.done;
                            return (
                              <div
                                key={ev.id}
                                className={`rounded-2xl border p-4 dark:border-slate-700 dark:bg-slate-800/80 ${overdue ? 'border-amber-300 bg-amber-50/80 dark:border-amber-600/50 dark:bg-amber-950/20' : 'border-slate-100 bg-slate-50'}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className={`font-bold text-slate-800 dark:text-slate-100 ${ev.done ? 'text-slate-400 line-through dark:text-slate-500' : ''}`}>{ev.title}</p>
                                    <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                      {ev.dueTime ? <span>Time {ev.dueTime}</span> : <span>End of day</span>}
                                      {overdue ? <span className="text-amber-700 dark:text-amber-400">Overdue</span> : null}
                                    </div>
                                    {ev.note ? (
                                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{ev.note}</p>
                                    ) : null}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setCalEvents((prev) => prev.filter((x) => x.id !== ev.id))}
                                    className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50"
                                    aria-label="Remove milestone"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-3">
                                  <span className="rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-black text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                                    Fibonacci level {ev.level}
                                  </span>
                                  <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(ev.done)}
                                      onChange={() =>
                                        setCalEvents((prev) =>
                                          prev.map((x) => (x.id === ev.id ? { ...x, done: !x.done } : x))
                                        )
                                      }
                                      className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                                    />
                                    Mark done
                                  </label>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <div className="mt-6 border-t border-slate-100 pt-6 dark:border-slate-700">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">New milestone</p>
                        <input
                          type="text"
                          placeholder="Title"
                          value={calFormTitle}
                          onChange={(e) => setCalFormTitle(e.target.value)}
                          className="mt-2 w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                        />
                        <label className="mt-3 block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                          Level (complexity)
                        </label>
                        <select
                          value={calFormLevel}
                          onChange={(e) => setCalFormLevel(Number(e.target.value))}
                          className="mt-1 w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        >
                          {FIBONACCI_LEVELS.map((lv) => (
                            <option key={lv} value={lv}>
                              Level {lv}
                              {lv === 1 ? ' — summary / headline' : ''}
                              {lv === 8 ? ' — technical spec depth' : ''}
                            </option>
                          ))}
                        </select>
                        <label className="mt-3 block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                          Time (optional)
                        </label>
                        <input
                          type="time"
                          value={calFormDueTime}
                          onChange={(e) => setCalFormDueTime(e.target.value)}
                          className="mt-1 w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                        />
                        <p className="mt-1 text-[10px] text-slate-400">Leave empty for end-of-day deadline (notifies after that day).</p>
                        <textarea
                          placeholder="Notes (optional)"
                          rows={2}
                          value={calFormNote}
                          onChange={(e) => setCalFormNote(e.target.value)}
                          className="mt-3 w-full resize-y rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                        />
                        <button
                          type="button"
                          disabled={!calFormTitle.trim()}
                          onClick={() => {
                            if (!calFormTitle.trim()) return;
                            const dueT = calFormDueTime.trim();
                            setCalEvents((prev) => [
                              ...prev,
                              normalizeCalendarEvent({
                                id: `cal-${Date.now()}`,
                                dateKey: calSelectedKey,
                                title: calFormTitle.trim(),
                                level: calFormLevel,
                                note: calFormNote.trim(),
                                dueTime: dueT,
                                done: false,
                              }),
                            ]);
                            setCalFormTitle('');
                            setCalFormNote('');
                            setCalFormDueTime('');
                          }}
                          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg hover:bg-indigo-500 disabled:opacity-45"
                        >
                          <Plus size={16} /> Add to this day
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </main>

      <HostMessageModal
        open={Boolean(hostDialog)}
        variant={hostDialog?.variant ?? 'alert'}
        title={hostDialog?.title}
        message={hostDialog?.message ?? ''}
        isDark={dark}
        onCancel={() => closeHostDialog(false)}
        onConfirm={() => closeHostDialog(hostDialog?.variant === 'confirm' ? true : undefined)}
      />
    </div>
  );
}
