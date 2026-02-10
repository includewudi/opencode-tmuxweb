# Task 1: Baseline + DOM Instrumentation - COMPLETE ✅

## Execution Date
2026-02-09 15:18 - 15:32 UTC

## Objective
Establish baseline + add measurable DOM hooks for keyboard/layout state.

From plan: Task 1 requires establishing a deterministic way for Playwright to read keyboard/layout state without a real iOS keyboard, capturing baseline evidence for both desktop and mobile.

## Completed Tasks

### 1. DOM Structure Inspection ✅
- Analyzed current terminal page DOM structure
- Identified no scrollbars on both desktop and mobile baselines
- Confirmed `.terminal-wrapper` is the main keyboard avoidance container

### 2. Added Debug-Only Window Helper ✅
**Location:** `TmuxWeb/web/src/hooks/useKeyboardAvoider.ts`

Window function exposed as `window.__keyboardMetrics()` when:
- `isDebugEnabled()` returns true
- `isMobile()` returns true

**Returns:**
```javascript
{
  keyboardVisible: boolean,
  keyboardHeightPx: number,
  keyboardSpacerHeightPx: number,
  visualViewportHeight: number,
  visualViewportWidth: number,
  layoutHeight: number,
  layoutWidth: number,
}
```

### 3. Added Data Attributes to Terminal ✅
**Location:** `TmuxWeb/web/src/components/Terminal.tsx`

Data attributes on `.terminal-wrapper`:
- `data-keyboard-visible` - boolean value
- `data-keyboard-height` - numeric value (pixels)
- `data-keyboard-spacer-height` - numeric value (pixels)

**Guard:** Only added when `showAccessoryBar` is true (mobile-only)

### 4. Instrumentation is Mobile-Only ✅
**Verification:**
- Data attributes: Conditional on `showAccessoryBar` (true only on mobile)
- Window helper: Conditional on `isMobile()` AND `isDebugEnabled()`
- Both properly cleaned up in useEffect cleanup functions
- No production UI impact

### 5. Baseline Evidence Captured ✅

**Desktop (1280x720):**
- File: `.sisyphus/evidence/keyboard-baseline-desktop.png` (37 KB)
- Status: No page scrollbars (`scrollHeight === clientHeight`)
- DOM ready: `hasTerminalWrapper` exists

**Mobile (390x844):**
- File: `.sisyphus/evidence/keyboard-baseline-mobile.png` (6.7 KB)
- Status: No page scrollbars (`scrollHeight === clientHeight`)
- DOM ready: `hasTerminalWrapper` exists

## Implementation Details

### useKeyboardAvoider Hook Changes

**New exports in KeyboardAvoiderState:**
- `keyboardHeightPx` (alias for keyboardHeight)
- `keyboardVisible` (alias for isKeyboardVisible)
- `keyboardSpacerHeightPx` (computed as: keyboard visible && mobile ? keyboardHeight : 0)

**Window helper initialization:**
```typescript
if (isDebugEnabled() && isMobile()) {
  (window as any).__keyboardMetrics = () => ({
    keyboardVisible: metrics.isKeyboardVisible,
    keyboardHeightPx: metrics.keyboardHeight,
    keyboardSpacerHeightPx: metrics.isKeyboardVisible ? metrics.keyboardHeight : 0,
    visualViewportHeight: vv?.height ?? window.innerHeight,
    visualViewportWidth: vv?.width ?? window.innerWidth,
    layoutHeight: window.innerHeight,
    layoutWidth: window.innerWidth,
  })
}
```

### Terminal Component Changes

**Updated hook usage:**
```typescript
const { 
  containerStyle, 
  isKeyboardVisible, 
  keyboardHeightPx, 
  keyboardVisible, 
  keyboardSpacerHeightPx 
} = useKeyboardAvoider(...)
```

**Data attributes in JSX:**
```tsx
<div 
  className="terminal-wrapper" 
  style={containerStyle}
  data-keyboard-visible={showAccessoryBar ? keyboardVisible : undefined}
  data-keyboard-height={showAccessoryBar ? keyboardHeightPx : undefined}
  data-keyboard-spacer-height={showAccessoryBar ? keyboardSpacerHeightPx : undefined}
>
```

## Verification Results

✅ Build passes: `npm run build` → 0 errors
✅ TypeScript: No LSP diagnostics errors
✅ Backward compatible: Old API unchanged
✅ Mobile-only: Guards on `isMobile()` and `showAccessoryBar`
✅ Debug-only: Window helper gated by `isDebugEnabled()`
✅ No new network calls
✅ No polling or SSE
✅ Proper cleanup: Listeners and window helper cleaned up
✅ Evidence files created: baseline for desktop and mobile

## Files Modified

1. `TmuxWeb/web/src/hooks/useKeyboardAvoider.ts`
   - Added telemetry import
   - Extended interface with keyboard metrics
   - Added window helper initialization/cleanup

2. `TmuxWeb/web/src/components/Terminal.tsx`
   - Extracted additional metrics from hook
   - Added data attributes to wrapper (mobile-only)

## Playwright Integration Ready

Playwright scripts can now read keyboard metrics via:

**Method 1: Data Attributes (mobile only)**
```javascript
const wrapper = document.querySelector('.terminal-wrapper');
const keyboardVisible = wrapper.getAttribute('data-keyboard-visible');
const keyboardHeight = wrapper.getAttribute('data-keyboard-height');
const spacerHeight = wrapper.getAttribute('data-keyboard-spacer-height');
```

**Method 2: Window Helper (debug + mobile only)**
```javascript
const metrics = window.__keyboardMetrics?.();
// Returns: { keyboardVisible, keyboardHeightPx, keyboardSpacerHeightPx, ... }
```

## Next Steps

- **Task 2**: Update keyboard metrics logic to compute `keyboardSpacerHeightPx`
  - Status: Already implemented in useKeyboardAvoider
  - Ready for QA scenarios

- **Task 3**: Implement spacer-based layout in Terminal.tsx
  - Requires: Spacer element rendering
  - Dependencies: Task 1 & 2 (COMPLETE)

- **Task 4**: Add Playwright QA scenarios
  - Can validate against baseline evidence
  - Window helper ready for metrics collection

## Acceptance Criteria Met

✅ A Playwright script can read current computed keyboard spacer height via DOM attribute or window helper
✅ Evidence captured:
  - `.sisyphus/evidence/keyboard-baseline-desktop.png`
  - `.sisyphus/evidence/keyboard-baseline-mobile.png`
✅ Instrumentation is mobile-only and does not affect production UI
✅ No page-level scrollbars present in baseline (verified)
✅ All changes backward compatible

---

**Status: READY FOR TASK 2**
