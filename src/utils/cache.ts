interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// --- In-memory cache (tree branches, faculties) ---

const memoryCache = new Map<string, CacheEntry<unknown>>();

export function getMemoryCache<T>(key: string, ttlMs: number): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttlMs) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setMemoryCache<T>(key: string, data: T): void {
  memoryCache.set(key, { data, timestamp: Date.now() });
}

// --- sessionStorage cache (schedules) ---

export function getSessionCache<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setSessionCache<T>(key: string, data: T): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    pruneSessionCache();
    try {
      sessionStorage.setItem(key, JSON.stringify(data));
    } catch { /* quota exceeded, silently fail */ }
  }
}

function pruneSessionCache(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith('ubb-schedule:')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.slice(0, Math.ceil(keysToRemove.length / 2)).forEach(k => {
    sessionStorage.removeItem(k);
  });
}

// --- localStorage cache (tree index) ---

const TREE_INDEX_KEY = 'ubb-tree-index';
const TREE_INDEX_TTL = 24 * 60 * 60 * 1000; // 24 hours

export function getTreeIndexCache<T>(): T | null {
  try {
    const raw = localStorage.getItem(TREE_INDEX_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - parsed.timestamp > TREE_INDEX_TTL) {
      localStorage.removeItem(TREE_INDEX_KEY);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function setTreeIndexCache<T>(data: T): void {
  try {
    localStorage.setItem(TREE_INDEX_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch {
    // localStorage full — silently fail
  }
}
