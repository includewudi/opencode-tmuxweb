# Plan: Mobile Two-Finger Scroll — Gesture State Machine

## Context
Mobile terminal (`/m`) touch scrolling is broken in TUI apps like opencode. The root cause: xterm.js focuses its hidden textarea on the first finger's touchstart (before the second finger arrives), causing scroll gestures to be interpreted as cursor/arrow key input instead of tmux scrollback.

## Decisions (confirmed by user)
- **Gesture model B**: Two-finger swipe = scroll; single-finger tap = focus/type; single-finger drag = ignored
- **Keyboard behavior A**: Keep keyboard open during two-finger scroll (no hide/show churn)
- **Capture area**: `.xterm-screen` only (terminal canvas)

## File: `TmuxWeb/web/src/mobile/MobileTerminal.tsx`

### Task 1: Replace touch gesture handlers with state machine

**Replace** the entire touch gesture section (lines 133–233, from `// Touch swipe scrolling` comment through the `addEventListener` calls) with a new implementation:

#### State machine design:
```
type GestureState = 'idle' | 'oneFinger' | 'twoFingerScroll'
```

#### Variables to declare:
- `gesture: GestureState = 'idle'`
- `twoFingerStartY: number | null = null`
- `twoFingerAccum: number = 0`
- `clickBlockedUntil: number = 0` — timestamp; blocks xterm click-to-focus for 300ms after two-finger gesture ends

#### `onTouchStart` (capture: true, **passive: false**):
- `touches.length === 1`: set `gesture = 'oneFinger'`. Do NOT preventDefault (let xterm handle tap-to-focus naturally).
- `touches.length === 2`: 
  - Set `gesture = 'twoFingerScroll'`
  - `e.preventDefault()` + `e.stopPropagation()` — **critical**: blocks xterm's internal mousedown→focus chain
  - Record `twoFingerStartY` = midpoint of two touches
  - Reset `twoFingerAccum = 0`

#### `onTouchMove` (capture: true, passive: false):
- If `gesture === 'twoFingerScroll'` and `touches.length === 2`:
  - `e.preventDefault()` + `e.stopPropagation()`
  - Calculate midpoint deltaY, accumulate, call `sendScroll()` when exceeds `SCROLL_THRESHOLD`
- If `gesture === 'oneFinger'` and `touches.length === 2`:
  - Upgrade: set `gesture = 'twoFingerScroll'`, preventDefault, stopPropagation
  - Record twoFingerStartY from midpoint
- Otherwise: do nothing (single-finger drag is ignored per spec)

#### `onTouchEnd` / `onTouchCancel` (capture: true, passive: false):
- If `gesture === 'twoFingerScroll'`:
  - `e.preventDefault()` + `e.stopPropagation()` — prevents iOS click synthesis
  - Set `clickBlockedUntil = Date.now() + 300`
  - If `e.touches.length === 0`: reset `gesture = 'idle'`
  - If `e.touches.length === 1`: keep `gesture = 'twoFingerScroll'` (one finger lifted, other still down — stay in scroll mode until all fingers lifted)
- If `gesture === 'oneFinger'` and `touches.length === 0`: reset `gesture = 'idle'`

#### `onClick` handler on touchTarget (capture: true):
- If `Date.now() < clickBlockedUntil`: `e.preventDefault()` + `e.stopPropagation()` — blocks the synthesized click that iOS fires ~300ms after touchend, which would re-focus xterm textarea
- Otherwise: let it through (normal tap-to-focus)

#### `sendScroll(lines)` — keep existing logic unchanged:
- Alt screen (TUI): send arrow keys
- Normal pane: send SGR mouse wheel events

#### Event listener registration:
```ts
touchTarget.addEventListener('touchstart', onTouchStart, { capture: true, passive: false })
touchTarget.addEventListener('touchmove', onTouchMove, { capture: true, passive: false })
touchTarget.addEventListener('touchend', onTouchEnd, { capture: true, passive: false })
touchTarget.addEventListener('touchcancel', onTouchEnd, { capture: true, passive: false })
touchTarget.addEventListener('click', onClick, { capture: true })
```

#### Cleanup (return function):
Add removal of `touchcancel` and `click` listeners alongside existing removals.

### Task 2: Remove single-finger scroll variables

Remove from the touch section:
- `touchStartY` variable
- `touchAccum` variable  
- `isTwoFingerGesture` variable
- All single-finger scroll logic in `onTouchMove` (the `if (touchStartY === null || ...)` branch)

These are replaced by the state machine. Single-finger drag does nothing per the spec.

### Task 3: Keep `paneInAltScreen` detection and `sendScroll()` 

The `checkPaneMode()` fetch + interval and the `sendScroll()` function remain exactly as-is. Only the gesture detection changes; the scroll-sending logic is unchanged.

## No CSS changes needed

`global.css` is already correct:
- `.mobile-terminal-container .xterm-viewport { overflow-y: hidden !important; }` — keeps xterm from scrolling internally
- `.mobile-terminal-container .xterm-screen { touch-action: none; }` — prevents browser default touch gestures

## Verification

1. `npm run build` in `TmuxWeb/web` — must succeed
2. `pm2 restart tmuxweb-frontend`
3. `lsp_diagnostics` on `MobileTerminal.tsx` — no errors

## What to tell user after deploy
"Two-finger swipe up/down should now scroll in opencode. Single tap still focuses for typing. Test on your phone."
