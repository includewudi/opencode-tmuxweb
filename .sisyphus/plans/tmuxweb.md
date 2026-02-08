# TmuxWeb — Web tmux terminal + pane tree + task status callbacks (ZeroTier, token auth)

## TL;DR

> **Quick Summary**: Build a Mac-hosted web app that lets iOS/Android browsers open multiple tabbed xterm.js terminals into **local tmux panes**, browse a **sessions/windows/panes tree**, and show **task status** per pane based on an **HTTP callback** from scripts/AI running inside tmux.
>
> **Deliverables**:
> - Node.js backend (static hosting + REST API + WebSocket terminal streaming)
> - Web frontend (xterm.js + tree + tabs; modular, CSS split, ≤200 lines/file)
> - Shared token auth (from server-side config file) for UI/API/WS/callback
> - Agent-executable QA scenarios for iOS/Android-like mobile viewport via Playwright (desktop emulation) + curl
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES — 3 waves
> **Critical Path**: Backend tmux control/WS protocol → Frontend terminal attach/tabs → Status callback + UI badges

---

## Context

### Original Request (condensed)
- 做一个 Web 版本：iOS/Android 浏览器通过 ZeroTier 打开网页，远程操作 Mac 本机 tmux。
- 交互：tmux 的 session/window/pane **目录树** + **多 Tab 来回切换 pane**。
- 需要状态监控：tmux 里跑的 AI/程序在完成后调用回调接口，上报任务完成情况；目录树能显示“已完成/窗口闲置”等状态。
- 安全：选择 **B**：共享 token **写到配置文件**。
- 前端工程约束：模块化、单文件≤200行、CSS 拆分、业界标准结构。

### Interview Summary (decisions)
- **Single target**: only local tmux on the Mac (no remote SSH targets for now).
- **Pane switching**: Tab-based UX (multiple Terminal tabs).
- **Status source of truth**: Callback is authoritative (no inference needed).
- **Auth**: Shared token in server config file; required for WS + APIs + callback.

### Research Findings (used as guardrails)
- **tmux control**: Prefer **tmux CLI** + formatted output; Node libraries are outdated; keep direct CLI control. Use `tmux list-* -F` for parseable output.
- **Interactive streaming**: Confirmed to use **node-pty** to spawn `tmux` attach to a specific pane and stream PTY bytes via WebSocket; avoid capture-pane polling except for snapshots.
- **xterm.js mobile**: Use FitAddon + ResizeObserver; debounce resize; consider WebGL addon; manage multiple Terminal instances carefully and dispose to avoid mobile memory leaks.

### Metis Review (gaps addressed via defaults/guardrails)
- Locked down scope to **no multi-user**, **no remote-host SSH**, **no task runner UI** (only callback + status display).
- Added explicit token auth and callback contract tasks.
- Added reconnect/resilience + mobile constraints.

---

## Work Objectives

### Core Objective
Provide a stable, mobile-friendly web terminal into local tmux panes (tree + tabs) plus a task-status layer driven by callbacks.

### Concrete Deliverables
- Backend server:
  - Static frontend hosting
  - REST:
    - `GET /api/tmux/tree`
    - `POST /api/tasks/callback`
    - (optional) `GET /api/tasks/state` for UI refresh
  - WebSocket terminal endpoint:
    - `WS /ws/terminal?paneId=...&token=...`
- Frontend web app:
  - Sidebar tree of sessions/windows/panes
  - Tabs for selected panes, each with xterm.js
  - Status badges per pane based on callback state
  - Mobile-first layout
- Config file (server-side): ZeroTier bind address/port, token, tmux socket (optional).

### Definition of Done
- [ ] From an iPhone (Safari/Chrome) and Android Chrome (or Playwright mobile emulation), user can:
  - browse tmux tree,
  - open 2+ panes as tabs,
  - type in terminal and see output,
  - resize on rotation/keyboard changes without screen corruption,
  - receive callback updates that mark a pane as completed/idle.

### Must Have
- Token-protected API + WS + callback.
- File size rule enforced during implementation (≤200 lines per file; CSS separate).
- Tabs feel responsive (no full-page refresh; no losing state when switching).

### Must NOT Have (Guardrails)
- MUST NOT implement multi-user accounts/roles.
- MUST NOT implement remote SSH to other servers (only local tmux).
- MUST NOT implement UI to start/schedule tasks; only receive callbacks.
- MUST NOT implement session recording/replay.
- MUST NOT implement file upload/download.

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks MUST be verifiable without humans manually clicking/inspecting.
> Verification is done via Playwright (UI), curl (API), and shell commands.

