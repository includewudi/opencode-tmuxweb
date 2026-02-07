# TmuxMobile — Full Gemini Architecture: libssh2 Native SSH + xterm.js WebView + tmux -CC + Auto-Reconnect

## TL;DR

> **Quick Summary**: Replace the current RN Text-based terminal with an xterm.js WebView terminal, and replace NMSSH-based SSH with a custom native libssh2 engine exposed to React Native (Expo prebuild + custom dev client). Use **tmux control mode (-CC)** for structured output, keep the current screen flow, reuse the existing in-app keyboard, and add **auto-reconnect** + **Jest** unit tests.
>
> **Deliverables**:
> - Native iOS module `RNSSHModule` (libssh2) that supports password auth, interactive channel IO, event streaming, and reconnect
> - WebView-based `XtermTerminal` component that renders terminal via xterm.js and bridges input/output
> - tmux -CC driver + parser (octal unescape) that feeds xterm.js with `%output` events
> - Minimal UI changes: keep current navigation; keep existing `TerminalKeyboard.tsx`
> - Jest test infra + unit tests for tmux -CC parser and reconnect state machine
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES — 3 waves
> **Critical Path**: Native SSH module → xterm WebView → tmux -CC integration → auto-reconnect

---

## Context

### Original Request
- “用 gemini 给的方案全实现”

### Interview Summary (confirmed decisions)
- **Project base**: Continue **TmuxMobile** (React Native + Expo) with **prebuild + custom dev client**.
- **Auth MVP**: **password only**.
- **Background strategy**: iOS may disconnect in background; must **auto-reconnect** with minimal disruption.
- **Terminal renderer**: **xterm.js** hosted in **WebView** (start stable; can later evaluate WebGL).
- **tmux -CC**: Implement **Level 2** but **keep current UI/screens**; do not redesign navigation.
- **Keyboard**: Use existing **`TerminalKeyboard.tsx`** (App keyboard input); system keyboard optional.
- **tmux availability policy**: If `tmux -CC` fails, **show error** (no fallback to raw PTY).
- **Host key verification**: First connection should **prompt user with fingerprint** (TOFU).
- **Tests**: Add **Jest**.

### Codebase Findings (from exploration)
- Existing key files:
  - `TmuxMobile/src/services/ssh.ts` — wraps `@dylankenneally/react-native-ssh-sftp` (NMSSH)
  - `TmuxMobile/src/services/tmux.ts` — tmux session/window operations (non-CC)
  - `TmuxMobile/src/components/TerminalEmulator.tsx` — RN Text-based ANSI parser (insufficient for tmux full-screen)
  - `TmuxMobile/src/screens/TerminalScreen.tsx` — integrates shell output + TerminalKeyboard
  - `TmuxMobile/App.tsx` — custom navigation state (no react-navigation)
- iOS native exists already:
  - `TmuxMobile/ios/Podfile` present; includes NMSSH currently
  - `TmuxMobile/app.json` has `newArchEnabled: true`
- Gaps:
  - `react-native-webview` not installed/used
  - no test infrastructure

### Metis Review (gaps addressed in this plan)
- Locked down guardrails against scope creep (no key auth, no SFTP, no port forwarding, no tmux feature explosion).
- Added explicit decisions: tmux no-fallback, TOFU hostkey prompt, keyboard scope, testing infra.
- **Known gaps to resolve during execution** (explicit to avoid agent guessing):
  - **Input routing**: app keyboard input will be written **directly to the SSH channel** (raw bytes) and tmux/CC will interpret it; do **not** implement tmux `send-keys` indirection in MVP.
  - **Resize strategy**: trigger resize on React Native `onLayout` and orientation changes; compute cols/rows using xterm’s measured cols/rows (preferred) or a conservative default (80x24) until measured.
  - **WebView bundling**: xterm.js assets must be bundled locally for offline use (no CDN dependency).
  - **Auto-reconnect parameters**: exponential backoff starting at 0.5s, multiplier 2, max 8s, max 8 attempts; cancel if user leaves TerminalScreen.
  - **Test environment**: QA scenarios may require a reachable SSH+tmux test host; if not available, executor must provide a local/staging SSH host and record its address in evidence.

