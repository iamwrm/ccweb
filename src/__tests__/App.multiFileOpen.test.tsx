import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { fetchFileMock } = vi.hoisted(() => ({
  fetchFileMock: vi.fn(),
}));

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    fetchFile: fetchFileMock,
  };
});

vi.mock('../components/FileTree', () => ({
  FileTree: ({ onFileSelect }: { onFileSelect: (filePath: string, options?: { pinned?: boolean }) => void }) => (
    <div>
      <button onClick={() => onFileSelect('/a.ts', { pinned: false })}>open-a-preview</button>
      <button onClick={() => onFileSelect('/b.ts', { pinned: false })}>open-b-preview</button>
      <button onClick={() => onFileSelect('/a.ts', { pinned: true })}>open-a-pinned</button>
      <button onClick={() => onFileSelect('/b.ts', { pinned: true })}>open-b-pinned</button>
    </div>
  ),
}));

vi.mock('../components/TileRenderer', () => ({
  TileRenderer: ({
    layout,
    openFiles,
    terminalPanes,
    activePaneId,
    onSplitPane,
    onCreateTerminalTab,
    onDropEditorTab,
    onMoveEditorTab,
  }: {
    layout: any;
    openFiles: Record<string, { tabs?: Array<unknown> }>;
    terminalPanes: Record<string, { tabs?: Array<unknown>; activeTabId?: string }>;
    activePaneId: string;
    onSplitPane: (paneId: string, direction: 'horizontal' | 'vertical') => void;
    onCreateTerminalTab: (paneId: string) => void;
    onDropEditorTab: (
      fromPaneId: string,
      tabId: string,
      targetPaneId: string,
      position: 'center' | 'left' | 'right' | 'top' | 'bottom',
    ) => void;
    onMoveEditorTab: (fromPaneId: string, tabId: string, targetPaneId: string) => void;
  }) => {
    const countEditors = (node: any): number => {
      if (!node) return 0;
      if (node.type === 'editor') return 1;
      if (node.type === 'split') return countEditors(node.children[0]) + countEditors(node.children[1]);
      return 0;
    };
    const countTerminals = (node: any): number => {
      if (!node) return 0;
      if (node.type === 'terminal') return 1;
      if (node.type === 'split') return countTerminals(node.children[0]) + countTerminals(node.children[1]);
      return 0;
    };
    const totalTabs = Object.values(openFiles).reduce((count, pane) => count + (pane.tabs?.length || 0), 0);
    const totalTerminalTabs = Object.values(terminalPanes).reduce((count, pane) => count + (pane.tabs?.length || 0), 0);
    const findFirstPane = (node: any, type: 'editor' | 'terminal'): string | null => {
      if (!node) return null;
      if (type === 'editor' && node.type === 'editor') return node.filePath;
      if (type === 'terminal' && node.type === 'terminal') return node.terminalId;
      if (node.type === 'split') return findFirstPane(node.children[0], type) || findFirstPane(node.children[1], type);
      return null;
    };
    const getEditorPaneIds = (node: any): string[] => {
      if (!node) return [];
      if (node.type === 'editor') return [node.filePath];
      if (node.type === 'split') return [...getEditorPaneIds(node.children[0]), ...getEditorPaneIds(node.children[1])];
      return [];
    };
    const getTabs = (paneId: string): Array<{ id: string; file: { path: string } }> =>
      (openFiles[paneId]?.tabs as Array<{ id: string; file: { path: string } }> | undefined) || [];

    return (
      <>
        <div
          data-testid="tile-renderer"
          data-editor-count={String(countEditors(layout))}
          data-terminal-count={String(countTerminals(layout))}
          data-open-file-count={String(Object.keys(openFiles).length)}
          data-tab-count={String(totalTabs)}
          data-terminal-tab-count={String(totalTerminalTabs)}
          data-active-pane={activePaneId}
        />
        <button onClick={() => onSplitPane(activePaneId, 'horizontal')}>split-active</button>
        <button onClick={() => onCreateTerminalTab(activePaneId)}>new-terminal-tab</button>
        <button
          onClick={() => {
            const sourcePaneId = findFirstPane(layout, 'editor');
            const targetPaneId = findFirstPane(layout, 'terminal');
            const sourceTabId = sourcePaneId ? (openFiles[sourcePaneId]?.tabs?.[0] as { id?: string } | undefined)?.id : undefined;
            if (!sourcePaneId || !targetPaneId || !sourceTabId) return;
            onDropEditorTab(sourcePaneId, sourceTabId, targetPaneId, 'center');
          }}
        >
          drop-editor-on-terminal
        </button>
        <button
          onClick={() => {
            const editorPaneIds = getEditorPaneIds(layout);
            if (editorPaneIds.length < 2) return;

            const sourcePaneId = editorPaneIds.find(
              paneId => {
                const tabs = getTabs(paneId);
                return tabs.length > 1 && tabs.some(tab => tab.file.path === '/b.ts');
              }
            );
            if (!sourcePaneId) return;

            const sourceTab = getTabs(sourcePaneId).find(tab => tab.file.path === '/b.ts');
            if (!sourceTab) return;

            const targetPaneId = editorPaneIds.find(paneId => paneId !== sourcePaneId);
            if (!targetPaneId) return;

            onMoveEditorTab(sourcePaneId, sourceTab.id, targetPaneId);
          }}
        >
          move-b-to-other-editor
        </button>
      </>
    );
  },
}));

import { App } from '../App';

