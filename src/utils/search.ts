import { fetchTreeIndex, fetchTreeBranch, searchPlans } from './api.ts';
import type { FavoriteGroup } from '../types/index.ts';
import { getPlanPresentation, planKey } from './plans.ts';

export type SearchKind = 'all' | 'group' | 'teacher' | 'room';
export interface PlanSearchResult extends FavoriteGroup { resultType: Exclude<SearchKind, 'all'> }
interface IndexNode { id: string; name: string; scheduleType: string | null; path: string[]; hasChildren?: boolean }

export interface PlanSearchData { results: PlanSearchResult[]; errors: string[] }
export async function findPlans(query: string, kind: SearchKind, signal: AbortSignal, onPartial?: (data: PlanSearchData) => void) {
  const term = query.trim().toLocaleLowerCase('pl');
  let groupIndex: IndexNode[] = [];
  const tasks: { label: string; request: Promise<PlanSearchResult[]> }[] = [];
  if (kind === 'all' || kind === 'group') tasks.push({ label: 'grup', request: (async () => {
    const index = await fetchTreeIndex(signal) as IndexNode[];
    groupIndex = index;
    const matches = index.filter(node => {
      if (!node.scheduleType) return false;
      const display = getPlanPresentation(node.name, node.path, node.scheduleType);
      const searchable = [node.name, ...node.path.slice(1), display.title, display.subtitle].join(' ').toLocaleLowerCase('pl');
      return term.split(/\s+/).every(token => searchable.includes(token));
    }).map(node => ({ id: node.id, name: node.name, path: node.path, scheduleType: node.scheduleType!, resultType: 'group' as const }));
    // The index stops at semesters. Resolve only the matching parent for a specific group code;
    // UBB's search omits aggregate group plans even when their children are searchable.
    if (/\/\d+gr/i.test(query)) {
      const parent = index.filter(node => node.hasChildren && node.scheduleType && term.startsWith(`${node.name.toLocaleLowerCase('pl')}/`))
        .sort((a, b) => b.name.length - a.name.length)[0];
      if (parent) {
        const children = await fetchTreeBranch(parent.id);
        signal.throwIfAborted();
        matches.push(...children.filter((node: { name: string; scheduleType?: string }) => node.scheduleType && node.name.toLocaleLowerCase('pl').includes(term))
          .map((node: { id: string; name: string; scheduleType: string }) => ({ ...node, path: [...parent.path, node.name], resultType: 'group' as const })));
      }
    }
    return matches;
  })() });
  if (kind === 'all' || kind === 'group') tasks.push({ label: 'grup z wyszukiwarki UBB', request: searchPlans(query.trim(), 'group', signal).then(results => results.map(item => ({
    ...item, path: ['Grupy', item.name], resultType: 'group' as const,
  }))) });
  for (const type of ['teacher', 'room'] as const) {
    if (kind !== 'all' && kind !== type) continue;
    tasks.push({ label: type === 'teacher' ? 'prowadzących' : 'sal', request: searchPlans(query.trim(), type, signal).then(results => results.map(item => ({
      ...item, path: [type === 'teacher' ? 'Prowadzący' : 'Sale', item.name], resultType: type,
    }))) });
  }
  const errors: string[] = [];
  const unique = new Map<string, PlanSearchResult>();
  const snapshot = (): PlanSearchData => ({ results: [...unique.values()].map(plan => {
    if (plan.resultType !== 'group' || plan.path[0] !== 'Grupy') return plan;
    const parent = groupIndex.filter(node => node.scheduleType && (node.name === plan.name || plan.name.startsWith(`${node.name}/`)))
      .sort((a, b) => b.name.length - a.name.length)[0];
    return parent ? { ...plan, path: parent.name === plan.name ? parent.path : [...parent.path, plan.name] } : plan;
  }).sort((a, b) => {
    const rank = (p: PlanSearchResult) => {
      const name = p.name.toLocaleLowerCase('pl');
      const title = getPlanPresentation(p.name, p.path, p.scheduleType).title.toLocaleLowerCase('pl');
      return name === term || title === term ? 0 : name.includes(term) || title.includes(term) ? 1 : 2;
    };
    return rank(a) - rank(b) || a.name.localeCompare(b.name, 'pl', { numeric: true });
  }), errors: [...errors] });
  await Promise.all(tasks.map(async task => {
    try {
      const plans = await task.request;
      signal.throwIfAborted();
      plans.forEach(plan => unique.set(planKey(plan), plan));
    } catch (error) {
      if (signal.aborted) throw error;
      errors.push(task.label);
    }
    onPartial?.(snapshot());
  }));
  signal.throwIfAborted();
  return snapshot();
}
