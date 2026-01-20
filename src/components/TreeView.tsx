import { useState, useEffect, useCallback } from 'react';
import type { TreeNode } from '../types';
import { fetchFaculties, fetchTreeBranch } from '../utils/api';
import './TreeView.css';

interface TreeViewProps {
  onSelectSchedule: (type: string, id: string, name: string, path: string[]) => void;
}

interface TreeNodeState extends TreeNode {
  children?: TreeNodeState[];
  isExpanded?: boolean;
  isLoading?: boolean;
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

    // Fetch children if expanding
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
    // If node has children, prioritize expanding (so users can see groups)
    if (node.hasChildren) {
      toggleNode(node.id);
    } else if (node.type === 'schedule' && node.scheduleType) {
      // Only load schedule if no children (pure leaf schedule node)
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

    // Check if this is a hybrid node (has both schedule and children)
    const isHybrid = node.type === 'schedule' && node.hasChildren;
    // Check if this is a pure schedule (no children)
    const isPureSchedule = node.type === 'schedule' && !node.hasChildren;

    return (
      <div key={node.id} className="tree-node">
        <div 
          className={`tree-node-content ${isPureSchedule ? 'schedule-item' : ''} ${isHybrid ? 'hybrid-item' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => handleNodeClick(node, path)}
        >
          {node.hasChildren && (
            <span 
              className={`expand-icon ${node.isExpanded ? 'expanded' : ''}`}
              onClick={(e) => handleExpandClick(e, node.id)}
            >
              {node.isLoading ? '⏳' : '▶'}
            </span>
          )}
          <span className="node-icon">
            {node.type === 'faculty' && '🏛️'}
            {node.type === 'branch' && '📁'}
            {node.type === 'schedule' && !isHybrid && '📅'}
            {isHybrid && '📁'}
          </span>
          <span className="node-name">{node.name}</span>
          {/* Show schedule button for hybrid nodes */}
          {isHybrid && (
            <span 
              className="schedule-btn" 
              title="Pokaż połączony plan (wszystkie grupy)"
              onClick={(e) => handleScheduleClick(e, node, path)}
            >
              📅
            </span>
          )}
        </div>
        {node.isExpanded && node.children && (
          <div className="tree-children">
            {node.children.map(child => renderNode(child, depth + 1, currentPath))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="tree-loading">Ładowanie wydziałów...</div>;
  }

  if (error) {
    return (
      <div className="tree-error">
        <p>{error}</p>
        <button onClick={loadFaculties}>Spróbuj ponownie</button>
      </div>
    );
  }

  return (
    <div className="tree-view">
      <div className="tree-search">
        <input
          type="text"
          placeholder="Szukaj grupy..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="tree-nodes">
        {nodes.map(node => renderNode(node))}
      </div>
    </div>
  );
}
