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
}

export function Sidebar({ workspaces, activeId, onSelect, onClose, onCreate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">cc</div>
      <div className="sidebar-workspaces">
        {workspaces.map(ws => (
          <div
            key={ws.id}
            className={`sidebar-item ${ws.id === activeId ? 'active' : ''}`}
            onClick={() => onSelect(ws.id)}
            title={ws.name}
            role="button"
            tabIndex={0}
          >
            <span className="sidebar-item-index">{ws.index}</span>
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
      <div className="sidebar-bottom">
        <button className="sidebar-add" onClick={onCreate} title="New workspace">
          +
        </button>
      </div>
    </aside>
  );
}
