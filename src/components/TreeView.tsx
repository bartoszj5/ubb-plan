import { useState, useEffect, useCallback, useRef } from 'react';
import type { TreeNode } from '../types';
import { fetchFaculties, fetchTreeBranch, fetchTreeIndex } from '../utils/api';
import { BuildingIcon, FolderIcon, CalendarIcon, ChevronRightIcon, LoaderIcon, SearchIcon, XIcon } from './Icons';
import './TreeView.css';

interface TreeViewProps {
  onSelectSchedule: (type: string, id: string, name: string, path: string[]) => void;
}

interface TreeNodeState extends TreeNode {
  children?: TreeNodeState[];
  isExpanded?: boolean;
  isLoading?: boolean;
}

interface SearchResult {
  id: string;
  name: string;
  type: 'faculty' | 'branch' | 'schedule';
  scheduleType: string | null;
  hasChildren: boolean;
  path: string[];
}

function HighlightMatch({ text, search }: { text: string; search: string }) {
  if (!search) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(search.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + search.length)}</mark>
      {text.slice(idx + search.length)}
    </>
  );
}

export default function TreeView({ onSelectSchedule }: TreeViewProps) {
  const [nodes, setNodes] = useState<TreeNodeState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const treeIndexRef = useRef<SearchResult[] | null>(null);

  useEffect(() => {
    loadFaculties();
  }, []);

  // Debounced server-side search
  useEffect(() => {
    if (searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const treeIndex: SearchResult[] = treeIndexRef.current ?? await fetchTreeIndex();
        if (!treeIndexRef.current) {
          treeIndexRef.current = treeIndex;
        }
        const term = searchTerm.toLowerCase();
        const results = treeIndex
          .filter(node => {
            if (node.name.toLowerCase().includes(term)) return true;
            // Match path excluding top-level faculty name to avoid false positives
            const pathWithoutFaculty = node.path.slice(1);
            return pathWithoutFaculty.some(p => p.toLowerCase().includes(term));
          })
          .filter(node => node.scheduleType)
          .sort((a, b) => {
            // Prioritize direct name matches over path-only matches
            const aName = a.name.toLowerCase().includes(term) ? 0 : 1;
            const bName = b.name.toLowerCase().includes(term) ? 0 : 1;
            if (aName !== bName) return aName - bName;
            return a.name.localeCompare(b.name, 'pl');
          })
          .slice(0, 50);
        setSearchResults(results);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  async function loadFaculties() {
    try {
      setLoading(true);
      const faculties = await fetchFaculties();
      setNodes(faculties.map((f: TreeNode) => ({ ...f, children: [], isExpanded: false })));
      setError(null);
    } catch (err) {
      setError('Nie udało się wczytać wydziałów');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const toggleNode = useCallback(async (nodeId: string) => {
    setNodes(prevNodes => {
      const updateNodes = (nodes: TreeNodeState[], targetId: string): TreeNodeState[] => {
        return nodes.map(node => {
          if (node.id === targetId) {
            if (node.isExpanded) {
              return { ...node, isExpanded: false };
            }
            return { ...node, isExpanded: true, isLoading: true };
          }
          if (node.children && node.children.length > 0) {
            return { ...node, children: updateNodes(node.children, targetId) };
          }
          return node;
        });
      };
      return updateNodes(prevNodes, nodeId);
    });

    try {
      const children = await fetchTreeBranch(nodeId);
      setNodes(prevNodes => {
        const updateNodes = (nodes: TreeNodeState[], targetId: string): TreeNodeState[] => {
          return nodes.map(node => {
            if (node.id === targetId) {
              return {
                ...node,
                children: children.map((c: TreeNode) => ({ ...c, children: [], isExpanded: false })),
                isLoading: false
              };
            }
            if (node.children && node.children.length > 0) {
              return { ...node, children: updateNodes(node.children, targetId) };
            }
            return node;
          });
        };
        return updateNodes(prevNodes, nodeId);
      });
    } catch (err) {
      console.error('Failed to load children:', err);
    }
  }, []);

  const handleExpandClick = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    toggleNode(nodeId);
  }, [toggleNode]);

  const handleScheduleClick = useCallback((e: React.MouseEvent, node: TreeNodeState, path: string[]) => {
    e.stopPropagation();
    if (node.type === 'schedule' && node.scheduleType) {
      onSelectSchedule(node.scheduleType, node.id, node.name, [...path, node.name]);
    }
  }, [onSelectSchedule]);

  const handleNodeClick = useCallback((node: TreeNodeState, path: string[]) => {
    if (node.hasChildren) {
      toggleNode(node.id);
    } else if (node.type === 'schedule' && node.scheduleType) {
      onSelectSchedule(node.scheduleType, node.id, node.name, [...path, node.name]);
    }
  }, [onSelectSchedule, toggleNode]);

  const handleSearchResultClick = useCallback((result: SearchResult) => {
    if (result.scheduleType) {
      onSelectSchedule(result.scheduleType, result.id, result.name, result.path);
      setSearchTerm('');
      setSearchResults([]);
    }
  }, [onSelectSchedule]);

  const renderNode = (node: TreeNodeState, depth: number = 0, path: string[] = []): React.ReactNode => {
    const currentPath = [...path, node.name];
    const isHybrid = node.type === 'schedule' && node.hasChildren;
    const isPureSchedule = node.type === 'schedule' && !node.hasChildren;

    return (
      <div key={node.id} className="tree-node">
        <div
          className={`tree-node-content ${isPureSchedule ? 'schedule-item' : ''} ${isHybrid ? 'hybrid-item' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => handleNodeClick(node, path)}
          aria-expanded={node.hasChildren ? node.isExpanded : undefined}
          role={node.hasChildren ? 'treeitem' : undefined}
        >
          {node.hasChildren && (
            <span
              className={`expand-icon ${node.isExpanded ? 'expanded' : ''}`}
              onClick={(e) => handleExpandClick(e, node.id)}
            >
              {node.isLoading ? <LoaderIcon size={12} /> : <ChevronRightIcon size={14} />}
            </span>
          )}
          <span className="node-icon">
            {node.type === 'faculty' && <BuildingIcon size={15} />}
            {node.type === 'branch' && <FolderIcon size={15} />}
            {node.type === 'schedule' && !isHybrid && <CalendarIcon size={15} />}
            {isHybrid && <FolderIcon size={15} />}
          </span>
          <span className="node-name">
            {node.name}
          </span>
          {isHybrid && (
            <button
              className="schedule-btn"
              aria-label={`Pokaz plan: ${node.name}`}
              onClick={(e) => handleScheduleClick(e, node, path)}
            >
              <CalendarIcon size={14} />
            </button>
          )}
        </div>
        {node.isExpanded && node.children && (
          <div className="tree-children" role="group">
            {node.children.map(child => renderNode(child, depth + 1, currentPath))}
          </div>
        )}
      </div>
    );
  };

  const isSearchActive = searchTerm.length >= 2;

  if (loading) {
    return <div className="tree-loading">Ladowanie wydzialow...</div>;
  }

  if (error) {
    return (
      <div className="tree-error">
        <p>{error}</p>
        <button onClick={loadFaculties}>Sprobuj ponownie</button>
      </div>
    );
  }

  return (
    <div className="tree-view" role="tree">
      <div className="tree-search">
        <SearchIcon size={14} className="tree-search-icon" />
        <input
          type="text"
          placeholder="Szukaj grupy..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Szukaj grupy"
        />
        {searchTerm && (
          <button
            className="tree-search-clear"
            onClick={() => { setSearchTerm(''); setSearchResults([]); }}
            aria-label="Wyczysc wyszukiwanie"
          >
            <XIcon size={14} />
          </button>
        )}
      </div>
      <div className="tree-nodes">
        {isSearchActive ? (
          searchLoading && searchResults.length === 0 ? (
            <div className="search-loading">
              <LoaderIcon size={16} />
              <span>Wyszukiwanie...</span>
            </div>
          ) : searchResults.length > 0 ? (
            <div className="search-results">
              {searchResults.map(result => (
                <div
                  key={result.id}
                  className="search-result"
                  onClick={() => handleSearchResultClick(result)}
                >
                  <span className="search-result-path">
                    {result.path.slice(0, -1).join(' \u203A ')}
                  </span>
                  <span className="search-result-name">
                    <CalendarIcon size={14} />
                    <HighlightMatch text={result.name} search={searchTerm} />
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="tree-no-results">
              <p>Brak wynikow dla "{searchTerm}"</p>
            </div>
          )
        ) : (
          nodes.map(node => renderNode(node))
        )}
      </div>
    </div>
  );
}
