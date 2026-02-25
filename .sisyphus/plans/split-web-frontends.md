# Split Desktop and Mobile Web Frontends

## TL;DR

> **Quick Summary**: Split the frontend into explicit desktop/mobile source trees with minimal shared components, while keeping a single Vite build and dynamic route-level chunking for `/` and `/m`. Add a minimal Vitest setup and include a targeted frontend fix for the WebSocket connection failure.
>
> **Deliverables**:
> - New `src/desktop`, `src/mobile`, and `src/shared` layout with updated imports
> - Route-level dynamic imports so `/` and `/m` load separate chunks in one build
> - Vitest base configuration with minimal sample tests
> - Frontend WS connection fix and diagnostic improvements
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES — 3 waves
> **Critical Path**: Shared-component move → Desktop/Mobile restructuring → Router split → Tests/WS fix

---

## Context

### Original Request
User wants to split the mac desktop web and mobile web frontends into separate build outputs, frontend-only changes, keep `/` and `/m`, and keep backend unchanged. Desktop and mobile should have distinct navigation/interaction. Minimal shared utilities are allowed. Add a minimal Vitest setup. Also include a task to diagnose/fix WS connection failures to `wss://172.29.15.223:8216/ws/terminal`.

### Interview Summary
**Key Decisions**:
- Single Vite build with entry-level split and dynamic imports per route
- Target structure: `src/desktop`, `src/mobile`, `src/shared`
- Minimal shared utilities/components allowed (types/auth/telemetry)
- Backend remains unchanged
- Vitest base configuration with minimal sample tests only

**Research Findings**:
- Single entry `web/src/main.tsx` with routes `/` → `App` and `/m` → `MobileApp`
- Desktop root: `web/src/App.tsx` (desktop components in `components/`)
- Mobile root: `web/src/mobile/MobileApp.tsx`
- Vite config is single build, no MPA setup
- No unit test framework; ad-hoc Playwright scripts only

### Metis Review
**Identified Gaps (addressed)**:
- Shared components live in `components/` and are used by mobile; must move to shared area
- Do NOT split `Terminal.tsx` or `global.css`
- Preserve existing localStorage keys

---

## Work Objectives

### Core Objective
Create an explicit desktop/mobile split in the frontend source tree with minimal shared components, while keeping a single build and no backend changes. Ensure `/` and `/m` load separate chunks and that the WS connection failure is addressed on the frontend side.

### Concrete Deliverables
- `src/desktop/` and `src/mobile/` directory structure with updated imports
- `src/shared/` containing shared components/utilities only
- `main.tsx` uses dynamic imports for desktop and mobile routes
- Vitest config + minimal test file + npm script
- WS connection fix or diagnostic improvements in terminal client code

### Definition of Done
- [ ] `npm run build` succeeds in `TmuxWeb/web`
- [ ] `npx tsc --noEmit` succeeds in `TmuxWeb/web`
- [ ] `/` and `/m` both render without runtime errors
- [ ] `npx vitest run` succeeds with at least one test
- [ ] WS connection failure either resolved or logs clearly show the root cause and correct URL/protocol

### Must Have
- No backend/server changes
- `/` and `/m` remain the routing paths
- Minimal shared components only (no full shared UI layer)

### Must NOT Have (Guardrails)
- Do not split or refactor `Terminal.tsx` internals
- Do not split or remove `global.css`
- Do not rename localStorage keys (`openTabs`, `activeTabId`, `mobile-openTabs`, `mobile-activeTabId`)
- Do not add React Testing Library or heavy test infra

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: NO (only ad-hoc Playwright scripts)
- **Automated tests**: YES (Tests-after)
- **Framework**: Vitest (minimal base config)

### QA Policy
Every task includes agent-executed QA scenarios with evidence saved to `.sisyphus/evidence/`.

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Shared components split — foundation)
- Task 1: Shared navigation components → `src/shared/components`
- Task 2: Shared auth/details/voice components → `src/shared/components`
- Task 3: Shared toolbox tabs → `src/shared/components`

