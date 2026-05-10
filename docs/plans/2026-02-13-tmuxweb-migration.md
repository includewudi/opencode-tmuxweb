# TmuxWeb → web/ Full Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate all TmuxWeb features (Express + MySQL + auth + groups/profiles/tasks/summaries) into the existing `web/` project, replacing the raw HTTP server with Express while preserving all existing functionality.

**Architecture:** Replace `web/server.js` (raw `http.createServer`) with an Express-based server that mounts both existing endpoints (sessions, AI, roles, snippets, logs) and all TmuxWeb routes (auth, groups, profiles, sessions-meta, panes, tasks, segments, summaries, task-events, telemetry). Frontend stays JSX (no TypeScript conversion) — port TmuxWeb TSX components to JSX. MySQL database `tmuxweb` already exists with all 9 tables populated.

**Tech Stack:** Node.js, Express, mysql2, cookie-parser, cors, ws, node-pty, @dnd-kit, React 19, Vite, Tailwind CSS

**Key Decisions:**
- **Express over raw HTTP:** TmuxWeb uses Express; current server.js is 626 lines of manual routing — Express is strictly better
- **Keep JSX:** Current frontend is JSX; converting to TS is scope creep. Port TSX → JSX
- **Reuse TmuxWeb config:** `web/config.js` already loads `TmuxWeb/server/config.json` as base — just add MySQL/auth fields to `private_config.json`
- **Single server:** One Express server serves everything (no separate TmuxWeb process)

---

## Phase 1: Backend Migration (Tasks 1-5)

### Task 1: Install Backend Dependencies

**Files:**
- Modify: `web/package.json`

**Step 1: Install express, mysql2, cors, cookie-parser, @google/generative-ai**

```bash
cd web && npm install express mysql2 cors cookie-parser @google/generative-ai
```

**Step 2: Verify package.json has new dependencies**

```bash
cat web/package.json
```

Expected: dependencies include express, mysql2, cors, cookie-parser, @google/generative-ai

**Step 3: Commit**

```bash
git add web/package.json web/package-lock.json
git commit -m "chore: add express, mysql2, cors, cookie-parser dependencies for TmuxWeb migration"
```

---

### Task 2: Port Database Layer

**Files:**
- Create: `web/db/pool.js` (copy from `TmuxWeb/server/db/pool.js`)
- Create: `web/db/bootstrap.js` (adapted from `TmuxWeb/server/db/bootstrap.js`)

**Step 1: Create `web/db/pool.js`**

Copy `TmuxWeb/server/db/pool.js` verbatim — it uses env vars with defaults matching our MySQL setup (root/root, localhost:3306, tmuxweb).

**Step 2: Create `web/db/bootstrap.js`**

Adapt `TmuxWeb/server/db/bootstrap.js` — fix the SCHEMA_PATH to point to `../../.sisyphus/drafts/tmuxweb-sql-schema.sql` (same relative path works from `web/db/`).

**Step 3: Verify MySQL connectivity**

```bash
cd web && node -e "const {testConnection}=require('./db/pool'); testConnection().then(ok=>console.log('DB:',ok)).catch(e=>console.error(e))"
```

Expected: `DB: true`

**Step 4: Commit**

```bash
git add web/db/
git commit -m "feat: add MySQL connection pool and bootstrap for TmuxWeb migration"
```

---

### Task 3: Port Auth and Middleware

**Files:**
- Create: `web/routes/auth.js` (copy from `TmuxWeb/server/routes/auth.js`)
- Create: `web/middleware/auth.js` (copy from `TmuxWeb/server/middleware/auth.js`)

**Step 1: Create `web/routes/auth.js`**

Copy `TmuxWeb/server/routes/auth.js`. Change `require('../config.json')` to `require('../config')` (to use the existing config.js loader that merges public+private config).

**Step 2: Create `web/middleware/auth.js`**

Copy `TmuxWeb/server/middleware/auth.js`. Same config path fix: `require('../config.json')` → `require('../config')`.

**Step 3: Update `web/private_config.json`**

Add `token` and `sessionSecret` fields:
```json
{
  "token": "tmuxweb-dev-token",
  "sessionSecret": "tmuxweb-session-secret-change-in-prod"
}
```

**Step 4: Commit**

```bash
git add web/routes/auth.js web/middleware/auth.js web/private_config.json
git commit -m "feat: add cookie-based auth middleware and login/logout routes"
```

---

### Task 4: Port All TmuxWeb Route Files

