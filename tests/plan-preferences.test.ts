import test from 'node:test';
import assert from 'node:assert/strict';
import { getMyPlan, setMyPlan, getRecentPlans, recordRecentPlan, getPlanView, savePlanView } from '../src/utils/plans.ts';
import { addFavorite, getFavorites, removeFavorite, renameFavorite } from '../src/utils/favorites.ts';
import { getGroupMeta, saveGroupMeta } from '../src/utils/groupMeta.ts';

test('own plan, favorites, history and viewing context remain independent and preserve typed IDs', t => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  for (const name of ['localStorage', 'sessionStorage', 'window'] as const) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value: name === 'window' ? new EventTarget() : storage });
    t.after(() => { if (previous) Object.defineProperty(globalThis, name, previous); else Reflect.deleteProperty(globalThis, name); });
  }
  const group = { id: '1', scheduleType: '0', name: 'Grupa', path: ['Grupy'] };
  const room = { id: '1', scheduleType: '20', name: 'B312', path: ['Sale'] };
  setMyPlan(group); recordRecentPlan(room); addFavorite(group); addFavorite(room);
  assert.deepEqual(getMyPlan(), group);
  assert.deepEqual(getRecentPlans(), [room]);
  assert.equal(getFavorites().length, 2);
  renameFavorite(group.id, '0', 'Mój skrót');
  assert.equal(getFavorites()[0].label, 'Mój skrót');
  removeFavorite(group.id, '0');
  assert.deepEqual(getFavorites(), [room]);
  assert.deepEqual(getMyPlan(), group);
  saveGroupMeta('1', { name: 'Grupa', type: '0', path: ['Grupy'] });
  saveGroupMeta('1', { name: 'B312', type: '20', path: ['Sale'] });
  assert.equal(getGroupMeta('1', '0')?.name, 'Grupa');
  assert.equal(getGroupMeta('1', '20')?.name, 'B312');
  savePlanView('0:1', { weekStart: '2026-10-26', day: 3, scrollTop: 420 });
  assert.deepEqual(getPlanView('0:1'), { weekStart: '2026-10-26', day: 3, scrollTop: 420 });
  assert.equal(getPlanView('20:1'), null);
  values.set('ubb-plan-view:v1:0:1', JSON.stringify({ weekStart: 'bad', day: 8, scrollTop: -1 }));
  assert.equal(getPlanView('0:1'), null);
  values.set('ubb-plan-favorites', '{broken');
  assert.deepEqual(getFavorites(), []);
  values.set('ubb-my-plan:v1', JSON.stringify({ ...group, path: [null] }));
  assert.equal(getMyPlan(), null);
});
