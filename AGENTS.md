# AGENTS.md

## Project Overview

TmuxWeb — web-based tmux client (desktop + mobile).

| Layer     | Stack                                      |
|-----------|--------------------------------------------|
| Backend   | Node.js, Express 4, WebSocket (ws), node-pty |
| Frontend  | React 18, Vite 5, TypeScript, xterm.js     |
| Database  | MySQL (mysql2/promise)                     |
| Deploy    | PM2 (TmuxWeb/ecosystem.config.js)          |

Primary working directory: `TmuxWeb/`.

## Build Commands

```bash
# Backend
cd TmuxWeb && npm start

# Frontend
cd TmuxWeb/web && npm run dev    # dev (port 5216)
cd TmuxWeb/web && npm run build  # production

# Combined
cd TmuxWeb && pm2 start ecosystem.config.js
```

No test scripts configured.

## Project Structure

```
TmuxWeb/
├── server/
│   ├── index.js           # Express + WebSocket entry
│   ├── config.json        # ports, token, xfyun, llm
│   ├── routes/            # Route handlers
│   ├── middleware/        # Auth
│   ├── services/          # terminal.js, speech.js
│   └── db/                # MySQL pool + schema
├── web/src/
│   ├── App.tsx            # Desktop app
│   ├── main.tsx           # Router (/, /m)
│   ├── mobile/            # Mobile UI
│   ├── components/        # UI components
│   ├── hooks/             # Custom hooks
│   ├── utils/             # Helpers
│   └── styles/            # CSS
└── ecosystem.config.js    # PM2
```

## Detailed References

| Topic | File |
|-------|------|
| Code style, naming, patterns | [agents/code-style.md](agents/code-style.md) |
| Voice / Xunfei STT | [agents/voice-xunfei.md](agents/voice-xunfei.md) |

## Tools

| Tool | File | Description |
|------|------|-------------|
| tmux-restart | [tools/tmux-restart.sh](tools/tmux-restart.sh) | 重启所有 tmux session（保留工作目录，自动跳过 opencode） |

## Configuration

- `TmuxWeb/server/config.json` — ports, token, xfyun, llm
- `token` is required for all API/WS routes

## Conventions

### Task Tracking
Task lifecycle events are reported automatically via the OpenCode plugin (`plugins/my-rules.js`).
No manual curl needed — the plugin handles `task_started` / `task_completed` events on every conversation.

### Task Completion Notification
For long-running tasks, notify the user upon completion:
```bash
notify alert "ios任务完成" --sync
```
