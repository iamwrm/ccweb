import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { createFileRouter } from './files.js';
import { TerminalManager } from './terminal.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3001', 10);
const PROJECT_ROOT = process.env.PROJECT_ROOT || process.cwd();

const app = express();
app.use('/api', createFileRouter(PROJECT_ROOT));

// Serve static files in production
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const server = createServer(app);

// WebSocket server for terminal I/O
const wss = new WebSocketServer({ server, path: '/ws' });
const terminalManager = new TerminalManager(PROJECT_ROOT);

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('session');
  const cwd = url.searchParams.get('cwd') || undefined;

  if (!sessionId) {
    ws.close(4000, 'Missing session ID');
    return;
  }

  terminalManager.attach(sessionId, ws, cwd);
});

server.listen(PORT, () => {
  console.log(`ccweb server listening on http://localhost:${PORT}`);
  console.log(`Project root: ${PROJECT_ROOT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  terminalManager.destroy();
  server.close();
});

process.on('SIGINT', () => {
  terminalManager.destroy();
  server.close();
});

export { app, server, terminalManager };
