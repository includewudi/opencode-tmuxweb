# TmuxWeb: API Docs + Backend APIs (MySQL) + Frontend UI + Frontend Integration — Parallel Execution Plan

## TL;DR

> **Quick Summary**: Produce a single source of truth API contract (OpenAPI + readable Markdown), implement the full PRD API surface in the existing Express+ws+node-pty backend with MySQL (mysql2) persistence using the provided 6-table schema, then implement the full UI per the provided React prototype and wire it to the backend—without introducing external state management.
>
> **Deliverables**:
> - **API interface documentation**: OpenAPI 3.0 (YAML or JSON) + companion Markdown reference
> - **Backend**: Express routes + MySQL (mysql2) data access layer using the existing 6 tables
> - **Frontend UI**: Components/pages matching `.sisyphus/drafts/tmuxweb-ui-reference.tsx`
> - **Frontend integration**: API client utilities + App.tsx useState orchestration to connect to backend
>
> **Estimated Effort**: XL
> **Parallel Execution**: YES — 4 waves
> **Critical Path**: API contract → MySQL/DAL foundation → core CRUD endpoints → frontend integration + E2E verification

---

## Context

### Original Request
分别实现：API接口文档、后端API、前端界面、前端对接。并要求给出并行执行（Waves）、依赖关系、任务拆解（具体修改哪些文件）、每个任务的 Category + Skills，以及每个任务的可执行验证标准。

### Existing Resources (authoritative)
- Prior approved plan (already Momus reviewed): `.sisyphus/plans/tmuxweb-auth-tree-pane-management.md`
- PRD + wireframes: `.sisyphus/drafts/tmuxweb-prd-wireframes.md`
- SQL schema (6 tables): `.sisyphus/drafts/tmuxweb-sql-schema.sql`
- UI reference prototype: `.sisyphus/drafts/tmuxweb-ui-reference.tsx`

### Current Codebase State (from user)
**Backend**: `TmuxWeb/server/` (Express + ws + node-pty)
- Auth middleware: `middleware/auth.js` token from query param or Bearer header
- Routes present: `routes/tmux.js` (tree), `routes/tasks.js` (in-memory Map)
- Config: `config.json` (port 8215, token, allowedOrigins)
- No MySQL yet; must add `mysql2`

**Frontend**: `TmuxWeb/web/src/` (Vite + React 18 + TS)
- Components: `TmuxTree.tsx`, `Terminal.tsx`, `TerminalTabs.tsx`
- State: `App.tsx` holds all state (useState)
- Auth: `utils/auth.ts` token in localStorage
- Styles: colocated CSS files, dark theme

### Key Constraints & Guardrails
- Must keep **useState-in-App.tsx** pattern (no Redux/Zustand/etc).
- Must use provided SQL schema (6 tables) as source of truth.
- Must match prototype UI design.
- Must implement cookie-based auth: HttpOnly, 30 days.
- Must keep WebSocket path `/ws/terminal` unchanged.
- Must NOT implement summary service itself (only integration/contract).

### Metis Gap-Analysis Highlights (incorporated)
- Biggest scope ambiguity risk: **Groups** and ordering granularity.
- Must specify cookie flags, WS auth migration strategy, and summary-service auth.
- Must call out explicit anti-scope-creep guardrails (no realtime sync, no log search, no summary editing).
- Must add agent-executable acceptance criteria (curl/Playwright) including negative scenarios.

---

## Work Objectives

### Core Objective
Deliver the full PRD feature set by establishing an API contract first, then implementing backend persistence and routes against the existing schema, then building the corresponding frontend UI and wiring.

### Concrete Deliverables
- `OpenAPI` spec file defining all endpoints, schemas, auth, error formats
- Express route modules implementing each endpoint group
- MySQL connection pool + minimal migration/bootstrap runner (idempotent)
- Frontend screens/components implementing prototype (profile/group management, ordering, pane status, tasks, segments, summaries)
- Frontend API client and integration in App state

### Definition of Done
- [ ] API docs exist and match running backend responses (validated by recorded curl examples)
- [ ] All PRD endpoints respond with correct status codes and JSON shapes
- [ ] Data persists in MySQL and follows the 6-table schema (including year/mon fields)
- [ ] Frontend matches prototype behaviors and styling conventions
- [ ] No external state library introduced; state remains in App.tsx via useState (helpers allowed)
- [ ] Agent-executed QA scenarios cover happy path + failure path for each major feature

