import { useState, useCallback, useEffect, useRef, type KeyboardEvent } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { Sidebar, type WorkspaceInfo } from './components/Sidebar';
import { FileTree } from './components/FileTree';
import { TileRenderer } from './components/TileRenderer';
import { QuickOpen } from './components/QuickOpen';
import type { OpenFile } from './components/FileViewer';
import type { TileNode, TerminalTabInfo } from './lib/tileLayout';
import {
  findInTile,
  removeFromTile,
  splitAtTile,
  splitAtTileWithPlacement,
  swapTiles,
  getAllLeafIds,
} from './lib/tileLayout';
import { fetchFile } from './lib/api';
import { ThemeContext, getStoredTheme, setStoredTheme, type Theme } from './lib/theme';

interface EditorTabState {
  id: string;
  file: OpenFile;
  pinned: boolean;
}

interface EditorPaneState {
  tabs: EditorTabState[];
  activeTabId: string;
}

interface TerminalPaneState {
  tabs: TerminalTabInfo[];
  activeTabId: string;
}

interface WorkspaceState {
  info: WorkspaceInfo;
  openFiles: Record<string, EditorPaneState>;
  terminalPanes: Record<string, TerminalPaneState>;
  cwd: string;
  terminals: TerminalTabInfo[];
  layout: TileNode;
  activePaneId: string;
}

const DEFAULT_CWD = import.meta.env.VITE_PROJECT_ROOT || '.';

let nextIndex = 1;

function createTerminalSession(terminals: TerminalTabInfo[]): TerminalTabInfo {
  return {
    id: crypto.randomUUID(),
    label: `T${terminals.length + 1}`,
  };
}

function dropPositionToSplit(position: 'center' | 'left' | 'right' | 'top' | 'bottom'): {
  direction: 'horizontal' | 'vertical';
  placement: 'before' | 'after';
} {
  if (position === 'left') return { direction: 'horizontal', placement: 'before' };
  if (position === 'right') return { direction: 'horizontal', placement: 'after' };
  if (position === 'top') return { direction: 'vertical', placement: 'before' };
  if (position === 'bottom') return { direction: 'vertical', placement: 'after' };
  // Center still creates a new split pane, matching requested behavior.
  return { direction: 'horizontal', placement: 'after' };
}

// Initialize theme before first render
const initialTheme = getStoredTheme();
if (initialTheme === 'light') {
  document.documentElement.dataset.theme = 'light';
}

