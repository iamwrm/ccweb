# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

ccweb is a browser-based terminal + file explorer for running multiple Claude Code TUI sessions in parallel. Each workspace has its own PTY terminal(s), file tree, and code editor with save support.

## Commands

```bash
npm run dev          # Vite (5173) + Express backend (3001) via concurrently
npm test             # All 61 tests (vitest run)
npm run test:watch   # Watch mode
npm run build        # Frontend (dist/) + server (dist-server/)
npm start            # Production server
```

Run a single test file:
```bash
npx vitest run server/__tests__/files.test.ts
npx vitest run src/__tests__/FileTree.test.tsx
```

Run tests by project:
```bash
npx vitest run --project server
npx vitest run --project frontend
```

## Architecture

**Two processes in dev:** Vite dev server (5173) proxies `/api/*` and `/ws` to Express (3001). In production, Express serves the Vite build from `dist/` directly.

**Workspace model:** Each workspace = multiple PTY sessions + one optional open file + its own working directory. Switching workspaces in the sidebar swaps the terminal area and editor. Terminal components stay mounted (hidden via CSS `display:none`) to preserve WebSocket connections and scrollback.

**Multi-terminal:** Each workspace supports multiple terminal tabs with horizontal/vertical splits. The layout is a recursive binary tree (`TerminalLayout` type) rendered with nested `react-resizable-panels`. Tabs that are not in the current split layout remain mounted but hidden.

**WebSocket protocol:** Terminal I/O is raw strings (not JSON-wrapped). Control messages are JSON: `{"type":"resize","cols":80,"rows":24}`. Server distinguishes them by checking if the message starts with `{` and attempting JSON.parse. The `cwd` query parameter sets the PTY's working directory on session creation.

**Session lifecycle:** PTY sessions survive WebSocket disconnect for 5 minutes. Reconnecting with the same session ID reattaches to the existing PTY. Orphaned sessions are swept every 30 seconds.

**File save:** `PUT /api/file` with JSON body `{ path, content, root? }`. Uses `safePath()` for traversal protection, validates target is an existing file, enforces 1MB limit. The editor triggers save via Ctrl+S/Cmd+S.

**Theme system:** Dark/light toggle via `[data-theme="light"]` attribute on `<html>`, overriding CSS custom properties. Theme state lives in `ThemeContext` (provided by `App.tsx`), persists in `localStorage`. Flash-prevention script in `index.html <head>`. Terminal (xterm.js) and editor (CodeMirror) themes update dynamically without remounting.

## Key Constraints

- **Express 5:** Catch-all routes use `/{*splat}` syntax, not `*`.
- **Vitest projects:** `globals: true` must be set inside each project's test config, not at the root level. Frontend tests use `jsdom`, server tests use `node`.
- **Path security:** All file API requests (read and write) pass through `safePath()` in `server/files.ts` which uses `path.resolve()` + startsWith prefix check with `path.sep`. Never bypass this.
- **No nested buttons:** The sidebar uses `<div role="button">` for workspace items to avoid nesting `<button>` inside `<button>` (the close button is a child).
- **TypeScript split:** `tsconfig.json` is frontend-only (noEmit, Vite handles it). `tsconfig.node.json` is server-only (emits to dist-server/). The `server/` directory is excluded from the frontend tsconfig.
- **express.json() import:** In `server/files.ts`, import as `json as jsonMiddleware` from `'express'` (named import), not `express.json()` — `express` is not in scope as a default import in that file.

## Common Pitfalls

- **Express 5 catch-all crash:** Using `app.get('*', ...)` throws `PathError: Missing parameter name`. Always use `app.get('/{*splat}', ...)`. This applies to any wildcard route.
- **Vitest `globals: true` at root level:** Placing `globals: true` at the top of `vitest.config.ts` instead of inside each project's `test` block causes `ReferenceError: expect is not defined` in the setup file. The projects config does NOT inherit root-level test options.
- **`environmentMatchGlobs` is deprecated:** Use the `projects` array with separate `environment` per project instead.
- **Port conflicts on restart:** The backend (3001) can linger after `npm run dev` is killed. Run `fuser -k 3001/tcp` before restarting if you get `EADDRINUSE`.
- **`tsconfig.json` references:** Do NOT add `"references": [{ "path": "./tsconfig.node.json" }]` to the frontend tsconfig unless `tsconfig.node.json` has `"composite": true`. Just use `"exclude": ["server"]` instead.
- **CSS `var()` in CodeMirror themes:** CodeMirror's `EditorView.theme()` accepts CSS var references (e.g., `backgroundColor: 'var(--bg-secondary)'`). This works because it generates CSS rules, not inline styles.
- **Terminal visibility:** Never unmount `<TerminalPanel>` when switching workspaces — use `display:none`. Unmounting destroys the xterm.js instance and WebSocket, losing all scrollback and session state.
- **`safePath` prefix check:** The check must be `resolved.startsWith(root + path.sep)` with the trailing separator. Without it, `/project-evil` would pass validation against root `/project`.
- **Sidebar rename popup:** The rename popup uses `position: fixed` (not `position: absolute`) because `.sidebar-workspaces` has `overflow-y: auto`, which implicitly sets `overflow-x: auto` and clips absolutely positioned children.
- **CodeMirror light theme:** In light mode, `oneDark` is excluded and replaced with a custom `HighlightStyle` using `syntaxHighlighting()`. Without this, code has no syntax colors in light mode.

## Design System

Dark/light theme toggle. Dark: backgrounds `#0a0a0a` / `#111111` / `#181818`, accent `#f6821f`. Light: backgrounds `#ffffff` / `#f5f5f5` / `#ebebeb`, accent `#e0710a`. Fonts are Inter (sans) and IBM Plex Mono (mono). All colors use CSS custom properties defined in `src/global.css`, overridden by `[data-theme="light"]`.