### Must NOT Have (explicit anti-scope-creep)
- No group-based ordering beyond what PRD explicitly requires (see Task 0 decision)
- No realtime sync / collaboration (no websockets for ordering/status updates)
- No window/pane ordering (unless PRD explicitly demands; keep to session/group ordering)
- No log search, analytics dashboards, export features
- No summary editing (summaries are read-only, can only regenerate/import)

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> All acceptance criteria are verified by the agent via commands/tools.

### Test Decision
- **Infrastructure exists**: TBD by executor (inspect `TmuxWeb/server/package.json` and `TmuxWeb/web/package.json`)
- **Automated tests**: Tests-after (preferred). If no test infra exists, do not block—use agent-executed QA as primary.
- **Framework**: Backend: Jest+supertest *if already present*; Frontend: Playwright for E2E verification.

### Evidence capture
- UI screenshots: `.sisyphus/evidence/`
- curl response bodies saved: `.sisyphus/evidence/api-*.json`

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 — Contract + DB foundation (independent, unblock everything)
- Task 0: Scope decisions lock (groups/order granularity, paneKey strategy, cookie flags)
- Task 1: API docs (OpenAPI + Markdown) as source of truth
- Task 2: MySQL integration baseline + migration/bootstrap runner using provided schema

Wave 2 — Core backend routes (can parallelize across route domains)
- Task 3: Auth endpoints + cookie-session middleware (and WS auth strategy)
- Task 4: Profiles + Ordering endpoints
- Task 5: Groups + session grouping endpoints
- Task 6: Pane status endpoints

Wave 3 — Domain backend routes + summary integration
- Task 7: Tasks + segments endpoints (task lifecycle)
- Task 8: Segment logs endpoints (conversation + commands + logs)
- Task 9: Summaries endpoints (summarize trigger, candidates, load-summary) + summary-service contract integration

Wave 4 — Frontend UI + integration (can parallelize by feature area, then integrate)
- Task 10: Frontend auth + session bootstrap changes (cookie-based; remove localStorage token usage)
- Task 11: Profile & group management UI + selection
- Task 12: Tree ordering UI (DnD) + persistence wiring
- Task 13: Pane status UI + API wiring
- Task 14: Tasks/segments UI + logs UI + API wiring
- Task 15: Summaries UI (generate, view, candidates modal, import/load)
- Task 16: End-to-end verification runbook (Playwright scenarios) + API contract conformance spot-check

### Dependency Matrix (high-level)

| Task | Depends On | Notes |
|------|------------|-------|
| 0 | none | locks assumptions to avoid rework |
| 1 | 0 | API docs require scoped decisions |
| 2 | 0 | DB foundation needs identity decisions |
| 3 | 1,2 | auth should match contract + cookie settings |
| 4 | 1,2,3 | requires auth + tables |
| 5 | 1,2,3 | requires auth + group tables |
| 6 | 1,2,3 | requires auth + meta tables |
| 7,8 | 1,2,3,6 | task lifecycle ties to pane identity/status |
| 9 | 1,2,3,7,8 | summaries reference tasks/segments |
| 10 | 3 | frontend auth depends on backend auth |
| 11-15 | 4-9,10 | UI depends on backend endpoints + auth |
| 16 | all | final verification |

Critical Path: 0 → 1 → 2 → 3 → (4/6/7/9) → 10 → (11-15) → 16

---

## TODOs

### Task 0 — Lock scope decisions (write into API docs as “MVP decisions”)

**What to do**:
- Confirm MVP scope decisions and encode them as explicit constraints in docs:
  1) **Groups**: IN scope (CRUD `/api/groups` + assign session to group) because PRD lists it and schema includes `tmux_session_group`.
  2) **Ordering granularity**: Support ordering for **groups** and **sessions within group** via `tmux_session_meta.sort_order` and `tmux_session_group.sort_order`. (No window/pane ordering.)
  3) **Pane identity (paneKey)**: Define canonical `paneKey = "{sessionName}:{windowIndex}:{paneIndex}"` for API paths; also store raw fields separately where schema requires.
  4) **Cookie settings**: HttpOnly, Max-Age=30 days; SameSite=Lax default; Secure enabled when `NODE_ENV=production`.
  5) **WebSocket auth**: Prefer cookie auth; keep query token fallback behind config flag for backward compatibility.
  6) **Summary-service auth**: Default shared secret header `X-Summary-Service-Token` env-configured.

**Must NOT do**:
- Do not redesign schema.

**Recommended Agent Profile**:
- Category: writing
- Skills: none

**Parallelization**:
- Can run in parallel with nothing (fast), but should complete before Task 1/2.