**Files:**
- Create: `web/routes/groups.js`
- Create: `web/routes/profiles.js`
- Create: `web/routes/sessions.js`
- Create: `web/routes/panes.js`
- Create: `web/routes/tasks-db.js`
- Create: `web/routes/segments.js`
- Create: `web/routes/summaries.js`
- Create: `web/routes/task-events.js`
- Create: `web/routes/telemetry.js`
- Create: `web/routes/tmux.js`
- Create: `web/services/terminal.js`
- Create: `web/services/gemini.js`

**Step 1: Copy all route files from `TmuxWeb/server/routes/` to `web/routes/`**

For each file, fix imports:
- `require('../config.json')` → `require('../config')`
- `require('../db/pool')` → `require('../db/pool')` (same)
- `require('../services/gemini')` → `require('../services/gemini')`

Files to copy (with config path fix where needed):
1. `groups.js` — no config import, just pool. Copy verbatim.
2. `profiles.js` — no config import, just pool. Copy verbatim.
3. `sessions.js` — no config import, just pool. Copy verbatim.
4. `panes.js` — no config import, just pool. Copy verbatim.
5. `tasks-db.js` — no config import, just pool. Copy verbatim.
6. `segments.js` — no config import, just pool. Copy verbatim.
7. `summaries.js` — imports config.json AND gemini service. Fix both paths.
8. `task-events.js` — no config import, just pool. Copy verbatim.
9. `telemetry.js` — no imports to fix. Copy verbatim.
10. `tmux.js` — no imports to fix. Copy verbatim.

**Step 2: Copy service files from `TmuxWeb/server/services/` to `web/services/`**

1. `terminal.js` — no config import. Copy verbatim.
2. `gemini.js` — imports `config.json`. Fix to `require('../config')`.
3. `speech.js` — TmuxWeb version imports `config.json`. BUT `web/speech.js` already exists with same Xunfei logic. **Keep existing `web/speech.js`**, do NOT overwrite. Only copy TmuxWeb's `services/speech.js` if the existing one doesn't work with Express's WebSocket setup.

**Step 3: Verify all files exist and have correct imports**

```bash
ls -la web/routes/ web/services/ web/db/
```

**Step 4: Commit**

```bash
git add web/routes/ web/services/
git commit -m "feat: port all TmuxWeb route and service files to web/"
```

---

### Task 5: Rewrite server.js to Express

This is the **critical task**. Replace the 626-line raw HTTP server with Express, mounting both existing endpoints and new TmuxWeb routes.

**Files:**
- Modify: `web/server.js` (full rewrite)

**Step 1: Write new Express-based `web/server.js`**

The new server.js must:
1. Create Express app with cors, cookieParser, express.json()
2. Mount health endpoints (`/health`, `/healthz`)
3. Mount auth routes (NO token required): `app.use('/api/auth', authRouter)`
4. Mount task-events (NO token required): `app.use('/api/tasks/events', taskEventsRouter)`
5. Mount telemetry (NO token required): `app.use('/api/telemetry', telemetryRouter)`
6. Mount ALL token-protected routes with tokenMiddleware
7. Mount existing endpoints (sessions, AI command, roles, snippets, logs) as Express routes
8. Serve static files from `app/dist/` with SPA fallback
9. Set up WebSocket (noServer mode) for terminal and speech
10. Keep the CA cert download HTTP server on port 8280
11. Use HTTPS if cert.pem/key.pem exist, otherwise HTTP

**Preserve these existing features:**
- `GET /api/sessions` — tmux session listing (keep inline, don't use TmuxWeb's tmux.js which has different format)
- `POST /api/ai/command` — AI command generation
- `GET/POST/PUT/DELETE /api/roles` — custom roles CRUD
- `GET/POST/DELETE /api/snippets` — snippets CRUD
- `POST /api/log` + `GET /api/logs` — client logging
- WebSocket `/ws` with target-based tmux attach (existing PTY helper approach)
- WebSocket `/ws/speech` — Xunfei STT

**Add these TmuxWeb features:**
- `POST /api/auth/login`, `POST /api/auth/logout`
- `GET/POST/PUT/DELETE /api/groups`
- `GET/POST/PUT/DELETE /api/profiles`, `GET/PUT /api/profiles/:id/order`
- `PUT /api/sessions/:sessionName/group`
- `GET/PUT /api/panes/status`
- `POST/GET /api/panes/:paneKey/tasks`
- `PUT /api/tasks/:id`, `POST /api/tasks/:id/complete`, `GET /api/tasks/:id/detail`
- `POST/GET /api/segments/:segmentId/*`
- `POST /api/tasks/:taskId/summarize`, `POST /api/tasks/:taskId/load-summary`
- `GET /api/panes/:paneKey/summary-candidates`
- `POST/GET /api/tasks/events/:pane_key`
- `POST/GET/POST /api/telemetry`

