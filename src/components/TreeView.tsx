import { useEffect, useRef, useState } from 'react';
import type { TreeNode } from '../types';
import { fetchFaculties, fetchTreeBranch } from '../utils/api';
import { BuildingIcon, CalendarIcon, ChevronLeftIcon, ChevronRightIcon, FolderIcon } from './Icons';
import './TreeView.css';

interface TreeViewProps {
  onSelectSchedule: (type: string, id: string, name: string, path: string[]) => void;
}
export default function TreeView({ onSelectSchedule }: TreeViewProps) {
  const [path, setPath] = useState<TreeNode[]>([]);
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const cache = useRef(new Map<string, TreeNode[]>());
  const parent = path.at(-1);
  const branch = parent?.id;
  useEffect(() => {
    let active = true;
    const key = branch || 'faculties';
    async function load() {
      setLoading(true); setError(false);
      try {
        const result = cache.current.get(key) ?? await (branch ? fetchTreeBranch(branch) : fetchFaculties()) as TreeNode[];
        if (!active) return;
        cache.current.set(key, result); setNodes(result);
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [branch, retry]);
  const select = (node: TreeNode) => {
    if (node.scheduleType) onSelectSchedule(node.scheduleType, node.id, node.name, [...path.map(p => p.name), node.name]);
  };
  return <div className="tree-view" data-shortcuts-blocked>
    {parent && <div className="catalog-navigation"><button type="button" className="text-button" onClick={() => setPath(p => p.slice(0, -1))}><ChevronLeftIcon size={17} />Wstecz</button>
      <button type="button" className="text-button" onClick={() => setPath([])}>Wydziały</button></div>}
    <h3 className="catalog-title">{parent?.name || 'Wybierz wydział'}</h3>
    {path.length > 1 && <p className="catalog-path">{path.slice(0, -1).map(p => p.name).join(' › ')}</p>}
    {loading ? <p className="catalog-status" role="status">Wczytywanie…</p>
      : error ? <div className="catalog-status" role="alert"><p>Nie udało się pobrać listy.</p><button type="button" className="secondary-button" onClick={() => setRetry(n => n + 1)}>Spróbuj ponownie</button></div>
      : nodes.length ? <ul className="catalog-list">{nodes.map(node => <li key={node.id}>
        <button type="button" className="catalog-item" onClick={() => node.hasChildren ? setPath(p => [...p, node]) : select(node)}>
          {node.type === 'faculty' ? <BuildingIcon size={18} /> : node.hasChildren ? <FolderIcon size={18} /> : <CalendarIcon size={18} />}
          <span>{node.name}</span>{node.hasChildren && <ChevronRightIcon size={17} />}
        </button>
        {node.hasChildren && node.scheduleType && <button type="button" className="catalog-whole" onClick={() => select(node)}>Otwórz plan: {node.name}</button>}
      </li>)}</ul> : <p className="catalog-status">Brak planów na tym poziomie. Wróć do poprzedniej listy.</p>}
  </div>;
}