**References**:
- `.sisyphus/drafts/tmuxweb-prd-wireframes.md` — product intent and endpoint list
- `.sisyphus/drafts/tmuxweb-sql-schema.sql` — confirms group+meta tables and sort_order
- `.sisyphus/plans/tmuxweb-auth-tree-pane-management.md` — earlier decisions/guardrails

**Acceptance Criteria (agent-executable)**:
- [ ] Decisions above appear verbatim in API docs intro section.

**Agent-Executed QA Scenarios**:
- Scenario: decisions are captured
  - Tool: Bash
  - Steps:
    1. `python -c "import pathlib; p=pathlib.Path('.sisyphus/plans/tmuxweb-api-backend-frontend-integration.md').read_text(); assert 'Groups: IN scope' in p"`
  - Expected Result: exit code 0

---

### Task 1 — Create API interface documentation (OpenAPI + Markdown)

**Files**:
- Create: `.sisyphus/drafts/tmuxweb-openapi.yaml` *(draft location as working spec)*
- Create: `.sisyphus/drafts/tmuxweb-api.md`

**What to do**:
- Define OpenAPI 3.0 spec covering all endpoints listed in PRD:
  - Auth, Profiles, Groups, Session-group assignment, Ordering, Pane status, Tasks, Segments (conversation/commands/logs), Summaries
- Specify auth scheme: cookie-based session
- Define consistent error response shape (minimum): `{ error, message, code?, details? }`
- Include concrete request/response examples for each endpoint
- Create a human-readable Markdown API reference that mirrors OpenAPI

**Must NOT do**:
- Do not invent endpoints not in PRD (except `/healthz` if needed for ops).

**Recommended Agent Profile**:
- Category: writing
- Skills: none

**Parallelization**:
- Can run in parallel with Task 2 after Task 0 is done.

**References**:
- `.sisyphus/drafts/tmuxweb-prd-wireframes.md` — endpoint list and UI flows
- `.sisyphus/drafts/tmuxweb-sql-schema.sql` — field names/types for schemas
- `TmuxWeb/server/routes/*` — existing route conventions (executor to inspect)

**Acceptance Criteria (agent-executable)**:
- [ ] OpenAPI file exists and includes every route path listed in PRD.
- [ ] Markdown doc includes curl examples for every endpoint group.

**Agent-Executed QA Scenarios**:
- Scenario: docs completeness check
  - Tool: Bash
  - Steps:
    1. `python - <<'PY'
import pathlib, re
p=pathlib.Path('.sisyphus/drafts/tmuxweb-openapi.yaml').read_text()
for path in [
  '/api/auth/login','/api/auth/logout','/api/profiles','/api/groups',
  '/api/sessions/{id}/group','/api/profiles/{id}/order','/api/panes/status',
  '/api/panes/{paneKey}/tasks','/api/tasks/{id}','/api/segments/{id}',
  '/api/tasks/{id}/summarize','/api/panes/{paneKey}/summary-candidates','/api/tasks/{id}/load-summary'
]:
  assert path in p, path
print('OK')
PY`
  - Expected Result: prints OK

---

### Task 2 — MySQL integration baseline + schema bootstrap (mysql2)

**Files** (expected touch points; executor to confirm exact names):
- Modify: `TmuxWeb/server/package.json` (add mysql2)
- Create: `TmuxWeb/server/db/pool.js` (mysql2 pool)
- Create: `TmuxWeb/server/db/bootstrap.js` (runs `.sisyphus/drafts/tmuxweb-sql-schema.sql` idempotently)
- Modify: `TmuxWeb/server/index.js` (initialize DB, expose health)

**What to do**:
- Add mysql2 with connection pool; configuration via env vars (MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE)
- Implement bootstrap runner that applies the provided schema (idempotent: IF NOT EXISTS / safe checks)
- Add a `/healthz` endpoint that checks DB connectivity (optional but recommended)

**Must NOT do**:
- Do not alter the logical schema beyond what’s in the SQL file.

**Recommended Agent Profile**:
- Category: unspecified-high
- Skills: none

**Parallelization**:
- Can run in parallel with Task 1 (after Task 0).

**References**:
- `.sisyphus/drafts/tmuxweb-sql-schema.sql` — exact table definitions
- `TmuxWeb/server/config.json` — existing config patterns

**Acceptance Criteria**:
- [ ] Starting server with MYSQL_* env vars succeeds
- [ ] `/healthz` returns 200 and includes `{ db: "ok" }` (or equivalent)

**Agent-Executed QA Scenarios**:
- Scenario: DB bootstrap + health
  - Tool: Bash
  - Preconditions: MySQL running and empty database created
  - Steps:
    1. Start server with env vars set
    2. `curl -s http://localhost:8215/healthz | tee .sisyphus/evidence/api-healthz.json`
    3. Assert JSON contains `db` and value indicates ok

