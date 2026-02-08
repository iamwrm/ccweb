# ccweb

Browser-based terminal + file explorer for running multiple Claude Code sessions in parallel.

## Goal

Run several Claude Code TUI instances side-by-side in the browser, each in its own workspace with a file tree and code viewer. Built for reviewing AI-generated code without leaving the browser.

```
┌──────┬──────────────┬──────────────────────────┐
│      │              │  Editor (read-only)      │
│  1   │  File Tree   │  syntax highlighted      │
│  2   │  Explorer    ├──────────────────────────┤
│  3   │              │  Terminal                │
│      │              │  $ claude                │
│ [+]  │              │                          │
└──────┴──────────────┴──────────────────────────┘
```

- **Left sidebar** — switch between workspaces (each has its own terminal + editor state)
- **File tree** — lazy-loaded directory browser, click to open files
- **Code viewer** — CodeMirror 6 with syntax highlighting (read-only)
- **Terminal** — xterm.js connected to a real PTY via WebSocket

## Quick Start

```bash
npm install
npm run dev
# Open http://localhost:5173
```

Point at a specific project directory:

```bash
PROJECT_ROOT=/path/to/project npm run dev
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vite + React 19 + TypeScript |
| Terminal | xterm.js (WebSocket to server PTY) |
| Code viewer | CodeMirror 6 (read-only, oneDark theme) |
| Layout | react-resizable-panels |
| Styling | CSS custom properties, no framework |
| Server | Node.js + Express 5 + ws |
| PTY | node-pty (one per workspace) |
| Testing | Vitest + Testing Library + supertest |

## Project Structure

```
ccweb/
├── server/
│   ├── index.ts              Express + WebSocket server
│   ├── terminal.ts           TerminalManager — PTY lifecycle, reconnection
│   ├── files.ts              File system REST API with path traversal protection
│   └── __tests__/
│       ├── files.test.ts     19 tests — directory listing, file content, security
│       └── terminal.test.ts  10 tests — PTY spawn, resize, cleanup, reconnection
├── src/
│   ├── main.tsx              React entry point
│   ├── App.tsx               Root — workspace state, panel layout
│   ├── global.css            Design tokens, reset, resize handles
│   ├── components/
│   │   ├── Sidebar.tsx       Workspace switcher (numbered buttons)
│   │   ├── FileTree.tsx      Lazy-loaded directory tree
│   │   ├── FileViewer.tsx    CodeMirror 6 read-only viewer
│   │   └── Terminal.tsx      xterm.js + WebSocket + ResizeObserver
│   ├── lib/
│   │   └── api.ts            REST client (fetchFiles, fetchFile)
│   └── __tests__/
│       ├── api.test.ts       5 tests — URL encoding, error handling
│       ├── SessionBar.test.tsx  5 tests — sidebar rendering, selection, close
│       └── FileTree.test.tsx 5 tests — mount, expand, file click, error
├── index.html
├── vite.config.ts            Dev proxy (/api → :3001, /ws → :3001)
├── vitest.config.ts          Separate frontend (jsdom) / server (node) projects
├── tsconfig.json             Frontend
└── tsconfig.node.json        Server
```

## Architecture

**Workspace model** — each workspace is an independent session with its own terminal (PTY process) and editor state. Switching workspaces swaps the entire right-side panel content. Terminal sessions survive browser disconnects for 5 minutes, allowing page refresh without losing state.

**Server API:**

| Endpoint | Description |
|----------|-------------|
| `GET /api/files?path=src` | Directory listing (one level, lazy) |
| `GET /api/file?path=src/main.ts` | File content with metadata |
| `WS /ws?session={id}` | Terminal I/O (raw text) + resize (JSON) |

**Security** — file API uses `path.resolve()` + prefix check to prevent path traversal. Hidden files and `node_modules` are filtered from directory listings.

## Scripts

```bash
npm run dev        # Vite (5173) + backend (3001) with hot reload
npm test           # Run all 44 tests
npm run build      # Production build (dist/ + dist-server/)
npm start          # Serve production build
```

## Design

Dark neutral theme inspired by Cloudflare Sandbox. Off-black backgrounds (`#0a0a0a`), orange accent (`#f6821f`), Inter + IBM Plex Mono typography. No CSS framework.
