import { useState, useEffect, useCallback, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { fetchFiles, renameFile, type FileEntry } from '../lib/api';
import { getFileIcon } from '../lib/fileIcons';
import './FileTree.css';

interface TreeNode extends FileEntry {
  children?: TreeNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
}

interface FileTreeProps {
  onFileSelect: (path: string, options?: { pinned?: boolean }) => void;
  root?: string;
}

export function FileTree({ onFileSelect, root }: FileTreeProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: TreeNode } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  const loadRoot = useCallback(async () => {
    setError(null);
    const args: [string, ...string[]] = ['.'];
    if (root) args.push(root);
    const entries = await fetchFiles(...args);
    setTree(entries.map(e => ({ ...e })));
  }, [root]);

  useEffect(() => {
    setTree([]);
    setError(null);
    loadRoot().catch(err => setError(err.message));
  }, [loadRoot]);

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
    setContextMenu(null);
    if (node.type === 'directory') {
      toggleDir(node.path);
    } else {
      onFileSelect(node.path, { pinned: false });
    }
  }, [toggleDir, onFileSelect]);

  const handleDoubleClick = useCallback((node: TreeNode) => {
    setContextMenu(null);
    if (node.type === 'file') {
      onFileSelect(node.path, { pinned: true });
    }
  }, [onFileSelect]);

  const handleContextMenu = useCallback((event: ReactMouseEvent, node: TreeNode) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      node,
    });
  }, []);

  const handleCopyPath = useCallback(async () => {
    if (!contextMenu) return;
    const absolutePath = getAbsolutePath(root, contextMenu.node.path);
    try {
      await copyTextToClipboard(absolutePath);
    } catch (err) {
      console.error('Failed to copy path:', err);
    } finally {
      setContextMenu(null);
    }
  }, [contextMenu, root]);

  const handleCopyRelativePath = useCallback(async () => {
    if (!contextMenu) return;
    try {
      await copyTextToClipboard(contextMenu.node.path);
    } catch (err) {
      console.error('Failed to copy relative path:', err);
    } finally {
      setContextMenu(null);
    }
  }, [contextMenu]);

  const handleRename = useCallback(async () => {
    if (!contextMenu) return;

    const current = contextMenu.node;
    const nextName = window.prompt('Rename to:', current.name);
    if (nextName === null) return;

    const trimmed = nextName.trim();
    if (!trimmed || trimmed === current.name) {
      setContextMenu(null);
      return;
    }
    if (trimmed === '.' || trimmed === '..' || /[\\/]/.test(trimmed)) {
      window.alert('Invalid name');
      return;
    }

    const slash = current.path.lastIndexOf('/');
    const parent = slash >= 0 ? current.path.slice(0, slash) : '';
    const newPath = parent ? `${parent}/${trimmed}` : trimmed;

    try {
      await renameFile(current.path, newPath, root);
      await loadRoot();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Rename failed';
      window.alert(message);
    } finally {
      setContextMenu(null);
    }
  }, [contextMenu, loadRoot, root]);

  useEffect(() => {
    if (!contextMenu) return;

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (contextMenuRef.current?.contains(target)) return;
      setContextMenu(null);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContextMenu(null);
    };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onEscape);
    };
  }, [contextMenu]);

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
          <TreeItem
            key={node.path}
            node={node}
            depth={0}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
          />
        ))}
      </div>
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="file-tree-context-menu"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
        >
          <button type="button" className="file-tree-context-item" onClick={handleCopyPath}>Copy Path</button>
          <button type="button" className="file-tree-context-item" onClick={handleCopyRelativePath}>Copy Relative Path</button>
          <button type="button" className="file-tree-context-item" onClick={handleRename}>Rename</button>
        </div>
      )}
    </div>
  );
}

function TreeItem({
  node,
  depth,
  onClick,
  onDoubleClick,
  onContextMenu,
}: {
  node: TreeNode;
  depth: number;
  onClick: (n: TreeNode) => void;
  onDoubleClick: (n: TreeNode) => void;
  onContextMenu: (event: ReactMouseEvent, node: TreeNode) => void;
}) {
  return (
    <>
      <div
        className={`tree-item ${node.type}`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
        onClick={() => onClick(node)}
        onDoubleClick={() => onDoubleClick(node)}
        onContextMenu={(event) => onContextMenu(event, node)}
        role="treeitem"
      >
        <span className="tree-icon">
          {node.isLoading
            ? <span className="tree-icon-loading">...</span>
            : getFileIcon(node.name, node.type, node.isExpanded)}
        </span>
        <span className="tree-name">{node.name}</span>
      </div>
      {node.isExpanded && node.children?.map(child => (
        <TreeItem
          key={child.path}
          node={child}
          depth={depth + 1}
          onClick={onClick}
          onDoubleClick={onDoubleClick}
          onContextMenu={onContextMenu}
        />
      ))}
    </>
  );
}

function getAbsolutePath(root: string | undefined, relativePath: string): string {
  if (!root) return relativePath;
  const normalizedRoot = root.replace(/[\\/]+$/, '');
  const normalizedRelative = relativePath.replace(/^[\\/]+/, '');
  if (!normalizedRelative || normalizedRelative === '.') return normalizedRoot;
  return `${normalizedRoot}/${normalizedRelative}`.replace(/\\/g, '/');
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
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
