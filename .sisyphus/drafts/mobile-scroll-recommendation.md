# Draft: Recommendation — iOS two-finger scroll without focus conflicts

## Goal
Improve iOS touch scrolling in TmuxWeb mobile terminal (`/m`) so that scroll gestures do not fight with xterm textarea focus / opencode input.

## Recommended UX (best experience)
- **Two-finger swipe** on terminal area scrolls (tmux scrollback)
- **Single-finger tap** focuses and types (existing xterm behavior)
- **Single-finger drag** does nothing (avoid accidental scroll + doesn't fight text selection)
- When keyboard is already visible, **two-finger scroll keeps keyboard open** (A) but prevents focus churn/click synthesis.

## Recommended Gesture Capture Area
- Capture gestures on `.xterm-screen` (canvas display area) for predictability.
- If the user starts two-finger gesture slightly outside `.xterm-screen`, it may miss; can optionally widen capture to `.mobile-terminal-container` as enhancement.

## Why this model is smoother
- Separates concerns: one-finger = input/selection; two-finger = navigation/scroll.
- Minimizes unintended focus changes and phantom arrow-key/cursor moves.
- Aligns with iOS conventions (two-finger scroll inside non-scrollable canvas areas).

## Technical implications
- Need non-passive `touchstart` in capture phase to block xterm focus path when detecting 2 touches.
- Must prevent click synthesis after two-finger gesture ends (touchend/cancel) to stop xterm receiving a click that re-focuses textarea.
- Must implement a small state machine: `pendingTap` → `twoFingerScroll`.