**WebSocket approach:** Use `noServer` mode (like TmuxWeb) to handle upgrade manually. Route `/ws/terminal` to terminal handler, `/ws/speech` to speech handler. Also support legacy `/ws?target=...` for backward compatibility with existing frontend.

**Step 2: Test server starts without errors**

```bash
cd web && node server.js &
sleep 2
curl -s https://localhost:8215/health -k | head -1
kill %1
```

Expected: `{"status":"ok",...}`

**Step 3: Test existing API still works**

```bash
curl -s https://localhost:8215/api/sessions -k | head -1
```

Expected: JSON with sessions array

**Step 4: Test new auth endpoint**

```bash
curl -s -X POST https://localhost:8215/api/auth/login -k -H 'Content-Type: application/json' -d '{"token":"tmuxweb-dev-token"}'
```

Expected: `{"success":true,"message":"Login successful"}`

**Step 5: Commit**

```bash
git add web/server.js
git commit -m "feat: rewrite server.js from raw HTTP to Express with all TmuxWeb routes"
```

**Step 6: Restart PM2 and verify**

```bash
pm2 restart iterm-api
sleep 3
pm2 status
curl -s https://localhost:8215/health -k
```

Expected: PM2 shows online, health returns ok

---

## Phase 2: Frontend Migration (Tasks 6-10)

### Task 6: Install Frontend Dependencies

**Files:**
- Modify: `web/app/package.json`

**Step 1: Install @dnd-kit and react-router-dom**

