import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Globe } from 'lucide-react';

/**
 * In-app replacement for window.confirm / window.alert styled like the browser
 * chrome dialog (origin header + message + Cancel / OK).
 */
export default function HostMessageModal({
  open,
  variant = 'alert',
  title,
  message,
  isDark,
  onCancel,
  onConfirm,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (variant === 'confirm') onCancel?.();
        else onConfirm?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, variant, onCancel, onConfirm]);

  if (!open || typeof document === 'undefined') return null;

  const panel = isDark
    ? 'border-zinc-600/80 bg-zinc-800 text-zinc-100 shadow-2xl shadow-black/40'
    : 'border-slate-200 bg-white text-slate-900 shadow-2xl shadow-slate-900/10';
  const bodyText = isDark ? 'text-zinc-100' : 'text-slate-800';
  const btnCancel = isDark
    ? 'border-zinc-600 bg-zinc-700/80 text-zinc-100 hover:bg-zinc-700'
    : 'border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200';
  const btnOk =
    'border-0 bg-cyan-500 font-semibold text-slate-950 shadow-sm hover:bg-cyan-400 active:bg-cyan-600';

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px] dark:bg-black/60"
      role="presentation"
      onClick={() => (variant === 'confirm' ? onCancel?.() : onConfirm?.())}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="host-msg-title"
        aria-describedby="host-msg-body"
        className={`w-full max-w-md rounded-xl border ${panel}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          id="host-msg-title"
          className={`flex items-center gap-2 border-b px-4 py-3 text-sm font-medium ${
            isDark ? 'border-zinc-600/80' : 'border-slate-200'
          }`}
        >
          <Globe size={18} className={`shrink-0 ${isDark ? 'text-zinc-300' : 'text-slate-600'}`} aria-hidden />
          <span className="min-w-0 truncate">{title || 'localhost'}</span>
        </div>
        <p id="host-msg-body" className={`px-4 py-4 text-sm leading-relaxed ${bodyText}`}>
          {message}
        </p>
        <div
          className={`flex justify-end gap-2 border-t px-4 py-3 ${
            isDark ? 'border-zinc-600/80 bg-zinc-900/40' : 'border-slate-200 bg-slate-50/80'
          }`}
        >
          {variant === 'confirm' ? (
            <button
              type="button"
              onClick={onCancel}
              className={`rounded-lg border px-4 py-2 text-xs font-bold uppercase tracking-wide ${btnCancel}`}
            >
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide ${btnOk}`}
          >
            OK
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