Wave 2 (Desktop/Mobile restructure + routing)
- Task 4: Desktop root move → `src/desktop` + CSS updates
- Task 5: Mobile path normalization after shared moves
- Task 6: Route-level dynamic imports in `main.tsx`

Wave 3 (Infra + WS issue)
- Task 7: Vitest base config + minimal tests
### Dependency Matrix
- 1 → 4,5,6
- 2 → 4,5,6
- 3 → 4,5,6
- 4 → 6
- 5 → 6
- 6 → 7,8
- 7 → Final Verification
- 8 → Final Verification

## TODOs


- [ ] 1. Move shared navigation components into src/shared/components

  **What to do**:
  - Move `TmuxTree`, `ProfileSelector`, `GroupManager` from `src/components/` into `src/shared/components/`.
  - Update imports in mobile/desktop files to use new shared path.
  - Keep behavior unchanged.

  **Must NOT do**:
  - Do not change component logic or props.
  - Do not move `global.css` or `Terminal.tsx`.

  **Recommended Agent Profile**:
  - **Category**: quick — mostly file moves and import updates.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Tasks 4-6
  - **Blocked By**: None

  **References**:
  - `web/src/components/TmuxTree.tsx` — shared session tree used by both desktop sidebar and mobile drawer.
  - `web/src/components/ProfileSelector.tsx` — shared profile picker.
  - `web/src/components/GroupManager.tsx` — shared group management UI.
  - `web/src/mobile/MobileDrawer.tsx` — imports these components today.
  - `web/src/App.tsx` — desktop imports of these components.

  **Acceptance Criteria**:
  - [ ] Imports compile with new paths; `npx tsc --noEmit` passes.
  - [ ] Desktop `/` and mobile `/m` render without missing component errors.
  **QA Scenarios**:
  ```
  Scenario: Desktop renders sidebar tree after move
    Tool: Playwright
    Preconditions: Dev server running on http://localhost:5216
    Steps:
      1. Open http://localhost:5216/
      2. Wait for selector ".tmux-tree"
      3. Capture screenshot
    Expected Result: Sidebar tree is visible without console errors
    Evidence: .sisyphus/evidence/task-1-desktop-tree.png

  Scenario: Mobile drawer renders profile selector after move
    Tool: Playwright
    Preconditions: Dev server running on http://localhost:5216/m
    Steps:
      1. Open http://localhost:5216/m
      2. Open mobile drawer (tap menu button if present)
      3. Assert selector ".profile-selector" exists
    Expected Result: Drawer shows profile selector without errors
    Evidence: .sisyphus/evidence/task-1-mobile-profile.png
  ```
    Expected Result: Drawer shows profile selector without errors
    Evidence: .sisyphus/evidence/task-1-mobile-profile.png
  ```

- [ ] 2. Move shared auth/details/voice components into src/shared/components

  **What to do**:
  - Move `LoginModal`, `PaneDetails`, `VoiceInput` from `src/components/` into `src/shared/components/`.
  - Keep `VoiceInputHandle` type exports accessible from shared module.
  - Update imports in desktop/mobile components using these modules.

  **Must NOT do**:
  - Do not change authentication or WS logic.
  - Do not change `VoiceInput` behavior.

  **Recommended Agent Profile**:
  - **Category**: quick — component moves + import updates.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Tasks 4-6
  - **Blocked By**: None

  **References**:
  - `web/src/components/LoginModal.tsx` — used by both `App.tsx` and `MobileApp.tsx`.
  - `web/src/components/PaneDetails.tsx` — used by both desktop panel and mobile slide-in.
  - `web/src/components/VoiceInput.tsx` — used by both desktop and mobile toolboxes.
  - `web/src/mobile/MobileToolbox.tsx` — imports `VoiceInput`.
  - `web/src/App.tsx` — imports `LoginModal` and `PaneDetails`.

  **QA Scenarios**:
  ```
  Scenario: Desktop login modal renders
    Tool: Playwright
    Preconditions: Dev server running
    Steps:
      1. Open http://localhost:5216/
      2. If login modal appears, assert selector ".login-modal" exists
      3. Screenshot modal (if present)
    Expected Result: Login modal renders without runtime error
    Evidence: .sisyphus/evidence/task-2-desktop-login.png

  Scenario: Mobile pane details opens
    Tool: Playwright
    Preconditions: Dev server running http://localhost:5216/m
    Steps:
      1. Open /m
      2. Open drawer and select a pane if available
      3. Click details panel toggle (right panel)
    Expected Result: Pane details panel visible without error
    Evidence: .sisyphus/evidence/task-2-mobile-details.png
  ```
  Scenario: Mobile pane details opens
    Tool: Playwright
  **QA Scenarios**:
  ```
  Scenario: Desktop login modal renders
    Tool: Playwright
    Preconditions: Dev server running
    Steps:
      1. Open http://localhost:5216/
      2. If login modal appears, assert selector ".login-modal" exists
      3. Screenshot modal (if present)
    Expected Result: Login modal renders without runtime error
    Evidence: .sisyphus/evidence/task-2-desktop-login.png

  Scenario: Mobile pane details panel opens
    Tool: Playwright
    Preconditions: Dev server running http://localhost:5216/m
    Steps:
      1. Open /m
      2. If tabs exist, tap right panel button (icon PanelRightOpen)
      3. Assert selector ".pane-details-container" exists
    Expected Result: Pane details panel visible without error
    Evidence: .sisyphus/evidence/task-2-mobile-details.png
  ```

  **Must NOT do**:
  - Do not refactor AI/snippets behavior.

  **Recommended Agent Profile**:
  - **Category**: quick — move components + update imports.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Tasks 4-6
  - **Blocked By**: None

  **References**:
  - `web/src/components/AiCommandTab.tsx`
  - `web/src/components/SnippetsTab.tsx`
  - `web/src/components/DesktopToolbox.tsx`
  - `web/src/mobile/MobileToolbox.tsx`

  **Acceptance Criteria**:
  - [ ] Desktop toolbox shows AI/snippets tabs without errors.
  - [ ] Mobile toolbox shows AI/snippets tabs without errors.

  **QA Scenarios**:
  ```
  Scenario: Desktop toolbox shows AI tab
    Tool: Playwright
    Preconditions: Dev server running
    Steps:
      1. Open http://localhost:5216/
      2. Switch toolbox to AI tab
  **QA Scenarios**:
  ```
  Scenario: Desktop toolbox shows AI tab
    Tool: Playwright
    Preconditions: Dev server running
    Steps:
      1. Open http://localhost:5216/
      2. Click ".desktop-toolbox-tab" with label "AI"
      3. Assert AI prompt textarea exists
    Expected Result: AI tab renders without errors
    Evidence: .sisyphus/evidence/task-3-desktop-ai.png

  Scenario: Mobile toolbox shows snippets tab
    Tool: Playwright
    Preconditions: Dev server running http://localhost:5216/m
    Steps:
      1. Open /m
      2. Tap toolbox tab labeled "命令"
      3. Assert snippets list or empty state text exists
    Expected Result: Snippets tab renders without errors
    Evidence: .sisyphus/evidence/task-3-mobile-snippets.png
  ```
  - Move `App.tsx` and desktop-only components (e.g. `DesktopToolbox`, `TerminalTabs`) into `src/desktop/`.
  - Update related CSS imports (e.g. `styles/app.css`) to remain accessible.
  - Keep `Terminal.tsx` where it is (do not refactor).

  **Must NOT do**:
  - Do not modify `Terminal.tsx` or `global.css`.

  **Recommended Agent Profile**:
  - **Category**: unspecified-high — multi-file moves with many import changes.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (with Tasks 5, 6)
  - **Blocks**: Tasks 6-8
  - **Blocked By**: Tasks 1-3

  **References**:
  - `web/src/App.tsx`
  - `web/src/components/DesktopToolbox.tsx`
  - `web/src/components/TerminalTabs.tsx`
  - `web/src/styles/app.css`

  **Acceptance Criteria**:
  - [ ] Desktop route renders without import errors.
  - [ ] `npx tsc --noEmit` passes.

  **QA Scenarios**:
  ```
  Scenario: Desktop layout loads after move
    Tool: Playwright
    Preconditions: Dev server running
    Steps:
      1. Open http://localhost:5216/
      2. Verify sidebar and toolbox exist (selectors or visible text)
      3. Screenshot layout
    Expected Result: Desktop UI renders correctly
    Evidence: .sisyphus/evidence/task-4-desktop-layout.png

  Scenario: Desktop terminal tabs visible
    Tool: Playwright
    Preconditions: Dev server running
    Steps:
      1. Open /
      2. Assert terminal tabs container exists
    Expected Result: Tabs visible without errors
    Evidence: .sisyphus/evidence/task-4-desktop-tabs.png
  ```