```bash
cd web/app && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Note: react-router-dom is NOT needed yet — the current app is a single-page app with panel switching, not URL routing. TmuxWeb uses it for desktop/mobile split but we can defer that.

**Step 2: Commit**

```bash
git add web/app/package.json web/app/package-lock.json
git commit -m "chore: add @dnd-kit dependencies for drag-drop session tree"
```

---

### Task 7: Port TmuxWeb Type Definitions and Utils (as JSX)

**Files:**
- Create: `web/app/src/utils/auth.js` — auth utilities (token in cookie, fetch wrappers)
- Create: `web/app/src/utils/api.js` — API helper functions for all TmuxWeb endpoints

**Step 1: Create `web/app/src/utils/auth.js`**

Port `TmuxWeb/web/src/utils/auth.ts` to JSX. The auth utility handles:
- Login (POST /api/auth/login with token)
- Token storage (cookie-based, server sets HttpOnly cookie)
- Authenticated fetch wrapper

**Step 2: Create `web/app/src/utils/api.js`**

Create API helper module with functions for:
- `fetchGroups(profileKey)` → GET /api/groups?profile_key=...
- `createGroup(profileKey, name)` → POST /api/groups
- `updateGroup(id, data)` → PUT /api/groups/:id
- `deleteGroup(id)` → DELETE /api/groups/:id
- `fetchProfiles()` → GET /api/profiles
- `createProfile(data)` → POST /api/profiles
- `updateProfile(id, data)` → PUT /api/profiles/:id
- `deleteProfile(id)` → DELETE /api/profiles/:id
- `fetchOrder(profileId)` → GET /api/profiles/:id/order
- `saveOrder(profileId, data)` → PUT /api/profiles/:id/order
- `assignSessionToGroup(sessionName, profileKey, groupId)` → PUT /api/sessions/:name/group
- `fetchPaneStatus(profileKey, paneKeys)` → GET /api/panes/status
- `updatePaneStatus(profileKey, paneKey, status)` → PUT /api/panes/status
- `fetchTasks(paneKey)` → GET /api/panes/:paneKey/tasks
- `createTask(paneKey, title)` → POST /api/panes/:paneKey/tasks
- `updateTask(id, data)` → PUT /api/tasks/:id
- `completeTask(id)` → POST /api/tasks/:id/complete
- `fetchTaskDetail(id)` → GET /api/tasks/:id/detail
- `summarizeTask(taskId)` → POST /api/tasks/:taskId/summarize
- `fetchSummaryCandidates(paneKey)` → GET /api/panes/:paneKey/summary-candidates
- `loadSummary(taskId, summaryId)` → POST /api/tasks/:taskId/load-summary

All functions use `credentials: 'include'` for cookie auth.

**Step 3: Commit**

```bash
git add web/app/src/utils/
git commit -m "feat: add auth utilities and API helper functions for TmuxWeb features"
```

---

### Task 8: Port Session Tree with Groups (TmuxTree → JSX)

This is the largest frontend component (686 lines TSX → JSX).

**Files:**
- Create: `web/app/src/components/TmuxTree.jsx` — drag-drop session/group tree
- Create: `web/app/src/components/TmuxTree.css` (copy from TmuxWeb)
- Create: `web/app/src/components/GroupManager.jsx` — group CRUD dialog
- Create: `web/app/src/components/GroupManager.css` (copy from TmuxWeb)
- Create: `web/app/src/components/StatusBadge.jsx` — pane status indicator
- Create: `web/app/src/components/StatusBadge.css` (copy from TmuxWeb)

**Step 1: Port `TmuxTree.tsx` → `TmuxTree.jsx`**

Key changes from TSX → JSX:
- Remove all TypeScript type annotations (`: string`, `: number`, interface, etc.)
- Remove generic type params (`<T>`)
- Keep all @dnd-kit logic intact
- Keep all state management
- Import from `../utils/api` instead of inline fetch calls
- Adapt to current App.jsx's session data format (has `name`, `windows`, `windows[].panes`)

The component receives:
- `sessions` — array of tmux sessions from GET /api/sessions
- `selectedTarget` — currently selected pane target string
- `onSelectPane(target)` — callback when user clicks a pane
- `profileKey` — current profile identifier
- Groups and ordering data fetched internally via API

**Step 2: Port `GroupManager.tsx` → `GroupManager.jsx`**

Remove TypeScript, keep all CRUD logic (create/rename/delete groups, assign sessions).

**Step 3: Port `StatusBadge.tsx` → `StatusBadge.jsx`**

Simple component showing idle/in_progress/done with colored dot.

**Step 4: Copy CSS files**

Copy `TmuxTree.css`, `GroupManager.css`, `StatusBadge.css` from `TmuxWeb/web/src/components/`.

**Step 5: Commit**

```bash
git add web/app/src/components/TmuxTree.* web/app/src/components/GroupManager.* web/app/src/components/StatusBadge.*
git commit -m "feat: port TmuxTree, GroupManager, StatusBadge components from TmuxWeb (TSX → JSX)"
```

---

### Task 9: Port Profile Selector and Pane Details

**Files:**
- Create: `web/app/src/components/ProfileSelector.jsx`
- Create: `web/app/src/components/ProfileSelector.css`
- Create: `web/app/src/components/PaneDetails.jsx`
- Create: `web/app/src/components/PaneDetails.css`
- Create: `web/app/src/components/TaskCard.jsx` (used by PaneDetails)
- Create: `web/app/src/components/SummarySection.jsx`
- Create: `web/app/src/components/SummarySection.css`
- Create: `web/app/src/components/SummaryCandidatePicker.jsx`
- Create: `web/app/src/components/SummaryCandidatePicker.css`
- Create: `web/app/src/components/LogAccordion.jsx`
- Create: `web/app/src/components/LoginModal.jsx`
- Create: `web/app/src/components/LoginModal.css`

**Step 1: Port each component TSX → JSX**

Same pattern: remove TypeScript, fix imports, adapt to JSX conventions.

**Step 2: Copy CSS files**

**Step 3: Commit**

```bash
git add web/app/src/components/
git commit -m "feat: port ProfileSelector, PaneDetails, TaskCard, SummarySection, LoginModal components"
```

---

### Task 10: Integrate New Components into App.jsx

**Files:**
- Modify: `web/app/src/App.jsx`

**Step 1: Add imports for new components**

```jsx
import TmuxTree from './components/TmuxTree';
import ProfileSelector from './components/ProfileSelector';
import LoginModal from './components/LoginModal';
```

**Step 2: Add state for auth, profiles, groups**

```jsx
const [isLoggedIn, setIsLoggedIn] = useState(false);
const [currentProfile, setCurrentProfile] = useState(null);
const [showLogin, setShowLogin] = useState(false);
```

**Step 3: Replace existing session sidebar with TmuxTree**

The current App.jsx has a simple session list in the left panel. Replace it with the TmuxTree component that supports grouping and drag-drop.

**Step 4: Add ProfileSelector to header/toolbar area**

**Step 5: Add LoginModal for initial auth**

**Step 6: Build and verify**

```bash
cd web/app && npm run build
```

Expected: Build succeeds

**Step 7: Commit**

```bash
git add web/app/src/App.jsx
git commit -m "feat: integrate TmuxTree, ProfileSelector, LoginModal into main App"
```

---

## Phase 3: Build, Deploy, Verify (Tasks 11-12)

### Task 11: Build Frontend and Restart Server

**Step 1: Full frontend build**

```bash
cd web/app && npm run build
```

**Step 2: Restart PM2**

```bash
pm2 restart iterm-api
```

**Step 3: Verify health**

```bash
curl -s https://localhost:8215/health -k
curl -s https://localhost:8215/healthz -k
```

Expected: Both return ok, healthz shows db: ok

**Step 4: Commit any remaining changes**

---

### Task 12: End-to-End Verification

**Step 1: Test auth flow**

```bash
# Login
curl -s -X POST https://localhost:8215/api/auth/login -k \
  -H 'Content-Type: application/json' \
  -d '{"token":"tmuxweb-dev-token"}' -c cookies.txt

