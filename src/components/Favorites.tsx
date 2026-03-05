import type { FavoriteGroup } from '../types';
import { StarOutlineIcon, XIcon, StarIcon } from './Icons';
import './Favorites.css';

interface FavoritesProps {
  favorites: FavoriteGroup[];
  onSelect: (favorite: FavoriteGroup) => void;
  onRemove: (id: string) => void;
}

export default function Favorites({ favorites, onSelect, onRemove }: FavoritesProps) {
  if (favorites.length === 0) {
    return (
      <div className="favorites-empty">
        <span className="favorites-icon"><StarOutlineIcon size={24} /></span>
        <p>Brak ulubionych grup</p>
        <small>Dodaj plan do ulubionych klikając ikonkę gwiazdki</small>
      </div>
    );
  }

  return (
    <div className="favorites-list" role="list">
      <h3><StarIcon size={12} /> Ulubione</h3>
      {favorites.map(fav => (
        <div key={fav.id} className="favorite-item" role="listitem">
          <div
            className="favorite-info"
            onClick={() => onSelect(fav)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(fav); }}}
          >
            <span className="favorite-name">{fav.name}</span>
            <span className="favorite-path">{fav.path.slice(0, -1).join(' > ')}</span>
          </div>
          <button
            className="remove-btn"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(fav.id);
            }}
            aria-label={`Usuń ${fav.name} z ulubionych`}
          >
            <XIcon size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
