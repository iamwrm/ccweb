# ccweb

Browser-based terminal + file explorer for running multiple Claude Code sessions in parallel.

## Goal

Run several Claude Code TUI instances side-by-side in the browser, each in its own workspace with a file tree, code editor, and multiple terminals. Built for reviewing and editing AI-generated code without leaving the browser.

```
┌──────────────┬──────────────┬──────────────────────────┐
│              │              │  Editor (editable)       │
│ 1 Session 1  │  File Tree   │  syntax highlighted      │
│ 2 My Project │  Explorer    │  Ctrl+S to save          │
│ 3 Backend    │              ├──────────────────────────┤
│              │              │  ┌ T1 ┬ T2 ┐  | — +     │
│ ☀         +  │              │  │ Terminal              │
│              │              │  │ $ claude              │
└──────────────┴──────────────┴──────────────────────────┘
```

- **Left sidebar** (140px) — switch between workspaces, shows index + name, double-click to rename
- **File tree** — lazy-loaded directory browser, per-workspace working directory
- **Code editor** — CodeMirror 6 with syntax highlighting for 15 languages, Ctrl+S saves to disk
- **Terminal** — xterm.js connected to a real PTY via WebSocket, multiple tabs + split panes per workspace
- **Theme toggle** — dark/light mode, persists across reloads

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
| Code editor | CodeMirror 6 (editable, 15 languages, dark/light themes) |
| Layout | react-resizable-panels |
| Styling | CSS custom properties (dark/light), no framework |
| Server | Node.js + Express 5 + ws |
| PTY | node-pty (multiple per workspace) |
| Testing | Vitest + Testing Library + supertest |

## Project Structure

```
ccweb/
├── server/
│   ├── index.ts              Express + WebSocket server
│   ├── terminal.ts           TerminalManager — PTY lifecycle, reconnection
│   ├── files.ts              File system REST API (read + write) with path traversal protection
│   └── __tests__/
│       ├── files.test.ts     27 tests — directory listing, file content, save, security
│       └── terminal.test.ts  10 tests — PTY spawn, resize, cleanup, reconnection
├── src/
│   ├── main.tsx              React entry point
│   ├── App.tsx               Root — workspace state, theme provider, panel layout
│   ├── global.css            Design tokens (dark + light), reset, resize handles
│   ├── components/
│   │   ├── Sidebar.tsx       Workspace list (index + name), rename, theme toggle
│   │   ├── FileTree.tsx      Lazy-loaded directory tree, per-workspace root
│   │   ├── FileViewer.tsx    CodeMirror 6 editable editor, Ctrl+S save, 15 languages
│   │   ├── Terminal.tsx      xterm.js + WebSocket + ResizeObserver, dark/light theme
│   │   ├── TerminalTabs.tsx  Tab bar for multiple terminals + split controls
│   │   └── TerminalArea.tsx  Recursive split layout renderer
│   ├── lib/
│   │   ├── api.ts            REST client (fetchFiles, fetchFile, saveFile)
│   │   └── theme.ts          ThemeContext, localStorage persistence
│   └── __tests__/
│       ├── api.test.ts       8 tests — URL encoding, save, error handling
│       ├── SessionBar.test.tsx  5 tests — sidebar rendering, selection, close
│       ├── FileTree.test.tsx 5 tests — mount, expand, file click, error
│       └── theme.test.ts    6 tests — theme storage, data-theme attribute
├── index.html                Flash-prevention script for theme
├── vite.config.ts            Dev proxy (/api → :3001, /ws → :3001)
├── vitest.config.ts          Separate frontend (jsdom) / server (node) projects
├── tsconfig.json             Frontend
└── tsconfig.node.json        Server
```

## Architecture

**Workspace model** — each workspace is an independent session with its own terminal(s), file tree root, and editor state. Switching workspaces swaps the entire right-side panel. Terminal components stay mounted (hidden via CSS `display:none`) to preserve WebSocket connections and scrollback.

**Multi-terminal** — each workspace supports multiple terminal tabs. Terminals can be split horizontally or vertically using a recursive layout tree. The layout is rendered with nested `react-resizable-panels`.

**Per-workspace directory** — each workspace can have its own working directory. Double-click the path bar above the file tree to change it. The terminal PTY spawns in that directory and the file tree browses from it.

**Server API:**

| Endpoint | Description |
|----------|-------------|
| `GET /api/files?path=src&root=/opt/project` | Directory listing (one level, lazy) |
| `GET /api/file?path=src/main.ts&root=/opt/project` | File content with metadata |
| `PUT /api/file` | Save file content (`{ path, content, root? }`) |
| `WS /ws?session={id}&cwd=/opt/project` | Terminal I/O (raw text) + resize (JSON) |

**Security** — file API uses `path.resolve()` + prefix check with `path.sep` to prevent path traversal. Write endpoint validates the target is an existing file. Hidden files and `node_modules` are filtered from directory listings.

**Theme system** — dark/light toggle using CSS custom properties. `[data-theme="light"]` on `<html>` overrides the default dark variables. Theme persists in `localStorage`. An inline `<script>` in `<head>` prevents flash of wrong theme on load. Terminal (xterm.js) and editor (CodeMirror) themes update dynamically.

## Scripts

```bash
npm run dev        # Vite (5173) + backend (3001) with hot reload
npm test           # Run all 61 tests
npm run build      # Production build (dist/ + dist-server/)
npm start          # Serve production build
```

## Supported Languages

TypeScript/TSX, JavaScript/JSX, Python, JSON, HTML, CSS/SCSS/Less, Markdown, Rust, YAML, C/C++, Java, XML/SVG, SQL, PHP, Go

## Design

Dark/light theme toggle. Dark: off-black backgrounds (`#0a0a0a`), orange accent (`#f6821f`). Light: white backgrounds (`#ffffff`), adjusted orange (`#e0710a`). Inter + IBM Plex Mono typography. No CSS framework.
