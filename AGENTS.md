# AGENTS.md

## Project Overview

TmuxWeb — web-based tmux client (desktop + mobile).

| Layer     | Stack                                      |
|-----------|--------------------------------------------|
| Backend   | Node.js, Express 4, WebSocket (ws), node-pty |
| Frontend  | React 18, Vite 5, TypeScript, xterm.js     |
| Database  | MySQL (mysql2/promise) — **optional**      |
| Deploy    | PM2 (TmuxWeb/ecosystem.config.js)          |

Primary working directory: `TmuxWeb/`.

## Prerequisites

- **Node.js 18.x – 20.x** (tested on v20.20.0; v22+ has node-pty compatibility issues)
- **npm ≥ 8.x**
- **tmux ≥ 3.0**
- **MySQL 5.7+** — optional, only needed for task tracking persistence
- macOS or Linux

## Build Commands

```bash
# Backend
cd TmuxWeb && npm start           # or: node server/index.js

# Frontend
cd TmuxWeb/web && npm run dev     # dev server (port 5215)
cd TmuxWeb/web && npm run build   # production build

# Combined (PM2)
cd TmuxWeb && pm2 start ecosystem.config.js
```

No test scripts configured. Manual verification:
```bash
curl -sk https://localhost:8215/healthz
```

## Ports

| Service       | Port  | Notes                    |
|---------------|-------|--------------------------|
| Backend API   | 8215  | Express + WebSocket      |
| Frontend Dev  | 5215  | Vite dev server          |

Ports are configurable in `TmuxWeb/server/config_private.json` (`port`, `frontendPort`).

## Project Structure

```
TmuxWeb/
├── server/
│   ├── index.js                    # Express + WebSocket entry
│   ├── config.json                 # Default config (tracked)
│   ├── config_private.json         # User config (gitignored)
│   ├── config-loader.js            # Merges config + config_private
│   ├── routes/
│   │   ├── ai.js                   # LLM command generation
│   │   ├── auth.js                 # Login/logout
│   │   ├── butler-proxy.js         # Orchestration service proxy
│   │   ├── capabilities.js         # API capability manifest
│   │   ├── groups.js               # Session groups
│   │   ├── hotwords.js             # Voice hotwords
│   │   ├── opencode-config.js      # OpenCode config reader
│   │   ├── panes.js                # Pane listing
│   │   ├── profiles.js             # Workspace profiles
│   │   ├── roles.js                # AI roles (built-in + custom)
│   │   ├── segments.js             # Conversation/command logging
│   │   ├── sessions.js             # Tmux session management
│   │   ├── snippets.js             # Saved command snippets
│   │   ├── summaries.js            # Task summaries
│   │   ├── task-events.js          # Task lifecycle SSE
│   │   ├── tasks-db.js             # Task DB queries
│   │   ├── tasks.js                # Task helpers
│   │   ├── telemetry.js            # Telemetry endpoint
│   │   ├── tmux.js                 # Tmux commands
│   │   └── upload.js               # File upload
│   ├── middleware/
│   │   ├── auth.js                 # Token/session auth
│   │   └── db.js                   # requireDb guard (503 if no MySQL)
│   ├── services/
│   │   ├── terminal.js             # PTY terminal service
│   │   ├── terminal-controlmode.js # Control mode terminal
│   │   ├── speech.js               # Xunfei STT WebSocket proxy
│   │   └── tmux-control.js         # Tmux control mode helpers
│   └── db/
│       ├── pool.js                 # MySQL connection pool (exports pool, dbEnabled)
│       ├── bootstrap.js            # Auto table creation on startup
│       └── init.sql                # Schema definitions
├── web/src/
│   ├── main.tsx                    # Router (/ → desktop, /m → mobile)
│   ├── desktop/
│   │   ├── App.tsx                 # Desktop app entry
│   │   ├── DesktopToolbox.tsx      # Toolbox panel
│   │   └── TerminalTabs.tsx        # Tab management
│   ├── mobile/
│   │   └── MobileApp.tsx           # Mobile app entry
│   ├── shared/
│   │   └── components/             # Shared UI (TmuxTree, ImperialStudy, etc.)
│   ├── components/                 # Page-level components (Terminal, Summary, etc.)
│   ├── hooks/                      # Custom React hooks
│   ├── utils/                      # Helpers (auth, platform, API)
│   └── styles/                     # CSS stylesheets
├── plugins/
│   └── my-rules.js.back            # OpenCode plugin template
├── ecosystem.config.js             # PM2 process config
├── skills/                         # AI agent knowledge base
│   ├── SKILL.md                    # Skill entry point
│   ├── api.md                      # API reference
│   ├── architecture.md             # Architecture details
│   ├── data-model.md               # Data model
│   ├── development.md              # Development guide
│   └── troubleshooting.md          # Common issues & solutions
└── setup.sh                        # One-click setup script
```

## Detailed References

| Topic | File |
|-------|------|
| Code style, naming, patterns | [agents/code-style.md](agents/code-style.md) |
| Voice / Xunfei STT | [agents/voice-xunfei.md](agents/voice-xunfei.md) |
| Troubleshooting | [skills/troubleshooting.md](skills/troubleshooting.md) |

## Tools

| Tool | File | Description |
|------|------|-------------|
| tmux-restart | [tools/tmux-restart.sh](tools/tmux-restart.sh) | Kill & recreate all tmux sessions (preserves working directories, auto-skips opencode sessions) |
| setup | [setup.sh](setup.sh) | One-click setup: install deps, generate SSL, configure, start server |

## Configuration

- `TmuxWeb/server/config.json` — defaults (tracked in git)
- `TmuxWeb/server/config_private.json` — user overrides (gitignored)
- `token` is required for all API/WS routes

### No-DB Mode

MySQL is optional. When `db` is not configured in `config_private.json`:
- `pool.js` exports `pool = null`, `dbEnabled = false`
- Routes guarded by `requireDb` middleware return 503
- Task event endpoints have inline `dbEnabled` guards
- Server runs normally — task tracking just won't persist

## Conventions

### Code Style

See [agents/code-style.md](agents/code-style.md) for full conventions. Key rules:

- **Backend**: CommonJS (`require`/`module.exports`), single quotes, 2-space indent
- **Frontend**: TypeScript ESM, functional components only, no Redux
- **Route files**: kebab-case (`task-events.js`)
- **Components**: PascalCase (`TerminalTabs.tsx`)
- **Hooks**: `useCamelCase.ts`

### Task Tracking

Task lifecycle events are reported automatically via the OpenCode plugin (`plugins/my-rules.js`).
No manual curl needed — the plugin handles `task_started` / `task_completed` events on every conversation.
See the [README](README.md#opencode-integration) for plugin deployment steps.
