import type { FavoriteGroup } from '../types';
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
        <span className="favorites-icon">⭐</span>
        <p>Brak ulubionych grup</p>
        <small>Kliknij ★ przy planie, aby dodać do ulubionych</small>
      </div>
    );
  }

  return (
    <div className="favorites-list">
      <h3>⭐ Ulubione</h3>
      {favorites.map(fav => (
        <div key={fav.id} className="favorite-item">
          <div 
            className="favorite-info"
            onClick={() => onSelect(fav)}
          >
            <span className="favorite-name">{fav.name}</span>
            <span className="favorite-path">{fav.path.slice(0, -1).join(' › ')}</span>
          </div>
          <button 
            className="remove-btn"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(fav.id);
            }}
            title="Usuń z ulubionych"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
