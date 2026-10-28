import { readStorage, writeStorage } from './storage.ts';

const STORAGE_KEY = 'ubb-group-meta';

export interface GroupMeta {
  name: string;
  path: string[];
  type: string;
}
function getAll(): Record<string, GroupMeta> {
  const value = readStorage<unknown>(STORAGE_KEY, {});
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, GroupMeta> : {};
}

export function saveGroupMeta(id: string, meta: GroupMeta): void {
  const all = getAll();
  all[`${meta.type}:${id}`] = meta;
  writeStorage(STORAGE_KEY, all);
}

export function getGroupMeta(id: string, type?: string): GroupMeta | null {
  const all = getAll();
  const meta = (type ? all[`${type}:${id}`] : null) ?? all[id];
  return meta && typeof meta.name === 'string' && Array.isArray(meta.path)
    && meta.path.every(p => typeof p === 'string') && (!type || meta.type === type) ? meta : null;
}
