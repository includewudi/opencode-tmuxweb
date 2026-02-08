# TmuxWeb: 30-day Cookie Auth + Profile Tree Ordering + Pane/Task Logs & Summaries (MySQL)

## TL;DR

> **Quick Summary**: Add secure 30-day login (token → HttpOnly cookie session), introduce profile/workspace concept with server-persisted drag-and-drop ordering, implement pane status + task/segment logging stored in MySQL, and wire in an external “summary service” contract for command/output summaries and re-loading historical summaries after tmux restarts.
>
> **Deliverables**:
> - Cookie-based session auth endpoints + middleware (replacing query-token usage where applicable)
> - MySQL-backed models for Profiles, Pane ordering, Pane status, Tasks, Segments, Logs, Summaries
> - UI: profile dropdown, drag-and-drop tree ordering, pane status display & edit, pane detail view with logs and summaries
> - Summary loading UX (modal on pane open + explicit button) + summary service integration contract
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES — 3 waves
> **Critical Path**: Auth (cookie session) → MySQL schema + DAL → Tree ordering + status APIs → UI + summary integration

---

## Context

### Original Request (translated)
1) Token config in config file; user enters token and stays logged in 30 days.
2) Session/window tree supports drag reorder; show pane status (idle/in-progress/done) and provide pane status modify API.
3) Pane management: conversation record (two-way), command record (human one-way), command summary (dedicated API service), output summary (dedicated API service).
Additional clarifications:
- Profile/workspace switching via UI dropdown; unlimited profiles.
- Ordering stored server-side per token + profile.
- Pane logs shared across profiles.
- If tmux closes and reopens with same name, user can choose to load historical summaries.
- Summary loading UX: both modal on pane open and explicit button in pane details.
- Sequential tasks are common; each task creates a new pane-run segment.
- Summary service not built yet: plan must define minimal API contract + integration points (no implementation of the service).
- Storage: MySQL.
- Test strategy: Tests-after (plus agent-executed QA scenarios).

### Current System (known)
- Backend: Node/Express + ws, WebSocket path: `/ws/terminal`
- Frontend: Vite + React + TypeScript

### Metis Review (gaps addressed in plan)
Metis flagged potential gaps: auth validation details, summary service contract details, data lifecycle (retention), drag reorder concurrency, and explicit guardrails against scope creep.
This plan:
- Defines a minimal token-validation approach with configurable “auth validator” modes and placeholders for the real provider.
- Defines a concrete Summary Service contract (HTTP endpoints + payload shapes) while keeping the service OUT of scope.
- Sets explicit retention defaults + last-write-wins semantics.
- Adds strong “Must NOT Have” guardrails.

---

## Work Objectives

### Core Objective
Implement a MySQL-backed “workspace + task log” layer on top of tmux tree browsing so users can:
- authenticate once (token) and stay logged in securely for 30 days;
- organize panes with profile-specific ordering;
- track pane status;
- create many sequential tasks per pane with segmented logs and attach AI summaries via an external service.

### Definition of Done
- [ ] User can login with token once and remain authenticated for 30 days via HttpOnly cookie.
- [ ] User can create/switch profiles via UI dropdown; profile persists.
- [ ] User can drag/drop reorder session/window/pane tree nodes (at least panes within a profile ordering view) and the order persists server-side.
- [ ] Each pane shows status (idle/in-progress/done); status changes persist in MySQL and reflect in UI.
- [ ] User can create sequential tasks for a pane; each task creates a new segment; logs/records attach to segments.
- [ ] On pane open, system can offer to load previous summaries after tmux restart (based on match strategy); user can also load via pane detail button.
- [ ] All changes verified via agent-executed QA scenarios (curl + browser automation as appropriate).

### Must Have
- Cookie-based auth for 30 days.
- MySQL persistence.
- Profile dropdown.
- Drag-and-drop ordering in UI with server persistence.
- Pane status API + UI.
- Task/segment model with per-task segmentation.
- Summary service integration contract + UI surfaces.

### Must NOT Have (Guardrails)
- Must NOT implement OAuth providers/MFA.
- Must NOT implement profile sharing/permissions.
- Must NOT implement full log search/analytics or export.
- Must NOT build the summary service itself (contract + integration only).
- Must NOT introduce automatic pane-status transitions (manual/user-driven only).
- Must NOT change WebSocket path `/ws/terminal`.

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> All acceptance criteria must be verifiable by the executing agent via commands/tools.