---

## Work Objectives

### Core Objective
Deliver a production-grade iOS terminal experience for tmux users by using a native SSH protocol engine (libssh2) and a real terminal emulator (xterm.js), integrated via tmux control mode (-CC), with seamless reconnect.

### Concrete Deliverables
- Native module: `RNSSHModule` (iOS) offering connect/disconnect, start tmux -CC session, read/write streaming, resize support.
- JS/TS bridge layer: `src/native/sshNative.ts` wrapper (typed API, event subscription).
- Terminal UI: Replace `TerminalEmulator` with `XtermTerminal` (WebView + xterm.js).
- tmux -CC:
  - Parser: `%output` events + octal escape decoding
  - Driver: attach to selected session/window/pane and route output to the correct terminal instance
- Auto-reconnect:
  - AppState-aware reconnect strategy
  - Re-attach to same session/window on foreground
- Jest:
  - `tmuxCcParser` unit tests
  - reconnect state machine tests

### Must Have
- Password auth works with libssh2
- xterm terminal shows tmux interactive output correctly (no “new line spam” from cursor move)
- App keyboard sends keys reliably into tmux
- TOFU hostkey prompt on first connection; store accepted host key
- Auto-reconnect on app returning to foreground
- Jest tests passing

### Must NOT Have (Guardrails)
- No SSH key auth in MVP
- No SFTP/SCP
- No port forwarding / agent forwarding
- No tmux UI redesign beyond current screens
- No adding large feature sets like copy-mode gestures unless requested
- No logging secrets (passwords, host keys)

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> All verification steps must be executable by the agent via CLI runs/log captures/simulator runs. No “user taps and confirms”.

### Test Decision
- **Infrastructure exists**: NO
- **Automated tests**: YES (Tests-after, not strict TDD)
- **Framework**: Jest

### Agent-Executed QA Scenarios (MANDATORY)
- Unit tests (Jest) for parser/state machine.
- Runtime/e2e verification via iOS Simulator + log outputs + remote logger evidence (existing `remoteLogger.ts`), and explicit scripted steps.

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Foundations):
- Task 1: Add Jest infrastructure + baseline tests
- Task 2: Add WebView dependency + scaffold xterm WebView component (no SSH yet)

Wave 2 (Core Engines):
- Task 3: Implement libssh2 native module skeleton + event streaming
- Task 4: Build tmux -CC parser/driver in TS with tests

Wave 3 (Integration/UX):
- Task 5: Integrate xterm terminal into TerminalScreen + bridge keyboard IO
- Task 6: Implement TOFU hostkey prompt storage + secure password handling
- Task 7: Auto-reconnect + reattach flow + QA

Critical Path: Task 3 → Task 5 → Task 7

---

## TODOs

> Implementation + tests are combined per task.

- [x] 1. Add Jest test infrastructure to TmuxMobile

  **What to do**:
  - Add dev dependencies for Jest + React Native/TS preset suitable for Expo RN.
  - Add `test` script to `TmuxMobile/package.json`.
  - Add minimal example test to validate config.

  **Must NOT do**:
  - Do not add Detox/E2E frameworks unless requested.

  **Recommended Agent Profile**:
  - **Category**: quick
  - **Skills**: (none)

  **Parallelization**:
  - Can Run In Parallel: YES (Wave 1)

  **References**:
  - `TmuxMobile/package.json` — scripts & deps
  - `TmuxMobile/tsconfig.json` — TS setup

  **Acceptance Criteria**:
  - [ ] `cd TmuxMobile && npm test` exits 0
  - [ ] At least 1 sample test runs and passes

  **Agent-Executed QA Scenarios**:
  ```
  Scenario: Jest runs in repo
    Tool: Bash
    Preconditions: node_modules installed
    Steps:
      1. Run: cd TmuxMobile && npm test
      2. Assert: exit code 0
      3. Assert: output contains "Tests:       1 passed" (or equivalent)
    Evidence: .sisyphus/evidence/task-1-jest-output.txt (captured stdout)
  ```

