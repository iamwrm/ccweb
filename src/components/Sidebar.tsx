import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../lib/theme';
import './Sidebar.css';

export interface WorkspaceInfo {
  id: string;
  name: string;
  index: number;
}

interface SidebarProps {
  workspaces: WorkspaceInfo[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, newName: string) => void;
}

export function Sidebar({ workspaces, activeId, onSelect, onClose, onCreate, onRename }: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [popupTop, setPopupTop] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    if (editingId && inputRef.current) {
      committedRef.current = false;
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const startEditing = (ws: WorkspaceInfo, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setPopupTop(rect.top + rect.height / 2);
    setEditingId(ws.id);
    setEditValue(ws.name);
  };

  const commitRename = () => {
    if (committedRef.current) return;
    if (editingId) {
      committedRef.current = true;
      const trimmed = editValue.trim();
      if (trimmed) {
        onRename(editingId, trimmed);
      }
      setEditingId(null);
    }
  };

  const cancelRename = () => {
    committedRef.current = true;
    setEditingId(null);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">cc</div>
      <div className="sidebar-workspaces">
        {workspaces.map(ws => (
          <div
            key={ws.id}
            className={`sidebar-item ${ws.id === activeId ? 'active' : ''}`}
            onClick={() => onSelect(ws.id)}
            onDoubleClick={(e) => {
              if (ws.id === activeId) {
                startEditing(ws, e.currentTarget);
              }
            }}
            title={ws.name}
            role="button"
            tabIndex={0}
          >
            <span className="sidebar-item-index">{ws.index}</span>
            <span className="sidebar-item-name">{ws.name}</span>
            {ws.id === activeId && workspaces.length > 1 && (
              <button
                className="sidebar-item-close"
                onClick={e => { e.stopPropagation(); onClose(ws.id); }}
                title="Close workspace"
              >
                &times;
              </button>
            )}
          </div>
        ))}
      </div>
      {editingId && (
        <div
          className="sidebar-rename-popup"
          style={{ top: popupTop }}
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          <input
            ref={inputRef}
            className="sidebar-rename-input"
            type="text"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                commitRename();
              } else if (e.key === 'Escape') {
                cancelRename();
              }
            }}
            onBlur={commitRename}
          />
        </div>
      )}
      <div className="sidebar-bottom">
        <button
          className="sidebar-theme-toggle"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? '\u2600' : '\u263E'}
        </button>
        <button className="sidebar-add" onClick={onCreate} title="New workspace">
          +
        </button>
      </div>
    </aside>
  );
}
