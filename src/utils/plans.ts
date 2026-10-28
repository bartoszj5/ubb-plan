import type { FavoriteGroup } from '../types/index.ts';
import { readStorage, writeStorage } from './storage.ts';

export const PLANS_CHANGED = 'ubb-plans-changed';
const MY_PLAN = 'ubb-my-plan:v1';
const RECENT_PLANS = 'ubb-recent-plans:v1';

export function planKey(plan: { id: string; scheduleType: string }): string { return `${plan.scheduleType}:${plan.id}`; }

function validPlan(value: unknown): value is FavoriteGroup {
  if (!value || typeof value !== 'object') return false;
  const plan = value as Partial<FavoriteGroup>;
  return typeof plan.id === 'string' && typeof plan.scheduleType === 'string'
    && typeof plan.name === 'string' && (plan.label === undefined || typeof plan.label === 'string')
    && Array.isArray(plan.path) && plan.path.every(p => typeof p === 'string');
}

export function getMyPlan(): FavoriteGroup | null {
  const plan = readStorage<unknown>(MY_PLAN, null);
  return validPlan(plan) ? plan : null;
}

export function setMyPlan(plan: FavoriteGroup | null): void {
  writeStorage(MY_PLAN, plan);
  window.dispatchEvent(new Event(PLANS_CHANGED));
}

export function getRecentPlans(): FavoriteGroup[] {
  const plans = readStorage<unknown>(RECENT_PLANS, []);
  return Array.isArray(plans) ? plans.filter(validPlan).slice(0, 8) : [];
}

export function recordRecentPlan(plan: FavoriteGroup): void {
  const previous = getRecentPlans();
  const next = [plan, ...previous.filter(p => planKey(p) !== planKey(plan))].slice(0, 8);
  if (JSON.stringify(previous) === JSON.stringify(next)) return;
  writeStorage(RECENT_PLANS, next);
  window.dispatchEvent(new Event(PLANS_CHANGED));
}

export interface PlanView { weekStart: string; day: number; scrollTop: number }

export function getPlanView(key: string): PlanView | null {
  const view = readStorage<Partial<PlanView> | null>(`ubb-plan-view:v1:${key}`, null, true);
  if (!view || typeof view.weekStart !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(view.weekStart)
    || !Number.isFinite(new Date(`${view.weekStart}T00:00:00`).getTime())
    || !Number.isInteger(view.day) || view.day! < 0 || view.day! > 6
    || typeof view.scrollTop !== 'number' || !Number.isFinite(view.scrollTop) || view.scrollTop < 0) return null;
  return view as PlanView;
}

export function savePlanView(key: string, view: PlanView): void { writeStorage(`ubb-plan-view:v1:${key}`, view, true); }

export function getPlanPresentation(name: string, path: string[] = [], type = '0') {
  if (type === '20') return { title: `Sala ${name}`, subtitle: 'Plan sali', code: name };
  if (type === '10') return { title: name, subtitle: 'Plan prowadzącego', code: name };
  const match = name.match(/^([^/]+)\/(S|NZ|NW)\/(I{1,3})st\/(\d+)sem(?:\/(\d+)gr)?(.*)$/);
  if (!match) return { title: name, subtitle: path.slice(-2).filter(p => p !== name).join(' · ') || 'Plan grupy', code: name };
  const direction = path.find(p => /\s(?:S|NZ|NW)$/.test(p) && !p.includes('/'))?.replace(/\s(?:S|NZ|NW)$/, '');
  if (!direction) return { title: name, subtitle: 'Plan grupy', code: name };
  const [, , mode, degree, semester, group, suffix] = match;
  const details = [`${degree} stopień`, `semestr ${semester}`, { S: 'stacjonarne', NZ: 'zaoczne', NW: 'wieczorowe' }[mode]];
  if (suffix) details.push(suffix.split('/').filter(Boolean).join(' · '));
  return { title: `${direction}${group ? ` · grupa ${group}` : ''}`, subtitle: details.join(' · '), code: name };
}
