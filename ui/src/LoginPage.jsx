import { LayoutDashboard, LogIn, Moon, Sun } from 'lucide-react';

/**
 * Placeholder gate: single action stores session in localStorage until real auth exists.
 * Theme must come from the parent so the same `useDarkMode` instance applies after login.
 */
export default function LoginPage({ onLoggedIn, dark, onToggleDark }) {

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-30"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgb(99 102 241 / 0.35), transparent), radial-gradient(ellipse 60% 40% at 100% 50%, rgb(99 102 241 / 0.12), transparent)',
        }}
      />
      <header className="relative z-10 flex justify-end p-4 sm:p-6">
        <button
          type="button"
          onClick={onToggleDark}
          className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-xl border border-slate-200/80 bg-white/90 text-slate-500 shadow-sm backdrop-blur-sm hover:bg-white dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-400 dark:hover:bg-slate-900"
          title={dark ? 'Light mode' : 'Dark mode'}
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-2">
        <div className="w-full max-w-[min(26rem,100%)] rounded-3xl border border-slate-200/90 bg-white/95 p-8 shadow-xl shadow-slate-900/5 backdrop-blur-md dark:border-slate-700/90 dark:bg-slate-900/95 dark:shadow-black/40 sm:p-10">
          <div className="mb-6 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25">
              <LayoutDashboard size={28} strokeWidth={2} />
            </div>
          </div>
          <h1 className="text-center text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Dashboard OS
          </h1>
          <p className="mt-3 text-center text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-400">
            Sign in to open your workspace. User accounts will be wired up later—for now this only remembers this browser
            session.
          </p>
          <button
            type="button"
            onClick={onLoggedIn}
            className="mt-8 flex w-full touch-manipulation items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-indigo-600/30 transition-colors hover:bg-indigo-500 active:bg-indigo-700"
          >
            <LogIn size={18} strokeWidth={2.5} aria-hidden />
            Log in
          </button>
        </div>
        <p className="mt-8 max-w-md text-center text-[11px] font-medium text-slate-500 dark:text-slate-500">
          Session is stored locally. Clearing site data or using another device will require signing in again.
        </p>
      </main>
    </div>
  );
}