### Test Decision
- **Infrastructure exists**: NO (new web app)
- **Automated tests**: YES (tests-after) — keep initial velocity; still require agent-executed QA for every task.
- **Framework**: Playwright for E2E + Node test runner of choice (decide during implementation; default: vitest for unit tests if needed)

### Core Agent-Executed QA Scenarios (global)
These scenarios will be referenced across tasks:

1) **Tree loads**
- Tool: Bash (curl)
- Steps:
  1. `curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:$PORT/api/tmux/tree`
  2. Assert response is JSON and contains `sessions` array.

2) **WebSocket terminal opens and echoes output**
- Tool: Playwright
- Steps:
  1. Open `http://127.0.0.1:$PORT/?token=$TOKEN`
  2. Click first pane in tree
  3. Click “Open in new tab”
  4. Type `echo __TMUXWEB_OK__` then Enter
  5. Assert terminal contains `__TMUXWEB_OK__`
  6. Screenshot evidence

3) **Tab switching keeps separate terminal buffers**
- Tool: Playwright
- Steps:
  1. Open tab A and run `echo TAB_A`
  2. Open tab B and run `echo TAB_B`
  3. Switch back to A; assert `TAB_A` still visible
  4. Switch to B; assert `TAB_B` visible

4) **Callback updates status badge**
- Tool: Bash (curl) + Playwright
- Steps:
  1. POST callback for a pane with status `completed`
  2. UI shows badge “completed” on that pane within N seconds

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Backend foundations):
- Task 1: Repo + server skeleton + config + token middleware
- Task 2: tmux tree API (list sessions/windows/panes)

Wave 2 (Terminal streaming + frontend shell):
- Task 3: WebSocket terminal streaming using node-pty + tmux attach-per-pane
- Task 4: Frontend layout: tree + tabs + terminal container (xterm.js + fit)

Wave 3 (Status callbacks + resilience + E2E):
- Task 5: Task status model + callback endpoint + UI badges
- Task 6: Reconnect/resize hardening + resource cleanup
- Task 7: Automated E2E (Playwright) + final verification

Critical Path: 1 → 2 → 3 → 4 → 5 → 7

---

## TODOs

> Note: Executor should continuously enforce: **≤200 lines per file** and **CSS split**.

- [ ] 1. Establish TmuxWeb project structure + server config + token auth + MySQL wiring

  **What to do**:
  - Define a standard project layout under `TmuxWeb/` (recommend: `server/` and `web/` subprojects).
  - Add a server-side config file (e.g., `TmuxWeb/server/config.json` or `config.yaml`):
    - `port`, `bind`, `token`, **MySQL DSN/credentials**, optional `tmuxSocket`, optional `allowedOrigins`.
  - Implement token verification middleware used by REST + WebSocket + callback:
    - Accept `Authorization: Bearer <token>`
    - Also allow `?token=` query for convenience on mobile.
  - Serve web static assets from backend.

  **Must NOT do**:
  - No user accounts.
  - No storing secrets in frontend bundle.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: full-stack project scaffolding + security guardrails.
  - **Skills**: (none required)

  **Parallelization**:
  - Can run in parallel: YES (with Task 2 partially; but token middleware should land first)
  - Blocks: Tasks 2–7

  **References**:
  - Repo pattern reference: `TmuxMobile/src/services/*` for “service layer” organization (adapt conceptually).
  - Background research: use xterm.js official addons list for later tasks.

  **Acceptance Criteria (agent-executable)**:
  - [ ] Backend starts: `node ...` (or `npm run dev`) exits 0 and logs `listening on http://127.0.0.1:PORT`
  - [ ] `curl -i http://127.0.0.1:PORT/` returns 200
  - [ ] `curl -i http://127.0.0.1:PORT/api/tmux/tree` without token returns 401
  - [ ] `curl -i -H "Authorization: Bearer $TOKEN" http://127.0.0.1:PORT/api/tmux/tree` returns 200 or a clear JSON error (until Task 2 implemented)

  **Agent-Executed QA Scenarios**:
  - Scenario: Unauthorized requests are rejected
    - Tool: Bash (curl)
    - Steps:
      1. `curl -s -o /tmp/noauth.txt -w "%{http_code}" http://127.0.0.1:PORT/api/tmux/tree`
      2. Assert status code is `401`
    - Evidence: `/tmp/noauth.txt`

