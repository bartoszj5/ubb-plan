export function readStorage<T>(key: string, fallback: T, session = false): T {
  try {
    const value = (session ? sessionStorage : localStorage).getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch { return fallback; }
}

export function writeStorage(key: string, value: unknown, session = false): void {
  try { (session ? sessionStorage : localStorage).setItem(key, JSON.stringify(value)); }
  catch { /* Browsing remains available when storage is disabled or full. */ }
}
