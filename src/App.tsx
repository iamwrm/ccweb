import { useState, useCallback, useEffect, useRef, type KeyboardEvent } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { Sidebar, type WorkspaceInfo } from './components/Sidebar';
import { FileTree } from './components/FileTree';
import { FileViewer, type OpenFile } from './components/FileViewer';
import { TerminalArea, type TerminalLayout } from './components/TerminalArea';
import type { TerminalTabInfo } from './components/TerminalTabs';
import { fetchFile } from './lib/api';
import { ThemeContext, getStoredTheme, setStoredTheme, type Theme } from './lib/theme';

interface WorkspaceState {
  info: WorkspaceInfo;
  openFile: OpenFile | null;
  cwd: string;
  terminals: TerminalTabInfo[];
  activeTerminalId: string;
  layout: TerminalLayout;
}

const DEFAULT_CWD = import.meta.env.VITE_PROJECT_ROOT || '.';

let nextIndex = 1;

// ── Layout helpers ──

/** Replace a terminal node in the layout tree with a new subtree. */
function replaceInLayout(
  layout: TerminalLayout,
  targetId: string,
  replacement: TerminalLayout,
): TerminalLayout {
  if (layout.type === 'terminal') {
    return layout.terminalId === targetId ? replacement : layout;
  }
  return {
    ...layout,
    children: [
      replaceInLayout(layout.children[0], targetId, replacement),
      replaceInLayout(layout.children[1], targetId, replacement),
    ],
  };
}

/** Remove a terminal node from the layout tree. Returns the pruned tree, or null if empty. */
function removeFromLayout(
  layout: TerminalLayout,
  targetId: string,
): TerminalLayout | null {
  if (layout.type === 'terminal') {
    return layout.terminalId === targetId ? null : layout;
  }
  const left = removeFromLayout(layout.children[0], targetId);
  const right = removeFromLayout(layout.children[1], targetId);
  if (!left && !right) return null;
  if (!left) return right;
  if (!right) return left;
  return { ...layout, children: [left, right] };
}

