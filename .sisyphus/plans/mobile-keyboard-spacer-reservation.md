# Mobile Keyboard Spacer Reservation (TmuxWeb Terminal)

## TL;DR

> **Quick Summary**: Redesign the mobile keyboard avoidance in TmuxWeb’s terminal so that when the system keyboard opens, the app **reserves space via a bottom spacer (撑高型占位)** instead of shrinking/splitting the terminal or creating page scrollbars.
>
> **Deliverables**:
> - Terminal layout updated to include a **keyboard spacer element** (mobile-only)
> - Updated keyboard metrics hook (or new hook) that exposes a **spacer height** driven by `visualViewport`
> - CSS/layout guardrails that prevent **body/page scrolling** and eliminate the “terminal split into two parts” symptom
> - Agent-executed QA scenarios + evidence artifacts in `.sisyphus/evidence/`
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES — 2 waves
> **Critical Path**: Baseline reproduction → Spacer layout implementation → QA/evidence

---

## Context

### Original Request (verbatim)
- “滑动条存在问题，要么app把 输入法的框预留空间，终端显示成2部分”
- “就是终端大小不改变，弹出的输入法，预先用一块占位”
- “移动端需要这样设计，留出键盘占位空间”

### Interview Summary (decisions)
- **Mobile keyboard behavior**: must reserve keyboard occupied space.
- **Spacer mode**: **push-up / reserve space** (撑高型占位), **not overlay**.
- **Implementation location**: inside `Terminal.tsx` (self-contained; user agreed).
- **Intent**: keep terminal area stable; eliminate double-scroll/split feeling.

### Metis Review (gaps addressed in this plan)
Metis flagged missing guardrails + acceptance criteria around:
- target platforms (iOS vs Android)
- visualViewport reliability assumptions
- explicit “no body scrollbars” criteria
- edge cases: orientation changes, delayed viewport events

This plan incorporates:
- explicit platform scope defaults (iOS Safari primary, Android Chrome best-effort)
- clear “must not” guardrails (no overlay; no body scrolling; avoid xterm fit on keyboard transitions)
- agent-executable acceptance criteria and evidence outputs

---

## Work Objectives

### Core Objective
Implement a **mobile-only keyboard spacer reservation** pattern so that keyboard appearance does not break terminal layout, create extra scrollbars, or visually split the terminal.

### Concrete Deliverables
- Terminal layout supports **Spacer** element with dynamic height when keyboard is visible.
- Keyboard height computation exposes `keyboardSpacerHeightPx` (0 when not visible).
- Page-level scrollbars eliminated during keyboard open/close.
- Playwright-based verification produces screenshots + JSON metrics evidence.

### Definition of Done
- [ ] In mobile emulation, opening a focusable input (or simulated keyboard metrics) causes `keyboardSpacerHeightPx > 0` and terminal layout remains continuous.
- [ ] `document.documentElement.scrollHeight <= document.documentElement.clientHeight + 1` during keyboard reserved state (no page scroll).
- [ ] Evidence files saved under `.sisyphus/evidence/` for keyboard open + close states.

### Must Have
- Mobile-only behavior: desktop must remain unchanged.
- Spacer is **push-up** reservation (DOM occupies space), not overlay.

### Must NOT Have (Guardrails)
- MUST NOT add polling/SSE/new websocket mechanisms.
- MUST NOT require human visual confirmation.
- MUST NOT introduce overlay spacer.
- MUST NOT create page-level scroll (no body/html scrollbars).
- SHOULD NOT add fancy animations; simple height transition only if necessary.
- SHOULD NOT refactor unrelated terminal behavior.

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> All verification must be agent-executable via Playwright and shell commands, producing concrete evidence files.

### Test Decision
- **Infrastructure exists**: NO (no established unit/integration test framework was identified in earlier work)
- **Automated tests**: None (for this change)
- **Agent-Executed QA**: PRIMARY verification method (Playwright)

### Agent-Executed QA Scenarios (applies to all tasks)

We will verify via Playwright mobile viewport + DOM assertions + screenshots.

**Evidence directory**: `.sisyphus/evidence/`

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Start Immediately):
- Task 1: Baseline reproduction + add instrumentation/DOM hooks for measurement
- Task 2: Adjust keyboard metrics hook to expose spacer height data

Wave 2 (After Wave 1):
- Task 3: Implement spacer-based layout in `Terminal.tsx` + CSS guardrails
- Task 4: Playwright QA scenarios + evidence capture

Critical Path: Task 1 → Task 3 → Task 4

---

## TODOs

