/** localStorage key for per-alert snooze (ms timestamp = show again after). */
export const LS_NOTIFY_SNOOZE = 'way-of-notify-snooze';

export function readNotifySnoozes() {
  try {
    const raw = localStorage.getItem(LS_NOTIFY_SNOOZE);
    const o = raw ? JSON.parse(raw) : {};
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

/** Parse `YYYY-MM-DDTHH:mm` as local wall time. */
export function parseLocalDateTime(val) {
  if (!val || typeof val !== 'string') return null;
  const m = val.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const hh = Number(m[4]);
  const min = Number(m[5]);
  if ([y, mo, d, hh, min].some((n) => Number.isNaN(n))) return null;
  return new Date(y, mo, d, hh, min, 0, 0);
}

/** Calendar milestone deadline: dateKey + optional dueTime HH:mm; else end of that day. */
export function getPlanDeadline(ev) {
  if (!ev?.dateKey) return null;
  const parts = ev.dateKey.split('-').map((n) => parseInt(n, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, mo, d] = parts;
  const tm = typeof ev.dueTime === 'string' ? ev.dueTime.match(/^(\d{1,2}):(\d{2})$/) : null;
  if (tm) {
    const hh = Math.min(23, parseInt(tm[1], 10));
    const mm = Math.min(59, parseInt(tm[2], 10));
    return new Date(y, mo - 1, d, hh, mm, 0, 0);
  }
  return new Date(y, mo - 1, d, 23, 59, 59, 0);
}

export function normalizeCalendarEvent(ev) {
  const tm = ev?.dueTime;
  let dueTime = '';
  if (typeof tm === 'string' && /^\d{1,2}:\d{2}$/.test(tm)) {
    const [h, m] = tm.split(':').map((x) => parseInt(x, 10));
    dueTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  return {
    id: String(ev?.id || `cal-${Date.now()}-${Math.random()}`),
    dateKey: String(ev?.dateKey || ''),
    title: String(ev?.title ?? ''),
    level: Number.isFinite(Number(ev?.level)) ? Number(ev.level) : 1,
    note: typeof ev?.note === 'string' ? ev.note : '',
    dueTime,
    done: Boolean(ev?.done),
  };
}

/**
 * @returns {{ key: string, kind: 'plan'|'task', title: string, subtitle: string, due: Date, listId?: string, taskId?: string, eventId?: string }[]}
 */
export function buildOverdueAlerts(taskLists, calEvents, now, snoozes) {
  const t = now.getTime();
  const alerts = [];

  for (const ev of calEvents) {
    if (!ev.dateKey || ev.done) continue;
    const due = getPlanDeadline(ev);
    if (!due || due.getTime() >= t) continue;
    const key = `plan:${ev.id}`;
    const sn = snoozes[key];
    if (typeof sn === 'number' && t < sn) continue;
    alerts.push({
      key,
      kind: 'plan',
      title: ev.title || 'Untitled milestone',
      subtitle: `Plan · ${ev.dateKey}${ev.dueTime ? ` · ${ev.dueTime}` : ' · end of day'}`,
      due,
      eventId: ev.id,
    });
  }

  for (const list of taskLists) {
    if (!list?.todos) continue;
    for (const todo of list.todos) {
      if (todo.completed) continue;
      const due = parseLocalDateTime(todo.dueAt);
      if (!due || due.getTime() >= t) continue;
      const key = `task:${list.id}:${todo.id}`;
      const sn = snoozes[key];
      if (typeof sn === 'number' && t < sn) continue;
      alerts.push({
        key,
        kind: 'task',
        title: todo.text || 'Untitled task',
        subtitle: `${list.name} · was due ${due.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}`,
        due,
        listId: list.id,
        taskId: todo.id,
      });
    }
  }

  alerts.sort((a, b) => a.due.getTime() - b.due.getTime());
  return alerts;
}
