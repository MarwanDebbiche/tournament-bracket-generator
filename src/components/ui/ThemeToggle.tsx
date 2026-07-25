import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { isDark, setDark } from '../../lib/theme';
import { cn } from '../../lib/cn';

export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDarkState] = useState(isDark);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    setDarkState(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className={cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200',
        className,
      )}
    >
      {dark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
    </button>
  );
}
