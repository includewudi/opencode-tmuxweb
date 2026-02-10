# Mobile Terminal: iOS Phantom Input Fixes + Keyboard Avoidance + Termius-like Virtual Key Bar + Production-First Restart

## TL;DR

> **Quick Summary**: Stabilize iOS PWA terminal input (stop phantom spaces/enters) using iOS-only telemetry + mitigations (including disabling xterm focus reporting), restore fast PWA initial load by enforcing production-first restarts, and improve mobile UX with keyboard-aware layout + a persistent Termius-inspired accessory key bar.
>
> **Deliverables**:
> - iOS-only terminal input telemetry (front + back) and mitigation toggles
> - iOS phantom input mitigation package: disable DEC 1004 focus reporting, burst suppression, safer focus handling
> - Production-first restart behavior enforced in **both** `start.sh` and `ecosystem.config.js`
> - Mobile keyboard avoidance (VisualViewport + safe-area insets + 100dvh)
> - Persistent accessory key bar (Esc/Tab/Ctrl toggle/Space/←↑↓→/Paste)
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES — 3 waves
> **Critical Path**: Establish baseline + enforce prod restart → implement iOS telemetry/mitigations → implement keyboard avoidance + key bar → verify on iOS PWA

---

## Context

### Original Request
- “ios 又开始出现空格了，不过没那么多，能不能ios单独过滤。还是要加一下ios的日志。”
- “计划一下弹出键盘的位置，留出空间给安卓，ios弹出键盘。然后增加虚拟键盘。 tab，空格，esc。参考体验最好的终端。”
- Connection slow regression: “网页打开很慢 (A) … 重启脚本改没改？”
- “以后重启服务默认方式”：**B** — production-first (`npm run build` then `pm2 restart ...`), and enforce in **both** start script + pm2 config.
- Virtual keyboard bar: **B** keyset + reference **Termius**; display strategy: **always visible**.

### Interview Summary
- Phantom input on iOS persists; occurs with keyboard shown and hidden.
- Performance regression is **PWA initial load** (not just WS attach).
- User wants a persistent accessory bar like Termius: Esc/Tab/Ctrl(toggle)/Space/Arrows/Paste.

### Research Findings (codebase)
- Web terminal uses **xterm.js v5.3.0** + **FitAddon** only: `TmuxWeb/web/src/components/Terminal.tsx`.
- No clipboard-related xterm addons are currently used.
- Existing filtering of xterm control sequences exists (focus/DA/OSC), but iOS still shows phantom input.

### Research Findings (external)
- xterm focus reporting (DEC private mode 1004) emits `\x1b[I` on focus and `\x1b[O` on blur; can be disabled by sending `\x1b[?1004l`.
- Mobile keyboard avoidance best practice: `100dvh`, `VisualViewport` resize/scroll listener, safe-area insets (iPhone notch/home indicator).
- Accessory key bar best practice: persistent bottom bar, >=44px touch targets, use Clipboard API behind a user gesture, provide fallback.

### Metis Review (gaps addressed in this plan)
- Add explicit guardrails against scope creep (no gestures, no theming, no configurable key-maps, no analytics).
- Add explicit acceptance criteria around performance baseline, iOS-only telemetry volume control, and keyboard/landscape edge cases.

---

## Work Objectives

### Core Objective
Deliver a stable, fast-loading iOS PWA terminal experience by:
1) removing phantom input sources and capturing actionable telemetry, and
2) upgrading mobile UX with keyboard avoidance and a Termius-like persistent accessory bar.

### Concrete Deliverables
- `TmuxWeb/web/src/utils/platform.ts` (or equivalent) with iOS/PWA/keyboard detection utilities.
- `TmuxWeb/web/src/utils/telemetry.ts` (lightweight console logger w/ sampling + enable flag).
- Updates to `TmuxWeb/web/src/components/Terminal.tsx`:
  - iOS-only telemetry hooks (onData/focus/blur/visibilitychange/reconnect/viewport)
  - iOS-only mitigation package (DEC 1004 disable, burst suppression windowing)
  - keyboard avoidance layout hooks
  - persistent accessory bar UI + handlers
