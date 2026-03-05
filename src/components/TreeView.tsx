import { useState, useEffect, useCallback } from 'react';
import type { TreeNode } from '../types';
import { fetchFaculties, fetchTreeBranch } from '../utils/api';
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

  useEffect(() => {
    loadFaculties();
  }, []);

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

  const renderNode = (node: TreeNodeState, depth: number = 0, path: string[] = []): React.ReactNode => {
    const currentPath = [...path, node.name];
    const matchesSearch = searchTerm === '' ||
      node.name.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch && (!node.children || node.children.length === 0)) {
      return <></>;
    }

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
            <HighlightMatch text={node.name} search={searchTerm} />
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

  const filteredNodes = searchTerm
    ? nodes.filter(n => {
        const matches = n.name.toLowerCase().includes(searchTerm.toLowerCase());
        const childrenMatch = n.children?.some(c =>
          c.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        return matches || childrenMatch;
      })
    : nodes;

  const hasResults = filteredNodes.length > 0 || nodes.some(n =>
    n.children?.some(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
            onClick={() => setSearchTerm('')}
            aria-label="Wyczyść wyszukiwanie"
          >
            <XIcon size={14} />
          </button>
        )}
      </div>
      <div className="tree-nodes">
        {searchTerm && !hasResults ? (
          <div className="tree-no-results">
            <p>Brak wynikow dla "{searchTerm}"</p>
          </div>
        ) : (
          nodes.map(node => renderNode(node))
        )}
      </div>
    </div>
  );
}
