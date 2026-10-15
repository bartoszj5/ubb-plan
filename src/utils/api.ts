import {
  getMemoryCache, setMemoryCache,
  getSessionCache, setSessionCache,
  getTreeIndexCache, setTreeIndexCache
} from './cache.ts';
import type { ScheduleEvent } from '../types';

const API_BASE = import.meta.env?.VITE_API_URL || '';
const ONE_HOUR = 60 * 60 * 1000;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
export const SCHEDULE_CACHE_TTL = 5 * 60 * 1000;
const SCHEDULE_UNAVAILABLE = 'Serwis planów UBB jest chwilowo niedostępny. Sprawdź połączenie i spróbuj ponownie później.';

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

export async function fetchTreeIndex(signal?: AbortSignal) {
  signal?.throwIfAborted();
  const MEM_KEY = 'ubb-tree-index';
  const memCached = getMemoryCache(MEM_KEY, TWENTY_FOUR_HOURS);
  if (memCached) return memCached;

  const lsCached = getTreeIndexCache();
  if (lsCached) {
    setMemoryCache(MEM_KEY, lsCached);
    return lsCached;
  }

  const response = await fetch(`${API_BASE}/api/tree-index`, { signal });
  if (!response.ok) throw new Error('Failed to fetch tree index');
  const data = await response.json();
  signal?.throwIfAborted();
  setMemoryCache(MEM_KEY, data);
  setTreeIndexCache(data);
  return data;
}

export async function fetchGroupInfo(type: string, id: string, signal?: AbortSignal): Promise<{ name: string; path: string[] }> {
  signal?.throwIfAborted();
  const CACHE_KEY = `ubb-group-info:${type}:${id}`;
  const cached = getMemoryCache<{ name: string; path: string[] }>(CACHE_KEY, TWENTY_FOUR_HOURS);
  if (cached) return cached;

  const response = await fetch(`${API_BASE}/api/group-info/${type}/${id}`, { signal });
  if (!response.ok) throw new Error('Failed to fetch group info');
  const data = await response.json();
  signal?.throwIfAborted();
  setMemoryCache(CACHE_KEY, data);
  return data;
}

export interface SearchResult {
  id: string;
  name: string;
  scheduleType: string;
  resultType: 'teacher' | 'group' | 'room';
}

export async function searchPlans(query: string, type?: string, signal?: AbortSignal): Promise<SearchResult[]> {
  signal?.throwIfAborted();
  if (query.length < 2) return [];

  let url = `${API_BASE}/api/search?q=${encodeURIComponent(query)}`;
  if (type) url += `&type=${encodeURIComponent(type)}`;

  const response = await fetch(url, { signal });
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

export interface ScheduleData {
  events: ScheduleEvent[];
  fetchedAt: number;
}

export async function fetchSchedule(
  type: string,
  id: string,
  week?: number,
  options: { signal?: AbortSignal; forceRefresh?: boolean } = {},
): Promise<ScheduleData> {
  const { signal, forceRefresh = false } = options;
  signal?.throwIfAborted();
  const CACHE_KEY = `ubb-schedule:v3:${type}:${id}:${week ?? 'current'}`;
  const cached = forceRefresh ? null : getSessionCache<ScheduleEvent[]>(CACHE_KEY, SCHEDULE_CACHE_TTL);
  if (cached) return { events: cached.data, fetchedAt: cached.timestamp };

  const params = new URLSearchParams();
  if (week !== undefined) params.set('week', String(week));
  // A distinct URL also bypasses the CDN cache and the service worker's offline fallback.
  if (forceRefresh) params.set('refresh', String(Date.now()));
  const url = `${API_BASE}/api/schedule/${type}/${id}?${params}`;
  let response: Response;
  try {
    response = await fetch(url, { signal, cache: forceRefresh ? 'no-store' : 'default' });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(SCHEDULE_UNAVAILABLE, { cause: error });
  }
  if (!response.ok) throw new Error(SCHEDULE_UNAVAILABLE);
  const events: ScheduleEvent[] = await response.json();
  signal?.throwIfAborted();
  const upstreamTimestamp = Number(response.headers.get('X-UBB-Fetched-At'));
  const fetchedAt = upstreamTimestamp > 0 && Number.isFinite(upstreamTimestamp) ? upstreamTimestamp : Date.now();
  setSessionCache(CACHE_KEY, events, fetchedAt);
  return { events, fetchedAt };
}
