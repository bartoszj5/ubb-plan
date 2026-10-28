import type { FavoriteGroup } from '../types/index.ts';
import { planKey, PLANS_CHANGED } from './plans.ts';
import { readStorage, writeStorage } from './storage.ts';

const STORAGE_KEY = 'ubb-plan-favorites';

export function getFavorites(): FavoriteGroup[] {
  const value = readStorage<unknown>(STORAGE_KEY, []);
  return Array.isArray(value) ? value.filter((item): item is FavoriteGroup =>
    item && typeof item.id === 'string' && typeof item.name === 'string'
    && typeof item.scheduleType === 'string' && (item.label === undefined || typeof item.label === 'string') && Array.isArray(item.path)
    && item.path.every((part: unknown) => typeof part === 'string')) : [];
}

function save(favorites: FavoriteGroup[]): FavoriteGroup[] {
  writeStorage(STORAGE_KEY, favorites);
  window.dispatchEvent(new Event(PLANS_CHANGED));
  return favorites;
}

export function addFavorite(group: FavoriteGroup): FavoriteGroup[] {
  const favorites = getFavorites();
  const existing = favorites.find(p => planKey(p) === planKey(group));
  if (!existing) return save([...favorites, group]);
  const updated = { ...existing, ...group, label: existing.label };
  return JSON.stringify(existing) === JSON.stringify(updated) ? favorites : save(favorites.map(p => planKey(p) === planKey(group) ? updated : p));
}

export function removeFavorite(id: string, type?: string): FavoriteGroup[] {
  return save(getFavorites().filter(p => p.id !== id || (type !== undefined && p.scheduleType !== type)));
}

export function isFavorite(id: string, type?: string): boolean {
  return getFavorites().some(p => p.id === id && (type === undefined || p.scheduleType === type));
}

export function renameFavorite(id: string, type: string, label: string): void {
  save(getFavorites().map(p => p.id === id && p.scheduleType === type ? { ...p, label: label.trim().slice(0, 80) || undefined } : p));
}