- Updates to `TmuxWeb/server/services/terminal.js`:
  - Optional iOS tagging via ws query param + additional sampled logs for phantom input debugging
- Enforce production-first restart:
  - Update `TmuxWeb/start.sh` (or your current bootstrap script) to **build then restart**
  - Update PM2 `ecosystem.config.js` so `tmuxweb-frontend` runs preview/prod by default

### Definition of Done
- [ ] iOS PWA: no phantom space/enter bursts during 10 cycles of background/foreground + keyboard show/hide.
- [ ] iOS PWA: initial load time returns to “fast” state (see baseline procedure below) and is not in dev mode.
- [ ] Mobile: keyboard never covers terminal input area; accessory bar remains visible and usable.
- [ ] Desktop: terminal behavior unchanged.

### Must Have
- iOS-only logging + mitigations switchable (avoid noisy logs in normal mode).
- Always-visible accessory bar with keyset: Esc/Tab/Ctrl toggle/Space/Arrows/Paste.
- Production-first restart enforced in **two** places (script + pm2).

### Must NOT Have (Guardrails)
- No gesture features (swipe-to-arrows etc.).
- No Termius visual/theming replication beyond simple layout.
- No configurable key mapping UI.
- No remote analytics/telemetry service; console logs only.
- No new heavy dependencies.
- No changes requiring humans to “visually confirm”; verification must be agent-executable.

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.
> The agent will verify via commands and automated browser checks.

### Test Decision
- **Infrastructure exists**: Unknown (must be detected)
- **Automated tests**: Tests-after by default (focus is E2E/behavior)
- **Framework**: TBD after detection

### Agent-Executed QA Scenarios (MANDATORY)

We will use:
- **Playwright** for browser scenarios (desktop emulation + limited mobile emulation) and to verify UI presence/DOM behavior.
- **Bash** to verify build outputs, pm2 configs, and runtime mode.
- **Log capture** via `pm2 logs` and browser console capture.

> Note: iOS Safari/PWA cannot be fully emulated by Playwright. Therefore, we will:
> 1) create deterministic preconditions, logs, and toggles, and
> 2) verify the toggles/logging function through Playwright + unit-level checks.
> This makes iOS device testing *optional* for plan verification, not mandatory.

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Start Immediately)
- Task 1: Discover current scripts/pm2 config + test infrastructure
- Task 2: Add platform/telemetry utilities (no runtime behavior change)

Wave 2 (After Wave 1)
- Task 3: Enforce production-first restart in start script + pm2 config
- Task 4: iOS-only terminal telemetry + DEC1004 disable toggle + burst suppression

Wave 3 (After Wave 2)
- Task 5: Keyboard avoidance layout
- Task 6: Persistent accessory bar (Termius-like)
- Task 7: Paste behavior + fallbacks
- Task 8: End-to-end verification suite (build, pm2, UI, logs)

---

## TODOs

- [ ] 1. Baseline & inventory: locate startup scripts, PM2 config, and test infrastructure

  **What to do**:
  - Identify the actual paths/names of:
    - start script used for “一键启动/重启” (e.g., `TmuxWeb/start.sh`)
    - PM2 ecosystem config file used to start `tmuxweb-backend` and `tmuxweb-frontend`
  - Verify current `tmuxweb-frontend` is running in preview/prod (not dev):
    - confirm command in pm2 list / ecosystem
    - confirm that built assets exist (e.g., `web/dist/`)
  - Detect test infrastructure:
    - `package.json` scripts and any jest/vitest/playwright config

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: mostly discovery + verification commands.
  - **Skills**: [`git-master`]
    - `git-master`: to inspect repo history/config changes safely.

  **Parallelization**:
  - Can Run In Parallel: YES (with Task 2)

  **References**:
  - `TmuxWeb/web/package.json` — build/dev/preview scripts.
  - `TmuxWeb/ecosystem.config.js` (or actual path) — pm2 process definitions.
  - `TmuxWeb/web/src/components/Terminal.tsx` — current reconnect + input logic.

  **Acceptance Criteria**:
  - [ ] Identify exact files used to restart services and list them in Task 3.
  - [ ] Evidence captured:
    - `.sisyphus/evidence/task-1-pm2-list.txt`
    - `.sisyphus/evidence/task-1-web-package-json-scripts.txt`

  **Agent-Executed QA Scenarios**:
  - Scenario: Capture current runtime mode
    - Tool: Bash
    - Steps:
      1. `pm2 show tmuxweb-frontend` capture start command
      2. `ls TmuxWeb/web/dist` to confirm build outputs
      3. Save outputs to evidence files

