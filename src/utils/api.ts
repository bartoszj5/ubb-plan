import {
  getMemoryCache, setMemoryCache,
  getSessionCache, setSessionCache,
  getTreeIndexCache, setTreeIndexCache
} from './cache';

const API_BASE = import.meta.env.VITE_API_URL || '';
const ONE_HOUR = 60 * 60 * 1000;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export async function fetchFaculties() {
  const CACHE_KEY = 'ubb-faculties';
  const cached = getMemoryCache(CACHE_KEY, ONE_HOUR);
  if (cached) return cached;

  const response = await fetch(`${API_BASE}/api/faculties`);
  if (!response.ok) throw new Error('Failed to fetch faculties');
  const data = await response.json();
  setMemoryCache(CACHE_KEY, data);
  return data;
}

export async function fetchTreeBranch(branch: string, type: number = 1) {
  const CACHE_KEY = `ubb-tree-branch:${type}:${branch}`;
  const cached = getMemoryCache(CACHE_KEY, ONE_HOUR);
  if (cached) return cached;

  const response = await fetch(
    `${API_BASE}/api/tree?type=${type}&branch=${branch}&link=0&iPos=0`
  );
  if (!response.ok) throw new Error('Failed to fetch tree branch');
  const data = await response.json();
  setMemoryCache(CACHE_KEY, data);
  return data;
}

export async function fetchTreeIndex() {
  const MEM_KEY = 'ubb-tree-index';
  const memCached = getMemoryCache(MEM_KEY, TWENTY_FOUR_HOURS);
  if (memCached) return memCached;

  const lsCached = getTreeIndexCache();
  if (lsCached) {
    setMemoryCache(MEM_KEY, lsCached);
    return lsCached;
  }

  const response = await fetch(`${API_BASE}/api/tree-index`);
  if (!response.ok) throw new Error('Failed to fetch tree index');
  const data = await response.json();
  setMemoryCache(MEM_KEY, data);
  setTreeIndexCache(data);
  return data;
}

export async function fetchGroupInfo(type: string, id: string): Promise<{ name: string; path: string[] }> {
  const CACHE_KEY = `ubb-group-info:${type}:${id}`;
  const cached = getMemoryCache<{ name: string; path: string[] }>(CACHE_KEY, TWENTY_FOUR_HOURS);
  if (cached) return cached;

  const response = await fetch(`${API_BASE}/api/group-info/${type}/${id}`);
  if (!response.ok) throw new Error('Failed to fetch group info');
  const data = await response.json();
  setMemoryCache(CACHE_KEY, data);
  return data;
}

export interface SearchResult {
  id: string;
  name: string;
  scheduleType: string;
  resultType: 'teacher' | 'group' | 'room';
}

export async function searchPlans(query: string, type?: string): Promise<SearchResult[]> {
  if (query.length < 2) return [];

  let url = `${API_BASE}/api/search?q=${encodeURIComponent(query)}`;
  if (type) url += `&type=${encodeURIComponent(type)}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error('Search failed');
  return response.json();
}

export interface Notice {
  title: string;
  description: string;
  items: string[];
}

export async function fetchNotices(): Promise<Notice[]> {
  const CACHE_KEY = 'ubb-notices';
  const cached = getMemoryCache<Notice[]>(CACHE_KEY, ONE_HOUR);
  if (cached) return cached;

  const response = await fetch(`${API_BASE}/api/notices`);
  if (!response.ok) throw new Error('Failed to fetch notices');
  const data = await response.json();
  setMemoryCache(CACHE_KEY, data);
  return data;
}

export async function fetchSchedule(type: string, id: string, week?: number) {
  const CACHE_KEY = `ubb-schedule:${type}:${id}:${week || 'current'}`;
  const cached = getSessionCache(CACHE_KEY);
  if (cached) return cached;

  let url = `${API_BASE}/api/schedule/${type}/${id}`;
  if (week) {
    url += `?week=${week}`;
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch schedule');
  const data = await response.json();
  setSessionCache(CACHE_KEY, data);
  return data;
}