describe('App file opening behavior', () => {
  beforeEach(() => {
    fetchFileMock.mockReset();
    fetchFileMock.mockImplementation(async (filePath: string) => ({
      path: filePath,
      content: `// ${filePath}`,
      extension: 'ts',
    }));
    localStorage.clear();
  });

  it('reuses the same editor pane on single-click preview', async () => {
    render(<App />);

    await screen.findByTestId('tile-renderer');

    fireEvent.click(screen.getByText('open-a-preview'));
    await waitFor(() => {
      expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-editor-count', '1');
    });
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-open-file-count', '1');
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-tab-count', '1');

    fireEvent.click(screen.getByText('open-b-preview'));
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-editor-count', '1');
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-open-file-count', '1');
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-tab-count', '1');
  });

  it('adds/pins tabs in the same pane on pinned open', async () => {
    render(<App />);

    await screen.findByTestId('tile-renderer');
    fireEvent.click(screen.getByText('open-a-preview'));
    await waitFor(() => {
      expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-editor-count', '1');
    });
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-tab-count', '1');

    fireEvent.click(screen.getByText('open-a-pinned'));
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-editor-count', '1');
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-open-file-count', '1');
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-tab-count', '1');

    fireEvent.click(screen.getByText('open-b-pinned'));
    await waitFor(() => {
      expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-tab-count', '2');
    });
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-editor-count', '1');
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-open-file-count', '1');
  });

  it('splitting an active terminal pane creates a new terminal pane', async () => {
    render(<App />);

    await screen.findByTestId('tile-renderer');
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-terminal-count', '1');
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-editor-count', '0');

    fireEvent.click(screen.getByText('split-active'));
    await waitFor(() => {
      expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-terminal-count', '2');
    });
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-editor-count', '0');
  });

  it('adds terminal tabs in the same terminal pane', async () => {
    render(<App />);

    await screen.findByTestId('tile-renderer');
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-terminal-count', '1');
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-terminal-tab-count', '1');

    fireEvent.click(screen.getByText('new-terminal-tab'));
    await waitFor(() => {
      expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-terminal-tab-count', '2');
    });
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-terminal-count', '1');
  });

  it('splitting an active editor pane creates a new editor pane', async () => {
    render(<App />);

    await screen.findByTestId('tile-renderer');
    fireEvent.click(screen.getByText('open-a-preview'));
    await waitFor(() => {
      expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-editor-count', '1');
    });
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-terminal-count', '1');

    fireEvent.click(screen.getByText('split-active'));
    await waitFor(() => {
      expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-editor-count', '2');
    });
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-terminal-count', '1');
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-open-file-count', '2');
  });

  it('moves an editor tab into another editor pane without creating a new pane', async () => {
    render(<App />);

    await screen.findByTestId('tile-renderer');
    fireEvent.click(screen.getByText('open-a-pinned'));
    await waitFor(() => {
      expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-tab-count', '1');
    });
    fireEvent.click(screen.getByText('split-active'));
    await waitFor(() => {
      expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-editor-count', '2');
    });
    fireEvent.click(screen.getByText('open-a-pinned'));
    fireEvent.click(screen.getByText('open-b-pinned'));

    await waitFor(() => {
      expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-tab-count', '3');
    });
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-editor-count', '2');
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-open-file-count', '2');

    fireEvent.click(screen.getByText('move-b-to-other-editor'));
    await waitFor(() => {
      expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-editor-count', '2');
    });
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-open-file-count', '2');
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-tab-count', '3');
  });

  it('dropping an editor tab on a terminal pane creates a new editor pane', async () => {
    render(<App />);

    await screen.findByTestId('tile-renderer');
    fireEvent.click(screen.getByText('open-a-pinned'));
    fireEvent.click(screen.getByText('open-b-pinned'));

    await waitFor(() => {
      expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-tab-count', '2');
    });
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-editor-count', '1');
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-open-file-count', '1');

    fireEvent.click(screen.getByText('drop-editor-on-terminal'));
    await waitFor(() => {
      expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-editor-count', '2');
    });
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-open-file-count', '2');
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-tab-count', '2');
  });

  it('closes active editor pane on Ctrl/Cmd+W and prevents browser close', async () => {
    render(<App />);

    await screen.findByTestId('tile-renderer');
    fireEvent.click(screen.getByText('open-a-preview'));
    await waitFor(() => {
      expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-editor-count', '1');
    });

    const event = new KeyboardEvent('keydown', { key: 'w', ctrlKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(event);

    await waitFor(() => {
      expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-editor-count', '0');
    });
    expect(event.defaultPrevented).toBe(true);
  });

  it('prevents browser close on Ctrl/Cmd+W when active pane is not an editor', async () => {
    render(<App />);

    await screen.findByTestId('tile-renderer');
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-terminal-count', '1');
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-editor-count', '0');

    const event = new KeyboardEvent('keydown', { key: 'w', metaKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(event);

    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-terminal-count', '1');
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-editor-count', '0');
    expect(event.defaultPrevented).toBe(true);
  });

  it('warns on beforeunload when editor panes are open', async () => {
    render(<App />);

    await screen.findByTestId('tile-renderer');
    fireEvent.click(screen.getByText('open-a-preview'));
    await waitFor(() => {
      expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-editor-count', '1');
    });

    await waitFor(() => {
      const event = new Event('beforeunload', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'returnValue', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      expect((event as Event & { returnValue?: string }).returnValue).toBe('');
    });
  });

  it('does not warn on beforeunload when no editor panes are open', async () => {
    render(<App />);

    await screen.findByTestId('tile-renderer');
    expect(screen.getByTestId('tile-renderer')).toHaveAttribute('data-editor-count', '0');

    const event = new Event('beforeunload', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'returnValue', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect((event as Event & { returnValue?: string }).returnValue).toBeUndefined();
  });
});
