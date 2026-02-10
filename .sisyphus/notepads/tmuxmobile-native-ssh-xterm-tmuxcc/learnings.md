# TmuxMobile Jest Setup Learnings

## Jest Configuration for Expo React Native Projects

### Challenge: Dependency Conflicts
- React 19.1.0 was incompatible with `@testing-library/react-native@12.9.0` which requires `react-test-renderer@^19.2.4`
- **Solution**: Used `npm install --legacy-peer-deps` to override peer dependency validation
- This is acceptable for test infrastructure setup since the conflict is in dev dependencies only

### Challenge: Babel Configuration
- Initial jest.config.js used `preset: 'react-native'` which loaded Babel configs from node_modules
- Error: `Cannot find module 'react-native-worklets/plugin'` - the preset tried to load a plugin not installed
- **Solution**: Removed `preset: 'react-native'` and used minimal config with `testEnvironment: 'node'`
- This works well for unit tests that don't need React Native runtime (which is appropriate for parser/state machine tests)

### Challenge: Setup File Syntax
- Initial jest.setup.js used ES6 `import` syntax
- Jest in Node environment requires CommonJS `require()`
- **Solution**: Changed to `const { TextEncoder } = require('util');`

### Successful Setup
- Jest runs successfully with TypeScript support via `ts-jest`
- ts-jest configured to use `jsx: 'react-jsx'` for React component tests
- Example tests validate the full pipeline works
- `npm test` exits with code 0 on success

### Dependency Versions Selected
- `jest@^29.7.0` - latest stable for Node projects
- `ts-jest@^29.1.2` - TypeScript transformer
- `@types/jest@^29.5.12` - TypeScript definitions
- `@testing-library/react-native@^12.9.0` - React Native testing utilities

### Future Considerations
- For components requiring React Native runtime, consider Detox or Expo testing library
- Parser tests (tmux -CC parser) and state machine tests are ideal for Jest + ts-jest
- Add coverage thresholds once test suite grows
- Can use `transformIgnorePatterns` if native modules need special handling

## Files Created
- `jest.config.js` - Main Jest configuration
- `jest.setup.js` - Polyfill setup (TextEncoder)
- `__tests__/example.test.tsx` - Minimal validation tests
- Updated `package.json` with `test` script and dev dependencies

## Task 2: XtermTerminal WebView Component

### Integration Approach
- Decided against @fressh/react-native-xtermjs-webview (v0.0.8) because:
  - Only 5 versions, low adoption
  - Uses Uint8Array for write() API instead of string
  - Adds additional dependency complexity
- Implemented custom WebView with inline xterm.js HTML for:
  - Full API control (string-based write/clear/resize/scrollToEnd)
  - Offline fallback capability
  - Simpler debugging

### XtermTerminalRef API
```typescript
export interface XtermTerminalRef {
  write: (data: string) => void;
  clear: () => void;
  resize: (cols: number, rows: number) => void;
  scrollToEnd: () => void;
}
```

### Key Implementation Details
- Uses CDN for xterm.js with graceful fallback to simple text terminal
- WebView injects JavaScript commands via `injectJavaScript()`
- Message bridge: WebView.postMessage -> onMessage handler
- Pending writes queue for commands before WebView ready

### Pre-existing Issues Discovered
1. NMSSH library in @dylankenneally/react-native-ssh-sftp has architecture mismatch
   - libcrypto.a built for iOS, not iOS-simulator
   - Blocks simulator builds
2. Missing react-native-worklets babel plugin blocks Metro bundling

### TODO for True Offline Support
Replace CDN xterm.js with bundled assets (currently uses CDN with fallback)


## Task 4: tmux -CC protocol parsing

- Jest unit tests are easiest to add under `src/**/__tests__/*.test.ts` (picked `src/tmux/cc/__tests__` for CC-specific fixtures).
- `octalUnescape` handles only tmux-style `\\ooo` (3 octal digits) escapes; invalid/incomplete sequences are left as-is.
- `TmuxCcParser` is a minimal line-buffering parser: accumulate chunks, split on `\n`, normalize optional `\r`, then emit typed events for `%output/%begin/%end/%error/%pause`.
- The driver can reuse the existing `sshService.startShell` / `sshService.onShellOutput` streaming pattern and only routes `%output` events; other events are currently ignored by the terminal renderer.

## Task 3: libssh2 Native Module Learnings

### libssh2-iosx Pod Issues
- The `libssh2-iosx` pod has build script issues with OpenSSL/CMake on macOS
- Build fails during `prepare_command` phase when building OpenSSL from source
- Alternative: Use NMSSH pod which bundles a pre-built libssh2

