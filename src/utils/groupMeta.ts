const STORAGE_KEY = 'ubb-group-meta';

export interface GroupMeta {
  name: string;
  path: string[];
  type: string;
}

function getAll(): Record<string, GroupMeta> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function saveGroupMeta(id: string, meta: GroupMeta): void {
  const all = getAll();
  all[id] = meta;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function getGroupMeta(id: string): GroupMeta | null {
  return getAll()[id] ?? null;
}
