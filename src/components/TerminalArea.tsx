import type { ReactNode } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { TerminalPanel } from './Terminal';
import { TerminalTabs, type TerminalTabInfo } from './TerminalTabs';
import { useTheme } from '../lib/theme';
import './TerminalArea.css';

// ── Layout tree types ──

export type TerminalLayout =
  | { type: 'terminal'; terminalId: string }
  | { type: 'split'; direction: 'horizontal' | 'vertical'; children: [TerminalLayout, TerminalLayout] };

// ── Props ──

interface TerminalAreaProps {
  terminals: TerminalTabInfo[];
  activeTerminalId: string;
  layout: TerminalLayout;
  cwd?: string;
  onSelectTerminal: (terminalId: string) => void;
  onCloseTerminal: (terminalId: string) => void;
  onAddTerminal: () => void;
  onSplitTerminal: (direction: 'horizontal' | 'vertical') => void;
}

// ── Helpers ──

/** Collect all terminal IDs that appear in a layout subtree. */
function collectTerminalIds(layout: TerminalLayout): Set<string> {
  if (layout.type === 'terminal') {
    return new Set([layout.terminalId]);
  }
  const left = collectTerminalIds(layout.children[0]);
  const right = collectTerminalIds(layout.children[1]);
  for (const id of right) left.add(id);
  return left;
}

/** Check if a layout has any splits (more than one terminal visible). */
function hasSplits(layout: TerminalLayout): boolean {
  return layout.type === 'split';
}

// ── Render the recursive layout tree ──

function renderLayout(layout: TerminalLayout, cwd?: string, theme?: 'dark' | 'light'): ReactNode {
  if (layout.type === 'terminal') {
    return (
      <div className="terminal-pane">
        <TerminalPanel sessionId={layout.terminalId} visible={true} cwd={cwd} theme={theme} />
      </div>
    );
  }

  const dir = layout.direction;
  const handleClass = dir === 'horizontal' ? 'terminal-split-handle-h' : 'terminal-split-handle-v';

  return (
    <PanelGroup direction={dir}>
      <Panel minSize={10}>
        {renderLayout(layout.children[0], cwd, theme)}
      </Panel>
      <PanelResizeHandle className={handleClass} />
      <Panel minSize={10}>
        {renderLayout(layout.children[1], cwd, theme)}
      </Panel>
    </PanelGroup>
  );
}

// ── Main component ──

export function TerminalArea({
  terminals,
  activeTerminalId,
  layout,
  cwd,
  onSelectTerminal,
  onCloseTerminal,
  onAddTerminal,
  onSplitTerminal,
}: TerminalAreaProps) {
  const { theme } = useTheme();
  const isSplit = hasSplits(layout);
  const layoutTermIds = collectTerminalIds(layout);

  // Terminals that are NOT in the current layout tree are "tabbed away" --
  // they stay mounted but hidden so their PTY sessions survive.
  const tabbedTermIds = terminals
    .map(t => t.id)
    .filter(id => !layoutTermIds.has(id));

  return (
    <div className="terminal-area">
      <TerminalTabs
        terminals={terminals}
        activeTerminalId={activeTerminalId}
        onSelect={onSelectTerminal}
        onClose={onCloseTerminal}
        onAdd={onAddTerminal}
        onSplit={onSplitTerminal}
      />
      <div className="terminal-area-content">
        {/* Render the active layout (split or single) */}
        {isSplit ? (
          renderLayout(layout, cwd, theme)
        ) : (
          /* Single terminal mode: show the active one, keep others mounted but hidden */
          terminals.map(t => (
            <TerminalPanel
              key={t.id}
              sessionId={t.id}
              visible={t.id === activeTerminalId}
              cwd={cwd}
              theme={theme}
            />
          ))
        )}

        {/* When in split mode, keep tabbed-away terminals mounted but hidden */}
        {isSplit && tabbedTermIds.map(id => (
          <TerminalPanel
            key={id}
            sessionId={id}
            visible={false}
            cwd={cwd}
            theme={theme}
          />
        ))}
      </div>
    </div>
  );
}
