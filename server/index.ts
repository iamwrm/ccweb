import express, { json as jsonMiddleware } from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { createFileRouter } from './files.js';
import { TerminalManager } from './terminal.js';
import { createAuthConfig, createAuthMiddleware, validateWebSocketToken, signToken } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3001', 10);
const PROJECT_ROOT = process.env.PROJECT_ROOT || process.cwd();

// Parse --token CLI arg
const args = process.argv.slice(2);
let cliToken: string | undefined;
const tokenIdx = args.indexOf('--token');
if (tokenIdx !== -1 && args[tokenIdx + 1]) {
  cliToken = args[tokenIdx + 1];
}

const authConfig = createAuthConfig(cliToken, process.env.CCWEB_TOKEN);

const app = express();

// Auth endpoint (excluded from auth middleware) — for client-side login
app.post('/api/auth', jsonMiddleware(), (req, res) => {
  const { token } = req.body || {};
  if (token === authConfig.token) {
    const signature = signToken(authConfig.token);
    res.setHeader('Set-Cookie',
      `${authConfig.cookieName}=${signature}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(authConfig.cookieMaxAge / 1000)}`
    );
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Auth middleware — all requests after this require valid token/cookie
app.use(createAuthMiddleware(authConfig));

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
  if (!validateWebSocketToken(authConfig, req)) {
    ws.close(4001, 'Unauthorized');
    return;
  }

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
  console.log(`\nccweb server listening on:\n`);
  console.log(`  http://localhost:${PORT}/?token=${authConfig.token}\n`);
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

export { app, server, terminalManager, authConfig };
