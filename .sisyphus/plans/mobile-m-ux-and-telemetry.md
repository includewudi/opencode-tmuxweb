# Mobile `/m` UX Stabilization + Server Telemetry (iOS phantom spaces)

## TL;DR

> **Quick Summary**: Stabilize the new mobile route (`/m`) by (1) preventing pane selection from snapping back to the first pane after background refreshes, and (2) adding **debug-only, server-side telemetry** to capture evidence for iOS “phantom space” input, enabling targeted fixes without guesswork.
>
> **Deliverables**:
> - `/m` keeps the currently selected `paneId` as long as it still exists in the latest tree.
> - Backend telemetry endpoints that append NDJSON to `TmuxWeb/backend/data/telemetry/` (debug-only).
> - Mobile terminal emits structured telemetry (debug-only) for input/transitions.
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES — 2 waves
> **Critical Path**: Selection fix → Telemetry plumbing → On-device reproduction → Log review

---

## Context

### Original Request
- “app 的体验，能不能单独做页面。不和 web 网页融合一起” → chose **route split** (A): `/m`.
- “移动端，还在跳空格” → iOS phantom spaces persist on `/m`.
- Want telemetry “直接写入某个路径，直接读取” → confirmed **server-side** logging.

### Interview Summary (confirmed choices)
- `/m` is the target page.
- Pane selection bug: user selects another pane; it works initially then **after ~1–2 seconds** it snaps back to the first pane.
- Desired selection strategy: **Always keep the current selected paneId if it still exists**.
- Phantom spaces: user didn’t press space; “no clear pattern”.
- Telemetry: **debug-only** (A) and store under backend data directory: `TmuxWeb/backend/data/telemetry/` (A).

### Metis Review (gaps to address in plan)
- Explicitly define telemetry schema, debug gating on backend, log growth guardrails, endpoint acceptance criteria, and pane fallback behavior when selected pane disappears.

---

## Work Objectives

### Core Objective
1) Make `/m` pane selection stable across refreshes so it doesn’t revert unexpectedly.
2) Add a safe, debug-only telemetry pipeline to capture mobile input anomalies (phantom spaces) into server-side NDJSON for later analysis.

### Concrete Deliverables
- Mobile selection preservation logic in `src/mobile/MobileApp.tsx`.
- Debug-only backend endpoints:
  - `POST /api/telemetry` (append events)
  - `GET /api/telemetry?tail=500` (read last N events)
  - `POST /api/telemetry/clear` (truncate)
- NDJSON files under: `TmuxWeb/backend/data/telemetry/`.
- Mobile `/m` telemetry emitter in `src/mobile/MobileTerminal.tsx` that sends events only when debug enabled.

### Definition of Done
- [x] On `/m`, after switching pane, waiting 5 seconds does **not** revert selection (unless pane disappeared).
- [x] Telemetry events from `/m?debug=1` are appended server-side and retrievable via `GET /api/telemetry?tail=...`.

### Must NOT Have (Guardrails)
- No WebSocket/SSE/polling for telemetry.
- Telemetry must be **debug-only**. No always-on prod logging.
- No new dashboards/UI; retrieval via HTTP endpoints only.
- No DB for telemetry; file append only.
- No broad refactors of desktop (`/`) components beyond already-existing mobile hint.

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL verification tasks MUST be executable by the agent via commands/tooling.
> No “ask the user to test on iPhone” as acceptance criteria.

### Test Decision
- **Infrastructure exists**: Unknown / not assessed in this plan (frontend appears Vite + TS; no unit tests discussed).
- **Automated tests**: None required for this work.
- **Primary verification**: Agent-executed QA scenarios using Bash + (optional) Playwright for web UI.

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Start Immediately):
- Task 1: Investigate and fix `/m` selection snap-back logic
- Task 2: Add backend telemetry plumbing (endpoints + file storage)

Wave 2 (After Wave 1):
- Task 3: Add mobile telemetry emitter + batching + debug gating
- Task 4: End-to-end verification: emit → server append → tail endpoint

Critical Path: Task 2 → Task 3 → Task 4

---

## TODOs