export function App() {
  const [workspaces, setWorkspaces] = useState<WorkspaceState[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [quickOpenVisible, setQuickOpenVisible] = useState(false);
  const [vimMode, setVimMode] = useState(() => {
    try { return localStorage.getItem('ccweb-vim-mode') === 'true'; } catch { return false; }
  });

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      setStoredTheme(next);
      return next;
    });
  }, []);

  const toggleVimMode = useCallback(() => {
    setVimMode(prev => {
      const next = !prev;
      try { localStorage.setItem('ccweb-vim-mode', String(next)); } catch {}
      return next;
    });
  }, []);

  const createWorkspace = useCallback(() => {
    const id = crypto.randomUUID();
    const termPaneId = `terminal::${crypto.randomUUID()}`;
    const firstTerminal = createTerminalSession([]);
    const ws: WorkspaceState = {
      info: { id, name: `Session ${nextIndex}`, index: nextIndex },
      openFiles: {},
      terminalPanes: {
        [termPaneId]: {
          tabs: [firstTerminal],
          activeTabId: firstTerminal.id,
        },
      },
      cwd: DEFAULT_CWD,
      terminals: [firstTerminal],
      layout: { type: 'terminal', terminalId: termPaneId },
      activePaneId: termPaneId,
    };
    nextIndex++;
    setWorkspaces(prev => [...prev, ws]);
    setActiveId(id);
  }, []);

  const closeWorkspace = useCallback((id: string) => {
    setWorkspaces(prev => {
      const next = prev.filter(w => w.info.id !== id);
      return next;
    });
    setActiveId(prev => {
      if (prev !== id) return prev;
      const remaining = workspaces.filter(w => w.info.id !== id);
      return remaining.length > 0 ? remaining[remaining.length - 1].info.id : null;
    });
  }, [workspaces]);

  // ── File operations ──

  const handleFileSelect = useCallback(async (filePath: string, options?: { pinned?: boolean }) => {
    const pinned = options?.pinned === true;
    try {
      const active = workspaces.find(w => w.info.id === activeId);
      const root = active?.cwd !== DEFAULT_CWD ? active?.cwd : undefined;
      const data = await fetchFile(filePath, root);

      setWorkspaces(prev =>
        prev.map(w => {
          if (w.info.id !== activeId) return w;

          const activeNode = findInTile(w.layout, w.activePaneId);
          let targetPaneId: string | null = activeNode?.type === 'editor' ? activeNode.filePath : null;
          if (!targetPaneId) {
            const firstEditorPaneId = getAllLeafIds(w.layout)
              .find(id => findInTile(w.layout, id)?.type === 'editor');
            if (firstEditorPaneId) targetPaneId = firstEditorPaneId;
          }

          // No editor pane yet: create one and open the file there.
          if (!targetPaneId) {
            const newEditorPaneId = `editor::${crypto.randomUUID()}`;
            const newTabId = pinned ? `${data.path}::${crypto.randomUUID()}` : `preview::${crypto.randomUUID()}`;
            const newLayout = splitAtTile(
              w.layout,
              w.activePaneId,
              { type: 'editor', filePath: newEditorPaneId },
              'horizontal',
            );
            return {
              ...w,
              openFiles: {
                ...w.openFiles,
                [newEditorPaneId]: {
                  tabs: [{ id: newTabId, file: data, pinned }],
                  activeTabId: newTabId,
                },
              },
              layout: newLayout,
              activePaneId: newEditorPaneId,
            };
          }

          const pane = w.openFiles[targetPaneId];
          if (!pane) return w;

          let tabs = pane.tabs.map(tab =>
            tab.file.path === filePath ? { ...tab, file: data } : tab
          );
          let activeTabId = pane.activeTabId;

          const existingTab = tabs.find(tab => tab.file.path === filePath);
          if (existingTab) {
            if (pinned && !existingTab.pinned) {
              tabs = tabs.map(tab =>
                tab.id === existingTab.id ? { ...tab, pinned: true } : tab
              );
            }
            activeTabId = existingTab.id;
          } else if (pinned) {
            const tabId = `${data.path}::${crypto.randomUUID()}`;
            tabs = [...tabs, { id: tabId, file: data, pinned: true }];
            activeTabId = tabId;
          } else {
            const previewTab = tabs.find(tab => !tab.pinned);
            if (previewTab) {
              tabs = tabs.map(tab =>
                tab.id === previewTab.id ? { ...tab, file: data } : tab
              );
              activeTabId = previewTab.id;
            } else {
              const tabId = `preview::${crypto.randomUUID()}`;
              tabs = [...tabs, { id: tabId, file: data, pinned: false }];
              activeTabId = tabId;
            }
          }

          return {
            ...w,
            openFiles: {
              ...w.openFiles,
              [targetPaneId]: {
                tabs,
                activeTabId,
              },
            },
            activePaneId: targetPaneId,
          };
        })
      );
    } catch (err) {
      console.error('Failed to load file:', err);
    }
  }, [activeId, workspaces]);

  const handleSaveFile = useCallback((paneId: string, newContent: string) => {
    setWorkspaces(prev =>
      prev.map(w => {
        if (w.info.id !== activeId) return w;

        const activePane = w.openFiles[paneId];
        if (!activePane) return w;
        const activeTab = activePane.tabs.find(tab => tab.id === activePane.activeTabId) || activePane.tabs[0];
        if (!activeTab) return w;

        // Keep same-path tabs synchronized across all editor panes.
        const newOpenFiles: Record<string, EditorPaneState> = {};
        for (const [id, pane] of Object.entries(w.openFiles)) {
          newOpenFiles[id] = {
            ...pane,
            tabs: pane.tabs.map(tab =>
              tab.file.path === activeTab.file.path
                ? { ...tab, file: { ...tab.file, content: newContent } }
                : tab
            ),
          };
        }

        return {
          ...w,
          openFiles: newOpenFiles,
        };
      })
    );
  }, [activeId]);

  const handleSelectEditorTab = useCallback((paneId: string, tabId: string) => {
    setWorkspaces(prev =>
      prev.map(w => {
        if (w.info.id !== activeId) return w;
        const pane = w.openFiles[paneId];
        if (!pane) return w;
        if (!pane.tabs.some(tab => tab.id === tabId)) return w;
        return {
          ...w,
          openFiles: {
            ...w.openFiles,
            [paneId]: { ...pane, activeTabId: tabId },
          },
          activePaneId: paneId,
        };
      })
    );
  }, [activeId]);

  const handleCloseEditorTab = useCallback((paneId: string, tabId: string) => {
    setWorkspaces(prev =>
      prev.map(w => {
        if (w.info.id !== activeId) return w;
        const pane = w.openFiles[paneId];
        if (!pane) return w;

        const tabIndex = pane.tabs.findIndex(tab => tab.id === tabId);
        if (tabIndex === -1) return w;

        const nextTabs = pane.tabs.filter(tab => tab.id !== tabId);
        if (nextTabs.length === 0) {
          const newLayout = removeFromTile(w.layout, paneId);
          if (!newLayout) return w;

          const newOpenFiles = { ...w.openFiles };
          delete newOpenFiles[paneId];

          let newActivePaneId = w.activePaneId;
          if (newActivePaneId === paneId) {
            const allIds = getAllLeafIds(newLayout);
            newActivePaneId = allIds[0] || w.activePaneId;
          }

          return {
            ...w,
            openFiles: newOpenFiles,
            layout: newLayout,
            activePaneId: newActivePaneId,
          };
        }

        const nextActiveTabId = pane.activeTabId === tabId
          ? (nextTabs[Math.max(0, tabIndex - 1)]?.id || nextTabs[0].id)
          : pane.activeTabId;

        return {
          ...w,
          openFiles: {
            ...w.openFiles,
            [paneId]: {
              ...pane,
              tabs: nextTabs,
              activeTabId: nextActiveTabId,
            },
          },
          activePaneId: paneId,
        };
      })
    );
  }, [activeId]);

  const handleCreateTerminalTab = useCallback((paneId: string) => {
    setWorkspaces(prev =>
      prev.map(w => {
        if (w.info.id !== activeId) return w;
        if (findInTile(w.layout, paneId)?.type !== 'terminal') return w;

        const pane = w.terminalPanes[paneId];
        if (!pane) return w;

        const newTerminal = createTerminalSession(w.terminals);
        return {
          ...w,
          terminals: [...w.terminals, newTerminal],
          terminalPanes: {
            ...w.terminalPanes,
            [paneId]: {
              tabs: [...pane.tabs, newTerminal],
              activeTabId: newTerminal.id,
            },
          },
          activePaneId: paneId,
        };
      })
    );
  }, [activeId]);

  const handleSelectTerminalTab = useCallback((paneId: string, tabId: string) => {
    setWorkspaces(prev =>
      prev.map(w => {
        if (w.info.id !== activeId) return w;
        const pane = w.terminalPanes[paneId];
        if (!pane) return w;
        if (!pane.tabs.some(tab => tab.id === tabId)) return w;

        return {
          ...w,
          terminalPanes: {
            ...w.terminalPanes,
            [paneId]: {
              ...pane,
              activeTabId: tabId,
            },
          },
          activePaneId: paneId,
        };
      })
    );
  }, [activeId]);

  const handleCloseTerminalTab = useCallback((paneId: string, tabId: string) => {
    setWorkspaces(prev =>
      prev.map(w => {
        if (w.info.id !== activeId) return w;

        const pane = w.terminalPanes[paneId];
        if (!pane) return w;

        const tabIndex = pane.tabs.findIndex(tab => tab.id === tabId);
        if (tabIndex === -1) return w;

        const nextTabs = pane.tabs.filter(tab => tab.id !== tabId);
        const nextTerminals = w.terminals.filter(tab => tab.id !== tabId);

        if (nextTabs.length === 0) {
          const newLayout = removeFromTile(w.layout, paneId);
          if (!newLayout) return w;

          const nextTerminalPanes = { ...w.terminalPanes };
          delete nextTerminalPanes[paneId];

          let newActivePaneId = w.activePaneId;
          if (newActivePaneId === paneId) {
            const allIds = getAllLeafIds(newLayout);
            newActivePaneId = allIds[0] || w.activePaneId;
          }

          return {
            ...w,
            terminals: nextTerminals,
            terminalPanes: nextTerminalPanes,
            layout: newLayout,
            activePaneId: newActivePaneId,
          };
        }

        const nextActiveTabId = pane.activeTabId === tabId
          ? (nextTabs[Math.max(0, tabIndex - 1)]?.id || nextTabs[0].id)
          : pane.activeTabId;

        return {
          ...w,
          terminals: nextTerminals,
          terminalPanes: {
            ...w.terminalPanes,
            [paneId]: {
              tabs: nextTabs,
              activeTabId: nextActiveTabId,
            },
          },
          activePaneId: paneId,
        };
      })
    );
  }, [activeId]);

  const handleMoveTerminalTab = useCallback((fromPaneId: string, tabId: string, targetPaneId: string) => {
    setWorkspaces(prev =>
      prev.map(w => {
        if (w.info.id !== activeId) return w;
        if (fromPaneId === targetPaneId) return w;

        const sourceNode = findInTile(w.layout, fromPaneId);
        const targetNode = findInTile(w.layout, targetPaneId);
        if (sourceNode?.type !== 'terminal' || targetNode?.type !== 'terminal') return w;

        const sourcePane = w.terminalPanes[fromPaneId];
        const targetPane = w.terminalPanes[targetPaneId];
        if (!sourcePane || !targetPane) return w;

        const movedTab = sourcePane.tabs.find(tab => tab.id === tabId);
        if (!movedTab) return w;

        const remainingSourceTabs = sourcePane.tabs.filter(tab => tab.id !== tabId);
        let layout = w.layout;
        const terminalPanes = { ...w.terminalPanes };

        if (remainingSourceTabs.length === 0) {
          const prunedLayout = removeFromTile(layout, fromPaneId);
          if (!prunedLayout) return w;
          layout = prunedLayout;
          delete terminalPanes[fromPaneId];
          if (!findInTile(layout, targetPaneId)) return w;
        } else {
          const sourceTabIndex = sourcePane.tabs.findIndex(tab => tab.id === tabId);
          const nextActiveTabId = sourcePane.activeTabId === tabId
            ? (remainingSourceTabs[Math.max(0, sourceTabIndex - 1)]?.id || remainingSourceTabs[0].id)
            : sourcePane.activeTabId;
          terminalPanes[fromPaneId] = {
            ...sourcePane,
            tabs: remainingSourceTabs,
            activeTabId: nextActiveTabId,
          };
        }

        const updatedTargetPane = terminalPanes[targetPaneId];
        if (!updatedTargetPane) return w;
        const targetHasTab = updatedTargetPane.tabs.some(tab => tab.id === tabId);
        const nextTargetTabs = targetHasTab ? updatedTargetPane.tabs : [...updatedTargetPane.tabs, movedTab];
        terminalPanes[targetPaneId] = {
          ...updatedTargetPane,
          tabs: nextTargetTabs,
          activeTabId: movedTab.id,
        };

        return {
          ...w,
          terminalPanes,
          layout,
          activePaneId: targetPaneId,
        };
      })
    );
  }, [activeId]);

  // ── Pane operations ──

  const handleSplitPane = useCallback((paneId: string, direction: 'horizontal' | 'vertical') => {
    setWorkspaces(prev =>
      prev.map(w => {
        if (w.info.id !== activeId) return w;

        const splitNode = findInTile(w.layout, paneId);
        if (!splitNode) return w;

        // Split terminal pane => create terminal pane.
        if (splitNode.type === 'terminal') {
          const newPaneId = `terminal::${crypto.randomUUID()}`;
          const newTerminal = createTerminalSession(w.terminals);

          const newLayout = splitAtTile(
            w.layout, paneId,
            { type: 'terminal', terminalId: newPaneId },
            direction,
          );

          return {
            ...w,
            terminals: [...w.terminals, newTerminal],
            terminalPanes: {
              ...w.terminalPanes,
              [newPaneId]: {
                tabs: [newTerminal],
                activeTabId: newTerminal.id,
              },
            },
            layout: newLayout,
            activePaneId: newPaneId,
          };
        }

        // Split editor pane => create another editor pane for the active tab.
        const sourcePane = w.openFiles[splitNode.filePath];
        if (!sourcePane) return w;
        const sourceTab = sourcePane.tabs.find(tab => tab.id === sourcePane.activeTabId) || sourcePane.tabs[0];
        if (!sourceTab) return w;

        const newEditorPaneId = `editor::${crypto.randomUUID()}`;
        const newTabId = `${sourceTab.file.path}::${crypto.randomUUID()}`;
        const newLayout = splitAtTile(
          w.layout,
          paneId,
          { type: 'editor', filePath: newEditorPaneId },
          direction,
        );

        return {
          ...w,
          openFiles: {
            ...w.openFiles,
            [newEditorPaneId]: {
              tabs: [{ id: newTabId, file: { ...sourceTab.file }, pinned: true }],
              activeTabId: newTabId,
            },
          },
          layout: newLayout,
          activePaneId: newEditorPaneId,
        };
      })
    );
  }, [activeId]);

  const handleClosePane = useCallback((paneId: string) => {
    setWorkspaces(prev =>
      prev.map(w => {
        if (w.info.id !== activeId) return w;

        const newLayout = removeFromTile(w.layout, paneId);
        if (!newLayout) return w; // Don't remove the last pane

        // Clean up editor files
        const node = findInTile(w.layout, paneId);
        const newOpenFiles = { ...w.openFiles };
        const newTerminalPanes = { ...w.terminalPanes };
        let newTerminals = w.terminals;
        if (node?.type === 'editor') {
          delete newOpenFiles[node.filePath];
        } else if (node?.type === 'terminal') {
          const pane = w.terminalPanes[node.terminalId];
          const tabIds = new Set((pane?.tabs || []).map(tab => tab.id));
          newTerminals = w.terminals.filter(tab => !tabIds.has(tab.id));
          delete newTerminalPanes[node.terminalId];
        }

        // Pick new active pane if needed
        let newActivePaneId = w.activePaneId;
        if (newActivePaneId === paneId) {
          const allIds = getAllLeafIds(newLayout);
          newActivePaneId = allIds[0] || w.activePaneId;
        }

        return {
          ...w,
          openFiles: newOpenFiles,
          terminalPanes: newTerminalPanes,
          terminals: newTerminals,
          layout: newLayout,
          activePaneId: newActivePaneId,
        };
      })
    );
  }, [activeId]);

  const handleSwapPanes = useCallback((fromId: string, toId: string) => {
    setWorkspaces(prev =>
      prev.map(w => {
        if (w.info.id !== activeId) return w;
        return { ...w, layout: swapTiles(w.layout, fromId, toId) };
      })
    );
  }, [activeId]);

  const handleDropSplit = useCallback((fromId: string, targetId: string, direction: 'horizontal' | 'vertical') => {
    setWorkspaces(prev =>
      prev.map(w => {
        if (w.info.id !== activeId) return w;

        const fromNode = findInTile(w.layout, fromId);
        if (!fromNode) return w;

        let newLayout = removeFromTile(w.layout, fromId);
        if (!newLayout) return w;

        newLayout = splitAtTile(newLayout, targetId, fromNode, direction);
        return { ...w, layout: newLayout };
      })
    );
  }, [activeId]);

  const handleDropEditorTab = useCallback((
    fromPaneId: string,
    tabId: string,
    targetPaneId: string,
    position: 'center' | 'left' | 'right' | 'top' | 'bottom',
  ) => {
    setWorkspaces(prev =>
      prev.map(w => {
        if (w.info.id !== activeId) return w;

        const targetNode = findInTile(w.layout, targetPaneId);
        if (targetNode?.type !== 'terminal') return w;

        const sourcePane = w.openFiles[fromPaneId];
        if (!sourcePane) return w;
        const draggedIndex = sourcePane.tabs.findIndex(tab => tab.id === tabId);
        if (draggedIndex === -1) return w;

        const draggedTab = sourcePane.tabs[draggedIndex];
        const remainingSourceTabs = sourcePane.tabs.filter(tab => tab.id !== tabId);
        let layout = w.layout;
        const openFiles = { ...w.openFiles };

        if (remainingSourceTabs.length === 0) {
          const prunedLayout = removeFromTile(layout, fromPaneId);
          if (!prunedLayout) return w;
          layout = prunedLayout;
          delete openFiles[fromPaneId];
        } else {
          const nextActiveTabId = sourcePane.activeTabId === tabId
            ? (remainingSourceTabs[Math.max(0, draggedIndex - 1)]?.id || remainingSourceTabs[0].id)
            : sourcePane.activeTabId;
          openFiles[fromPaneId] = {
            ...sourcePane,
            tabs: remainingSourceTabs,
            activeTabId: nextActiveTabId,
          };
        }

        if (!findInTile(layout, targetPaneId)) return w;

        const { direction, placement } = dropPositionToSplit(position);
        const newPaneId = `editor::${crypto.randomUUID()}`;
        const newTabId = `${draggedTab.file.path}::${crypto.randomUUID()}`;
        const newLayout = splitAtTileWithPlacement(
          layout,
          targetPaneId,
          { type: 'editor', filePath: newPaneId },
          direction,
          placement,
        );

        openFiles[newPaneId] = {
          tabs: [{ ...draggedTab, id: newTabId, pinned: true }],
          activeTabId: newTabId,
        };

        return {
          ...w,
          openFiles,
          layout: newLayout,
          activePaneId: newPaneId,
        };
      })
    );
  }, [activeId]);

  const handleMoveEditorTab = useCallback((
    fromPaneId: string,
    tabId: string,
    targetPaneId: string,
  ) => {
    setWorkspaces(prev =>
      prev.map(w => {
        if (w.info.id !== activeId) return w;

        if (fromPaneId === targetPaneId) return w;

        const sourceNode = findInTile(w.layout, fromPaneId);
        const targetNode = findInTile(w.layout, targetPaneId);
        if (sourceNode?.type !== 'editor' || targetNode?.type !== 'editor') return w;

        const sourcePane = w.openFiles[fromPaneId];
        const targetPane = w.openFiles[targetPaneId];
        if (!sourcePane) return w;
        if (!targetPane) return w;

        const draggedIndex = sourcePane.tabs.findIndex(tab => tab.id === tabId);
        if (draggedIndex === -1) return w;

        const draggedTab = sourcePane.tabs[draggedIndex];
        const remainingSourceTabs = sourcePane.tabs.filter(tab => tab.id !== tabId);
        let layout = w.layout;
        let openFiles = { ...w.openFiles };
        let activePaneId = w.activePaneId;

        if (remainingSourceTabs.length === 0) {
          const prunedLayout = removeFromTile(layout, fromPaneId);
          if (!prunedLayout) return w;
          layout = prunedLayout;
          delete openFiles[fromPaneId];
          if (!findInTile(layout, targetPaneId)) return w;
        } else {
          const nextActiveTabId = sourcePane.activeTabId === tabId
            ? (remainingSourceTabs[Math.max(0, draggedIndex - 1)]?.id || remainingSourceTabs[0].id)
            : sourcePane.activeTabId;
          openFiles[fromPaneId] = {
            ...sourcePane,
            tabs: remainingSourceTabs,
            activeTabId: nextActiveTabId,
          };
        }

        const updatedTargetPane = openFiles[targetPaneId];
        if (!updatedTargetPane) return w;

        const existingTargetTab = updatedTargetPane.tabs.find(tab => tab.file.path === draggedTab.file.path);
        let nextTargetTabs = updatedTargetPane.tabs;
        let nextTargetActiveTabId = updatedTargetPane.activeTabId;

        if (existingTargetTab) {
          nextTargetTabs = updatedTargetPane.tabs.map(tab =>
            tab.id === existingTargetTab.id
              ? {
                  ...tab,
                  pinned: tab.pinned || draggedTab.pinned,
                  file: draggedTab.file,
                }
              : tab
          );
          nextTargetActiveTabId = existingTargetTab.id;
        } else {
          nextTargetTabs = [...updatedTargetPane.tabs, draggedTab];
          nextTargetActiveTabId = draggedTab.id;
        }

        openFiles[targetPaneId] = {
          ...updatedTargetPane,
          tabs: nextTargetTabs,
          activeTabId: nextTargetActiveTabId,
        };

        activePaneId = targetPaneId;

        return {
          ...w,
          openFiles,
          layout,
          activePaneId,
        };
      })
    );
  }, [activeId]);

  const handleFocusPane = useCallback((paneId: string) => {
    setWorkspaces(prev =>
      prev.map(w => {
        if (w.info.id !== activeId) return w;
        if (w.activePaneId === paneId) return w;
        return { ...w, activePaneId: paneId };
      })
    );
  }, [activeId]);

  // ── Workspace operations ──

  const renameWorkspace = useCallback((id: string, newName: string) => {
    setWorkspaces(prev =>
      prev.map(w =>
        w.info.id === id ? { ...w, info: { ...w.info, name: newName } } : w
      )
    );
  }, []);

  const setCwd = useCallback((id: string, newCwd: string) => {
    setWorkspaces(prev =>
      prev.map(w =>
        w.info.id === id ? { ...w, cwd: newCwd } : w
      )
    );
  }, []);

  // Auto-create first workspace
  useEffect(() => {
    if (workspaces.length === 0) {
      createWorkspace();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Global Ctrl+P / Cmd+P shortcut for quick open
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        setQuickOpenVisible(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Prevent browser tab close and close active editor tab on Ctrl/Cmd+W.
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const activeWorkspace = workspaces.find(w => w.info.id === activeId);
        if (!activeWorkspace) return;
        const activeNode = findInTile(activeWorkspace.layout, activeWorkspace.activePaneId);
        if (activeNode?.type === 'editor') {
          const pane = activeWorkspace.openFiles[activeWorkspace.activePaneId];
          const tabId = pane?.activeTabId;
          if (tabId) handleCloseEditorTab(activeWorkspace.activePaneId, tabId);
          return;
        }

        // If focus is not on an editor pane, close the active tab of the most recently opened editor pane.
        const editorPaneIds = Object.keys(activeWorkspace.openFiles).filter(
          paneId => findInTile(activeWorkspace.layout, paneId)?.type === 'editor'
        );
        const targetPaneId = editorPaneIds[editorPaneIds.length - 1];
        if (targetPaneId) {
          const tabId = activeWorkspace.openFiles[targetPaneId]?.activeTabId;
          if (tabId) handleCloseEditorTab(targetPaneId, tabId);
        }
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [activeId, workspaces, handleCloseEditorTab]);

  // Show native browser warning when attempting to close/reload with editor panes open.
  useEffect(() => {
    const hasOpenEditors = workspaces.some(w =>
      Object.keys(w.openFiles).some(paneId => findInTile(w.layout, paneId)?.type === 'editor')
    );
    if (!hasOpenEditors) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Required for Chrome/Edge/Safari to trigger the generic leave-site warning dialog.
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [workspaces]);

  const active = workspaces.find(w => w.info.id === activeId);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
    <div className="app">
      <Sidebar
        workspaces={workspaces.map(w => w.info)}
        activeId={activeId}
        onSelect={setActiveId}
        onClose={closeWorkspace}
        onCreate={createWorkspace}
        onRename={renameWorkspace}
      />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <PanelGroup direction="horizontal" autoSaveId="ccweb-h">
          <Panel defaultSize={20} minSize={12} maxSize={35}>
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <PathBar
                cwd={active?.cwd || DEFAULT_CWD}
                onCwdChange={(newCwd) => {
                  if (activeId) setCwd(activeId, newCwd);
                }}
              />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <FileTree
                  onFileSelect={handleFileSelect}
                  root={active?.cwd !== DEFAULT_CWD ? active?.cwd : undefined}
                />
              </div>
            </div>
          </Panel>
          <PanelResizeHandle className="resize-handle resize-handle-h" />
          <Panel>
            {workspaces.map(ws => (
              <div
                key={ws.info.id}
                style={{
                  display: ws.info.id === activeId ? 'flex' : 'none',
                  flexDirection: 'column',
                  height: '100%',
                }}
              >
                <TileRenderer
                  layout={ws.layout}
                  openFiles={ws.openFiles}
                  terminalPanes={ws.terminalPanes}
                  allTerminals={ws.terminals}
                  activePaneId={ws.activePaneId}
                  cwd={ws.cwd !== DEFAULT_CWD ? ws.cwd : undefined}
                  theme={theme}
                  vimMode={vimMode}
                  onToggleVim={toggleVimMode}
                  onSplitPane={handleSplitPane}
                  onClosePane={handleClosePane}
                  onSwapPanes={handleSwapPanes}
                  onDropSplit={handleDropSplit}
                  onDropEditorTab={handleDropEditorTab}
                  onMoveEditorTab={handleMoveEditorTab}
                  onMoveTerminalTab={handleMoveTerminalTab}
                  onFocusPane={handleFocusPane}
                  onCreateTerminalTab={handleCreateTerminalTab}
                  onSelectTerminalTab={handleSelectTerminalTab}
                  onCloseTerminalTab={handleCloseTerminalTab}
                  onSelectEditorTab={handleSelectEditorTab}
                  onCloseEditorTab={handleCloseEditorTab}
                  onSaveFile={handleSaveFile}
                  onOpenFile={(path) => handleFileSelect(path, { pinned: true })}
                />
              </div>
            ))}
          </Panel>
        </PanelGroup>
      </div>
      {quickOpenVisible && (
        <QuickOpen
          root={active?.cwd !== DEFAULT_CWD ? active?.cwd : undefined}
          onSelect={(path) => handleFileSelect(path, { pinned: true })}
          onClose={() => setQuickOpenVisible(false)}
        />
      )}
    </div>
    </ThemeContext.Provider>
  );
}

function PathBar({ cwd, onCwdChange }: { cwd: string; onCwdChange: (cwd: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cwd);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(cwd);
  }, [cwd]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== cwd) {
      onCwdChange(trimmed);
    } else {
      setDraft(cwd);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commit();
    } else if (e.key === 'Escape') {
      setDraft(cwd);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <div className="path-bar">
        <input
          ref={inputRef}
          className="path-bar-input"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          spellCheck={false}
        />
      </div>
    );
  }

  return (
    <div
      className="path-bar"
      onDoubleClick={() => setEditing(true)}
      title="Double-click to change working directory"
    >
      <span className="path-bar-text">{cwd}</span>
    </div>
  );
}