- [x] 1. Establish baseline + add measurable DOM hooks for keyboard/layout state
- [x] 2. Update keyboard metrics logic to compute a dedicated `keyboardSpacerHeightPx`
- [x] 3. Implement spacer-based layout inside `Terminal.tsx` (mobile-only)

  **What to do**:
  - Replace/avoid `paddingBottom`-driven avoidance for mobile.
  - Render a spacer element as the last child in the terminal layout:
    - Example: `<div className="keyboard-spacer" style={{ height: keyboardSpacerHeightPx }} />`
  - Ensure the overall terminal wrapper prevents page scrollbars:
    - Terminal page root uses `overflow: hidden`
    - Xterm container uses its own internal scroll
  - Keep AccessoryBar behavior intact; ensure it sits above the spacer (so accessory bar is usable while keyboard is up).
  - Avoid calling xterm `fit()` on keyboard open/close transitions (only do it on width/orientation changes).

  **Must NOT do**:
  - Do not move spacer responsibility to global page layout.
  - Do not add overlay-based hacks.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: layout/overflow interplay needs careful iteration.
  - **Skills**: `playwright`
    - `playwright`: necessary to validate no scrollbars and capture evidence.

  **Parallelization**:
  - Can Run In Parallel: NO
  - Parallel Group: Wave 2
  - Blocks: Task 4
  - Blocked By: Task 1, Task 2

  **References**:
  - `TmuxWeb/web/src/components/Terminal.tsx` — implement layout changes here.
  - `TmuxWeb/web/src/components/Terminal.css` — update CSS for `.keyboard-spacer` and overflow.
  - `TmuxWeb/web/src/components/AccessoryBar.tsx` + `.css` — ensure stacking order & positioning.

  **Acceptance Criteria**:
  - [ ] In mobile viewport with simulated keyboard metrics, `.keyboard-spacer` exists and its computed height equals `keyboardSpacerHeightPx`.
  - [ ] Page scrollbars remain absent:
    - `document.documentElement.scrollHeight <= document.documentElement.clientHeight + 1`
    - `window.scrollY === 0`
  - [ ] Evidence captured:
    - `.sisyphus/evidence/keyboard-spacer-open.png`
    - `.sisyphus/evidence/keyboard-spacer-close.png`

  **Agent-Executed QA Scenarios**:

  Scenario: Keyboard spacer reserves space without page scrollbars
    Tool: Playwright
    Preconditions: App served at http://localhost:8215/
    Steps:
      1. Set viewport: 390x844
      2. Navigate to: http://localhost:8215/
      3. Simulate keyboard open via visualViewport shrink + resize event
      4. Assert: `.keyboard-spacer` is visible (exists in DOM)
      5. Assert: `getComputedStyle(.keyboard-spacer).height` > 0
      6. Assert: no page scrollbars via scrollHeight/clientHeight
      7. Screenshot: `.sisyphus/evidence/keyboard-spacer-open.png`
      8. Simulate keyboard close (restore visualViewport)
      9. Assert: spacer height == 0
      10. Screenshot: `.sisyphus/evidence/keyboard-spacer-close.png`
    Expected Result: Reserving space is stable and non-scrollable


- [x] 4. Add Playwright end-to-end verification suite + evidence capture for key edge cases

  **What to do**:
  - Create a Playwright run (ad-hoc script or test file depending on repo conventions) that:
    - Validates desktop unchanged (no spacer rendered)
    - Validates mobile spacer behavior (open/close)
    - Validates orientation change handling (simulate width/height swap; spacer recomputes)
    - Captures evidence screenshots + JSON metrics

  **Must NOT do**:
  - Do not require real iOS keyboard; keep tests deterministic via simulation.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `playwright`

  **Parallelization**:
  - Can Run In Parallel: NO
  - Parallel Group: Wave 2
  - Blocks: None
  - Blocked By: Task 3

  **References**:
  - Existing evidence approach from prior plan: `.sisyphus/evidence/task-8-*.png/json` patterns.

  **Acceptance Criteria**:
  - [ ] Evidence files exist:
    - `.sisyphus/evidence/keyboard-spacer-desktop-noop.png`
    - `.sisyphus/evidence/keyboard-spacer-open.png`
    - `.sisyphus/evidence/keyboard-spacer-close.png`
    - `.sisyphus/evidence/keyboard-spacer-orientation.json`
  - [ ] All Playwright runs exit 0.

  **Agent-Executed QA Scenarios**:

  Scenario: Desktop does not render keyboard spacer
    Tool: Playwright
    Preconditions: App served at http://localhost:8215/
    Steps:
      1. Viewport: 1280x720
      2. Navigate to app
      3. Assert: `.keyboard-spacer` does NOT exist
      4. Screenshot: `.sisyphus/evidence/keyboard-spacer-desktop-noop.png`
    Expected Result: Desktop unchanged

  Scenario: Orientation change recomputes layout without scrollbars
    Tool: Playwright
    Preconditions: Mobile viewport, spacer logic implemented
    Steps:
      1. Set viewport: 390x844
      2. Simulate keyboard open
      3. Swap viewport to 844x390 (landscape)
      4. Dispatch resize events
      5. Assert no scrollbars
      6. Save JSON metrics: `.sisyphus/evidence/keyboard-spacer-orientation.json`
    Expected Result: No split, no scrollbars

---

## Commit Strategy

- Commit after Task 3 + 4 together (single coherent fix + verification evidence).

---

## Success Criteria

### Final Checklist
- [ ] Mobile keyboard reservation uses push-up spacer (not overlay)
- [ ] Terminal no longer visually “splits into two parts” under keyboard reservation
- [ ] No page-level scrollbars during keyboard open/close
- [ ] Desktop unaffected
- [ ] Evidence artifacts present in `.sisyphus/evidence/`
