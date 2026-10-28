import { useState } from 'react';
import type { FavoriteGroup } from '../types';
import { getPlanPresentation, planKey } from '../utils/plans';
import { renameFavorite } from '../utils/favorites';
import { StarOutlineIcon, MoreHorizontalIcon } from './Icons';
import './Favorites.css';

interface FavoritesProps {
  favorites: FavoriteGroup[];
  myPlan: FavoriteGroup | null;
  onSelect: (favorite: FavoriteGroup) => void;
  onRemove: (id: string, type: string) => void;
  activeKey: string;
}
export default function Favorites({ favorites, myPlan, onSelect, onRemove, activeKey }: FavoritesProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [options, setOptions] = useState<string | null>(null);
  const plans = myPlan ? [favorites.find(plan => planKey(plan) === planKey(myPlan)) ?? myPlan, ...favorites.filter(plan => planKey(plan) !== planKey(myPlan))] : favorites;
  if (!plans.length) return <div className="favorites-empty"><StarOutlineIcon size={20} /><p>Zapisz plan gwiazdką, aby mieć go pod ręką.</p></div>;
  return <ul className="favorites-list">{plans.map(plan => {
    const key = planKey(plan);
    const own = !!myPlan && planKey(myPlan) === key;
    const saved = favorites.some(favorite => planKey(favorite) === key);
    const display = getPlanPresentation(plan.name, plan.path, plan.scheduleType);
    return <li className="favorite-item" key={key}>
      <div className="favorite-main"><button type="button" className={`saved-plan ${own ? 'my-plan-link' : ''}`} title={`${plan.name} · ${display.subtitle}`} aria-current={activeKey === key ? 'page' : undefined} onClick={() => onSelect(plan)}>
        <span><strong>{plan.label || display.title}</strong><small>{own && <span className="own-plan-marker">Mój</span>}{display.subtitle}</small></span>
      </button>{saved && <button type="button" className="icon-button plan-actions-button" aria-label={`Opcje planu ${plan.label || display.title}`} aria-expanded={options === key} aria-controls={options === key ? `plan-actions-${key}` : undefined} onClick={() => setOptions(options === key ? null : key)}><MoreHorizontalIcon size={17} /></button>}</div>
      {options === key && <div className="favorite-actions" id={`plan-actions-${key}`} onKeyDown={e => { if (e.key === 'Escape') { setOptions(null); e.currentTarget.parentElement?.querySelector<HTMLButtonElement>('.plan-actions-button')?.focus(); } }}><button type="button" onClick={() => { setEditing(key); setLabel(plan.label || ''); setOptions(null); }}>Zmień nazwę</button><button type="button" onClick={() => { onRemove(plan.id, plan.scheduleType); setOptions(null); }}>Usuń z zapisanych</button></div>}

      {editing === key ? <form className="rename-form" onSubmit={e => { e.preventDefault(); renameFavorite(plan.id, plan.scheduleType, label); setEditing(null); }}>
        <label>Własna nazwa<input aria-label={`Własna nazwa dla ${plan.name}`} autoFocus maxLength={80} value={label} onChange={e => setLabel(e.target.value)} placeholder={display.title} /></label>
        <div><button type="submit" className="text-button">Zapisz nazwę</button><button type="button" className="text-button" onClick={() => setEditing(null)}>Anuluj</button></div>
      </form> : null}
    </li>;
  })}</ul>;
}