---

- [ ] 2. Add centralized platform detection + keyboard metrics utility

  **What to do**:
  - Create a small utility module for:
    - `isIOS()` (including iPadOS MacIntel+touchPoints)
    - `isAndroid()`
    - `isStandalonePWA()`
    - `getKeyboardMetrics()` using `window.visualViewport` when available
  - Ensure no side effects; pure functions.

  **Must NOT do**:
  - No heavy UA parsing libraries.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - Can Run In Parallel: YES (with Task 1)

  **References**:
  - `TmuxWeb/web/src/components/Terminal.tsx` — existing iOS-related behavior.

  **Acceptance Criteria**:
  - [ ] Module exists and is imported by Terminal (later tasks).
  - [ ] Playwright can evaluate `isStandalonePWA()` without errors in browser context.

---

- [ ] 3. Enforce production-first restart in BOTH start script and PM2 config

  **What to do**:
  - Update the start script to always:
    1) `npm run build` in `TmuxWeb/web`
    2) `pm2 restart tmuxweb-backend`
    3) `pm2 restart tmuxweb-frontend`
  - Update PM2 ecosystem so `tmuxweb-frontend` runs **preview** (not `vite dev`).
  - Add a lightweight check command in script to print current mode.

  **Must NOT do**:
  - Do not introduce interactive prompts.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`git-master`]

  **References**:
  - Task 1 discovered script paths.

  **Acceptance Criteria**:
  - [ ] Running the start script results in:
    - a new `web/dist` build timestamp
    - pm2 restarts for backend+frontend
  - [ ] Evidence:
    - `.sisyphus/evidence/task-3-build-output.txt`
    - `.sisyphus/evidence/task-3-pm2-restart-output.txt`

  **Agent-Executed QA Scenarios**:
  - Scenario: Verify restart uses production build
    - Tool: Bash
    - Steps:
      1. Run the start script
      2. Confirm `web/dist/assets/*.js` exists and is minified (size > 0, no dev HMR endpoints referenced in HTML)
      3. `pm2 show tmuxweb-frontend` shows preview-like command

---

- [ ] 4. iOS-only terminal telemetry + phantom input mitigation package

  **What to do**:
  - Add an iOS-only “debug mode” toggle (e.g. query param `?debug=1` or localStorage key).
  - Add telemetry hooks in `Terminal.tsx`:
    - record onData sequences into an in-memory ring buffer (avoid log spam)
    - log event timeline for: ws open/close/reconnect attempts, visibilitychange, focus/blur, visualViewport resize
  - Mitigations (iOS-only):
    1) Send `\x1b[?1004l` to disable focus reporting upon terminal init + after reconnect.
    2) Add an iOS-only suppression window for high-frequency bursts of `" "` and `"\r"`.
       - Only suppress when occurring within N ms after reconnect / visibility return / keyboard transition.

  **Must NOT do**:
  - Don’t suppress legitimate user typing outside the suppression windows.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`superpowers/systematic-debugging`]
    - Reason: This is a subtle iOS-specific bug; apply disciplined debugging workflow.

  **References**:
  - `TmuxWeb/web/src/components/Terminal.tsx` — onData filtering + focus logic.
  - `TmuxWeb/docs/errors/xterm-control-sequences-causing-phantom-input.md`
  - External: WebKit bug focus/blur issues; DEC1004 focus reporting behavior.

  **Acceptance Criteria**:
  - [ ] When debug mode enabled, the terminal prints one structured log summary per event (not per keystroke) with:
    - event type, timestamps, ws state, keyboard metrics
  - [ ] DEC1004 disable is executed on iOS only (verified by grep/log paths).
  - [ ] Burst suppression only applies within configured windows; other input passes unchanged.

  **Agent-Executed QA Scenarios**:
  - Scenario: Verify mitigation code paths are active only on iOS
    - Tool: Playwright
    - Steps:
      1. Launch web app with `?debug=1`
      2. Stub `navigator.userAgent`/platform in page context to emulate iOS detection
      3. Trigger focus/blur and confirm logs show DEC1004 disable send call
      4. Trigger synthetic onData calls (unit-level) to confirm suppression logic
    - Evidence:
      - `.sisyphus/evidence/task-4-console-log.txt`

