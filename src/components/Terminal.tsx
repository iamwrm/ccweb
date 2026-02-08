import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import './Terminal.css';

const THEME = {
  background: '#0a0a0a',
  foreground: '#ededed',
  cursor: '#f6821f',
  selectionBackground: 'rgba(246, 130, 31, 0.2)',
  black: '#181818',
  red: '#e5484d',
  green: '#46a758',
  yellow: '#f5a623',
  blue: '#3b82f6',
  magenta: '#ab6dff',
  cyan: '#05a2c2',
  white: '#ededed',
  brightBlack: '#555555',
  brightRed: '#ff6369',
  brightGreen: '#5bb98c',
  brightYellow: '#f7ce68',
  brightBlue: '#6fb3f2',
  brightMagenta: '#c49cff',
  brightCyan: '#2ec8e6',
  brightWhite: '#ffffff',
};

interface TerminalPanelProps {
  sessionId: string;
  visible: boolean;
}

export function TerminalPanel({ sessionId, visible }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const term = new Terminal({
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 10000,
      theme: THEME,
      allowProposedApi: true,
    });

    term.open(container);
    termRef.current = term;

    // WebSocket connection
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${location.host}/ws?session=${sessionId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    };

    ws.onmessage = (e) => {
      term.write(typeof e.data === 'string' ? e.data : '');
    };

    ws.onclose = () => {
      term.write('\r\n\x1b[90m[session disconnected]\x1b[0m\r\n');
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Resize observer
    const observer = new ResizeObserver(() => {
      if (!container || !termRef.current) return;

      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      // Approximate character dimensions for 14px monospace
      const charWidth = 8.4;
      const charHeight = 17;
      const cols = Math.max(2, Math.floor(rect.width / charWidth));
      const rows = Math.max(1, Math.floor(rect.height / charHeight));

      try {
        termRef.current.resize(cols, rows);
      } catch {
        // Resize may fail if terminal is not ready
      }

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });

    observer.observe(container);
    observerRef.current = observer;

    return () => {
      observer.disconnect();
      ws.close();
      term.dispose();
    };
  }, [sessionId]);

  return (
    <div
      className="terminal-panel"
      ref={containerRef}
      style={{ display: visible ? 'block' : 'none' }}
    />
  );
}
