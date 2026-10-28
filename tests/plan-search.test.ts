import test from 'node:test';
import assert from 'node:assert/strict';
import { findPlans } from '../src/utils/search.ts';

test('available room results appear before slow sources, with partial failures distinguished from no matches', async t => {
  let finishTeachers!: (value: Response) => void;
  const teachers = new Promise<Response>(resolve => { finishTeachers = resolve; });
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    if (url.includes('type=teacher')) return teachers;
    if (url.includes('type=room')) return new Response(JSON.stringify([{ id: '1', name: 'B312', scheduleType: '20' }]));
    return new Response('Unavailable', { status: 502 });
  });
  const partials: string[][] = [];
  let sawRoom!: () => void;
  const available = new Promise<void>(resolve => { sawRoom = resolve; });
  const pending = findPlans('B312', 'all', new AbortController().signal, data => {
    partials.push(data.results.map(result => result.name));
    if (data.results.length) sawRoom();
  });
  await available;
  assert.ok(partials.some(names => names.includes('B312')));
  finishTeachers(new Response('Unavailable', { status: 502 }));
  const result = await pending;
  assert.equal(result.results[0].name, 'B312');
  assert.deepEqual(result.errors.sort(), ['grup', 'grup z wyszukiwarki UBB', 'prowadzących']);
});

test('a cancelled search does not publish late results', async t => {
  let finish!: (value: Response) => void;
  t.mock.method(globalThis, 'fetch', () => new Promise<Response>(resolve => { finish = resolve; }));
  const controller = new AbortController();
  const partials: unknown[] = [];
  const pending = findPlans('B312', 'room', controller.signal, data => partials.push(data));
  controller.abort();
  finish(new Response(JSON.stringify([{ id: '1', name: 'B312', scheduleType: '20' }])));
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(partials.length, 0);
});

test('specific group search resolves aggregate groups below the shallow semester index', async t => {
  const paths = ['Wydział Budowy Maszyn i Informatyki', 'Stacjonarne', 'Informatyka S', 'Inf/S/ II stopień', 'Inf/S/IIst/2sem'];
  const requests: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    requests.push(url);
    if (url.includes('/api/tree-index')) return new Response(JSON.stringify([{ id: 'parent', name: 'Inf/S/IIst/2sem', scheduleType: '2', path: paths, hasChildren: true }]));
    if (url.includes('/api/tree?')) return new Response(JSON.stringify([{ id: 'aggregate', name: 'Inf/S/IIst/2sem/2gr', scheduleType: '0', hasChildren: true }]));
    return new Response(JSON.stringify([{ id: 'child', name: 'Inf/S/IIst/2sem/2gr/a/TTO', scheduleType: '0' }]));
  });
  const result = await findPlans('Inf/S/IIst/2sem/2gr', 'group', new AbortController().signal);
  assert.equal(result.results[0].id, 'aggregate');
  assert.deepEqual(result.results[0].path, [...paths, 'Inf/S/IIst/2sem/2gr']);
  assert.equal(result.results[1].id, 'child');
  assert.ok(requests.some(url => url.includes('branch=parent')));
});
