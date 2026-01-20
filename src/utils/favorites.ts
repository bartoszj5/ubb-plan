import type { FavoriteGroup } from '../types';

const STORAGE_KEY = 'ubb-plan-favorites';

export function getFavorites(): FavoriteGroup[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addFavorite(group: FavoriteGroup): FavoriteGroup[] {
  const favorites = getFavorites();
  if (!favorites.find(f => f.id === group.id)) {
    favorites.push(group);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  }
  return favorites;
}

export function removeFavorite(id: string): FavoriteGroup[] {
  const favorites = getFavorites().filter(f => f.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  return favorites;
}

export function isFavorite(id: string): boolean {
  return getFavorites().some(f => f.id === id);
}