### NMSSH as libssh2 Provider
- NMSSH includes libssh2 headers at: `Pods/NMSSH/NMSSH-iOS/Libraries/include/libssh2/`
- Can use `#include <libssh2/libssh2.h>` to access C API directly
- This allows using raw libssh2 without NMSSH's Objective-C wrapper
- Simulator builds fail due to libcrypto.a architecture mismatch

### React Native Event Emitter Pattern
- Extend `RCTEventEmitter` and implement `RCTBridgeModule`
- Override `supportedEvents` to declare event names
- Override `startObserving`/`stopObserving` for listener lifecycle
- Use `sendEventWithName:body:` to emit events

### Background Thread Pattern
- Use `dispatch_queue_create` for serial SSH queue
- All SSH operations on background queue via `dispatch_async`
- Emit events on main queue via nested `dispatch_async(dispatch_get_main_queue(), ...)`
- Use `usleep(10000)` for non-blocking read loop polling

## Task 5: XtermTerminal Integration

### Key findings:
- SSHService uses listener pattern (`onShellOutput`, `onError`) - no NativeEventEmitter needed
- XtermTerminal WebView handles data as strings, no base64 encoding required
- Resize calculation: charWidth=9px, charHeight=17px at 14px font size
- Layout changes trigger `onLayout` → calculate cols/rows → call `resize()`
- terminalReady state tracks WebView initialization (though not currently gated)
- Existing keyboard handlers (handleKeyPress, handleSpecialKey) work without changes

## Task 6: TOFU Host Key + Secure Password

### Key Learnings
- `libssh2_hostkey_hash()` returns host key fingerprint after handshake, before auth
- Use LIBSSH2_HOSTKEY_HASH_SHA256 (32 bytes) with SHA1 fallback (20 bytes)
- expo-secure-store uses iOS Keychain with `WHEN_UNLOCKED_THIS_DEVICE_ONLY` 
- SecureStore keys have restrictions - base64 encode identifiers with non-alphanumeric replaced
- React Native doesn't have Buffer globally - use custom base64 decode
- Split connect into handshake/authenticate phases for TOFU flow

### Files Created
- `src/storage/secureStorage.ts` - Password/hostkey secure storage
- `src/components/HostKeyPrompt.tsx` - TOFU verification UI
- `src/services/nativeSSH.ts` - Native SSH service with TOFU integration

### Native Module Changes
- Added `handshake:port:` method - returns fingerprint before auth
- Added `authenticate:password:` method - completes auth after TOFU
- Added `getHostKeyFingerprintHex` helper using libssh2_hostkey_hash

### Security Notes
- Passwords stored in iOS Keychain, never logged
- Host key fingerprints hashed before storage (additional layer)
- Mismatch shows warning, blocks connection (MITM detection)

## Task 7: Auto-reconnect on AppState changes

### Current Status
- Tasks 1-6 complete
- Task 7 implementation pending
- TerminalScreen.tsx missing AppState listeners
- No reconnect state machine exists

### Key Requirements
- Add AppState listener: when app returns to active, if connection not healthy → reconnect
- Reconnect state machine: exponential backoff, max attempts, cancel on manual back
- On successful reconnect: re-run `tmux -CC attach -t session:window` based on TerminalScreen context
- Jest tests for state machine transitions
- Parameters: backoff starting at 0.5s, multiplier 2, max 8s, max 8 attempts
- Cancel reconnect if user leaves TerminalScreen

### Implementation Approach
- Use `AppState` from 'react-native'
- Implement reconnect state machine in TerminalScreen or separate service
- Preserve session:window context on reconnect
- On reconnect failure after max attempts, show error in xterm
- Add Jest tests for state transitions (connected/disconnected/reconnecting states)

## Task 7.1: AppState Listener Implementation

### Implementation Details
- Added `AppState` import to TerminalScreen.tsx from 'react-native'
- Created useEffect hook that subscribes to AppState changes via `AppState.addEventListener('change', ...)`
- Listener checks connection health when app returns to 'active' state using `sshService.isConnected(server.id)`
- Added comprehensive logging via remoteLogger:
  - Logs setup/cleanup of listener
  - Logs state changes with state value
  - Logs connection health check results
- Added placeholder comment "TODO: Trigger reconnect via reconnectStateMachine" for next subtask
- Placeholder code writes yellow warning to terminal if connection is unhealthy

