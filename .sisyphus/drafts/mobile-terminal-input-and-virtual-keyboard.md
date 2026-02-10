# Draft: Mobile terminal input issues + virtual keyboard

## Requirements (confirmed)
- iOS PWA still occasionally produces phantom spaces after reconnect/focus; want iOS-specific filtering and/or additional iOS logging.
- Phantom input occurs with keyboard both shown and hidden (user report).
- PWA/first load performance regressed again (slow initial load; white screen/resources slow). Likely prod/dev mode regression or caching.
- Restart default mode must be Production-first: `npm run build` then `pm2 restart tmuxweb-backend` and `pm2 restart tmuxweb-frontend`.
- This must be enforced in BOTH start script and PM2 ecosystem config (prevent regression).
- Plan a keyboard-avoidance layout: when mobile keyboard pops up (Android/iOS), leave space so terminal remains usable.
- Add an on-screen “virtual keyboard” bar with best-in-class UX.
  - Minimum keyset chosen: Esc / Tab / Ctrl(toggle) / Space / Arrows (←↑↓→) / Paste.
  - Reference UX: Termius (mobile).

## Technical Decisions (pending)
- Whether to add a centralized `utils/platform.ts` and what it exports (isIOS/isAndroid/isStandalonePWA/keyboardHeight).
- iOS-only mitigation strategy package:
  - Option to disable xterm focus reporting (DEC mode 1004): `\x1b[?1004l`.
  - iOS-only telemetry hooks + event timeline logging.
  - iOS-only suppression for high-frequency phantom Space/Enter bursts.
- Keyboard avoidance approach:
  - Prefer `visualViewport`-based measurement + CSS `100dvh`.
  - Safari lacks `interactive-widget`; must feature-detect.
- Paste behavior for iOS:
  - Use Clipboard API when allowed; fallback instructions otherwise.

## Research Findings
- Codebase uses xterm.js (web: v5.3.0) with FitAddon only; no clipboard/webLinks/attach addons currently.
- Phantom input on iOS Safari/PWA is commonly tied to helper textarea focus/blur and xterm focus reporting.
- Mitigation recommended by research:
  - Disable focus reporting mode 1004 (`\x1b[?1004l`).
  - Add iOS-only filtering of known sequences AND burst suppression for Space/Enter.
  - Instrument focus/blur/visibilitychange + visualViewport resize to correlate events.
- Mobile terminal UX best practices:
  - Use `100dvh` not `100vh`.
  - Use `VisualViewport` API to compute keyboard height.
  - Apply safe-area insets.
  - Accessory bar buttons should be >=44px touch targets.

## Open Questions
- Which iOS versions/devices are affected (e.g., iOS 16/17/18; iPhone model)?
- Phantom input shape: user suspects (1) auto continuous spaces OR (3) spaces plus other keys; not yet confirmed by logs.
- Is phantom input only after reconnect/visibility change, or also during normal use?
- Do we want to introduce xterm clipboard addon vs custom Paste button using Clipboard API?
- Should the virtual keyboard bar be always visible on mobile, or only when terminal is focused / keyboard open?

## Scope Boundaries
- INCLUDE: platform-specific logging + filtering adjustments; keyboard-aware layout; Termius-inspired accessory key bar (Esc/Tab/Ctrl/Space/Arrows/Paste); production-first restart flow in start script + pm2 config.
- EXCLUDE (for now): full custom soft keyboard, IME deep fixes, advanced key mapping beyond selected set.