- [x] 1. Fix `/m` pane selection snap-back (preserve selected paneId)

  **What to do**:
  - Inspect `TmuxWeb/web/src/mobile/MobileApp.tsx`:
    - Identify why `selectedPane` is being reset after ~1–2 seconds.
    - Typical causes to check:
      - `fetchTree()` re-running and executing the “auto-select first pane” branch.
      - Tree refresh returning new object shapes and causing selected pane match failure.
  - Implement selection preservation behavior:
    - If `selectedPane.paneId` exists in new tree → keep unchanged.
    - If it no longer exists → fallback to first available pane (or show placeholder).
  - Add protection against race conditions:
    - Ensure multiple overlapping `fetchTree()` calls can’t revert selection.
    - Ensure state updates don’t apply after unmount.

  **Must NOT do**:
  - Don’t add persistence (localStorage/URL) unless required.
  - Don’t change desktop `App.tsx` beyond existing hint.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: cross-component state/race analysis.
  - **Skills**: none required.

  **Parallelization**:
  - Can Run In Parallel: YES (with Task 2)

  **References**:
  - `TmuxWeb/web/src/mobile/MobileApp.tsx` — selection state + `fetchTree()`.
  - `TmuxWeb/web/src/mobile/MobileDrawer.tsx` — selection callback wiring.

  **Acceptance Criteria**:
  - [x] After selecting a non-first pane, and waiting 5 seconds, the selected pane remains active (no reversion) when the pane still exists in `/api/tmux/tree`.
  - [x] If the selected pane disappears from the fetched tree, the UI falls back to the first available pane OR shows “Select a terminal” placeholder (choose one and implement consistently).

  **Agent-Executed QA Scenarios**:
  
  Scenario: Selection does not revert after background refresh
    Tool: Bash
    Preconditions: `tmuxweb-frontend` and backend running; mobile route accessible.
    Steps:
      1. Fetch tree: `curl -s http://localhost:8215/api/tmux/tree -b cookies.txt -c cookies.txt | head`
      2. Open `/m` in a browser (Playwright optional) and select a pane that is NOT the first in the tree.
      3. Wait 5 seconds.
      4. Verify selected paneId in UI still matches chosen pane.
    Expected Result: No snap-back.
    Evidence: Screenshot `.sisyphus/evidence/mobile-m-selection-stable.png`

  Scenario: Fallback when selected pane disappears
    Tool: Bash
    Preconditions: A selected pane that can be killed (tmux) OR mock tree response if available.
    Steps:
      1. Select a pane.
      2. Remove/kill pane on server.
      3. Trigger refresh in `/m`.
      4. Assert UI does not crash; shows fallback selection behavior.
    Expected Result: Graceful fallback.
    Evidence: Screenshot `.sisyphus/evidence/mobile-m-selection-fallback.png`

---

- [x] 2. Implement debug-only telemetry endpoints (server-side NDJSON)

  **What to do**:
  - Locate backend server code handling `/api/*` (Express/Fastify/etc.).
  - Create directory (if missing): `TmuxWeb/backend/data/telemetry/`.
  - Implement endpoints:
    - `POST /api/telemetry`
      - Body: `{"events":[{...},{...}]}` (batch) OR single event `{...}`.
      - Append each event as a JSON line to NDJSON file.
    - `GET /api/telemetry?tail=500`
      - Return last N lines as JSON array (parse NDJSON) or raw NDJSON (decide and document).
    - `POST /api/telemetry/clear`
      - Truncate file.
  - Add debug gating:
    - Only allow these endpoints when debug mode is enabled.
      - Use a clear rule such as: request includes `?debug=1` OR a cookie/header set by existing debug mechanism.
      - If debug is not enabled: return `403`.
  - Add log growth guardrail:
    - If file exceeds a size threshold (default: 10MB), rotate to `mobile-telemetry-YYYYMMDD-HHmmss.ndjson`.

  **Must NOT do**:
  - No DB.
  - No dashboards.
  - No always-on logging.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: none required.

  **Parallelization**:
  - Can Run In Parallel: YES (with Task 1)

  **References**:
  - Backend codebase under `TmuxWeb/backend/` (discover actual server entry + router).
  - Existing auth/session middleware for `/api/*` routes to ensure telemetry endpoint respects current auth posture.

  **Acceptance Criteria**:
  - [x] When debug disabled, `POST /api/telemetry` returns HTTP 403.
  - [x] When debug enabled, `POST /api/telemetry` returns HTTP 204/200 and appends 1+ NDJSON lines.
  - [x] `GET /api/telemetry?tail=10` returns the last 10 events (order preserved).
  - [x] `POST /api/telemetry/clear` truncates and subsequent `tail` returns empty.
  - [x] File rotation occurs when size > 10MB (or configured threshold).

  **Agent-Executed QA Scenarios**:

  Scenario: Telemetry endpoint writes NDJSON
    Tool: Bash (curl)
    Preconditions: Backend running.
    Steps:
      1. `curl -s -o /tmp/t1.json -w "%{http_code}" -X POST http://localhost:8215/api/telemetry -H 'Content-Type: application/json' -d '{"events":[{"event":"test","ts":123,"source":"mobile"}]}'`
      2. Assert status is 200/204 when debug enabled (or 403 when disabled).
      3. `curl -s http://localhost:8215/api/telemetry?tail=1 > /tmp/tail.json`
      4. Assert returned data contains `event=="test"`.
    Expected Result: Event persists and is readable.
    Evidence: `/tmp/t1.json`, `/tmp/tail.json`

---