- [ ] 2. Implement tmux tree discovery API (`GET /api/tmux/tree`)

  **What to do**:
  - Use `tmux` CLI to enumerate:
    - sessions
    - windows per session
    - panes per window
  - Use `tmux list-sessions -F ...`, `tmux list-windows -F ...`, `tmux list-panes -F ...` with machine-parseable format.
  - Provide stable identifiers:
    - `session_name`, `window_id`/`window_index`, `pane_id` (e.g., `%1`) and `pane_title`.
  - Return JSON tree.

  **Must NOT do**:
  - No heavy polling loops; API is request/response.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: reliable tmux CLI parsing and stable contracts.
  - **Skills**: (none)

  **Parallelization**:
  - Can run in parallel: PARTIALLY (after Task 1 middleware is ready)
  - Blocks: Tasks 4–7

  **External References**:
  - tmux manual/repo: https://github.com/tmux/tmux (command options & format strings)

  **Acceptance Criteria**:
  - [ ] `curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:PORT/api/tmux/tree | jq .sessions` returns an array (jq optional)
  - [ ] Response includes panes with unique `pane_id` values

  **Agent-Executed QA Scenarios**:
  - Scenario: Tree endpoint returns parseable JSON
    - Tool: Bash (curl)
    - Steps:
      1. `curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:PORT/api/tmux/tree > .sisyphus/evidence/tree.json`
      2. Assert file is non-empty
      3. Assert contains key `"sessions"`
    - Evidence: `.sisyphus/evidence/tree.json`

- [ ] 3. WebSocket terminal streaming per pane (node-pty + tmux)

  **What to do**:
  - Define WS endpoint: `WS /ws/terminal?paneId=%1&token=...`.
  - On connect:
    - Validate token
    - Validate pane exists (by checking against `tmux list-panes`)
    - Spawn PTY via **node-pty** and run a tmux attach/client command targeting the pane.
  - Data flow:
    - WS (binary/text) → PTY stdin
    - PTY stdout → WS
  - Resize:
    - Frontend sends JSON message `{type:"resize", cols, rows}`
    - Backend calls `pty.resize(cols, rows)` and also `tmux resize-pane -t <paneId> -x cols -y rows` (avoid mismatch)

  **Must NOT do**:
  - Don’t implement capture-pane polling as the primary interactive stream.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: interactive terminal streaming + correctness under resize/reconnect.
  - **Skills**: (none)

  **External References**:
  - node-pty: https://github.com/microsoft/node-pty
  - xterm.js attach addon: https://github.com/xtermjs/xterm.js (addon-attach)

  **Acceptance Criteria**:
  - [ ] WS connect without token is rejected (close code + reason)
  - [ ] WS connect with valid token and paneId streams terminal output
  - [ ] Sending `echo __OK__` from UI shows `__OK__` in terminal

  **Agent-Executed QA Scenarios**:
  - Scenario: Open terminal and run echo
    - Tool: Playwright
    - Preconditions: server running; at least one existing tmux pane
    - Steps:
      1. Navigate to `http://127.0.0.1:PORT/?token=$TOKEN`
      2. Click first pane in tree (selector to be defined during implementation)
      3. Click “Open” to create tab
      4. Focus terminal, type `echo __TMUXWEB_OK__` + Enter
      5. Wait for terminal text to include `__TMUXWEB_OK__` (timeout 5s)
      6. Screenshot `.sisyphus/evidence/task-3-echo.png`
    - Evidence: `.sisyphus/evidence/task-3-echo.png`

- [ ] 4. Frontend UI: tree + tabs + xterm.js terminals (mobile-first)

  **What to do**:
  - Use a modern frontend scaffold (recommend Vite + TS + React).
  - Enforce structural constraints:
    - components split by feature (`Tree`, `Tabs`, `TerminalTab`, etc.)
    - CSS files per component/feature (no mega CSS)
    - keep each file ≤200 lines
  - xterm.js:
    - Create one Terminal instance per tab (recommended for correctness)
    - Use FitAddon + ResizeObserver
    - Debounce resize (~250ms)
    - Consider WebGL addon if supported
  - Implement tab lifecycle:
    - open/close tabs
    - show active tab
    - dispose terminals on close to avoid leaks

  **Must NOT do**:
  - No complicated buffer swapping across tabs.
  - No heavy animations that hurt mobile performance.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: mobile-first UI + xterm.js integration
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: keep layout clean, touch-friendly, avoids generic UI

  **External References**:
  - xterm.js: https://github.com/xtermjs/xterm.js
  - addon-fit: https://github.com/xtermjs/xterm.js/tree/master/addons/addon-fit
  - addon-webgl: https://github.com/xtermjs/xterm.js/tree/master/addons/addon-webgl

  **Acceptance Criteria**:
  - [ ] UI loads on mobile viewport widths (Playwright emulation)
  - [ ] Open 2 tabs and switch; buffers preserved
  - [ ] Close tab disposes correctly (no console errors)

  **Agent-Executed QA Scenarios**:
  - Scenario: Tab switching preserves independent output
    - Tool: Playwright
    - Steps:
      1. Emulate iPhone viewport
      2. Open pane A tab, run `echo TAB_A`
      3. Open pane B tab, run `echo TAB_B`
      4. Switch to pane A tab; assert `TAB_A` visible
      5. Switch to pane B tab; assert `TAB_B` visible
      6. Screenshot `.sisyphus/evidence/task-4-tabs.png`
    - Evidence: `.sisyphus/evidence/task-4-tabs.png`