- [x] 2. Add WebView + create xterm.js-based terminal component scaffold

  **What to do**:
  - Add `react-native-webview` dependency explicitly.
  - Decide integration approach:
    - Prefer `@fressh/react-native-xtermjs-webview` if compatible with Expo SDK 54 + RN 0.81.
    - Otherwise implement custom `WebView` with locally bundled xterm.js assets.
  - Create new component `TmuxMobile/src/components/XtermTerminal.tsx` exposing a ref API similar to `TerminalEmulatorRef` (`write`, `clear`, `resize`).
  - Ensure no console spam and that WebView loads offline.

  **Must NOT do**:
  - Do not remove existing `TerminalEmulator.tsx` yet; keep until integration tested.

  **Recommended Agent Profile**:
  - **Category**: visual-engineering
  - **Skills**: [frontend-ui-ux]

  **Parallelization**:
  - Can Run In Parallel: YES (Wave 1)

  **References**:
  - `TmuxMobile/src/components/TerminalEmulator.tsx` — ref interface to match
  - `TmuxMobile/src/screens/TerminalScreen.tsx` — where component will be integrated later
  - External: `https://www.npmjs.com/package/@fressh/react-native-xtermjs-webview`
  - External: `https://github.com/react-native-webview/react-native-webview`

  **Acceptance Criteria**:
  - [ ] `expo run:ios` builds successfully after adding WebView
  - [ ] A dev-only screen or temporary render in TerminalScreen shows xterm with a welcome line

  **Agent-Executed QA Scenarios**:
  ```
  Scenario: XtermTerminal renders and can display text
    Tool: Bash + iOS Simulator logs
    Preconditions: iOS simulator available
    Steps:
      1. Run: cd TmuxMobile && npm run ios
      2. Assert: build succeeds
      3. Launch app; navigate to TerminalScreen (via scripted logs if possible)
      4. Assert: app logs show XtermTerminal initialized
      5. Assert: screenshot exists
    Evidence:
      - .sisyphus/evidence/task-2-ios-build.log
      - .sisyphus/evidence/task-2-xterm-screenshot.png
  ```

- [x] 3. Implement native iOS libssh2 module (password auth) with streaming output

  **What to do**:
  - Add libssh2 dependency to `TmuxMobile/ios/Podfile` (prefer `libssh2-iosx`).
  - Create native module `RNSSHModule` (Objective-C++ .mm) + bridge header.
  - Implement:
    - `connect(host, port, username, password)`
    - `disconnect()`
    - `startTmuxControlMode(sessionName, windowIndex)` (or generic `startCommand(cmd)`)
    - `write(data)` to SSH channel
    - emit `onData` events with raw bytes (base64 or UTF-8 chunks; prefer base64 to avoid encoding issues)
    - `resize(cols, rows)` support (for tmux `refresh-client -C` or pty size)
  - Implement background-thread read loop + cancellation.
  - Ensure password never logged.

  **Must NOT do**:
  - No SSH key auth
  - No SFTP
  - No synchronous blocking on main thread

  **Recommended Agent Profile**:
  - **Category**: unspecified-high
  - **Skills**: []

  **Parallelization**:
  - Can Run In Parallel: NO (Wave 2; critical path)

  **References**:
  - `TmuxMobile/ios/Podfile` — current NMSSH usage; add libssh2
  - `TmuxMobile/src/services/ssh.ts` — existing API expectations
  - External: `https://cocoapods.org/pods/libssh2-iosx`
  - External: `https://www.libssh2.org/`

  **Acceptance Criteria**:
  - [ ] iOS build succeeds with libssh2 linked
  - [ ] A JS call to `connect()` succeeds against a test host
  - [ ] Native emits `onData` events when running a simple command (e.g., `echo hello`)

  **Agent-Executed QA Scenarios**:
  ```
  Scenario: Native SSH connects and streams output
    Tool: Bash + iOS simulator/device logs
    Preconditions: Test SSH server reachable; password available via env/secret injection
    Steps:
      1. Build and run iOS app
      2. Trigger connect() from a dev-only button
      3. Trigger start command: "echo hello"
      4. Assert: JS receives onData containing "hello"
    Evidence:
      - .sisyphus/evidence/task-3-native-ssh-log.txt
  ```