### Test Decision
- **Infrastructure exists**: TBD (executor will inspect package.json/scripts)
- **Automated tests**: YES (tests-after)
- **Framework**: TBD (prefer existing; if none, minimal setup with Jest/Vitest on backend only)

### Agent-Executed QA Scenarios
We will rely heavily on:
- **Bash + curl** for auth/profile/order/status/task endpoints
- **Playwright** for UI flows (profile dropdown, tree ordering drag/drop, status changes, summary modal)

---

## Proposed Data Model (MySQL)

> Exact migrations left to executor but schema intent is fixed here.

Entities (conceptual):
- **UserSession**: represents authenticated browser session (cookie)
- **Profile**: workspace grouping for ordering and UI context
- **PaneIdentity**: “stable-ish” identity for tmux pane across restarts using match keys
- **PaneState**: status (idle/in-progress/done)
- **Task**: logical unit of work (many sequential)
- **Segment**: per-task pane-run segment (Option B: every task creates new segment)
- **ConversationMessage**: two-way messages within a task/segment
- **CommandRecord**: one-way commands (human)
- **Summary**: command summary + output summary (generated externally)

Matching keys for historical summaries:
- Primary: `sessionName` + `windowIndex`/`windowName` + `paneIndex` (or other available pane position fields)
- Secondary: allow user-driven rename-window to strengthen matching

Retention defaults (override later):
- Logs/summaries retained indefinitely for MVP (no cleanup job). Future: retention policy.

---

## External Summary Service Contract (MVP)

> Service implementation OUT of scope. We define a contract so integration can be built now.

### Endpoint: Create Summary Job
- `POST {SUMMARY_SERVICE_BASE_URL}/v1/summaries`
- Auth: `[DECISION NEEDED: how does summary service authenticate? bearer token? mTLS? none in local?]`
- Body:
  - `taskId` (string)
  - `segmentId` (string)
  - `paneIdentity` (object: sessionName/window/pane keys)
  - `commands` (array of strings)
  - `conversation` (array of {role: "user"|"assistant", content: string, ts})
  - `outputs` (string or array; optional)
- Response:
  - `jobId` (string)
  - `status` ("queued"|"running")

### Endpoint: Get Summary Job
- `GET {SUMMARY_SERVICE_BASE_URL}/v1/summaries/{jobId}`
- Response:
  - `status` ("queued"|"running"|"done"|"error")
  - `commandSummary` (string | null)
  - `outputSummary` (string | null)
  - `error` (string | null)

### Callback (optional)
- If summary service supports callback:
  - `POST {TmuxWebBackend}/api/tasks/callback` (already exists) with `{ jobId, status, commandSummary, outputSummary, error }`

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Backend foundations):
- Auth (cookie session) + middleware
- MySQL connection + migrations baseline
- Core tables: profiles, ordering, pane status

Wave 2 (Backend domain + UI basics):
- Profile APIs + UI dropdown
- Tree ordering APIs + DnD UI
- Pane status APIs + UI

Wave 3 (Task/segment logs + summaries):
- Task/segment endpoints + logging endpoints
- Summary integration endpoints + UI (modal + pane detail)
- Historical summary matching + load flow

---

## TODOs

> Note: Each task includes acceptance criteria and agent-executed QA scenarios.
> “Implementation + verification” are kept together.

- [ ] 1. Assess current backend/frontend auth usage and introduce cookie-session auth

  **What to do**:
  - Add `POST /api/auth/login` that accepts `{ token }`
  - Validate token against configured validator mode:
    - Default (MVP): compare with `config.json` token(s) (dev mode)
    - Extension point: allow calling external validator endpoint (placeholder)
  - On success: issue HttpOnly cookie (30 days), set SameSite policy (Lax by default)
  - Add `POST /api/auth/logout` to clear cookie
  - Update `tokenMiddleware` and `validateToken` to prefer cookie session; keep query token as fallback behind a config flag for backward compatibility

  **Must NOT do**:
  - No OAuth/MFA
  - No user management UI

  **Recommended Agent Profile**:
  - Category: unspecified-high
  - Skills: none

  **Parallelization**: Can run in parallel with Task 2

  **References**:
  - `TmuxWeb/server/index.js` — current middleware wiring and ws setup
  - `TmuxWeb/server/middleware/auth.js` — current token validation
  - `TmuxWeb/server/config.json` — token and allowedOrigins configuration

  **Acceptance Criteria**:
  - `curl -i -X POST http://localhost:8215/api/auth/login -H 'Content-Type: application/json' -d '{"token":"tmuxweb-dev-token"}'` returns `200` and includes `Set-Cookie` with HttpOnly and max-age ~30 days
  - Invalid token returns `401` and no cookie

  **Agent-Executed QA Scenarios**:
  - Scenario: Login and persist cookie
    - Tool: Bash (curl)
    - Steps:
      1. `curl -s -i -c /tmp/tmuxweb.cookie -X POST http://localhost:8215/api/auth/login -H 'Content-Type: application/json' -d '{"token":"tmuxweb-dev-token"}'`
      2. Assert: response includes `Set-Cookie:` and `HttpOnly`
      3. Call `curl -s -b /tmp/tmuxweb.cookie http://localhost:8215/api/tmux/tree` → status 200

