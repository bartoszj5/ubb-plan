import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchIcon, CalendarIcon, UserIcon, XIcon } from './Icons';
import { fetchTreeIndex, searchPlans } from '../utils/api';
import { saveGroupMeta } from '../utils/groupMeta';
import './CommandPalette.css';

interface SearchResult {
  id: string;
  name: string;
  type: 'faculty' | 'branch' | 'schedule';
  scheduleType: string | null;
  hasChildren: boolean;
  path: string[];
  resultType?: 'teacher' | 'group' | 'room';
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const term = query.toLowerCase();

        // Search tree index (groups) and UBB search API (teachers) in parallel
        const [treeIndex, teacherResults] = await Promise.all([
          fetchTreeIndex() as Promise<SearchResult[]>,
          searchPlans(query, 'teacher').catch(() => []),
        ]);

        const filtered = treeIndex
          .filter(node => {
            if (node.name.toLowerCase().includes(term)) return true;
            const pathWithoutFaculty = node.path.slice(1);
            return pathWithoutFaculty.some(p => p.toLowerCase().includes(term));
          })
          .filter(node => node.scheduleType)
          .sort((a, b) => {
            const aName = a.name.toLowerCase().includes(term) ? 0 : 1;
            const bName = b.name.toLowerCase().includes(term) ? 0 : 1;
            if (aName !== bName) return aName - bName;
            return a.name.localeCompare(b.name, 'pl');
          })
          .slice(0, 15)
          .map(node => ({ ...node, resultType: 'group' as const }));

        // Convert teacher results to SearchResult format
        const teachers: SearchResult[] = teacherResults.map(t => ({
          id: t.id,
          name: t.name,
          type: 'schedule' as const,
          scheduleType: t.scheduleType,
          hasChildren: false,
          path: ['Nauczyciele'],
          resultType: 'teacher' as const,
        }));

        // Combine: teachers first if query looks like a name, otherwise groups first
        const combined = [...teachers, ...filtered].slice(0, 20);
        setResults(combined);
        setSelectedIndex(0);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = useCallback((result: SearchResult) => {
    if (result.scheduleType) {
      saveGroupMeta(result.id, {
        name: result.name,
        path: result.path,
        type: result.scheduleType,
      });
      navigate(`/plan/${result.scheduleType}/${result.id}`);
      onClose();
    }
  }, [navigate, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [results, selectedIndex, handleSelect, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const container = resultsRef.current;
    if (!container) return;
    const selected = container.children[selectedIndex] as HTMLElement;
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd-palette" onClick={e => e.stopPropagation()}>
        <div className="cmd-input-wrap">
          <SearchIcon size={16} className="cmd-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="cmd-input"
            placeholder="Szukaj grupy, nauczyciela, kierunku..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Wyszukaj plan"
          />
          {query && (
            <button className="cmd-clear" onClick={() => setQuery('')}>
              <XIcon size={14} />
            </button>
          )}
          <kbd className="cmd-esc">ESC</kbd>
        </div>

        {(results.length > 0 || loading || query.length >= 2) && (
          <div className="cmd-results" ref={resultsRef}>
            {loading && results.length === 0 ? (
              <div className="cmd-loading">Wyszukiwanie...</div>
            ) : results.length > 0 ? (
              results.map((result, i) => (
                <div
                  key={`${result.resultType}-${result.id}`}
                  className={`cmd-result ${i === selectedIndex ? 'selected' : ''}`}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  {result.resultType === 'teacher' ? (
                    <UserIcon size={14} className="cmd-result-icon" />
                  ) : (
                    <CalendarIcon size={14} className="cmd-result-icon" />
                  )}
                  <div className="cmd-result-info">
                    <span className="cmd-result-name">{result.name}</span>
                    <span className="cmd-result-path">
                      {result.resultType === 'teacher'
                        ? 'Nauczyciel'
                        : result.path.slice(0, -1).join(' \u203A ')}
                    </span>
                  </div>
                  <kbd className="cmd-result-hint">{'\u23CE'}</kbd>
                </div>
              ))
            ) : query.length >= 2 ? (
              <div className="cmd-empty">Brak wynikow dla &ldquo;{query}&rdquo;</div>
            ) : null}
          </div>
        )}

        <div className="cmd-footer">
          <span><kbd>{'\u2191'}</kbd><kbd>{'\u2193'}</kbd> nawigacja</span>
          <span><kbd>{'\u23CE'}</kbd> wybierz</span>
          <span><kbd>ESC</kbd> zamknij</span>
        </div>
      </div>
    </div>
  );
}