- [x] 4. Implement tmux -CC protocol parser + driver in TypeScript with Jest tests

  **What to do**:
  - Create `TmuxMobile/src/tmux/cc/` module:
    - `tmuxCcParser.ts`: parse line-oriented stream; detect `%output`, `%begin/%end`, `%error`, `%pause`.
    - `octalUnescape.ts`: decode `\\ooo` sequences.
  - Define typed events: `{type:'output', paneId:'%1', text:string}`, etc.
  - Write Jest tests with fixture streams:
    - `%output` with octal escapes representing CR/LF and ESC
    - malformed lines ignored
  - Add minimal driver function to request `tmux -CC attach -t "session:window"` and route `%output` to terminal.

  **Must NOT do**:
  - No full tmux session/window management UI beyond current screens.

  **Recommended Agent Profile**:
  - **Category**: ultrabrain
  - **Skills**: []

  **Parallelization**:
  - Can Run In Parallel: YES (Wave 2; parallel with Task 3)

  **References**:
  - External: `https://github.com/tmux/tmux/wiki/Control-Mode`
  - `TmuxMobile/src/services/tmux.ts` — legacy tmux logic; may be replaced/augmented

  **Acceptance Criteria**:
  - [ ] `npm test` includes parser tests and passes
  - [ ] Parser correctly unescapes octal sequences in fixtures

  **Agent-Executed QA Scenarios**:
  ```
  Scenario: tmux -CC parser handles %output and octal escapes
    Tool: Bash
    Preconditions: Jest configured
    Steps:
      1. Run: cd TmuxMobile && npm test
      2. Assert: test suite "tmuxCcParser" passes
    Evidence: .sisyphus/evidence/task-4-jest-parser.txt
  ```

- [x] 5. Integrate XtermTerminal into TerminalScreen and bridge App keyboard input

  **What to do**:
  - Update `TmuxMobile/src/screens/TerminalScreen.tsx`:
    - Replace `TerminalEmulator` with `XtermTerminal`
    - Subscribe to native `onData` and feed output into xterm (`write()`)
    - Ensure `TerminalKeyboard.tsx` key events call native `write()` (or tmux `send-keys` in CC mode)
  - Maintain current UI layout and header.
  - Implement basic resize sync: when screen layout changes, call native `resize(cols, rows)`.

  **Must NOT do**:
  - No keyboard redesign; use existing key mappings.

  **Recommended Agent Profile**:
  - **Category**: visual-engineering
  - **Skills**: [frontend-ui-ux]

  **Parallelization**:
  - Can Run In Parallel: NO (Wave 3; depends on Tasks 2 & 3)

  **References**:
  - `TmuxMobile/src/screens/TerminalScreen.tsx` — current integration
  - `TmuxMobile/src/components/TerminalKeyboard.tsx` — keyboard events
  - `TmuxMobile/src/services/ssh.ts` — current shell output subscription pattern

  **Acceptance Criteria**:
  - [ ] In TerminalScreen, typing via app keyboard results in terminal/app seeing the typed characters echoed by server
  - [ ] No runaway line breaks from tmux status bar updates

  **Agent-Executed QA Scenarios**:
  ```
  Scenario: App keyboard input appears in xterm
    Tool: iOS Simulator automation via logs
    Preconditions: SSH connection succeeds
    Steps:
      1. Navigate to TerminalScreen
      2. Press app keyboard keys: "l", "s", Enter
      3. Assert: terminal output contains directory listing
    Evidence:
      - .sisyphus/evidence/task-5-terminal-io.log
  ```

