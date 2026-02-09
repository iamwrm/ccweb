import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { TileNode, TerminalTabInfo } from '../lib/tileLayout';
import { TileRenderer } from '../components/TileRenderer';

vi.mock('../components/Terminal', () => ({
  TerminalPanel: ({ sessionId, visible }: { sessionId: string; visible: boolean }) => (
    <div data-testid={`terminal-${sessionId}`} data-visible={String(visible)} />
  ),
}));

function createDataTransfer(): DataTransfer {
  const store = new Map<string, string>();
  const dataTransfer = {
    setData: (type: string, value: string) => {
      store.set(type, value);
      dataTransfer.types = Array.from(store.keys());
    },
    getData: (type: string) => store.get(type) || '',
    clearData: (type?: string) => {
      if (!type) {
        store.clear();
      } else {
        store.delete(type);
      }
      dataTransfer.types = Array.from(store.keys());
    },
    dropEffect: 'move',
    effectAllowed: 'move',
    types: [] as string[],
  };
  return dataTransfer as unknown as DataTransfer;
}

function mockPaneRect(el: Element): void {
  Object.defineProperty(el, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      left: 0,
      top: 0,
      width: 200,
      height: 120,
      right: 200,
      bottom: 120,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
}

describe('TileRenderer drag/drop', () => {
  it('drags a terminal tab to another terminal pane and calls move handler', () => {
    const layout: TileNode = {
      type: 'split',
      direction: 'horizontal',
      children: [
        { type: 'terminal', terminalId: 'pane-a' },
        { type: 'terminal', terminalId: 'pane-b' },
      ],
    };

    const allTerminals: TerminalTabInfo[] = [
      { id: 'term-a1', label: 'TA1' },
      { id: 'term-a2', label: 'TA2' },
      { id: 'term-b1', label: 'TB1' },
    ];

    const onMoveTerminalTab = vi.fn();
    const onDropSplit = vi.fn();
    const onSwapPanes = vi.fn();

    const { container } = render(
      <TileRenderer
        layout={layout}
        openFiles={{}}
        terminalPanes={{
          'pane-a': {
            tabs: [
              { id: 'term-a1', label: 'TA1' },
              { id: 'term-a2', label: 'TA2' },
            ],
            activeTabId: 'term-a1',
          },
          'pane-b': {
            tabs: [{ id: 'term-b1', label: 'TB1' }],
            activeTabId: 'term-b1',
          },
        }}
        allTerminals={allTerminals}
        activePaneId="pane-a"
        theme="dark"
        vimMode={false}
        onToggleVim={vi.fn()}
        onSplitPane={vi.fn()}
        onClosePane={vi.fn()}
        onSwapPanes={onSwapPanes}
        onDropSplit={onDropSplit}
        onDropEditorTab={vi.fn()}
        onMoveEditorTab={vi.fn()}
        onMoveTerminalTab={onMoveTerminalTab}
        onFocusPane={vi.fn()}
        onCreateTerminalTab={vi.fn()}
        onSelectTerminalTab={vi.fn()}
        onCloseTerminalTab={vi.fn()}
        onSelectEditorTab={vi.fn()}
        onCloseEditorTab={vi.fn()}
        onSaveFile={vi.fn()}
        onOpenFile={vi.fn()}
      />
    );

    const dragTabButton = screen.getByText('TA2').closest('button');
    expect(dragTabButton).toBeTruthy();
    if (!dragTabButton) throw new Error('Expected terminal tab button');
    expect(dragTabButton).toHaveAttribute('draggable', 'true');

    const panes = container.querySelectorAll('.tile-pane');
    expect(panes.length).toBe(2);
    const targetPane = panes[1];
    mockPaneRect(targetPane);

    const dataTransfer = createDataTransfer();
    fireEvent.dragStart(dragTabButton, { dataTransfer });
    fireEvent.dragOver(targetPane, { dataTransfer, clientX: 100, clientY: 60 });
    fireEvent.drop(targetPane, { dataTransfer, clientX: 100, clientY: 60 });

    expect(onMoveTerminalTab).toHaveBeenCalledTimes(1);
    expect(onMoveTerminalTab).toHaveBeenCalledWith('pane-a', 'term-a2', 'pane-b');
    expect(onDropSplit).not.toHaveBeenCalled();
    expect(onSwapPanes).not.toHaveBeenCalled();
  });
});
