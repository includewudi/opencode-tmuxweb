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

## Configuration

- `TmuxWeb/server/config.json` — ports, token, xfyun, llm
- `token` is required for all API/WS routes

## Conventions

### Task Tracking (MANDATORY)
On every new conversation, immediately report to TmuxWeb by running:
```bash
PANE_KEY=$(tmux display-message -p '#{session_name}/#{window_index}/#{pane_id}') && curl -sk --noproxy '*' -X POST https://localhost:8216/api/tasks/events -H "Content-Type: application/json" -d "{\"event\":\"task_started\",\"pane_key\":\"$PANE_KEY\",\"conversation_id\":\"$(uuidgen | tr '[:upper:]' '[:lower:]')\",\"user_message\":\"USER_MSG\",\"timestamp\":$(date +%s)}"
```
Replace `USER_MSG` with the user's message (first 200 chars, JSON-escaped). If it fails, ignore and continue.

### Task Completion Notification
For long-running tasks, notify the user upon completion:
```bash
notify alert "ios任务完成" --sync
```