- [ ] 5. Normalize mobile imports after shared/desktop split

  **What to do**:
  - Update `src/mobile/*` imports to new `src/shared` locations.
  - Keep mobile-specific hooks and utils in `src/mobile` if they are not shared.

  **Must NOT do**:
  - Do not change mobile behaviors or localStorage keys.

  **Recommended Agent Profile**:
  - **Category**: quick
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (with Tasks 4, 6)
  - **Blocks**: Tasks 6-8
  - **Blocked By**: Tasks 1-3

  **References**:
  - `web/src/mobile/MobileApp.tsx`
  - `web/src/mobile/MobileDrawer.tsx`
  - `web/src/mobile/MobileToolbox.tsx`
  - `web/src/mobile/MobileTerminal.tsx`

  **Acceptance Criteria**:
  - [ ] Mobile `/m` route renders without import errors.
  - [ ] `npx tsc --noEmit` passes.

  **QA Scenarios**:
  ```
  Scenario: Mobile app loads after import updates
    Tool: Playwright
    Preconditions: Dev server running
    Steps:
      1. Open http://localhost:5216/m
      2. Wait for main mobile container
      3. Screenshot
    Expected Result: Mobile UI renders correctly
    Evidence: .sisyphus/evidence/task-5-mobile-layout.png

  Scenario: Mobile toolbox opens
    Tool: Playwright
    Preconditions: Dev server running
    Steps:
      1. Open /m
      2. Open toolbox
      3. Screenshot toolbox
    Expected Result: Toolbox renders without errors
    Evidence: .sisyphus/evidence/task-5-mobile-toolbox.png
  ```