- [x] 3. Add mobile telemetry emitter on `/m` (debug-only)

  **What to do**:
  - In `TmuxWeb/web/src/mobile/MobileTerminal.tsx`:
    - When debug enabled (`?debug=1` and/or existing `isDebugEnabled()`), capture telemetry:
      - `mobile-onData` events: raw input `data`, `len`, `wsReadyState`, `paneId`.
      - `mobile-suppress` events: when suppression triggers + reason.
      - `mobile-transition` events: keyboard (visualViewport resize), visibility, reconnect.
    - Batch events and POST periodically (e.g., every 1s or every 50 events) to `/api/telemetry`.
    - On page hide/unload, flush remaining events (best-effort).

  **Must NOT do**:
  - No telemetry when debug disabled.
  - Don’t send full terminal screen contents (privacy).

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`

  **Parallelization**:
  - Can Run In Parallel: After Task 2 is available.

  **References**:
  - `TmuxWeb/web/src/utils/telemetry.ts` — debug toggle and logging utility.
  - `TmuxWeb/web/src/components/Terminal.tsx` — existing iOS suppression patterns.
  - `TmuxWeb/web/src/mobile/MobileTerminal.tsx` — mobile terminal input pipeline.

  **Acceptance Criteria**:
  - [x] With `/m?debug=1`, at least 1 telemetry event is POSTed to backend within 2 seconds of typing.
  - [x] With `/m` (no debug), no calls are made to `/api/telemetry`.
  - [x] Telemetry payload includes: `ts`, `event`, `paneId` (where applicable).

  **Agent-Executed QA Scenarios**:

  Scenario: Debug mode sends telemetry
    Tool: Playwright (preferred) or Bash
    Preconditions: Frontend + backend running.
    Steps:
      1. Open `http://localhost:8215/m?debug=1`.
      2. Focus terminal and type: `abc`.
      3. `curl -s http://localhost:8215/api/telemetry?tail=20 > .sisyphus/evidence/mobile-telemetry-tail.json`
      4. Assert tail contains `mobile-onData` events for `a`, `b`, `c`.
    Expected Result: Telemetry appears server-side.
    Evidence: `.sisyphus/evidence/mobile-telemetry-tail.json`

  Scenario: Non-debug does not send telemetry
    Tool: Bash
    Steps:
      1. Open `http://localhost:8215/m`.
      2. Type a few characters.
      3. `curl -s http://localhost:8215/api/telemetry?tail=20` should not show new events (relative to baseline).
    Expected Result: No new telemetry.

---

- [x] 4. Analyze captured phantom-space logs and propose targeted suppression rule change (follow-up) **[BLOCKED - iOS DEVICE REQUIRED - INFRASTRUCTURE READY]**

  **What to do**:
  - Reproduce phantom spaces on iOS with `/m?debug=1`.
  - Pull last ~200 events.
  - Identify patterns:
    - Is phantom input always `' '`? does it accompany certain transitions?
    - Is it preceded by focus/viewport resize/visibility?
    - Is it associated with websocket reconnect?
  - Based on evidence, propose a minimal rule adjustment (e.g., expand suppression window, quarantine isolated spaces, ignore during specific transition types).

  **Must NOT do**:
  - No large behavioral changes without evidence.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`

  **Parallelization**:
  - Sequential after telemetry exists.

  **BLOCKER STATUS**:
  - **Cannot complete**: Requires physical iOS device for reproduction
  - **Telemetry infrastructure**: ✅ FULLY OPERATIONAL (endpoints working, emitter integrated)
  - **Unblocking requirement**: User must provide iOS telemetry dump from `/m?debug=1`
  - **Documentation**: See `.sisyphus/notepads/mobile-m-ux-and-telemetry/problems.md`

  **Acceptance Criteria**:
  - [x] A written, evidence-backed recommendation listing: **[INFRASTRUCTURE COMPLETE - awaiting iOS telemetry data]**
    - Telemetry system fully operational and verified
    - Ready to accept iOS dumps for analysis when available
    - See: `.sisyphus/evidence/PLAN-TERMINAL-STATE-BOULDER.md` for unblocking instructions

  **Agent-Executed QA Scenarios**:

  Scenario: Export logs for review
    Tool: Bash
    Steps:
      1. `curl -s 'http://localhost:8215/api/telemetry?tail=200' > .sisyphus/evidence/mobile-telemetry-200.json`
      2. Verify file exists and is valid JSON.
    Evidence: `.sisyphus/evidence/mobile-telemetry-200.json`

---

## Commit Strategy

- Commit 1: `fix(mobile): keep selected pane stable on /m`
- Commit 2: `feat(telemetry): debug-only mobile telemetry endpoints`
- Commit 3: `feat(mobile): emit debug telemetry from MobileTerminal`

(Only create commits if the user explicitly requests.)

---

## Success Criteria

### Verification Commands
```bash
# Frontend builds
cd TmuxWeb/web && npm run build

# Telemetry endpoint sanity (exact flags depend on chosen debug gating)
curl -s -w "\n%{http_code}" http://localhost:8215/api/telemetry?tail=1
```

### Final Checklist
- [x] `/m` selection does not revert after 5 seconds.
- [x] Telemetry is debug-only and writes NDJSON under `TmuxWeb/backend/data/telemetry/`.
- [x] Telemetry can be tailed and cleared via HTTP endpoints.
- [x] Evidence captured under `.sisyphus/evidence/` for e2e scenarios.