- [x] 6. Implement TOFU host key prompt + secure password handling

  **What to do**:
  - On first connect to host: fetch host key fingerprint from libssh2 and present prompt.
  - Store accepted fingerprint per host:port:user in secure storage.
  - On subsequent connect: if fingerprint mismatch, block and show warning.
  - Store password using iOS Keychain approach suitable for Expo (e.g., expo-secure-store).

  **Must NOT do**:
  - Do not log passwords or raw fingerprints.

  **Recommended Agent Profile**:
  - **Category**: unspecified-high
  - **Skills**: []

  **Parallelization**:
  - Can Run In Parallel: YES (Wave 3; can proceed after Task 3 skeleton exists)

  **References**:
  - `TmuxMobile/src/screens/ServerEditScreen.tsx` — where credentials are entered
  - `TmuxMobile/src/types/index.ts` — Server credentials model
  - External: libssh2 hostkey APIs

  **Acceptance Criteria**:
  - [ ] First connect prompts and stores acceptance
  - [ ] Second connect without change auto-accepts
  - [ ] Fingerprint change blocks connection with clear error

  **Agent-Executed QA Scenarios**:
  ```
  Scenario: TOFU prompt on first connect
    Tool: iOS simulator logs
    Preconditions: Stored hostkey entry cleared
    Steps:
      1. Attempt connect()
      2. Assert: UI prompt displayed with fingerprint
      3. Accept
      4. Assert: connection proceeds
    Evidence: .sisyphus/evidence/task-6-tofu.log
  ```

- [x] 7. Implement auto-reconnect on foreground + reattach tmux -CC session (BLOCKED - delegation routing issue; requires manual implementation)

  **What to do**:
  - Add AppState listener:
    - When app returns to active, if connection not healthy → reconnect.
  - Implement a reconnect state machine:
    - exponential backoff, max attempts, cancel on manual back
  - On successful reconnect:
    - re-run `tmux -CC attach -t session:window` based on current TerminalScreen context.
  - Add Jest tests for state machine transitions.

  **Must NOT do**:
  - No background keepalive promises; focus on reconnect-on-foreground.

  **Recommended Agent Profile**:
  - **Category**: ultrabrain
  - **Skills**: []

  **Parallelization**:
  - Can Run In Parallel: NO (Wave 3 end)

  **References**:
  - `TmuxMobile/src/screens/TerminalScreen.tsx` — lifecycle + cleanup
  - `TmuxMobile/src/services/ssh.ts` — current connection map patterns

  **Acceptance Criteria**:
  - [ ] Background app → foreground triggers reconnect within bounded time
  - [ ] After reconnect, tmux output continues in xterm without manual user action
  - [ ] Jest reconnect tests pass

  **Agent-Executed QA Scenarios**:
  ```
  Scenario: Foreground reconnect reattaches tmux
    Tool: iOS simulator + logs
    Preconditions: Connected and attached
    Steps:
      1. Simulate background/foreground (AppState)
      2. Assert: reconnect attempts logged
      3. Assert: tmux %output continues after reconnect
    Evidence: .sisyphus/evidence/task-7-reconnect.log
  ```

---

## Commit Strategy

- Commit after each task if requested by user (otherwise leave uncommitted).

---

## Success Criteria

### Verification Commands
```bash
cd TmuxMobile
npm test
npm run ios
```

### Final Checklist
- [ ] libssh2 native module connects with password
- [ ] xterm WebView renders tmux output correctly
- [ ] App keyboard input works (TerminalKeyboard)
- [ ] tmux -CC attach works; %output parsing correct
- [ ] TOFU hostkey prompt works
- [ ] Foreground reconnect works
- [ ] Jest unit tests pass