- [ ] 6. Add route-level dynamic imports for desktop and mobile

  **What to do**:
  - Update `src/main.tsx` to lazy-load desktop and mobile roots with dynamic import.
  - Ensure `/` and `/m` still map to the correct root components.

  **Must NOT do**:
  - Do not add React.Suspense UI changes beyond minimal fallback.

  **Recommended Agent Profile**:
  - **Category**: quick
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (with Tasks 4, 5)
  - **Blocks**: Tasks 7-8
  - **Blocked By**: Tasks 4-5

  **References**:
  - `web/src/main.tsx`
  - Current `App.tsx` and `mobile/MobileApp.tsx` entry usage

  **Acceptance Criteria**:
  - [ ] Build outputs separate chunks for desktop and mobile entries.
  - [ ] `/` and `/m` render after build and dev.

  **QA Scenarios**:
  ```
  Scenario: Desktop route loads via dynamic import
    Tool: Playwright
    Preconditions: Dev server running
    Steps:
      1. Open http://localhost:5216/
      2. Observe initial load and ensure no blank screen
  **QA Scenarios**:
  ```
  Scenario: Desktop layout loads after move
    Tool: Playwright
    Preconditions: Dev server running
    Steps:
      1. Open http://localhost:5216/
      2. Verify sidebar ".sidebar" and toolbox ".desktop-toolbox" exist
      3. Screenshot layout
    Expected Result: Desktop UI renders correctly
    Evidence: .sisyphus/evidence/task-4-desktop-layout.png

  Scenario: Desktop terminal tabs visible
    Tool: Playwright
    Preconditions: Dev server running
    Steps:
      1. Open /
      2. Assert selector ".terminal-tabs" exists
    Expected Result: Tabs visible without errors
    Evidence: .sisyphus/evidence/task-4-desktop-tabs.png
  ```
  - Add `vitest` to dev dependencies and a minimal `vitest.config.ts` (or `test` block in `vite.config.ts`).
  - Add a minimal test file targeting pure utilities (e.g. `platform.ts` or `auth.ts`).
  - Add npm script `test` or `test:unit` as appropriate.

  **Must NOT do**:
  - Do not add React Testing Library or heavy component tests.

  **Recommended Agent Profile**:
  - **Category**: quick
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 8)
  - **Blocks**: Final verification
  - **Blocked By**: Task 6

  **References**:
  - `web/vite.config.ts`
  - `web/src/utils/platform.ts`
  - `web/src/utils/auth.ts`

  **Acceptance Criteria**:
  - [ ] `npx vitest run` passes with at least one test.
  - [ ] No component tests added.

  **QA Scenarios**:
  ```
  Scenario: Vitest runs minimal tests
    Tool: Bash
    Preconditions: Dependencies installed
    Steps:
      1. cd TmuxWeb/web
      2. npx vitest run
    Expected Result: Exit code 0 with at least 1 passing test
    Evidence: .sisyphus/evidence/task-7-vitest.txt

  Scenario: Build still succeeds after test setup
    Tool: Bash
  **QA Scenarios**:
  ```
  Scenario: Mobile app loads after import updates
    Tool: Playwright
    Preconditions: Dev server running
    Steps:
      1. Open http://localhost:5216/m
      2. Wait for selector ".mobile-app"
      3. Screenshot
    Expected Result: Mobile UI renders correctly
    Evidence: .sisyphus/evidence/task-5-mobile-layout.png

  Scenario: Mobile toolbox opens
    Tool: Playwright
    Preconditions: Dev server running
    Steps:
      1. Open /m
      2. Tap toolbox tab labeled "AI"
      3. Assert AI textarea exists
    Expected Result: Toolbox renders without errors
    Evidence: .sisyphus/evidence/task-5-mobile-toolbox.png
  ```
  **Must NOT do**:
  - Do not change backend/server code.

  **Recommended Agent Profile**:
  - **Category**: unspecified-high
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 7)
  - **Blocks**: Final verification
  - **Blocked By**: Task 6

  **References**:
  - `web/src/components/Terminal.tsx` — WS connection code and URL generation.
  - `web/src/utils/auth.ts` — token usage in WS URL.
  - `web/src/utils/platform.ts` — protocol/environment detection if used.

  **Acceptance Criteria**:
  - [ ] WS URL logged clearly (protocol + host + params).
  - [ ] WS connection succeeds or fails with explicit actionable error (not silent close).

  **QA Scenarios**:
  ```
  Scenario: WS connection uses correct protocol
    Tool: Playwright
    Preconditions: Dev server running; backend reachable
    Steps:
      1. Open http://localhost:5216/
      2. Observe console for WS URL log
    Expected Result: Log shows correct ws/wss URL and token
    Evidence: .sisyphus/evidence/task-8-ws-log.txt
  **QA Scenarios**:
  ```
  Scenario: Desktop route loads via dynamic import
    Tool: Playwright
    Preconditions: Dev server running
    Steps:
      1. Open http://localhost:5216/
      2. Ensure ".app" root exists and no blank screen
    Expected Result: Desktop UI renders
    Evidence: .sisyphus/evidence/task-6-desktop-dynamic.png

  Scenario: Mobile route loads via dynamic import
    Tool: Playwright
    Preconditions: Dev server running
    Steps:
      1. Open http://localhost:5216/m
      2. Ensure ".mobile-app" exists
    Expected Result: Mobile UI renders
    Evidence: .sisyphus/evidence/task-6-mobile-dynamic.png
  ```


- [ ] 7. Add Vitest base configuration and minimal tests

  **What to do**:
  - Add `vitest` to dev dependencies and a minimal `vitest.config.ts` (or `test` block in `vite.config.ts`).
  - Add a minimal test file targeting pure utilities (e.g. `platform.ts` or `auth.ts`).
  - Add npm script `test` or `test:unit`.

  **Must NOT do**:
  - Do not add React Testing Library or heavy component tests.

  **Recommended Agent Profile**:
  - **Category**: quick
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 8)
  - **Blocks**: Final verification
  - **Blocked By**: Task 6

  **References**:
  - `web/vite.config.ts` — existing build config to extend or keep separate.
  - `web/src/utils/platform.ts` — pure functions for isMobile/isIOS tests.
  - `web/src/utils/auth.ts` — token helpers to unit test (if pure).

  **Acceptance Criteria**:
  - [ ] `npx vitest run` passes with at least one test.
  - [ ] No component tests added.

  **QA Scenarios**:
  ```
  Scenario: Vitest runs minimal tests
    Tool: Bash
    Preconditions: Dependencies installed
    Steps:
      1. cd TmuxWeb/web
      2. npx vitest run
    Expected Result: Exit code 0 with at least 1 passing test
    Evidence: .sisyphus/evidence/task-7-vitest.txt

  Scenario: Build still succeeds after test setup
    Tool: Bash
    Preconditions: Dependencies installed
    Steps:
      1. cd TmuxWeb/web
      2. npm run build
    Expected Result: Build succeeds
    Evidence: .sisyphus/evidence/task-7-build.txt
  ```

- [ ] 8. Diagnose and fix WS connection failure in frontend

  **What to do**:
  - Inspect WS URL construction in `Terminal.tsx` (uses protocol + host + paneId + token).
  - Add logging for WS URL and connection errors (include readyState + close code).
  - Fix paneId double-encoding if present in upstream usage.
  - Ensure protocol selection accounts for TLS (ws vs wss).

  **Must NOT do**:
  - Do not change backend/server code.

  **Recommended Agent Profile**:
  - **Category**: unspecified-high
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 7)
  - **Blocks**: Final verification
  - **Blocked By**: Task 6

  **References**:
  - `web/src/components/Terminal.tsx` — `buildWsUrl()` uses protocol + host + paneId + token.
  - `web/src/utils/auth.ts` — token usage in WS URL.

  **Acceptance Criteria**:
  - [ ] WS URL logged clearly (protocol + host + params).
  - [ ] WS connection succeeds or fails with explicit actionable error (not silent close).

  **QA Scenarios**:
  ```
  Scenario: WS connection uses correct protocol
    Tool: Playwright
    Preconditions: Dev server running; backend reachable
    Steps:
      1. Open http://localhost:5216/
      2. Observe console for WS URL log
    Expected Result: Log shows correct ws/wss URL and token
    Evidence: .sisyphus/evidence/task-8-ws-log.txt

  Scenario: WS connection handshake succeeds
    Tool: Playwright
    Preconditions: Backend running
    Steps:
      1. Open desktop terminal view
      2. Verify no "closed before connection established" error
    Expected Result: Terminal connects without immediate close
    Evidence: .sisyphus/evidence/task-8-ws-connect.txt
  ```

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Verify deliverables, guardrails, evidence files, and scope fidelity. Output verdict with pass/fail per requirement.

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `npx tsc --noEmit`, `npm run build`, and `npx vitest run` in `TmuxWeb/web`. Check for lint issues, console noise, and unused imports.

- [ ] F3. **Real QA (Web)** — `unspecified-high` (+ `playwright` skill)
  Start dev server. Verify `/` and `/m` load, navigation works, and terminal connects. Capture screenshots and console logs to `.sisyphus/evidence/final-qa/`.

- [ ] F4. **Scope Fidelity Check** — `deep`
  Ensure no backend files touched; verify only frontend files changed per tasks.

---

## Commit Strategy

- 1 commit after all tasks: `refactor(web): split desktop and mobile frontends`

---

## Success Criteria

### Verification Commands
```bash
cd TmuxWeb/web
npm run build
npx tsc --noEmit
npx vitest run
```

### Final Checklist
- [ ] `/` loads desktop UI without errors
- [ ] `/m` loads mobile UI without errors
- [ ] Shared components live under `src/shared/`
- [ ] WS connection issue resolved or clearly diagnosed with actionable logs
- [ ] All guardrails respected
