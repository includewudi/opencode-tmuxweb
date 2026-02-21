# Draft: Mobile two-finger scroll (avoid xterm focus conflicts)

## Requirements (confirmed)
- On iOS touch screen, scrolling in TUI (opencode) is broken/conflicting.
- Desired gesture model: **Option B** — **two-finger swipe scrolls**, single finger does NOT scroll.
- Two-finger swiping currently causes focus to remain in xterm textarea/opencode input, resulting in arrow-key-like behavior instead of scroll.

## Observed Implementation (code references)
- `TmuxWeb/web/src/mobile/MobileTerminal.tsx`
  - Custom touch scroll handler currently installed on `.xterm-screen` (or container).
  - `touchstart` listener uses `{ passive: true }` (cannot preventDefault early).
  - Prior implementation handled only single-finger; we added two-finger mid-point tracking.
  - Focus behavior exists elsewhere: `toggleKeyboard()` explicitly focuses `.xterm-helper-textarea`.

- `TmuxWeb/web/src/styles/global.css`
  - `.mobile-terminal-container .xterm-viewport { overflow-y: hidden !important; }` disables xterm internal scroll.
  - `.mobile-terminal-container .xterm-screen { touch-action: none; }` disables browser default touch gestures.

- Backend scroll-mode detection
  - `TmuxWeb/server/routes/tmux.js:/pane-mode` returns `{ alternate_on, mouse_any_flag }` from tmux format vars.
  - Mobile uses `paneInAltScreen = alternate_on && mouse_any_flag` to choose between arrow keys vs SGR mouse wheel.

## Root Cause Hypothesis
- xterm focuses its hidden textarea on first finger `touchstart` (touches=1) before second finger arrives.
- Because our `touchstart` listener is passive, we cannot preventDefault to block xterm focus.
- Blurring on two-finger start occurs too late; focus already moved to textarea, and subsequent scroll attempts appear as cursor movement.

## Technical Decisions
- Adopt **gesture state machine**: two-finger scroll only; single finger tap focuses (to type); single finger drag does nothing.
- Ensure we can block xterm default focus on gesture start by using non-passive listeners and/or pointer capture.

## Open Questions
- Should two-finger scroll work even when keyboard is visible? (likely YES)
- Should single-finger drag be ignored entirely, or reserved for future text selection? (default: ignore)

## Scope Boundaries
- INCLUDE: Mobile (`/m`) terminal gesture handling + focus management to avoid conflicts.
- EXCLUDE: Desktop terminal behavior; tmux server changes unless required.
