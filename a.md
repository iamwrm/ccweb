# Web Terminal Ecosystem Exploration
## Building a "Codex App in the Browser"

---

## Executive Summary

Your goal: a browser-based tool with **Ghostty-quality terminal** + **file browser** for reviewing AI-generated code — essentially OpenAI's Codex App, but in the browser.

After deep exploration, the landscape breaks into **three existing projects** that directly address this, plus **one proven component** (ghostty-web) that underpins everything.

**Bottom line:** You don't need to build from scratch. The ecosystem has converged around ghostty-web as the terminal layer, and there are two real paths forward:

1. **Fork/extend webterm** — Already works, ghostty-web integrated, Python backend, just needs file browser + Monaco
2. **Self-host Mux** — Coder's Mux is already a "Codex App in the browser" with ghostty-web, but it's an agentic IDE (may be more than you want)

---

## 1. ghostty-web (coder/ghostty-web)

**The terminal layer everything else depends on.**

| Property | Value |
|---|---|
| Source | Ghostty's VT100 emulator compiled to WASM |
| Bundle size | ~400 KB (WASM) |
| Renderer | Canvas-based, 60 FPS |
| API | xterm.js-compatible (drop-in replacement) |
| Created for | Mux (Coder's agentic IDE) |
| License | MIT |

**Key advantage over xterm.js:**

- xterm.js reimplements terminal emulation in JavaScript — every escape sequence hand-coded
- ghostty-web uses the **same battle-tested C/Zig code** that runs the native Ghostty app
- Proper RTL language support, complex scripts (Devanagari, Arabic), Kitty keyboard protocol
- XTPUSHSGR/XTPOPSGR support (xterm.js: not supported)
- Native theme colors passed directly to WASM (no runtime color remapping)

**Usage is dead simple:**

```typescript
import { init, Terminal } from 'ghostty-web';
await init();
const term = new Terminal({
  fontSize: 14,
  theme: { background: '#1a1b26', foreground: '#a9b1d6' },
});
term.open(document.getElementById('terminal'));
term.onData((data) => websocket.send(data));
websocket.onmessage = (e) => term.write(e.data);
```

**Status:** Actively maintained by Coder. Currently uses patches on Ghostty source. Will eventually consume a native Ghostty WASM distribution once Mitchell Hashimoto ships libghostty.

---

## 2. webterm (rcarmo/webterm)

**The most relevant starting point for your project.**

A production web terminal that has already migrated from xterm.js to ghostty-web. Python backend (85.9%), TypeScript frontend (12.3%).

### Architecture

```
Browser                          Server (Python)
┌─────────────────┐             ┌──────────────────────┐
│ ghostty-web WASM│◄──WebSocket──►│ asyncio + pty        │
│ Canvas renderer │   JSON msgs  │ aiofiles             │
│ 60fps           │              │ pyte (screenshots)   │
└─────────────────┘             │ Docker API (optional) │
                                └──────────────────────┘
```

### WebSocket Protocol

JSON messages: `["stdin", data]`, `["resize", {"width": w, "height": h}]`, `["ping", data]`

### What It Already Has

- **ghostty-web terminal** (patched fork with theme/palette support)
- **Multiple terminal sessions** via YAML manifest or Docker auto-discovery
- **Dashboard** with live SVG screenshots, SSE real-time updates
- **Session reconnection** — refresh browser, reconnect to same PTY
- **10 themes** — xterm, monokai, dark, light, dracula, catppuccin, nord, gruvbox, solarized, tokyo
- **Custom fonts** — configurable family and size
- **Mobile support** — iOS Safari, Android
- **Docker integration** — auto-discover containers with `webterm-command` / `webterm-theme` labels
- **CPU sparklines** — 30-min CPU history per container (compose mode)
- **Docker exec** — opens PTY directly into containers via Docker API
- **tmux integration** — per-container tmux sessions via `WEBTERM_DOCKER_AUTO_COMMAND`
- **Auto-sizing** — terminal resizes to browser window
- **Pre-built bundle** — committed to repo, `pip install` works without Node.js

### What It Lacks (For Your Use Case)

- **No file browser** — terminal only
- **No Monaco/code viewer** — no syntax-highlighted file viewer
- **No git integration** — no diff view, no branch status
- **No split pane layout** — dashboard is tile-based, not IDE-like
- **No authentication** — designed for container-internal use behind reverse proxy

### Key Technical Details

- Uses **patched ghostty-web** (rcarmo/ghostty-web fork) — upstream has bugs/feature gaps
- Frontend bundle: ~0.67 MB (vs ~1.16 MB for xterm.js equivalent)
- Backend: Python 3.9+, uses Poetry for deps, Bun for frontend build
- Screenshots via **pyte** (ANSI interpretation → SVG) — author wants to replace with libghostty-vt when ready
- Docker socket access for container management
- SSE for real-time dashboard updates

### Companion: agentbox (rcarmo/agentbox)

webterm is designed to pair with **agentbox** — a Docker-based coding agent sandbox:

- Debian container with Homebrew, Docker-in-Docker, SSH/Mosh, minimal RDP desktop
- Pre-installed agents: Batrachian Toad, Copilot CLI, Mistral Vibe, OpenCode
- Dev tools: VS Code, uv, node, bun, go
- TUI manager for spinning up/managing multiple agent instances
- The combo of **webterm + agentbox** is essentially "containerized AI coding agents with web-based terminal access"

---

## 3. Coder Mux (coder/mux)

**The closest existing thing to "Codex App in the browser."**

| Property | Value |
|---|---|
| Type | Desktop & browser application |
| Language | TypeScript (95.7%) |
| Stars | 737+ |
| License | AGPL-3.0 |
| Status | Beta, actively developed (989+ commits, 12 contributors) |

### What It Is

A **coding agent multiplexer** — run multiple AI coding agents in parallel with isolated workspaces. Built by Coder (the company behind ghostty-web).

### Features That Match Your Needs

- **ghostty-web terminal** — same WASM terminal
- **Integrated code review** — review agent's changes with diff view
- **Git divergence UI** — see changes and potential conflicts across workspaces
- **Multi-model support** — Sonnet 4, GPT-5, Grok, Opus 4, Ollama (local), OpenRouter
- **Isolated workspaces** — local, git worktree, or SSH remote
- **Rich markdown** — mermaid diagrams, LaTeX in agent output
- **VS Code extension** — jump into mux workspaces from VS Code
- **Cost tracking** — token consumption and costs per workspace
- **Agent status sidebar** — agents report their status with emoji/URLs
- **Opportunistic compaction** — keeps context small automatically
- **Browser mode** — works via Tailscale for mobile/tablet access

### Architecture

- Desktop: Electron app (macOS + Linux)
- Browser: served via HTTP, works with Tailscale for remote access
- Agent loop: custom, inspired by Claude Code (Plan/Exec mode, vim inputs, /compact)
- Workspaces: git worktrees for isolation

### Why You Might NOT Want Mux

- **It's an agentic IDE** — has its own agent loop, LLM integration, workspace management
- **AGPL-3.0** — copyleft license, must share modifications
- **Requires API keys** — designed around LLM interaction, not just terminal + file viewing
- **Heavy** — full Electron app, not a lightweight terminal+filebrowser
- **You may just want the terminal + file browser**, not the agent orchestration

---

## 4. Architecture Comparison

### webterm (What Exists)

```
┌─────────────────────────────────────────┐
│              Browser                    │
│  ┌─────────────┐  ┌──────────────┐     │
│  │ ghostty-web │  │  Dashboard   │     │
│  │   (WASM)    │  │  (tiles)     │     │
│  │ 400KB       │  │  live SVGs   │     │
│  └──────┬──────┘  └──────┬───────┘     │
│         │ WebSocket      │ SSE         │
└─────────┼────────────────┼─────────────┘
          │                │
┌─────────┴────────────────┴─────────────┐
│         Python Server                   │
│  ┌──────────┐  ┌─────────────────┐     │
│  │ PTY mgmt │  │ Docker API      │     │
│  │ asyncio  │  │ container watch │     │
│  └──────────┘  │ CPU stats       │     │
│                └─────────────────┘     │
└─────────────────────────────────────────┘
```

### What You Want (webterm + additions)

```
┌──────────────────────────────────────────────────────┐
│                     Browser                          │
│  ┌──────────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ ghostty-web  │  │  File    │  │ Monaco       │   │
│  │ Terminal     │  │  Tree    │  │ Editor       │   │
│  │ (WASM,400KB) │  │  Panel   │  │ (read-only)  │   │
│  └──────┬───────┘  └────┬─────┘  └──────┬───────┘   │
│         │ WebSocket     │ REST         │ REST       │
└─────────┼───────────────┼──────────────┼────────────┘
          │               │              │
┌─────────┴───────────────┴──────────────┴────────────┐
│                  Server (Python or Node)             │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ PTY mgmt │  │ File API     │  │ Git status   │   │
│  │ sessions │  │ fs.readdir   │  │ changed files│   │
│  │ asyncio  │  │ read/stat    │  │ diff view    │   │
│  └──────────┘  └──────────────┘  └──────────────┘   │
└──────────────────────────────────────────────────────┘
```

---

## 5. Recommended Path Forward

### Option A: Extend webterm (Fastest)

**Effort:** Medium. ~1-2 weeks for MVP.

1. **Fork rcarmo/webterm**
2. **Add file tree panel** — REST endpoint `GET /files/{path}` returning JSON directory listing with git status
3. **Add Monaco editor** — read-only file viewer with syntax highlighting, loaded on file click
4. **Add split-pane layout** — replace tile dashboard with IDE-like layout (terminal bottom/right, file tree left, editor center)
5. **Add git status indicators** — modified/added/deleted markers in file tree

**Pros:**
- ghostty-web already integrated and working
- Python backend is simple and well-structured
- WebSocket protocol is clean (JSON messages)
- Docker integration already built
- Works today — `pip install` and go

**Cons:**
- Python backend means no node-pty (uses OS pty directly via asyncio — actually fine)
- Patched ghostty-web fork needed (upstream has gaps)
- Adding Monaco means adding a JS build step

### Option B: Custom Build with Node.js

**Effort:** Medium-High. ~2-3 weeks for MVP.

1. **ghostty-web** for terminal
2. **Express/Fastify** + **node-pty** for PTY management
3. **Monaco Editor** for file viewing
4. **Custom file tree** component
5. **WebSocket** for terminal I/O

**Pros:**
- Everything in one language (TypeScript)
- node-pty is battle-tested
- Monaco is native to the JS ecosystem
- Full control over architecture

**Cons:**
- More boilerplate to write
- No Docker integration out of the box
- Starting from scratch vs. extending existing code

### Option C: Use Mux Directly

**Effort:** Low setup, but may not fit.

1. **Install Mux** from releases
2. **Configure** with your preferred LLM
3. **Access via browser** with Tailscale

**Pros:**
- Already built, already works
- ghostty-web terminal, code review, git integration
- Multi-agent parallel workflows

**Cons:**
- AGPL-3.0 license
- Requires LLM API keys / integration
- More than you need (full agentic IDE)
- Can't easily strip it down to just terminal + file browser

---

## 6. Key Technical Decisions

### Terminal: ghostty-web ✓

No question. Drop-in replacement for xterm.js with better correctness, smaller bundle, native WASM performance.

### Backend: Python vs Node.js

| Factor | Python (webterm) | Node.js |
|---|---|---|
| PTY management | asyncio + os.pty | node-pty (battle-tested) |
| File operations | aiofiles | fs/promises |
| WebSocket | built-in | ws or socket.io |
| Monaco integration | Separate build | Native ecosystem |
| Docker API | Direct asyncio | dockerode |
| Existing code | webterm has it all | Start from scratch |

**Recommendation:** Start with webterm (Python). Add Monaco via CDN (no build step needed). If you later want to go full Node.js, the WebSocket protocol is clean enough to rewrite the backend.

### Editor: Monaco Editor

- Same editor as VS Code
- Load from CDN: `https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/`
- Read-only mode for code review
- Syntax highlighting for 50+ languages
- Diff view built-in (useful for reviewing AI changes)

### File Tree

- Simple REST API: `GET /api/files?path=/&depth=2`
- Return JSON: `{name, type, size, modified, gitStatus}`
- Lazy-load directories on expand
- Highlight git-modified files

---

## 7. The webterm + agentbox Ecosystem

This is worth calling out: rcarmo has built exactly the workflow you're describing, just in a different form factor.

```
agentbox (Docker container)
├── AI coding agents (Toad, Copilot, Mistral Vibe, OpenCode)
├── Dev environment (Debian + Homebrew + Docker-in-Docker)
├── tmux sessions per agent
└── webterm (web terminal access)
    ├── ghostty-web terminal in browser
    ├── Dashboard with live screenshots per agent
    ├── Docker auto-discovery of agent containers
    └── Session reconnection
```

The missing piece is the **file browser + code viewer**. That's the gap you'd fill.

---

## 8. Quick Start Commands

### Try webterm now:
```bash
pip install git+https://github.com/rcarmo/webterm.git
webterm --theme dracula bash
# Open http://localhost:8080
```

### Try Mux now:
```bash
# Download from https://github.com/coder/mux/releases
# macOS or Linux
./mux
```

### Try ghostty-web demo:
```bash
npx @ghostty-web/demo@next
# Opens http://localhost:8080 with a real shell
```