---

### Task 3 — Auth endpoints + cookie-session middleware (and WS auth strategy)

**Files**:
- Modify: `TmuxWeb/server/middleware/auth.js`
- Create: `TmuxWeb/server/routes/auth.js`
- Modify: `TmuxWeb/server/index.js` (mount `/api/auth`)

**What to do**:
- Implement:
  - `POST /api/auth/login` (accept `{ token }`, validate against `config.json` token(s))
  - `POST /api/auth/logout` (clear cookie)
- Update auth middleware to:
  - Prefer session cookie
  - Allow Bearer/query token fallback behind a config flag (temporary)
- Ensure CORS allows credentialed requests from allowedOrigins

**Recommended Agent Profile**:
- Category: unspecified-high
- Skills: none

**Parallelization**:
- Can run in parallel with Tasks 4/5/6 after Task 2.

**References**:
- `TmuxWeb/server/middleware/auth.js` — current validation
- `TmuxWeb/server/config.json` — token, allowedOrigins
- `.sisyphus/plans/tmuxweb-auth-tree-pane-management.md` — prior acceptance patterns and guardrails

**Acceptance Criteria**:
- [ ] `curl -i -c .sisyphus/evidence/cookie.txt -X POST http://localhost:8215/api/auth/login -H 'Content-Type: application/json' -d '{"token":"<valid>"}'` returns 200 and sets HttpOnly cookie
- [ ] Invalid token → 401
- [ ] Logout clears cookie

**Agent-Executed QA Scenarios**:
- Scenario: login + access protected endpoint
  - Tool: Bash (curl)
  - Steps:
    1. Login storing cookie
    2. Call `GET /api/tmux/tree` with cookie; expect 200

---

### Task 4 — Profiles endpoints (CRUD) + ordering endpoints

**Files**:
- Create: `TmuxWeb/server/routes/profiles.js`
- Create: `TmuxWeb/server/routes/order.js` (or in profiles)
- Modify: `TmuxWeb/server/index.js`

**What to do**:
- Implement profile CRUD:
  - `GET/POST/PUT/DELETE /api/profiles`
- Implement ordering:
  - `GET /api/profiles/:id/order`
  - `PUT /api/profiles/:id/order`
- Store ordering per profile in `tmux_session_meta` using `sort_order` fields consistent with schema.

**Recommended Agent Profile**:
- Category: unspecified-high
- Skills: none

**Parallelization**:
- Parallel with Task 5/6.

**Acceptance Criteria**:
- [ ] curl create/list/update/delete profile works with cookie auth
- [ ] order PUT then GET returns the updated ordering

---

### Task 5 — Session Groups endpoints + session assignment

**Files**:
- Create: `TmuxWeb/server/routes/groups.js`
- Modify/Create: `TmuxWeb/server/routes/sessions.js` (for PUT /api/sessions/:id/group)
- Modify: `TmuxWeb/server/index.js`

**What to do**:
- Implement group CRUD:
  - `GET/POST/PUT/DELETE /api/groups`
- Implement session assignment:
  - `PUT /api/sessions/:id/group` (assign groupId)
- Persist per schema: `tmux_session_group` and `tmux_session_meta` linkage.

**Recommended Agent Profile**:
- Category: unspecified-high
- Skills: none

**Parallelization**:
- Parallel with Task 4/6.

**Acceptance Criteria**:
- [ ] Create group then assign a session; GET groups shows sessions grouped.

---

### Task 6 — Pane status endpoints

**Files**:
- Create: `TmuxWeb/server/routes/panes.js`
- Modify: `TmuxWeb/server/index.js`

**What to do**:
- `GET /api/panes/status` (by paneKey or list visible)
- `PUT /api/panes/status` (set status: idle|in-progress|done)
- Persist to `tmux_session_meta` (or appropriate table as per schema)

**Recommended Agent Profile**:
- Category: unspecified-high
- Skills: none

**Acceptance Criteria**:
- [ ] Invalid status → 400
- [ ] PUT then GET returns persisted status

---

### Task 7 — Tasks endpoints (per paneKey)

**Files**:
- Create: `TmuxWeb/server/routes/tasks-db.js` (replace in-memory Map)
- Modify: `TmuxWeb/server/index.js` (mount)

**What to do**:
- Implement:
  - `POST/GET /api/panes/:paneKey/tasks`
  - `PUT/POST /api/tasks/:id` (complete, detail updates)
- Store to `tmux_task_segment` + `tmux_task_summary` as per schema.

**Acceptance Criteria**:
- [ ] Create task returns id; list returns it; complete updates state.

