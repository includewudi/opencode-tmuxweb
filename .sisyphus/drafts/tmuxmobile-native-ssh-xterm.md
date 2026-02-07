# Draft: TmuxMobile — Native SSH Engine + xterm.js Rendering Layer

## Requirements (confirmed)
- Implement Gemini-proposed architecture end-to-end:
  - Native SSH engine using **libssh2** compiled into iOS app
  - Bridge raw byte stream to JS layer
  - Rendering layer using **xterm.js** in **WebView** (with WebGL acceleration if possible)
  - Maintain a virtual terminal state via xterm.js (no line-based emulation)
  - Support **auto-reconnect** with minimal user disruption (background may disconnect)
  - Add **tmux -CC** control mode support for structured events and native UI mapping (Level 2)
- Project base choice: **(1) Continue TmuxMobile (React Native + Expo)**
- Expo approach: **Route A** — accept **prebuild + custom dev client** to enable native modules
- SSH auth (MVP): **password only**
- App keyboard input: **Option A** — reuse existing `TerminalKeyboard.tsx` patterns; system keyboard optional
- UI mapping: **keep current screens/UI** (ServerList → ServerDetail → Terminal) with minimal UI churn; add only necessary CC-driven behaviors
- Tests: **Add Jest** for unit tests (tmux -CC parser / reconnect logic / service helpers)

## Technical Decisions (tentative)
- iOS target: React Native + Expo project (TmuxMobile)
- Native integration: likely requires **prebuild** / custom dev client (Expo) or bare RN
- SSH engine: libssh2 + sockets + encryption handled native-side
- PTY: decide whether to provide pure channel shell vs PTY resizing APIs exposed to JS
- Terminal rendering: WebView hosts xterm.js; JS feeds data via postMessage; keystrokes returned to native

## Research Findings
- Current line-based terminal emulator cannot support tmux full-screen control sequences reliably; xterm.js is recommended.
- tmux status bar refresh emits cursor positioning sequences (e.g., \x1b[24;1H) that break naive renderers.

## Open Questions
- Expo constraints: Are we willing to eject/prebuild to add native module? (required for libssh2)
- Target OS versions and background behavior expectation (minutes vs hours)
- Authentication support: password + private key + passphrase + agent forwarding?
- Desired tmux -CC UX: what native UI elements (session/window/pane list, tabs, gestures)?
- Security expectations: keychain storage, known_hosts verification, host key pinning.

## Scope Boundaries
- INCLUDE: iOS implementation primarily (Gemini plan is iOS-focused)
- EXCLUDE (unless requested): Android parity, full SFTP file browser, AI Gemini integration
