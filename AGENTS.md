# AGENTS.md

## Project Overview

TmuxWeb — web-based tmux client (desktop + mobile). This repo keeps **TmuxWeb** as the active web stack.

| Layer     | Stack                                      |
|-----------|--------------------------------------------|
| Backend   | Node.js, Express 4, WebSocket (ws), node-pty |
| Frontend  | React 18, Vite 5, TypeScript, xterm.js     |
| Database  | MySQL (mysql2/promise)                     |
| Voice     | Xunfei STT via WebSocket proxy             |
| Deploy    | PM2 (TmuxWeb/ecosystem.config.js)          |

Primary working directory: `TmuxWeb/`.

## Build / Dev / Lint Commands

### Backend (`TmuxWeb/`)
```bash
cd TmuxWeb
npm start               # node server/index.js
npm run dev             # same as start
```

### Frontend (`TmuxWeb/web`)
```bash
cd TmuxWeb/web
npm run dev             # Vite dev server (port 5216)
npm run build           # Production build → TmuxWeb/web/dist
npm run preview         # Preview production build
```

### Combined
```bash
cd TmuxWeb
./start.sh              # build frontend + start backend + preview frontend
pm2 start ecosystem.config.js
```

### Tests
No test scripts configured for TmuxWeb. (Playwright is a dev dependency but no default test command.)

## Project Structure

```
TmuxWeb/
├── server/
│   ├── index.js           # Express + WebSocket entry point
│   ├── config.json        # Public config (ports, token, xfyun, llm)
│   ├── routes/            # Express route handlers
│   ├── middleware/        # Auth middleware
│   ├── services/          # terminal.js, speech.js (Xunfei proxy)
│   └── db/                # MySQL pool + schema
├── web/                   # React frontend (Vite + TS)
│   ├── public/            # Static assets
│   └── src/
│       ├── App.tsx        # Desktop app
│       ├── main.tsx       # Router entry (/, /m)
│       ├── mobile/        # Mobile UI
│       ├── components/    # UI components
│       ├── hooks/         # Custom hooks
│       ├── utils/         # Helpers (auth, telemetry)
│       └── styles/        # CSS
└── ecosystem.config.js    # PM2
```

## Code Style

### Language & Modules
- **Backend**: JavaScript (CommonJS) — `require()` / `module.exports`
- **Frontend**: TypeScript + React (ESM) — `import` / `export`

### Formatting
- **Indentation**: 2 spaces
- **Quotes**: Single quotes
- **Semicolons**: Used in backend JS; frontend TS uses standard TS/JS style (no enforced lint config)

### Naming
| Element             | Convention     | Example                         |
|---------------------|----------------|---------------------------------|
| Variables/functions | camelCase      | `fetchProfiles`, `paneId`       |
| React components    | PascalCase     | `TerminalTabs`, `MobileApp`     |
| Component files     | PascalCase.tsx | `LoginModal.tsx`                |
| Hook files          | useCamelCase.ts| `useKeyboardAvoider.ts`         |
| Route files         | kebab-case.js  | `tasks-db.js`, `task-events.js` |
| Constants           | UPPER_SNAKE    | `COOKIE_NAME`                   |

### Imports — Order
```ts
// 1. React / external packages
import { useState } from 'react'
import { Menu } from 'lucide-react'

// 2. Local modules
import { TmuxTree } from './components/TmuxTree'
import { checkAuth } from './utils/auth'
```

### Error Handling (Backend)
```js
router.post('/endpoint', async (req, res) => {
  try {
    const result = await pool.query(...)
    res.json({ data: result })
  } catch (err) {
    console.error('[route POST /endpoint]', err)
    res.status(500).json({ error: 'internal_error', message: err.message })
  }
})
```

### React Patterns
- **Functional components only**
- **React Router** in `main.tsx` (`/` desktop, `/m` mobile)
- **Local state** with hooks; no Redux/Zustand
- **Styling**: CSS files in `src/styles` and component-specific CSS

### Voice / Xunfei Flow
- Frontend: `web/src/components/VoiceInput.tsx` (getUserMedia + WS `/ws/speech`)
- Backend: `server/services/speech.js` (proxy to Xunfei)
- Debug page: `TmuxWeb/web/public/voice-debug.html` → `http://localhost:5216/voice-debug.html`

## Configuration

- `TmuxWeb/server/config.json` — ports, token, xfyun, llm
- `allowedOrigins` must include the frontend URL (`http://localhost:5216`)
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
