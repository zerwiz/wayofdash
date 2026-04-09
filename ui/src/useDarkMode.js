import { useLayoutEffect, useState, useCallback } from 'react';

const LS_THEME = 'way-of-theme';

function readStoredTheme() {
  try {
    const v = localStorage.getItem(LS_THEME);
    if (v === 'dark' || v === 'light') return v;
  } catch { /* ignore */ }
  return null;
}

function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Initial value only (run once on mount). */
function getInitialDark() {
  const stored = readStoredTheme();
  if (stored === 'dark') return true;
  if (stored === 'light') return false;
  return systemPrefersDark();
}

function applyDarkToDocument(isDark) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const body = document.body;
  if (isDark) {
    root.classList.add('dark');
    body?.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    body?.classList.remove('dark');
    root.style.colorScheme = 'light';
  }
  try {
    localStorage.setItem(LS_THEME, isDark ? 'dark' : 'light');
  } catch { /* ignore */ }
}

export function useDarkMode() {
  // Call getInitialDark inside initializer so React never treats a mistaken function ref badly.
  const [dark, setDark] = useState(() => getInitialDark());

  useLayoutEffect(() => {
    applyDarkToDocument(dark);
  }, [dark]);

  const toggle = useCallback(() => {
    setDark((prev) => !prev);
  }, []);

  const setDarkMode = useCallback((value) => {
    setDark(Boolean(value));
  }, []);

  return { dark, toggle, setDark: setDarkMode };
}