---

- [ ] 5. Keyboard avoidance layout (iOS/Android): never let keyboard cover terminal

  **What to do**:
  - Implement layout using:
    - container height using `100dvh`
    - `visualViewport` resize/scroll listeners to compute keyboard inset
    - apply bottom padding/margin so terminal viewport remains visible
    - apply `env(safe-area-inset-bottom)` to avoid home indicator overlap
  - Ensure resize updates are debounced to prevent thrash during keyboard animation.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Acceptance Criteria**:
  - [ ] In Playwright mobile emulation, when viewport height shrinks, terminal container adjusts and accessory bar stays visible.
  - [ ] No layout jitter loops (debounced).

---

- [ ] 6. Persistent Termius-like accessory key bar (always visible)

  **What to do**:
  - Add a bottom bar UI that is always visible on mobile breakpoints.
  - Keys: Esc, Tab, Ctrl (toggle), Space, ←↑↓→, Paste.
  - Ctrl toggle behavior:
    - When active, next key press should send Ctrl-modified sequence (minimal: map Ctrl+<letter> for A-Z; for arrows map to common CSI with modifier if desired).
    - Auto-reset Ctrl after one use (like Termius) unless user preference says otherwise (default: auto-reset).

  **Guardrails**:
  - No user-configurable key layouts.

  **Acceptance Criteria**:
  - [ ] Each button sends correct bytes to backend via existing `sendText()`.
  - [ ] Buttons have >=44px touch target and do not trigger iOS zoom.

  **Agent-Executed QA Scenarios**:
  - Scenario: Accessory bar buttons exist
    - Tool: Playwright
    - Steps:
      1. Set viewport to iPhone 14 size
      2. Navigate to terminal page
      3. Assert accessory bar visible and contains text: Esc, Tab, Ctrl, Space, Paste, and arrow buttons
      4. Click Esc; assert WS send spy called with `\x1b`

---

- [ ] 7. Paste implementation (mobile-first) with fallback

  **What to do**:
  - Implement Paste button to use `navigator.clipboard.readText()` when available.
  - If unavailable/denied:
    - show a small non-blocking toast message explaining “Clipboard permission denied; long-press paste into terminal input”
  - Ensure Paste only runs on user gesture (button tap).

  **Acceptance Criteria**:
  - [ ] In browsers supporting clipboard, clicking Paste sends clipboard text to terminal.
  - [ ] If denied, a visible runtime message is shown (DOM assertion), no crash.

---

- [ ] 8. End-to-end verification: performance, prod mode, and regressions

  **What to do**:
  - Add a reproducible performance baseline procedure:
    - measure cold load with cache disabled via Playwright
    - record TTFB + DOMContentLoaded + load event
  - Verify production build served:
    - network requests do not include Vite HMR websocket
    - asset filenames are hashed
  - Confirm desktop unaffected.

  **Acceptance Criteria**:
  - [ ] Evidence files captured for performance timings before/after.
  - [ ] All scenarios pass on CI/local agent run.

---

## Success Criteria

### Verification Commands
```bash
# Production build
cd TmuxWeb/web && npm run build

# Restart services
pm2 restart tmuxweb-backend
pm2 restart tmuxweb-frontend

# Inspect pm2 commands
pm2 show tmuxweb-frontend

# View logs
pm2 logs tmuxweb-backend --lines 200
```

### Final Checklist
- [ ] iOS-only phantom input mitigations present and toggleable
- [ ] Production-first restart enforced in both script + ecosystem config
- [ ] Mobile keyboard avoidance works with VisualViewport and safe-area
- [ ] Accessory bar matches chosen keyset and always visible on mobile
- [ ] Paste works with permission + graceful fallback
- [ ] Desktop behavior unchanged