- [ ] 5. Task status model + callback endpoint + UI badges (MySQL persisted)

  **What to do**:
  - Define callback API:
    - `POST /api/tasks/callback` with token auth
    - payload includes at minimum: `paneId`, `taskId`, `status`, `message?`, `timestamp?`
  - Backend stores current status per pane in **MySQL** (confirmed). Keep an in-memory cache optional for UI speed, but DB is source of truth.
  - Persist model (minimum):
    - `pane_status`: latest status per `paneId` (status, lastTaskId, updatedAt)
    - `task_events` (optional but recommended): append-only history (taskId, paneId, status, message, createdAt)
  - Idempotency: treat `taskId` as unique and perform upsert to avoid duplicate callbacks.
  - Frontend displays status badge in tree nodes:
    - e.g. `idle` / `running` / `completed` / `failed`
  - Add server push updates:
    - Option 1: frontend polls `GET /api/tasks/state` every N seconds
    - Option 2: server broadcasts status updates via WS (recommended)

  **Must NOT do**:
  - No full task orchestration UI.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: (none)

  **Acceptance Criteria**:
  - [ ] `curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
      http://127.0.0.1:PORT/api/tasks/callback \
      -d '{"paneId":"%1","taskId":"t1","status":"completed"}'` returns 200
  - [ ] UI shows completed badge for that pane within 2s (or next refresh interval)

  **Agent-Executed QA Scenarios**:
  - Scenario: Callback updates UI badge
    - Tool: Bash + Playwright
    - Steps:
      1. Ensure UI open and tree visible
      2. POST callback for target pane
      3. Wait for badge selector to show “completed” (timeout 5s)
      4. Screenshot `.sisyphus/evidence/task-5-callback.png`
    - Evidence: `.sisyphus/evidence/task-5-callback.png`

- [ ] 6. Resilience & mobile hardening: reconnect, resize, pooling guardrails

  **What to do**:
  - Reconnect strategy:
    - if WS drops, show toast “reconnecting…”
    - exponential backoff, max backoff cap
    - on reconnect, re-open active tab’s stream
  - Resize hardening:
    - handle keyboard open/close causing viewport changes
    - debounce resize; call fitAddon.fit(); then send resize to backend
  - Resource management:
    - optional cap on active terminal instances on mobile (e.g., keep last 3 alive; older tabs reconnect on focus)

  **Must NOT do**:
  - No complex persistence of terminal buffer across full page reload (MVP).

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Acceptance Criteria**:
  - [ ] Simulated WS close triggers reconnect and terminal continues working
  - [ ] Rotation triggers resize and does not corrupt rendering

  **Agent-Executed QA Scenarios**:
  - Scenario: WebSocket reconnect
    - Tool: Playwright + Bash
    - Steps:
      1. Open a terminal tab
      2. Kill WS server process (or simulate network offline) then restart
      3. UI shows reconnecting state
      4. After reconnect, run `echo RECONNECTED` and see output
      5. Screenshot `.sisyphus/evidence/task-6-reconnect.png`
    - Evidence: `.sisyphus/evidence/task-6-reconnect.png`

- [ ] 7. Add automated E2E suite + final verification commands

  **What to do**:
  - Add Playwright tests for:
    - login/token flow (if UI has it)
    - tree load
    - open tab + echo
    - tab switching
    - callback badge update
  - Document final verification commands.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`playwright`]

  **Acceptance Criteria**:
  - [ ] `npx playwright test` (or equivalent) passes
  - [ ] Evidence artifacts saved under `.sisyphus/evidence/`

---

## Commit Strategy

- Single commit per wave is acceptable, or per task if preferred.
- Do NOT commit secrets (token config should have example + ignored real config).

---

## Success Criteria

### Verification Commands (examples)
```bash
# Server health
curl -i http://127.0.0.1:PORT/

# tmux tree
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:PORT/api/tmux/tree

# callback
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  http://127.0.0.1:PORT/api/tasks/callback \
  -d '{"paneId":"%1","taskId":"t1","status":"completed"}'
```

### Final Checklist
- [ ] Token required for WS + API + callback
- [ ] Tree shows sessions/windows/panes
- [ ] Tabs open multiple panes and can switch reliably
- [ ] Mobile resize/rotate stable
- [ ] Callback updates appear in UI
