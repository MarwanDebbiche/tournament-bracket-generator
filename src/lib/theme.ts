const STORAGE_KEY = 'tbg-theme';

export function isDark(): boolean {
  return document.documentElement.classList.contains('dark');
}

/** Apply and persist an explicit dark/light choice. */
export function setDark(dark: boolean): void {
  document.documentElement.classList.toggle('dark', dark);
  try {
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
  } catch {
    // Ignore storage failures (private mode, etc.).
  }
}