- [ ] 2. Add MySQL integration baseline and migrations for Profiles + Ordering + Pane Status

  **What to do**:
  - Introduce MySQL connection config (env vars) and a migration mechanism (use existing if present; otherwise minimal)
  - Create tables:
    - profiles (id, name, createdAt)
    - profile_orders (profileId, itemType, itemKey, position)
    - pane_states (paneKey, status, updatedAt)
  - Decide on “paneKey” as derived key from tmux identity (sessionName + windowIndex + paneId/paneIndex)

  **Must NOT do**:
  - No retention/cleanup jobs

  **Parallelization**: Can run in parallel with Task 1

  **Acceptance Criteria**:
  - Running backend with MySQL configured succeeds
  - Basic insert/select works via a smoke endpoint or script

  **Agent-Executed QA Scenarios**:
  - Scenario: DB connectivity
    - Tool: Bash
    - Steps:
      1. Start backend with MYSQL_* env vars
      2. Call health endpoint and a DB-backed endpoint (profiles list) and ensure 200

- [ ] 3. Implement Profile APIs + UI dropdown (unlimited profiles)

  **What to do**:
  - Backend endpoints:
    - `GET /api/profiles`
    - `POST /api/profiles` {name}
    - `PUT /api/profiles/:id` {name}
    - `DELETE /api/profiles/:id`
    - `POST /api/profiles/:id/select` (or store active profile in cookie/local state)
  - Frontend:
    - Add profile dropdown
    - Persist selected profile client-side (but server remains source of ordering)

  **Acceptance Criteria**:
  - Creating, renaming, deleting profiles works via curl; dropdown reflects updates.

  **QA Scenarios**:
  - Scenario: create & select profile
    - Tool: Playwright
    - Steps: login → open dropdown → create “work” → select “work” → refresh → still “work”

- [ ] 4. Implement drag-and-drop ordering of tree items persisted per profile

  **What to do**:
  - Tree UX default: session/window/pane directory tree is **collapsed by default** (not expanded).
  - Define what is reorderable in MVP:
    - CONFIRMED: support session-level drag ordering (drag sessions as whole units)
  - Backend:
    - `GET /api/profiles/:id/order`
    - `PUT /api/profiles/:id/order` { items: [{itemType, itemKey, position}] }
    - Last-write-wins
  - Frontend:
    - Drag-and-drop UI interactions
    - On drop: call PUT order

  **Must NOT do**:
  - No collaborative conflict resolution

  **Acceptance Criteria**:
  - Reorder persists across refresh and across browser tabs after reload.

  **QA Scenarios**:
  - Scenario: tree is collapsed by default
    - Tool: Playwright
    - Steps:
      1. Login
      2. Assert: session nodes rendered
      3. Assert: window nodes are not visible until clicking expand control
      4. Screenshot: .sisyphus/evidence/task-4-tree-collapsed-default.png

  - Scenario: session drag-drop persists
    - Tool: Playwright
    - Steps:
      1. Login → select profile
      2. Drag session item at index 0 to index 1
      3. Refresh
      4. Assert: session order persists
      5. Screenshot: .sisyphus/evidence/task-4-session-dnd-persist.png

- [ ] 5. Pane status: store & display idle/in-progress/done; provide modify API

  **What to do**:
  - Backend endpoints:
    - `GET /api/panes/status?paneKey=...` (or list status for visible panes)
    - `PUT /api/panes/status` { paneKey, status }
  - Frontend: show inline badge; allow changing via dropdown or context menu

  **Acceptance Criteria**:
  - Invalid status returns 400
  - Status persists and is visible after refresh

  **QA Scenarios**:
  - Scenario: set status done
    - Tool: Bash (curl)
    - Steps: PUT status → GET status → assert