---

### Task 8 — Segments endpoints: conversation/commands/logs

**Files**:
- Create: `TmuxWeb/server/routes/segments.js`

**What to do**:
- Implement:
  - `POST/GET /api/segments/:id` for conversation/commands/logs
- Persist to `tmux_chat_message` and `tmux_command_record` with year/mon.

**Acceptance Criteria**:
- [ ] Append message/command then retrieve; ordering preserved.

---

### Task 9 — Summaries endpoints + external summary service integration

**Files**:
- Create: `TmuxWeb/server/routes/summaries.js`
- Modify: `TmuxWeb/server/routes/tasks.js` callback handling (if exists)

**What to do**:
- Implement:
  - `POST /api/tasks/:id/summarize`
  - `GET /api/panes/:paneKey/summary-candidates`
  - `POST /api/tasks/:id/load-summary`
- If summary service base URL missing → return 501 with clear JSON error
- If present → create job, poll or accept callback; persist to `tmux_task_summary`

**Acceptance Criteria**:
- [ ] With base URL unset: summarize returns 501
- [ ] Candidates endpoint returns previous summaries for same paneKey

---

### Task 10 — Frontend auth migration to cookie-session

**Files**:
- Modify: `TmuxWeb/web/src/utils/auth.ts`
- Modify: `TmuxWeb/web/src/App.tsx`

**What to do**:
- Replace localStorage token usage with cookie-based session
- Add login UI flow that calls `/api/auth/login`
- Ensure fetch calls include `credentials: 'include'`

**Recommended Agent Profile**:
- Category: visual-engineering
- Skills: ["frontend-ui-ux"]

**Acceptance Criteria**:
- [ ] Reload retains login for 30 days (cookie present)

---

### Task 11 — Profile + group management UI

**Files**:
- Modify/Create: `TmuxWeb/web/src/components/ProfileSelector.tsx`
- Modify: `TmuxWeb/web/src/components/GroupManager.tsx`
- Modify: `TmuxWeb/web/src/App.tsx`

**What to do**:
- Implement UI per prototype: create/select/delete profiles; manage groups; assign sessions to groups

**Recommended Agent Profile**:
- Category: visual-engineering
- Skills: ["frontend-ui-ux","frontend-design"]

---

### Task 12 — Tree ordering UI (DnD) + wiring

**Files**:
- Modify: `TmuxWeb/web/src/components/TmuxTree.tsx`
- Modify: relevant CSS files

**What to do**:
- Implement drag-and-drop ordering exactly as prototype; persist via `/api/profiles/:id/order`

**Recommended Agent Profile**:
- Category: visual-engineering
- Skills: ["frontend-ui-ux"]

---

### Task 13 — Pane status UI + wiring

**Files**:
- Modify: `TmuxWeb/web/src/components/TmuxTree.tsx` and/or `TerminalTabs.tsx`

**What to do**:
- Display status badge; allow changing status; persist via `/api/panes/status`

---

### Task 14 — Tasks/segments UI + logs UI

**Files**:
- Create/Modify: `TmuxWeb/web/src/components/PaneDetail.tsx`
- Modify: `TmuxWeb/web/src/App.tsx`

**What to do**:
- Create sequential tasks, show task list, show conversation and command logs

---

### Task 15 — Summaries UI (generate/view/import)

**Files**:
- Modify: `PaneDetail.tsx` and/or summary modal components

**What to do**:
- Add generate summary action, show job status, show candidates modal and load-summary

---

### Task 16 — End-to-end QA runbook (agent executed)

**What to do**:
- Provide Playwright scenarios for:
  - Login (cookie)
  - Create profile + group, assign session
  - Reorder sessions and persist
  - Update pane status
  - Create tasks, add logs
  - Generate summary (service disabled path)
  - Load previous summary

**Acceptance Criteria**:
- [ ] Playwright run produces screenshots saved under `.sisyphus/evidence/`

---

## Notes / Known Ambiguities (defaults applied)
- **Groups are treated as IN scope** because PRD lists CRUD and schema includes group tables.
- **Summary service** is integration-only; if no real service available, backend returns 501 and UI shows not-configured state.
- **Conflict resolution** for ordering/status updates defaults to last-write-wins.

---

## Success Criteria

### Final verification (agent-executable)
- API smoke:
  - `curl` login → list profiles → create profile → create group → assign session → set order → set pane status
- UI E2E:
  - Playwright runs scenarios and stores screenshots in `.sisyphus/evidence/`

---

Plan saved to: `.sisyphus/plans/tmuxweb-api-backend-frontend-integration.md`
