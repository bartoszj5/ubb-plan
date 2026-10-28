import { useEffect, useId, useRef, useState } from 'react';
import type { FavoriteGroup } from '../types';
import { findPlans } from '../utils/search';
import type { PlanSearchResult, SearchKind } from '../utils/search';
import { getPlanPresentation, planKey } from '../utils/plans';
import { CalendarIcon, MapPinIcon, SearchIcon, UserIcon, XIcon, ChevronRightIcon } from './Icons';
import './CommandPalette.css';

interface PlanSearchProps {
  onSelect: (plan: FavoriteGroup) => void;
  favorites: FavoriteGroup[];
  recent: FavoriteGroup[];
  initialKind?: SearchKind;
  autoFocus?: boolean;
}
const FILTERS: { value: SearchKind; label: string }[] = [
  { value: 'all', label: 'Wszystko' }, { value: 'group', label: 'Grupy' },
  { value: 'teacher', label: 'Prowadzący' }, { value: 'room', label: 'Sale' },
];

export default function PlanSearch({ onSelect, favorites, recent, initialKind = 'all', autoFocus = false }: PlanSearchProps) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<SearchKind>(initialKind);
  const [data, setData] = useState<{ results: PlanSearchResult[]; errors: string[] }>({ results: [], errors: [] });
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [limit, setLimit] = useState(30);
  const [retry, setRetry] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const searching = query.trim().length >= 2;

  useEffect(() => {
    if (!searching) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      findPlans(query, kind, controller.signal, partial => {
        if (!controller.signal.aborted) setData(partial);
      }).then(result => {
        if (!controller.signal.aborted) setData(result);
      }).catch(() => {
        if (!controller.signal.aborted) setData({ results: [], errors: ['wyników'] });
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, kind, retry, searching]);

  function resetResults(pending = searching) {
    setData({ results: [], errors: [] }); setSelectedKey(null); setLimit(30); setLoading(pending);
  }
  const suggestions = [...favorites, ...recent.filter(p => !favorites.some(f => planKey(f) === planKey(p)))]
    .filter(p => kind === 'all' || (kind === 'teacher' ? p.scheduleType === '10' : kind === 'room' ? p.scheduleType === '20' : p.scheduleType !== '10' && p.scheduleType !== '20')).slice(0, 6);
  const visible = data.results.slice(0, limit);
  const selected = Math.max(0, visible.findIndex(plan => planKey(plan) === selectedKey));
  const count = data.results.length;
  const countLabel = count === 1 ? 'wynik' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'wyniki' : 'wyników';
  useEffect(() => { list.current?.children[selected]?.scrollIntoView({ block: 'nearest' }); }, [selected]);

  return <div className="plan-search" data-shortcuts-blocked>
    <label className="search-field">
      <SearchIcon size={21} />
      <input ref={input} data-autofocus={autoFocus ? '' : undefined} type="search" role="combobox"
        aria-label="Szukaj grupy, prowadzącego lub sali" aria-autocomplete="list" aria-expanded={searching && visible.length > 0}
        aria-controls={listId} aria-activedescendant={searching && visible[selected] ? `${listId}-${selected}` : undefined}
        placeholder="Kierunek, nazwisko lub sala…" value={query}
        onChange={e => { setQuery(e.target.value); resetResults(e.target.value.trim().length >= 2); }}
        onKeyDown={e => {
          if (!visible.length || !searching) return;
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault(); setSelectedKey(planKey(visible[(selected + (e.key === 'ArrowDown' ? 1 : -1) + visible.length) % visible.length]));
          } else if (e.key === 'Enter' && visible[selected]) { e.preventDefault(); onSelect(visible[selected]); }
        }} />
      {query && <button type="button" className="icon-button" aria-label="Wyczyść wyszukiwanie" onClick={() => { setQuery(''); resetResults(false); input.current?.focus(); }}><XIcon size={18} /></button>}
    </label>
    <div className="search-filters" role="group" aria-label="Rodzaj planu">
      {FILTERS.map(filter => <button type="button" key={filter.value} aria-pressed={kind === filter.value}
        onClick={() => { if (kind !== filter.value) { setKind(filter.value); resetResults(); } input.current?.focus(); }}>{filter.label}</button>)}
    </div>
    <div className="search-status" role="status" aria-live="polite">
      {searching ? loading ? count ? `${count} ${countLabel} · szukanie pozostałych…` : 'Wyszukiwanie…' : `${count} ${countLabel}${count > limit ? ` · pokazano ${limit}` : ''}`
        : query.trim() ? 'Wpisz co najmniej 2 znaki.' : 'Wpisz np. Informatyka, nazwisko prowadzącego lub B312.'}
    </div>
    {searching && data.errors.length > 0 && <div className="search-warning" role="alert">
      <span>Nie udało się pobrać {data.errors.join(', ')}.{data.results.length > 0 ? ' Pozostałe wyniki są dostępne.' : ''}</span>
      <button type="button" className="text-button" onClick={() => { resetResults(); setRetry(n => n + 1); }}>Spróbuj ponownie</button>
    </div>}
    {searching ? <>
      <ul ref={list} id={listId} className="search-results" role="listbox" aria-label="Znalezione plany" aria-busy={loading}>
        {visible.map((plan, i) => {
          const presentation = getPlanPresentation(plan.name, plan.path, plan.scheduleType);
          const Icon = plan.resultType === 'teacher' ? UserIcon : plan.resultType === 'room' ? MapPinIcon : CalendarIcon;
          return <li key={planKey(plan)} id={`${listId}-${i}`} role="option" aria-selected={selected === i}
            className={`search-result ${selected === i ? 'selected' : ''}`} onMouseEnter={() => setSelectedKey(planKey(plan))}
            onMouseDown={e => e.preventDefault()} onClick={() => onSelect(plan)}>
            <Icon size={20} /><span className="search-result-copy"><strong>{presentation.title}</strong><span>{presentation.subtitle}</span>
              {presentation.title !== plan.name && <small>{plan.name}</small>}</span><ChevronRightIcon size={17} />
          </li>;
        })}
      </ul>
      {!loading && !data.errors.length && !visible.length && <div className="search-empty"><strong>Nie znaleziono planu „{query.trim()}”</strong><p>Spróbuj krótszej nazwy lub zmień rodzaj planu.</p></div>}
      {data.results.length > limit && <button type="button" className="secondary-button more-results" onClick={() => setLimit(n => n + 30)}>Pokaż kolejne wyniki</button>}
    </> : suggestions.length > 0 && <div className="search-suggestions"><h3>Zapisane i ostatnio oglądane</h3>
      {suggestions.map(plan => {
        const display = getPlanPresentation(plan.name, plan.path, plan.scheduleType);
        return <button type="button" key={planKey(plan)} className="suggested-plan" onClick={() => onSelect(plan)}>
          <CalendarIcon size={18} /><span><strong>{plan.label || display.title}</strong><small>{display.subtitle}</small></span><ChevronRightIcon size={16} />
        </button>;
      })}
    </div>}
  </div>;
}