/** Check if a terminal ID exists in the layout tree. */
function existsInLayout(layout: TerminalLayout, terminalId: string): boolean {
  if (layout.type === 'terminal') {
    return layout.terminalId === terminalId;
  }
  return existsInLayout(layout.children[0], terminalId) || existsInLayout(layout.children[1], terminalId);
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

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      setStoredTheme(next);
      return next;
    });
  }, []);

  const createWorkspace = useCallback(() => {
    const id = crypto.randomUUID();
    const termId = crypto.randomUUID();
    const ws: WorkspaceState = {
      info: { id, name: `Session ${nextIndex}`, index: nextIndex },
      openFile: null,
      cwd: DEFAULT_CWD,
      terminals: [{ id: termId, label: 'T1' }],
      activeTerminalId: termId,
      layout: { type: 'terminal', terminalId: termId },
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

  const handleFileSelect = useCallback(async (filePath: string) => {
    try {
      const active = workspaces.find(w => w.info.id === activeId);
      const root = active?.cwd !== DEFAULT_CWD ? active?.cwd : undefined;
      const data = await fetchFile(filePath, root);
      setWorkspaces(prev =>
        prev.map(w =>
          w.info.id === activeId ? { ...w, openFile: data } : w
        )
      );
    } catch (err) {
      console.error('Failed to load file:', err);
    }
  }, [activeId, workspaces]);

  const closeFile = useCallback(() => {
    setWorkspaces(prev =>
      prev.map(w =>
        w.info.id === activeId ? { ...w, openFile: null } : w
      )
    );
  }, [activeId]);

  const handleFileSave = useCallback((newContent: string) => {
    setWorkspaces(prev =>
      prev.map(w =>
        w.info.id === activeId && w.openFile
          ? { ...w, openFile: { ...w.openFile, content: newContent } }
          : w
      )
    );
  }, [activeId]);

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

  // ── Multi-terminal callbacks ──

  const addTerminal = useCallback((workspaceId: string) => {
    setWorkspaces(prev =>
      prev.map(w => {
        if (w.info.id !== workspaceId) return w;
        const newId = crypto.randomUUID();
        const label = `T${w.terminals.length + 1}`;
        const newTerminal: TerminalTabInfo = { id: newId, label };
        return {
          ...w,
          terminals: [...w.terminals, newTerminal],
          activeTerminalId: newId,
          layout: { type: 'terminal', terminalId: newId },
        };
      })
    );
  }, []);

  const closeTerminal = useCallback((workspaceId: string, terminalId: string) => {
    setWorkspaces(prev =>
      prev.map(w => {
        if (w.info.id !== workspaceId) return w;
        if (w.terminals.length <= 1) return w; // Don't close the last terminal

        const remaining = w.terminals.filter(t => t.id !== terminalId);
        const newLayout = removeFromLayout(w.layout, terminalId) ??
          { type: 'terminal' as const, terminalId: remaining[0].id };

        // If the closed terminal was active, pick a neighbor
        let newActiveId = w.activeTerminalId;
        if (newActiveId === terminalId) {
          const idx = w.terminals.findIndex(t => t.id === terminalId);
          const neighbor = idx > 0 ? w.terminals[idx - 1] : w.terminals[idx + 1];
          newActiveId = neighbor.id;
        }

        // If active terminal is not in the layout, set the layout to show it
        let finalLayout = newLayout;
        if (!existsInLayout(finalLayout, newActiveId)) {
          finalLayout = { type: 'terminal', terminalId: newActiveId };
        }

        return {
          ...w,
          terminals: remaining,
          activeTerminalId: newActiveId,
          layout: finalLayout,
        };
      })
    );
  }, []);

  const splitTerminal = useCallback((workspaceId: string, terminalId: string, direction: 'horizontal' | 'vertical') => {
    setWorkspaces(prev =>
      prev.map(w => {
        if (w.info.id !== workspaceId) return w;

        const newId = crypto.randomUUID();
        const label = `T${w.terminals.length + 1}`;
        const newTerminal: TerminalTabInfo = { id: newId, label };

        // If the target terminal is in the layout tree, split it in place
        // Otherwise, create a new split with the active terminal
        const splitTarget = existsInLayout(w.layout, terminalId) ? terminalId : w.activeTerminalId;

        const splitNode: TerminalLayout = {
          type: 'split',
          direction,
          children: [
            { type: 'terminal', terminalId: splitTarget },
            { type: 'terminal', terminalId: newId },
          ],
        };

        let newLayout: TerminalLayout;
        if (existsInLayout(w.layout, splitTarget)) {
          newLayout = replaceInLayout(w.layout, splitTarget, splitNode);
        } else {
          // Current layout is a single non-matching terminal -- just create a fresh split
          newLayout = splitNode;
        }

        return {
          ...w,
          terminals: [...w.terminals, newTerminal],
          activeTerminalId: newId,
          layout: newLayout,
        };
      })
    );
  }, []);

  const setActiveTerminal = useCallback((workspaceId: string, terminalId: string) => {
    setWorkspaces(prev =>
      prev.map(w => {
        if (w.info.id !== workspaceId) return w;

        // If the terminal is already visible in a split layout, just update activeTerminalId
        if (existsInLayout(w.layout, terminalId)) {
          return { ...w, activeTerminalId: terminalId };
        }

        // Otherwise, switch the layout to show this terminal (tab switch)
        return {
          ...w,
          activeTerminalId: terminalId,
          layout: { type: 'terminal', terminalId },
        };
      })
    );
  }, []);

  // Auto-create first workspace
  useEffect(() => {
    if (workspaces.length === 0) {
      createWorkspace();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
            <PanelGroup direction="vertical" autoSaveId="ccweb-v">
              {active?.openFile && (
                <>
                  <Panel defaultSize={45} minSize={15}>
                    <FileViewer
                      file={active.openFile}
                      onClose={closeFile}
                      onSave={handleFileSave}
                      root={active.cwd !== DEFAULT_CWD ? active.cwd : undefined}
                    />
                  </Panel>
                  <PanelResizeHandle className="resize-handle resize-handle-v" />
                </>
              )}
              <Panel defaultSize={active?.openFile ? 55 : 100} minSize={20}>
                {active ? (
                  <TerminalArea
                    key={active.info.id}
                    terminals={active.terminals}
                    activeTerminalId={active.activeTerminalId}
                    layout={active.layout}
                    cwd={active.cwd !== DEFAULT_CWD ? active.cwd : undefined}
                    onSelectTerminal={(termId) => setActiveTerminal(active.info.id, termId)}
                    onCloseTerminal={(termId) => closeTerminal(active.info.id, termId)}
                    onAddTerminal={() => addTerminal(active.info.id)}
                    onSplitTerminal={(dir) => splitTerminal(active.info.id, active.activeTerminalId, dir)}
                  />
                ) : (
                  <div style={{ height: '100%' }} />
                )}
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>
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
