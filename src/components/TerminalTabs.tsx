import './TerminalTabs.css';

export interface TerminalTabInfo {
  id: string;
  label: string;
}

interface TerminalTabsProps {
  terminals: TerminalTabInfo[];
  activeTerminalId: string;
  onSelect: (terminalId: string) => void;
  onClose: (terminalId: string) => void;
  onAdd: () => void;
  onSplit: (direction: 'horizontal' | 'vertical') => void;
}

export function TerminalTabs({
  terminals,
  activeTerminalId,
  onSelect,
  onClose,
  onAdd,
  onSplit,
}: TerminalTabsProps) {
  return (
    <div className="terminal-tabs">
      {terminals.map(t => (
        <button
          key={t.id}
          className={`terminal-tab ${t.id === activeTerminalId ? 'active' : ''}`}
          onClick={() => onSelect(t.id)}
          title={t.label}
        >
          <span>{t.label}</span>
          {terminals.length > 1 && (
            <span
              className="terminal-tab-close"
              onClick={e => {
                e.stopPropagation();
                onClose(t.id);
              }}
              role="button"
              tabIndex={-1}
            >
              &times;
            </span>
          )}
        </button>
      ))}
      <div className="terminal-tabs-actions">
        <button
          className="terminal-tabs-btn"
          onClick={() => onSplit('vertical')}
          title="Split vertical"
        >
          |
        </button>
        <button
          className="terminal-tabs-btn"
          onClick={() => onSplit('horizontal')}
          title="Split horizontal"
        >
          &mdash;
        </button>
        <button
          className="terminal-tabs-btn"
          onClick={onAdd}
          title="New terminal"
        >
          +
        </button>
      </div>
    </div>
  );
}
