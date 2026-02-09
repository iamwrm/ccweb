import { useState, useEffect, useCallback } from 'react';
import { fetchFiles, type FileEntry } from '../lib/api';
import './FileTree.css';

interface TreeNode extends FileEntry {
  children?: TreeNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
}

interface FileTreeProps {
  onFileSelect: (path: string) => void;
  root?: string;
}

export function FileTree({ onFileSelect, root }: FileTreeProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTree([]);
    setError(null);
    const args: [string, ...string[]] = ['.'];
    if (root) args.push(root);
    fetchFiles(...args)
      .then(entries => setTree(entries.map(e => ({ ...e }))))
      .catch(err => setError(err.message));
  }, [root]);

  const toggleDir = useCallback(async (nodePath: string) => {
    // First check if already expanded — just collapse
    setTree(prev => {
      const node = findNode(prev, nodePath);
      if (node?.isExpanded) {
        return updateNode(prev, nodePath, { isExpanded: false });
      }
      if (node?.children) {
        return updateNode(prev, nodePath, { isExpanded: true });
      }
      return updateNode(prev, nodePath, { isLoading: true });
    });

    // Need to check if we should fetch
    const currentTree = tree;
    const node = findNode(currentTree, nodePath);
    if (node?.isExpanded || node?.children) return;

    try {
      const args: [string, ...string[]] = [nodePath];
      if (root) args.push(root);
      const entries = await fetchFiles(...args);
      setTree(prev =>
        updateNode(prev, nodePath, {
          children: entries.map(e => ({ ...e })),
          isExpanded: true,
          isLoading: false,
        })
      );
    } catch {
      setTree(prev => updateNode(prev, nodePath, { isLoading: false }));
    }
  }, [tree, root]);

  const handleClick = useCallback((node: TreeNode) => {
    if (node.type === 'directory') {
      toggleDir(node.path);
    } else {
      onFileSelect(node.path);
    }
  }, [toggleDir, onFileSelect]);

  if (error) {
    return (
      <div className="file-tree">
        <div className="file-tree-header">Explorer</div>
        <div className="file-tree-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="file-tree">
      <div className="file-tree-header">Explorer</div>
      <div className="file-tree-content">
        {tree.map(node => (
          <TreeItem key={node.path} node={node} depth={0} onClick={handleClick} />
        ))}
      </div>
    </div>
  );
}

function TreeItem({ node, depth, onClick }: { node: TreeNode; depth: number; onClick: (n: TreeNode) => void }) {
  return (
    <>
      <div
        className={`tree-item ${node.type}`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
        onClick={() => onClick(node)}
        role="treeitem"
      >
        <span className="tree-icon">
          {node.type === 'directory'
            ? (node.isLoading ? '...' : node.isExpanded ? '▾' : '▸')
            : '·'}
        </span>
        <span className="tree-name">{node.name}</span>
      </div>
      {node.isExpanded && node.children?.map(child => (
        <TreeItem key={child.path} node={child} depth={depth + 1} onClick={onClick} />
      ))}
    </>
  );
}

function findNode(nodes: TreeNode[], targetPath: string): TreeNode | undefined {
  for (const node of nodes) {
    if (node.path === targetPath) return node;
    if (node.children) {
      const found = findNode(node.children, targetPath);
      if (found) return found;
    }
  }
  return undefined;
}

function updateNode(nodes: TreeNode[], targetPath: string, updates: Partial<TreeNode>): TreeNode[] {
  return nodes.map(node => {
    if (node.path === targetPath) {
      return { ...node, ...updates };
    }
    if (node.children) {
      return { ...node, children: updateNode(node.children, targetPath, updates) };
    }
    return node;
  });
}
