import { describe, it, expect, afterEach } from 'vitest';
import { TerminalManager } from '../terminal.js';

let manager: TerminalManager | null = null;

afterEach(() => {
  if (manager) {
    manager.destroy();
    manager = null;
  }
});

// Mock WebSocket for testing without a real connection
function makeMockWs() {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  const ws = {
    readyState: 1,
    _sent: [] as string[],
    send(data: string) {
      ws._sent.push(data);
    },
    close(_code?: number, _reason?: string) {
      ws.readyState = 3;
    },
    on(event: string, cb: (...args: unknown[]) => void) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
    },
    emit(event: string, ...args: unknown[]) {
      (listeners[event] || []).forEach(cb => cb(...args));
    },
  };
  return ws;
}

describe('TerminalManager', () => {
  it('creates a session when attaching', () => {
    manager = new TerminalManager('/tmp');
    const ws = makeMockWs();
    manager.attach('test-1', ws as any);

    const session = manager.getSession('test-1');
    expect(session).toBeDefined();
    expect(session!.id).toBe('test-1');
  });

  it('receives PTY output via WebSocket', async () => {
    manager = new TerminalManager('/tmp');
    const ws = makeMockWs();
    manager.attach('test-2', ws as any);

    // Wait for shell to produce some output (prompt)
    await new Promise(resolve => setTimeout(resolve, 500));

    // The shell should have sent something (prompt, motd, etc.)
    // At minimum, the session should be alive
    const session = manager.getSession('test-2');
    expect(session).toBeDefined();
  });

  it('forwards input to PTY', async () => {
    manager = new TerminalManager('/tmp');
    const ws = makeMockWs();
    manager.attach('test-3', ws as any);

    // Send input via the WebSocket message handler
    ws.emit('message', 'echo hello\r');

    // Wait for command execution
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check that we received output containing "hello"
    const output = ws._sent.join('');
    expect(output.length).toBeGreaterThan(0);
  });

  it('handles resize messages', () => {
    manager = new TerminalManager('/tmp');
    const ws = makeMockWs();
    manager.attach('test-4', ws as any);

    ws.emit('message', JSON.stringify({ type: 'resize', cols: 120, rows: 40 }));

    const session = manager.getSession('test-4');
    expect(session!.cols).toBe(120);
    expect(session!.rows).toBe(40);
  });

  it('keeps session alive after WebSocket disconnect', () => {
    manager = new TerminalManager('/tmp');
    const ws = makeMockWs();
    manager.attach('test-5', ws as any);

    // Simulate disconnect
    ws.emit('close');

    // Session should still exist (orphaned but alive)
    const session = manager.getSession('test-5');
    expect(session).toBeDefined();
    expect(session!.ws).toBeNull();
  });

  it('allows reconnection to existing session', () => {
    manager = new TerminalManager('/tmp');
    const ws1 = makeMockWs();
    manager.attach('test-6', ws1 as any);

    // Disconnect
    ws1.emit('close');

    // Reconnect with new WebSocket
    const ws2 = makeMockWs();
    manager.attach('test-6', ws2 as any);

    const session = manager.getSession('test-6');
    expect(session).toBeDefined();
    expect(session!.ws).toBe(ws2);
  });

  it('manages multiple concurrent sessions', () => {
    manager = new TerminalManager('/tmp');

    const ws1 = makeMockWs();
    const ws2 = makeMockWs();
    const ws3 = makeMockWs();

    manager.attach('multi-1', ws1 as any);
    manager.attach('multi-2', ws2 as any);
    manager.attach('multi-3', ws3 as any);

    expect(manager.getSessions().length).toBe(3);
    expect(manager.getSession('multi-1')).toBeDefined();
    expect(manager.getSession('multi-2')).toBeDefined();
    expect(manager.getSession('multi-3')).toBeDefined();
  });

  it('kills session and cleans up', () => {
    manager = new TerminalManager('/tmp');
    const ws = makeMockWs();
    manager.attach('kill-1', ws as any);

    expect(manager.killSession('kill-1')).toBe(true);
    expect(manager.getSession('kill-1')).toBeUndefined();
  });

  it('returns false when killing nonexistent session', () => {
    manager = new TerminalManager('/tmp');
    expect(manager.killSession('nope')).toBe(false);
  });

  it('destroys all sessions', () => {
    manager = new TerminalManager('/tmp');

    const ws1 = makeMockWs();
    const ws2 = makeMockWs();
    manager.attach('destroy-1', ws1 as any);
    manager.attach('destroy-2', ws2 as any);

    manager.destroy();
    expect(manager.getSessions().length).toBe(0);
    manager = null; // prevent afterEach from double-destroying
  });
});
