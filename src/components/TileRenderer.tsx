import { useCallback, useState, type DragEvent, type ReactNode } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { TerminalPanel } from './Terminal';
import { EditorPane, type OpenFile } from './FileViewer';
import { PaneHeader } from './PaneHeader';
import type { TileNode } from '../lib/tileLayout';
import { countLeaves, findInTile } from '../lib/tileLayout';
import type { TerminalTabInfo } from '../lib/tileLayout';
import './TileRenderer.css';

interface EditorPaneState {
  tabs: Array<{ id: string; file: OpenFile; pinned: boolean }>;
  activeTabId: string;
}

interface TerminalPaneState {
  tabs: TerminalTabInfo[];
  activeTabId: string;
}

interface TileRendererProps {
  layout: TileNode;
  openFiles: Record<string, EditorPaneState>;
  terminalPanes: Record<string, TerminalPaneState>;
  allTerminals: TerminalTabInfo[];
  activePaneId: string;
  cwd?: string;
  theme: 'dark' | 'light';
  vimMode: boolean;
  onToggleVim: () => void;
  onSplitPane: (paneId: string, direction: 'horizontal' | 'vertical') => void;
  onClosePane: (paneId: string) => void;
  onSwapPanes: (fromId: string, toId: string) => void;
  onDropSplit: (fromId: string, targetId: string, direction: 'horizontal' | 'vertical') => void;
  onDropEditorTab: (
    fromPaneId: string,
    tabId: string,
    targetPaneId: string,
    position: 'center' | 'left' | 'right' | 'top' | 'bottom',
  ) => void;
  onMoveEditorTab: (fromPaneId: string, tabId: string, targetPaneId: string) => void;
  onMoveTerminalTab: (fromPaneId: string, tabId: string, targetPaneId: string) => void;
  onFocusPane: (paneId: string) => void;
  onCreateTerminalTab: (paneId: string) => void;
  onSelectTerminalTab: (paneId: string, tabId: string) => void;
  onCloseTerminalTab: (paneId: string, tabId: string) => void;
  onSelectEditorTab: (paneId: string, tabId: string) => void;
  onCloseEditorTab: (paneId: string, tabId: string) => void;
  onSaveFile: (paneId: string, content: string) => void;
  onOpenFile: (filePath: string) => void;
}

const EDITOR_TAB_DND_MIME = 'application/x-ccweb-editor-tab';
const TERMINAL_TAB_DND_MIME = 'application/x-ccweb-terminal-tab';

interface EditorTabDropPayload {
  paneId: string;
  tabId: string;
}

interface TerminalTabDropPayload {
  paneId: string;
  tabId: string;
}

function parseEditorTabDropPayload(raw: string): EditorTabDropPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<EditorTabDropPayload>;
    if (!parsed.paneId || !parsed.tabId) return null;
    return { paneId: parsed.paneId, tabId: parsed.tabId };
  } catch {
    return null;
  }
}

function parseTerminalTabDropPayload(raw: string): TerminalTabDropPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<TerminalTabDropPayload>;
    if (!parsed.paneId || !parsed.tabId) return null;
    return { paneId: parsed.paneId, tabId: parsed.tabId };
  } catch {
    return null;
  }
}

