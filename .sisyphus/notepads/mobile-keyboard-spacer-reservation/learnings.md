
# Mobile Keyboard Spacer Reservation - Learnings

---


## [2026-02-09] Discovery: TmuxWeb-right-pane-history-status Already Complete

### Finding: Prior Work Already Complete

Exploration revealed that the `tmuxweb-right-pane-history-status` plan was already fully implemented in prior sessions.

This session discovered:
- **Task 1-5** all completed with implementations verified
- Evidence files exist in `.sisyphus/evidence/`
- Boulder state updated to point to next plan

### Verified Implementations

**Backend Preview** ✅
- `generatePreview()` at `TmuxWeb/server/routes/summaries.js` lines 22-33

**Frontend Preview** ✅
- Type has `preview?: string`, `getPreview()` prioritizes candidate.preview

**Overwrite Confirmation** ✅
- `hasExistingSummary` check, confirmation modal implemented

**Status Sync** ✅
- `statusRefreshToken` state → TmuxTree refetch pattern complete

**QA Evidence** ✅
- All required files captured (task-1-candidates.json, task-2-picker-preview.png, task-3-cancel.png, task-3-after-overwrite.png, task-4-status-sync.png)

### Session Outcome

The `tmuxweb-right-pane-history-status` plan has been marked as complete.
Boulder updated to point to `mobile-keyboard-spacer-reservation` plan.


## [2026-02-09] Task 2: Keyboard Metrics Hook Extension

### Changes Made

Extended `useKeyboardAvoider.ts` to expose three new values per plan requirements:
- `keyboardVisible` (boolean alias for `isKeyboardVisible`)
- `keyboardHeightPx` (number alias for `keyboardHeight`)
- `keyboardSpacerHeightPx` (number - 0 when keyboard hidden or on desktop)

### Implementation Details

**Spacer Height Logic:**
```typescript
const keyboardSpacerHeightPx = enabledRef.current && metrics.isKeyboardVisible 
  ? metrics.keyboardHeight 
  : 0
```

Key conditions:
1. `enabledRef.current` - true only on mobile (`enabled && isMobile()`)
2. `metrics.isKeyboardVisible` - from `getKeyboardMetrics()` (threshold >100px)

### Keyboard Height Formula (from platform.ts)

```typescript
keyboardHeight = Math.max(0, layoutHeight - viewportHeight - visualViewport.offsetTop)
// where layoutHeight = window.innerHeight, viewportHeight = visualViewport.height
```

### Default Behavior

- If `visualViewport` missing → `getKeyboardMetrics()` returns `keyboardHeight: 0`, so spacer = 0
- Desktop: `isMobile()` is false → `enabledRef.current` is false → spacer = 0
- Debouncing: 100ms via existing mechanism

### Backward Compatibility

- Original interface properties retained (`keyboardHeight`, `isKeyboardVisible`, `containerStyle`)
- New properties are additive (no breaking changes)

---

## [2026-02-09] Task 1: Baseline + DOM Instrumentation

### Baseline DOM Analysis

**Desktop (1280x720):**
- scrollHeight: 720 (equals clientHeight)
- Has no page-level scroll
- visualViewport available: yes

**Mobile (390x844):**
- scrollHeight: 844 (equals clientHeight)
- Has no page-level scroll
- visualViewport available: yes
- Evidence captured: `.sisyphus/evidence/keyboard-baseline-mobile.png`

**Evidence Files Created:**
- `.sisyphus/evidence/keyboard-baseline-desktop.png` (37KB)
- `.sisyphus/evidence/keyboard-baseline-mobile.png` (6.7KB)

### DOM Instrumentation Implementation

**1. Window Helper (Debug-only)**
- Exposed at `window.__keyboardMetrics()` when `isDebugEnabled() && isMobile()`
- Returns object with:
  - `keyboardVisible` - boolean
  - `keyboardHeightPx` - number
  - `keyboardSpacerHeightPx` - number
  - `visualViewportHeight`, `visualViewportWidth`
  - `layoutHeight`, `layoutWidth`
- Properly cleaned up in useEffect cleanup function
- Mobile-only guard: `isMobile()` check
- Debug-only guard: `isDebugEnabled()` check

