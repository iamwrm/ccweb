import { useCallback, useState, type DragEvent } from 'react';
import { getFileIcon } from '../lib/fileIcons';
import './PaneHeader.css';

interface PaneHeaderProps {
  title: string;
  paneId: string;
  paneType: 'terminal' | 'editor';
  isDirty?: boolean;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  isActive?: boolean;
  canClose?: boolean;
  vimMode?: boolean;
  onToggleVim?: () => void;
  onSplitH?: () => void;
  onSplitV?: () => void;
  onClose?: () => void;
  onFocus?: () => void;
  onDrop?: (fromId: string, position: 'center' | 'left' | 'right' | 'top' | 'bottom') => void;
}

export function PaneHeader({
  title,
  paneId,
  paneType,
  isDirty,
  saveStatus = 'idle',
  isActive,
  canClose = true,
  vimMode,
  onToggleVim,
  onSplitH,
  onSplitV,
  onClose,
  onFocus,
  onDrop,
}: PaneHeaderProps) {
  const [dropPosition, setDropPosition] = useState<string | null>(null);

  const handleDragStart = useCallback((e: DragEvent) => {
    e.dataTransfer.setData('text/plain', paneId);
    e.dataTransfer.effectAllowed = 'move';
  }, [paneId]);

  const getDropPosition = useCallback((e: DragEvent): 'left' | 'right' | 'top' | 'bottom' | 'center' => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0.25) return 'left';
    if (x > 0.75) return 'right';
    if (y < 0.4) return 'top';
    if (y > 0.6) return 'bottom';
    return 'center';
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropPosition(getDropPosition(e));
  }, [getDropPosition]);

  const handleDragLeave = useCallback(() => {
    setDropPosition(null);
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDropPosition(null);
    const fromId = e.dataTransfer.getData('text/plain');
    if (fromId && fromId !== paneId && onDrop) {
      onDrop(fromId, getDropPosition(e));
    }
  }, [paneId, onDrop, getDropPosition]);

  const filename = paneType === 'editor' ? title.split('/').pop() || title : title;
  const icon = paneType === 'editor' ? getFileIcon(filename, 'file') : null;

  return (
    <div
      className={`pane-header ${isActive ? 'active' : ''} ${onDrop && dropPosition ? `drop-${dropPosition}` : ''}`}
      draggable
      onDragStart={handleDragStart}
      onDragOver={onDrop ? handleDragOver : undefined}
      onDragLeave={onDrop ? handleDragLeave : undefined}
      onDrop={onDrop ? handleDrop : undefined}
      onClick={onFocus}
    >
      <div className="pane-header-title">
        {icon && <span className="pane-header-icon">{icon}</span>}
        <span className="pane-header-text" title={title}>
          {filename}
          {isDirty && <span className="pane-header-dirty"> *</span>}
        </span>
        {saveStatus === 'saving' && <span className="pane-header-status">Saving...</span>}
        {saveStatus === 'saved' && <span className="pane-header-status saved">Saved</span>}
        {saveStatus === 'error' && <span className="pane-header-status error">Failed</span>}
      </div>
      <div className="pane-header-actions">
        {paneType === 'editor' && onToggleVim && (
          <button
            className={`pane-header-btn vim-toggle ${vimMode ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleVim(); }}
            title={vimMode ? 'Disable vim mode' : 'Enable vim mode'}
          >
            VIM
          </button>
        )}
        {onSplitH && (
          <button className="pane-header-btn" onClick={(e) => { e.stopPropagation(); onSplitH(); }} title="Split down">
            &#x2501;
          </button>
        )}
        {onSplitV && (
          <button className="pane-header-btn" onClick={(e) => { e.stopPropagation(); onSplitV(); }} title="Split right">
            &#x2503;
          </button>
        )}
        {canClose && onClose && (
          <button className="pane-header-btn close" onClick={(e) => { e.stopPropagation(); onClose(); }} title="Close">
            &times;
          </button>
        )}
      </div>
    </div>
  );
}
