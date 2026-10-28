import type { FavoriteGroup } from '../types';
import type { SearchKind } from '../utils/search';
import Dialog from './Dialog';
import PlanSearch from './PlanSearch';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (plan: FavoriteGroup) => void;
  favorites: FavoriteGroup[];
  recent: FavoriteGroup[];
  initialKind?: SearchKind;
}
export default function CommandPalette({ isOpen, onClose, ...props }: CommandPaletteProps) {
  if (!isOpen) return null;
  return <Dialog title="Znajdź plan" onClose={onClose} className="search-dialog">
    <PlanSearch {...props} autoFocus />
  </Dialog>;
}