**2. Data Attributes (Mobile-only)**
- Added to `.terminal-wrapper` element
- Only rendered when `showAccessoryBar` is true (mobile only)
- Attributes exposed:
  - `data-keyboard-visible` → `keyboardVisible` boolean
  - `data-keyboard-height` → `keyboardHeightPx` number
  - `data-keyboard-spacer-height` → `keyboardSpacerHeightPx` number

### Files Modified

1. **`TmuxWeb/web/src/hooks/useKeyboardAvoider.ts`**
   - Added `isDebugEnabled` import
   - Extended `KeyboardAvoiderState` with new properties (backward compatible)
   - Added window helper initialization/cleanup in useEffect
   - Dependencies updated to include `metrics`

2. **`TmuxWeb/web/src/components/Terminal.tsx`**
   - Destructured new keyboard metrics from `useKeyboardAvoider`
   - Added three data attributes to terminal wrapper
   - Guarded by `showAccessoryBar` condition

### Verification

- ✅ TypeScript build passes (no LSP errors)
- ✅ No network calls added
- ✅ No manual-only debugging steps
- ✅ Mobile-only: guards on both `isMobile()` and `showAccessoryBar`
- ✅ Debug-only: window helper gated by `isDebugEnabled()`
- ✅ Both desktop and mobile have no page scrollbars in baseline
- ✅ Backward compatible: old API properties still available

### Architecture Decisions

1. **Data attributes**: Exposed on DOM for Playwright to read easily
2. **Window helper**: Exposed for complex queries or debugging without modifying HTML
3. **Mobile-first**: No desktop impact - all instrumentation desktop-agnostic
4. **Debug-gating**: Prevents production exposure of debug APIs
5. **Cleanup**: Proper cleanup of window helper in useEffect return function

### Ready for Task 2 & 3

- Instrumentation complete and verified
- Playwright can now read keyboard metrics via:
  - Data attributes: `wrapper.getAttribute('data-keyboard-visible')`
  - Window helper: `window.__keyboardMetrics()`
- Baseline evidence captured for comparison


## [2026-02-09] Task 3: Spacer-Based Layout in Terminal.tsx

### Implementation Summary

Replaced `paddingBottom`-driven keyboard avoidance with spacer-based layout pattern.

### Key Changes

**Terminal.tsx:**
1. Removed `containerStyle` and `isKeyboardVisible` from hook destructuring
2. Removed useEffect that called `fit()` on `isKeyboardVisible` change (per requirement: only fit on width/orientation)
3. Removed inline `style={containerStyle}` from wrapper div
4. Added `.keyboard-spacer` div as last child (mobile-only, guarded by `showAccessoryBar`)
5. Spacer height driven by `keyboardSpacerHeightPx` from hook

**Terminal.css:**
1. Added `overflow: hidden` to `.terminal-wrapper` to prevent body/html scrollbars
2. Added `.keyboard-spacer` class with:
   - `flex-shrink: 0` - ensures spacer maintains its height
   - `background: #0d0d0d` - matches AccessoryBar background
   - `transition: height 0.15s ease-out` - smooth keyboard open/close

### DOM Structure (Mobile)

```
.terminal-wrapper (overflow:hidden, 100dvh)
  ├── .terminal-container (flex:1, xterm with internal scroll)
  ├── .terminal-toolbar (absolute positioned)
  ├── AccessoryBar (flex child, 44px height)
  └── .keyboard-spacer (flex child, dynamic height from hook)
```

### Behavior

- **Keyboard hidden**: spacer height = 0, AccessoryBar sits at bottom
- **Keyboard visible**: spacer height = keyboardHeightPx, pushes AccessoryBar up
- **Desktop**: spacer not rendered (isMobile() check)
- **No fit() calls**: removed dependency on isKeyboardVisible to avoid xterm refit during keyboard transitions

### Why Push-Up Spacer vs paddingBottom

The spacer approach:
1. Creates actual DOM reservation (not just padding)
2. Better for flexbox layout - spacer participates in flex calculation
3. Easier to debug - visible element in DevTools
4. Cleaner separation - container doesn't know about keyboard

