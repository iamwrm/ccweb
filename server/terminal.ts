import * as pty from 'node-pty';
import type { WebSocket } from 'ws';

interface Session {
  id: string;
  pty: pty.IPty;
  ws: WebSocket | null;
  lastActivity: number;
  cols: number;
  rows: number;
}

const ORPHAN_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export class TerminalManager {
  private sessions = new Map<string, Session>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(private cwd: string) {
    this.cleanupTimer = setInterval(() => this.sweep(), 30_000);
  }

  attach(sessionId: string, ws: WebSocket): void {
    let session = this.sessions.get(sessionId);

    if (!session) {
      const shell = process.env.SHELL || '/bin/bash';
      const p = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: this.cwd,
        env: { ...process.env, TERM: 'xterm-256color' } as Record<string, string>,
      });

      session = {
        id: sessionId,
        pty: p,
        ws: null,
        lastActivity: Date.now(),
        cols: 80,
        rows: 24,
      };

      p.onData((data: string) => {
        const s = this.sessions.get(sessionId);
        if (s?.ws && s.ws.readyState === 1) {
          s.ws.send(data);
        }
      });

      p.onExit(() => {
        const s = this.sessions.get(sessionId);
        if (s?.ws && s.ws.readyState === 1) {
          s.ws.close(1000, 'Process exited');
        }
        this.sessions.delete(sessionId);
      });

      this.sessions.set(sessionId, session);
    }

    // Attach websocket
    session.ws = ws;
    session.lastActivity = Date.now();

    ws.on('message', (msg: Buffer | string) => {
      const s = this.sessions.get(sessionId);
      if (!s) return;
      s.lastActivity = Date.now();

      const data = msg.toString();

      // Try to parse as control message
      if (data.startsWith('{')) {
        try {
          const ctrl = JSON.parse(data);
          if (ctrl.type === 'resize' && typeof ctrl.cols === 'number' && typeof ctrl.rows === 'number') {
            s.pty.resize(ctrl.cols, ctrl.rows);
            s.cols = ctrl.cols;
            s.rows = ctrl.rows;
            return;
          }
        } catch {
          // Not valid JSON — treat as terminal input
        }
      }

      s.pty.write(data);
    });

    ws.on('close', () => {
      const s = this.sessions.get(sessionId);
      if (s && s.ws === ws) {
        s.ws = null;
      }
    });

    ws.on('error', () => {
      const s = this.sessions.get(sessionId);
      if (s && s.ws === ws) {
        s.ws = null;
      }
    });
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  getSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  killSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.pty.kill();
    this.sessions.delete(sessionId);
    return true;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (!session.ws && now - session.lastActivity > ORPHAN_TIMEOUT) {
        session.pty.kill();
        this.sessions.delete(id);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupTimer);
    for (const [, session] of this.sessions) {
      session.pty.kill();
    }
    this.sessions.clear();
  }
}