# Authenticated request
curl -s https://localhost:8215/api/profiles -k -b cookies.txt

# Cleanup
rm cookies.txt
```

**Step 2: Test groups CRUD**

```bash
# Create group
curl -s -X POST https://localhost:8215/api/groups -k \
  -b cookies.txt \
  -H 'Content-Type: application/json' \
  -d '{"profile_key":"default","group_name":"Test Group"}'
```

**Step 3: Test existing features still work**

```bash
# Sessions
curl -s https://localhost:8215/api/sessions -k

# AI command (no auth required for this endpoint currently)
curl -s -X POST https://localhost:8215/api/ai/command -k \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"list files","role":"cli"}'
```

**Step 4: Open web UI in browser**

Open `https://localhost:8215` — verify:
- Login modal appears (if not yet authenticated)
- Session tree shows with groups
- Terminal connects and works
- AI command generation works
- Voice input works

---

## Migration Boundaries

**IN SCOPE:**
- Express server rewrite
- All TmuxWeb backend routes
- All TmuxWeb frontend components (ported to JSX)
- MySQL integration
- Cookie-based auth
- Drag-drop session tree
- Group management
- Profile management
- Task tracking
- AI summaries

**OUT OF SCOPE (deferred):**
- TypeScript conversion of existing JSX
- react-router-dom (URL-based routing)
- Mobile-specific layout (TmuxWeb's mobile/ directory)
- New UI redesign beyond porting existing components
- Accessibility bar (TmuxWeb's AccessoryBar — mobile keyboard helper)

## File Inventory

### Files to CREATE in `web/`:
```
web/
├── db/
│   ├── pool.js
│   └── bootstrap.js
├── middleware/
│   └── auth.js
├── routes/
│   ├── auth.js
│   ├── groups.js
│   ├── profiles.js
│   ├── sessions.js
│   ├── panes.js
│   ├── tasks-db.js
│   ├── segments.js
│   ├── summaries.js
│   ├── task-events.js
│   ├── telemetry.js
│   └── tmux.js
├── services/
│   ├── terminal.js
│   └── gemini.js
└── app/src/
    ├── utils/
    │   ├── auth.js
    │   └── api.js
    └── components/
        ├── TmuxTree.jsx + .css
        ├── GroupManager.jsx + .css
        ├── StatusBadge.jsx + .css
        ├── ProfileSelector.jsx + .css
        ├── PaneDetails.jsx + .css
        ├── TaskCard.jsx
        ├── SummarySection.jsx + .css
        ├── SummaryCandidatePicker.jsx + .css
        ├── LogAccordion.jsx
        └── LoginModal.jsx + .css
```

### Files to MODIFY:
```
web/server.js              — Full rewrite to Express
web/package.json           — Add dependencies
web/private_config.json    — Add token + sessionSecret
web/app/package.json       — Add @dnd-kit
web/app/src/App.jsx        — Integrate new components
```

### Files to KEEP UNCHANGED:
```
web/config.js              — Already loads TmuxWeb config
web/speech.js              — Keep existing (used by current WS handler)
web/pty_helper.py          — Keep existing
web/ecosystem.config.js    — Keep existing
web/cert.pem / key.pem     — Keep existing
web/snippets.json          — Keep existing
web/app/src/components/AiCommandTab.jsx
web/app/src/components/BottomToolbox.jsx
web/app/src/components/TerminalPane.jsx
web/app/src/components/TerminalToolbar.jsx
web/app/src/components/VoiceInput.jsx
web/app/src/hooks/*
```
