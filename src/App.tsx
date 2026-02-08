import { useState, useCallback, useEffect } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { Sidebar, type WorkspaceInfo } from './components/Sidebar';
import { FileTree } from './components/FileTree';
import { FileViewer, type OpenFile } from './components/FileViewer';
import { TerminalPanel } from './components/Terminal';
import { fetchFile } from './lib/api';

interface WorkspaceState {
  info: WorkspaceInfo;
  openFile: OpenFile | null;
}

let nextIndex = 1;

export function App() {
  const [workspaces, setWorkspaces] = useState<WorkspaceState[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const createWorkspace = useCallback(() => {
    const id = crypto.randomUUID();
    const ws: WorkspaceState = {
      info: { id, name: `Session ${nextIndex}`, index: nextIndex },
      openFile: null,
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
      const data = await fetchFile(filePath);
      setWorkspaces(prev =>
        prev.map(w =>
          w.info.id === activeId ? { ...w, openFile: data } : w
        )
      );
    } catch (err) {
      console.error('Failed to load file:', err);
    }
  }, [activeId]);

  const closeFile = useCallback(() => {
    setWorkspaces(prev =>
      prev.map(w =>
        w.info.id === activeId ? { ...w, openFile: null } : w
      )
    );
  }, [activeId]);

  // Auto-create first workspace
  useEffect(() => {
    if (workspaces.length === 0) {
      createWorkspace();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const active = workspaces.find(w => w.info.id === activeId);

  return (
    <div className="app">
      <Sidebar
        workspaces={workspaces.map(w => w.info)}
        activeId={activeId}
        onSelect={setActiveId}
        onClose={closeWorkspace}
        onCreate={createWorkspace}
      />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <PanelGroup direction="horizontal" autoSaveId="ccweb-h">
          <Panel defaultSize={20} minSize={12} maxSize={35}>
            <FileTree onFileSelect={handleFileSelect} />
          </Panel>
          <PanelResizeHandle className="resize-handle resize-handle-h" />
          <Panel>
            <PanelGroup direction="vertical" autoSaveId="ccweb-v">
              {active?.openFile && (
                <>
                  <Panel defaultSize={45} minSize={15}>
                    <FileViewer file={active.openFile} onClose={closeFile} />
                  </Panel>
                  <PanelResizeHandle className="resize-handle resize-handle-v" />
                </>
              )}
              <Panel defaultSize={active?.openFile ? 55 : 100} minSize={20}>
                <div style={{ height: '100%', position: 'relative' }}>
                  {workspaces.map(w => (
                    <TerminalPanel
                      key={w.info.id}
                      sessionId={w.info.id}
                      visible={w.info.id === activeId}
                    />
                  ))}
                </div>
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
