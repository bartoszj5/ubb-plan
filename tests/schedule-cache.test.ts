import test from 'node:test';
import assert from 'node:assert/strict';
import { getSessionCache, setSessionCache } from '../src/utils/cache.ts';
import { fetchSchedule, SCHEDULE_CACHE_TTL } from '../src/utils/api.ts';

test('schedule cache expires, refresh bypasses caches, and cancelled requests cannot overwrite data', async t => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() { return store.size; },
  };
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'sessionStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
  });
  let now = 1_800_000_000_000;
  t.mock.method(Date, 'now', () => now);

  setSessionCache('test', ['old']);
  assert.deepEqual(getSessionCache('test', SCHEDULE_CACHE_TTL), { data: ['old'], timestamp: now });
  now += SCHEDULE_CACHE_TTL;
  assert.equal(getSessionCache('test', SCHEDULE_CACHE_TTL), null);
  assert.equal(store.has('test'), false);
  store.set('legacy', JSON.stringify(['untimed']));
  assert.equal(getSessionCache('legacy', SCHEDULE_CACHE_TTL), null);

  const requests: { url: string; options?: RequestInit }[] = [];
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url: string, options?: RequestInit) => {
    requests.push({ url, options });
    return new Response(JSON.stringify([{ room: 'L152' }]), {
      headers: { 'X-UBB-Fetched-At': String(now - 1_000) },
    });
  });
  const first = await fetchSchedule('0', '123', 790);
  assert.equal(first.events[0].room, 'L152');
  assert.equal(first.fetchedAt, now - 1_000);
  assert.deepEqual(await fetchSchedule('0', '123', 790), first);
  assert.equal(requests.length, 1);
  now += SCHEDULE_CACHE_TTL;
  await fetchSchedule('0', '123', 790);
  assert.equal(requests.length, 2);
  await fetchSchedule('0', '123', 790, { forceRefresh: true });
  assert.equal(requests.length, 3);
  assert.match(requests[2].url, /[?&]refresh=/);
  assert.equal(requests[2].options?.cache, 'no-store');

  // Even a transport that completes after cancellation cannot overwrite the cached plan.
  let finishBody!: (events: unknown) => void;
  fetchMock.mock.mockImplementation(async () => ({
    ok: true,
    json: () => new Promise(resolve => { finishBody = resolve; }),
  } as Response));
  const controller = new AbortController();
  const cancelled = fetchSchedule('0', '123', 790, { signal: controller.signal, forceRefresh: true });
  await Promise.resolve();
  controller.abort();
  finishBody([{ room: 'WRONG' }]);
  await assert.rejects(cancelled, { name: 'AbortError' });
  assert.deepEqual(await fetchSchedule('0', '123', 790), {
    events: [{ room: 'L152' }], fetchedAt: now - 1_000,
  });

  fetchMock.mock.mockImplementation(async () => new Response('Unavailable', { status: 502 }));
  await assert.rejects(fetchSchedule('0', '123', 790, { forceRefresh: true }), /UBB/);
  assert.equal((await fetchSchedule('0', '123', 790)).events[0].room, 'L152');

  fetchMock.mock.mockImplementation(async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(fetchSchedule('0', '123', 790, { forceRefresh: true }), /Sprawdź połączenie/);
});

test('unavailable browser storage does not prevent displaying a downloaded plan', t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    get() { throw new Error('Storage disabled'); },
  });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'sessionStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
  });
  assert.equal(getSessionCache('test', SCHEDULE_CACHE_TTL), null);
  assert.doesNotThrow(() => setSessionCache('test', []));
});