export function TileRenderer({
  layout,
  openFiles,
  terminalPanes,
  allTerminals,
  activePaneId,
  cwd,
  theme,
  vimMode,
  onToggleVim,
  onSplitPane,
  onClosePane,
  onSwapPanes,
  onDropSplit,
  onDropEditorTab,
  onMoveEditorTab,
  onMoveTerminalTab,
  onFocusPane,
  onCreateTerminalTab,
  onSelectTerminalTab,
  onCloseTerminalTab,
  onSelectEditorTab,
  onCloseEditorTab,
  onSaveFile,
  onOpenFile,
}: TileRendererProps) {
  type DropPosition = 'center' | 'left' | 'right' | 'top' | 'bottom';

  const totalLeaves = countLeaves(layout);
  const canClose = totalLeaves > 1;
  const [dropHint, setDropHint] = useState<{ targetId: string; position: DropPosition } | null>(null);
  const activeTerminalSessionIds = new Set<string>();

  function handlePaneDropAction(targetId: string, fromId: string, position: DropPosition) {
    if (position === 'center') {
      onSwapPanes(fromId, targetId);
    } else if (position === 'left' || position === 'right') {
      onDropSplit(fromId, targetId, 'horizontal');
    } else {
      onDropSplit(fromId, targetId, 'vertical');
    }
  }

  const getDropPosition = useCallback((e: DragEvent<HTMLElement>): DropPosition => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Prioritize top/bottom so "upper part" and "lower part" are reliable.
    if (y < 0.3) return 'top';
    if (y > 0.7) return 'bottom';
    if (x < 0.25) return 'left';
    if (x > 0.75) return 'right';
    return 'center';
  }, []);

  const getDropClass = useCallback((paneId: string) => {
    if (!dropHint || dropHint.targetId !== paneId) return '';
    return ` tile-drop-${dropHint.position}`;
  }, [dropHint]);

  const handlePaneDragOver = useCallback((e: DragEvent<HTMLElement>, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const position = getDropPosition(e);

    if (Array.from(e.dataTransfer.types).includes(EDITOR_TAB_DND_MIME)) {
      const targetNode = findInTile(layout, targetId);
      const tabDropPosition: DropPosition = targetNode?.type === 'editor' ? 'center' : position;
      setDropHint(prev => (
        prev?.targetId === targetId && prev.position === tabDropPosition
          ? prev
          : { targetId, position: tabDropPosition }
      ));
      return;
    }

    if (Array.from(e.dataTransfer.types).includes(TERMINAL_TAB_DND_MIME)) {
      const targetNode = findInTile(layout, targetId);
      const tabDropPosition: DropPosition = targetNode?.type === 'terminal' ? 'center' : position;
      setDropHint(prev => (
        prev?.targetId === targetId && prev.position === tabDropPosition
          ? prev
          : { targetId, position: tabDropPosition }
      ));
      return;
    }

    const fromId = e.dataTransfer.getData('text/plain');
    if (!fromId || fromId === targetId) {
      setDropHint(null);
      return;
    }

    setDropHint(prev => (
      prev?.targetId === targetId && prev.position === position
        ? prev
        : { targetId, position }
    ));
  }, [getDropPosition, layout]);

  const handlePaneDragLeave = useCallback((e: DragEvent<HTMLElement>, targetId: string) => {
    const related = e.relatedTarget as Node | null;
    if (related && (e.currentTarget as HTMLElement).contains(related)) return;
    setDropHint(prev => (prev?.targetId === targetId ? null : prev));
  }, []);

  const handlePaneDrop = useCallback((e: DragEvent<HTMLElement>, targetId: string) => {
    e.preventDefault();
    const position = getDropPosition(e);
    setDropHint(null);

    const tabPayload = parseEditorTabDropPayload(e.dataTransfer.getData(EDITOR_TAB_DND_MIME));
    if (tabPayload) {
      const targetNode = findInTile(layout, targetId);
      if (targetNode?.type === 'editor') {
        onMoveEditorTab(tabPayload.paneId, tabPayload.tabId, targetId);
      } else if (targetNode?.type === 'terminal') {
        onDropEditorTab(tabPayload.paneId, tabPayload.tabId, targetId, position);
      }
      return;
    }

    const terminalTabPayload = parseTerminalTabDropPayload(e.dataTransfer.getData(TERMINAL_TAB_DND_MIME));
    if (terminalTabPayload) {
      const targetNode = findInTile(layout, targetId);
      if (targetNode?.type === 'terminal') {
        onMoveTerminalTab(terminalTabPayload.paneId, terminalTabPayload.tabId, targetId);
      }
      return;
    }

    const fromId = e.dataTransfer.getData('text/plain');
    if (!fromId || fromId === targetId) return;
    handlePaneDropAction(targetId, fromId, position);
  }, [getDropPosition, layout, onDropEditorTab, onMoveEditorTab, onMoveTerminalTab]);

  function renderNode(node: TileNode): ReactNode {
    if (node.type === 'split') {
      const dir = node.direction;
      const handleClass = dir === 'horizontal' ? 'tile-split-handle-h' : 'tile-split-handle-v';
      return (
        <PanelGroup direction={dir}>
          <Panel minSize={10}>
            {renderNode(node.children[0])}
          </Panel>
          <PanelResizeHandle className={handleClass} />
          <Panel minSize={10}>
            {renderNode(node.children[1])}
          </Panel>
        </PanelGroup>
      );
    }

    if (node.type === 'terminal') {
      const paneId = node.terminalId;
      const pane = terminalPanes[paneId];
      const activeTab = pane?.tabs.find(tab => tab.id === pane.activeTabId) || pane?.tabs[0];
      if (activeTab) activeTerminalSessionIds.add(activeTab.id);

      return (
        <div
          className={`tile-pane${getDropClass(paneId)}`}
          onClick={() => onFocusPane(paneId)}
          onDragOver={(e) => handlePaneDragOver(e, paneId)}
          onDragLeave={(e) => handlePaneDragLeave(e, paneId)}
          onDrop={(e) => handlePaneDrop(e, paneId)}
        >
          <PaneHeader
            title={activeTab?.label || 'Terminal'}
            paneId={paneId}
            paneType="terminal"
            isActive={activePaneId === paneId}
            canClose={canClose}
            onSplitH={() => onSplitPane(paneId, 'vertical')}
            onSplitV={() => onSplitPane(paneId, 'horizontal')}
            onClose={() => onClosePane(paneId)}
            onFocus={() => onFocusPane(paneId)}
          />
          <div className="terminal-tabs" onMouseDown={() => onFocusPane(paneId)}>
            {(pane?.tabs || []).map(tab => {
              const isActive = tab.id === pane.activeTabId;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`terminal-tab ${isActive ? 'active' : ''}`}
                  draggable
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTerminalTab(paneId, tab.id);
                  }}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(TERMINAL_TAB_DND_MIME, JSON.stringify({ paneId, tabId: tab.id }));
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                >
                  <span className="terminal-tab-name">{tab.label}</span>
                  <span
                    className="terminal-tab-close"
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTerminalTab(paneId, tab.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        onCloseTerminalTab(paneId, tab.id);
                      }
                    }}
                    aria-label={`Close ${tab.label}`}
                  >
                    x
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              className="terminal-tab-add"
              onClick={(e) => {
                e.stopPropagation();
                onCreateTerminalTab(paneId);
              }}
              title="New terminal tab"
              aria-label="New terminal tab"
            >
              +
            </button>
          </div>
          <div className="tile-pane-content">
            {activeTab ? (
              <TerminalPanel sessionId={activeTab.id} visible={true} cwd={cwd} theme={theme} onOpenFile={onOpenFile} />
            ) : (
              <div className="tile-pane-empty">Terminal not available</div>
            )}
          </div>
        </div>
      );
    }

    // editor
    const paneId = node.filePath;
    const paneState = openFiles[paneId];
    const activeTab = paneState?.tabs.find(tab => tab.id === paneState.activeTabId) || paneState?.tabs[0];
    const displayPath = activeTab?.file.path || paneId;
    if (!paneState || !activeTab) {
      return (
        <div
          className={`tile-pane${getDropClass(paneId)}`}
          onDragOver={(e) => handlePaneDragOver(e, paneId)}
          onDragLeave={(e) => handlePaneDragLeave(e, paneId)}
          onDrop={(e) => handlePaneDrop(e, paneId)}
        >
          <PaneHeader
            title={displayPath}
            paneId={paneId}
            paneType="editor"
            canClose={canClose}
            onClose={() => onClosePane(paneId)}
            onFocus={() => onFocusPane(paneId)}
          />
          <div className="tile-pane-content tile-pane-empty">File not loaded</div>
        </div>
      );
    }

    return (
      <div
        className={`tile-pane${getDropClass(paneId)}`}
        onClick={() => onFocusPane(paneId)}
        onDragOver={(e) => handlePaneDragOver(e, paneId)}
        onDragLeave={(e) => handlePaneDragLeave(e, paneId)}
        onDrop={(e) => handlePaneDrop(e, paneId)}
      >
        <EditorPane
          paneId={paneId}
          file={activeTab.file}
          filePath={displayPath}
          tabs={paneState.tabs.map(tab => ({ id: tab.id, path: tab.file.path, pinned: tab.pinned }))}
          activeTabId={activeTab.id}
          isActive={activePaneId === paneId}
          canClose={canClose}
          cwd={cwd}
          vimMode={vimMode}
          onToggleVim={onToggleVim}
          onSave={(content) => onSaveFile(paneId, content)}
          onCloseTab={(tabId) => onCloseEditorTab(paneId, tabId)}
          onSelectTab={(tabId) => onSelectEditorTab(paneId, tabId)}
          onClose={() => onClosePane(paneId)}
          onFocus={() => onFocusPane(paneId)}
          onSplitH={() => onSplitPane(paneId, 'vertical')}
          onSplitV={() => onSplitPane(paneId, 'horizontal')}
          onOpenFile={onOpenFile}
        />
      </div>
    );
  }

  return (
    <div className="tile-renderer">
      {renderNode(layout)}
      {/* Keep non-visible terminals mounted but hidden */}
      {allTerminals
        .filter(t => !activeTerminalSessionIds.has(t.id))
        .map(t => (
          <TerminalPanel key={t.id} sessionId={t.id} visible={false} cwd={cwd} theme={theme} onOpenFile={onOpenFile} />
        ))
      }
    </div>
  );
}