- [ ] 6. Task + Segment model (per-task segmentation) and pane logs (conversation + commands)

  **What to do**:
  - Backend:
    - Create Task for a pane (status defaults in-progress)
    - Each new Task creates a new Segment
    - Endpoints:
      - `POST /api/panes/:paneKey/tasks` {title?}
      - `POST /api/tasks/:taskId/complete`
      - `GET /api/panes/:paneKey/tasks`
      - `POST /api/segments/:segmentId/conversation` {role, content}
      - `POST /api/segments/:segmentId/commands` {command}
      - `GET /api/tasks/:taskId/detail` (returns conversation + commands)
  - Frontend:
    - Pane detail view: task list, create next task, mark complete
    - Conversation + command record view

  **Acceptance Criteria**:
  - Creating two tasks produces two segment ids and logs are separated.

  **QA Scenarios**:
  - Scenario: sequential tasks segmentation
    - Tool: Bash (curl)
    - Steps: create task A → add command → complete → create task B → ensure logs separated

- [ ] 7. Summary integration: store summaries in MySQL and integrate with Summary Service contract

  **What to do**:
  - Create summary job trigger:
    - `POST /api/tasks/:taskId/summarize` → calls external summary service (or queues job record if base URL unset)
  - Support callback endpoint: reuse `/api/tasks/callback`
  - Store `commandSummary` and `outputSummary` in MySQL, linked to task/segment
  - Frontend:
    - Show “command summary” and “output summary” sections
    - Show job status

  **Acceptance Criteria**:
  - If SUMMARY_SERVICE_BASE_URL unset: endpoint returns 501 or a clear error and UI shows “not configured”
  - If configured: job created and status polled/updated

  **QA Scenarios**:
  - Scenario: summarize with service disabled
    - Tool: Bash
    - Steps: call summarize endpoint → assert 501 and JSON error

- [ ] 8. Historical summary loading flow on pane open + explicit load button

  **What to do**:
  - Implement “match candidates” endpoint:
    - `GET /api/panes/:paneKey/summary-candidates` — returns list of previous tasks/summaries by match key (sessionName/window/pane) and recency
  - UI:
    - On opening pane Terminal: if candidates exist, show modal to pick one to load/attach
    - Pane detail view: “Load previous summary” button that opens same picker
  - Attach semantics:
    - Attaching a previous summary may link to a new Task or copy summary into current task (decide consistent behavior; default: copy into current task as “imported context”)

  **Acceptance Criteria**:
  - When tmux session reopens with same name and identity matches, candidates appear.

  **QA Scenarios**:
  - Scenario: candidate list returned
    - Tool: Bash
    - Steps: create fake old summary in DB → call candidates endpoint → assert returned

- [ ] 9. Optional: Window rename support to strengthen matching

  **What to do**:
  - Backend endpoint: `POST /api/tmux/windows/:windowId/rename` {name}
  - UI: inline rename action

  **Guardrail**:
  - Keep optional; if tmux rename not supported in environment, disable gracefully.

---

## Decisions Needed (placeholders used)

1. **Auth token validation source**: For MVP, validate token against config.json (dev token). Later can add external validator endpoint.
2. **Summary service authentication**: Default to shared secret header `X-Summary-Service-Token` configured in backend env; can be none in local.
3. **Ordering granularity**: CONFIRMED — support dragging **sessions as whole units** (session-level ordering). Windows/panes ordering can remain as-is for MVP unless later extended.

---

## Success Criteria

### Verification Commands (examples)
```bash
# login
curl -i -c /tmp/tmuxweb.cookie -X POST http://localhost:8215/api/auth/login \
  -H 'Content-Type: application/json' -d '{"token":"tmuxweb-dev-token"}'

# access tree
curl -s -b /tmp/tmuxweb.cookie http://localhost:8215/api/tmux/tree | jq '.sessions | length'
```

### Final Checklist
- [ ] Cookie session auth works and lasts 30 days.
- [ ] Profiles can be created/switched.
- [ ] Tree ordering can be drag-reordered and persists per profile.
- [ ] Pane status API works and UI shows status.
- [ ] Tasks/segments/logs persist and segment per task.
- [ ] Summary flow wired with clear “service not configured” behavior.
- [ ] Historical summary loading works (modal + button).