### Key Technical Notes
- AppState listener is dependency-cleaned in useEffect return - calls `.remove()` on subscription
- Dependencies: [server.id] - recreates listener if server changes (correct since we check server.id)
- Integration point for reconnectStateMachine: replace TODO placeholder in "Connection unhealthy" branch
- No actual reconnect logic yet - this task is detection only

### TypeScript Status
- Compilation succeeded with no errors
- All imports and types are correct

## Task 7.2: ReconnectStateMachine Integration

### Implementation Details
- Imported `ReconnectStateMachine` and `ReconnectContext` types from utils
- Created `reconnectMachineRef` to hold state machine instance across renders
- Added `reconnectingState` state to track state changes for UI updates
- Initialized ReconnectStateMachine in a useEffect with callbacks:
  - **onReconnectAttempt**: Disconnects SSH connection, waits 100ms, reconnects, and calls attachToWindow
  - **onStateChange**: Updates UI with colored status messages in terminal (yellow for reconnecting, green for success, red for failure)
- Replaced TODO placeholder with actual `reconnectMachineRef.current?.triggerReconnect()` call when connection unhealthy
- Added cleanup: call `reconnectMachineRef.current?.cancel()` in handleDisconnect when user manually disconnects

### Key Behaviors
- When app returns to active state with unhealthy connection, triggers async reconnect with exponential backoff
- Displays attempt counter in yellow: "Attempting to reconnect (2/8)..."
- On success: clears error state and shows "Reconnected successfully!" in green
- On max attempt failure: shows error message and transitions to failed state
- Cleanup ensures no orphaned reconnect timers if component unmounts

### Connection Restoration Flow
1. App returns to foreground → AppState listener fires
2. sshService.isConnected() checks health
3. If unhealthy → triggerReconnect() starts state machine
4. State machine waits (currentDelay), calls onReconnectAttempt callback
5. Callback: disconnect → wait 100ms → connect → attachToWindow
6. Success: onStateChange called, "Reconnected successfully!" shown
7. Failure: retries with exponential backoff up to 8 attempts

### TypeScript Validation
- Jest tests pass (12 passed, 3 suites)
- No TypeScript compilation errors
- All imports and type signatures correct

## Task 7.3: ReconnectStateMachine Jest Tests

### Test Coverage
- Created comprehensive test suite at `TmuxMobile/src/utils/__tests__/reconnectStateMachine.test.ts`
- 63 total tests passing across all suites
- Tests cover all transition types and state machine behaviors

### Key Test Patterns
- **Pure function tests**: Use `transition()` function directly to test state logic
- **Class tests**: Use `ReconnectStateMachine` class for lifecycle and callback testing
- **Helper tests**: Test `createInitialContext()` and `calculateNextDelay()` utilities
- **State sequence tests**: Test realistic flow patterns (connect → connected → reconnecting → etc.)

### Test Categories Implemented
1. **Basic utilities**: Context initialization, delay calculation with caps
2. **All transition types**: CONNECT, CONNECT_SUCCESS, CONNECT_FAILURE, DISCONNECT, TRIGGER_RECONNECT, RECONNECT_SUCCESS, RECONNECT_FAILURE, CANCEL, RESET
3. **State machine class**: Initialization, getters, dispatch methods, callbacks
4. **Realistic flows**: 
   - Successful connect sequence (idle → connecting → connected)
   - Failed connect → failed state
   - Reconnect with exponential backoff
   - Cancel/cleanup on disconnect
   - Max attempts boundary conditions
   - State reset functionality

### Important Implementation Details
- `TRIGGER_RECONNECT` only works from 'connected', 'idle', or 'failed' states (not from 'reconnecting')
- `RECONNECT_FAILURE` doesn't increment attemptCount - only `TRIGGER_RECONNECT` does
- Max attempts check happens on both TRIGGER_RECONNECT and RECONNECT_FAILURE
- Exponential backoff: delay multiplied by 2, capped at 8000ms
- On successful connection: attemptCount reset to 0, currentDelay reset to initialDelay

### Test Execution
- All 63 tests pass (4 test suites: example, octalUnescape, tmuxCcParser, reconnectStateMachine)
- TypeScript compilation: No errors
- LSP diagnostics: Clean

### Comment Guidelines
- Test comments removed where code is self-explanatory
- Kept minimal inline comments only for complex exponential backoff calculations (where test expectations verify exact multiplier math)
- No docstrings needed - test names clearly express intent

### Future Considerations
- Timer warning about process exit: Normal for async state machine tests with setTimeout
- Could add integration tests with actual ReconnectStateMachine.triggerReconnect() async flow
- Coverage metrics could be tracked if thresholds added to jest.config.js
