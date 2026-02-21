# Terminal Management App - Parallel Task Graph

## TL;DR

> **Quick Summary**: Implement two independent features: Web terminal font size slider (6-12px) with localStorage persistence, and React Native drawer navigator to replace custom state navigation with iOS-style sidebar.
>
> **Deliverables**:
> - Stream A: `web/app/src` files modified for dynamic fontSize (useTerminal.js, TerminalPane.jsx, App.jsx, BottomToolbox.jsx)
> - Stream B: `TmuxMobile/src` files created/modified (AppNavigator.tsx, SessionTreeSidebar.tsx, App.tsx refactor)
> - Both streams verified with build passes and LSP diagnostics
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 parallel streams (Wave 1), sequential verification (Wave 2)
> **Critical Path**: Task A/B (parallel) → Task C/D (sequential)

---

## Context

### Original Request
Complete 3 remaining tasks:
1. **Web: Terminal font size slider (6-12px)** — Mobile web terminal font adjustable via drag/slider, persisted in localStorage
2. **RN: Drawer navigator (AppNavigator.tsx)** — Replicate iOS NavigationSplitView with sidebar + content
3. **RN: SessionTreeSidebar + App.tsx refactor** — Extract sidebar, replace useState navigation with Drawer

### Interview Summary

**Key Discussions**:
- Test strategy: NO automated tests for either stream. Runtime verification only (build passes, LSP clean)
- Web has no test infrastructure; RN has Jest but user declined using it
- Two fully independent streams that can run in parallel
- User provided React Navigation Drawer API patterns from librarian research

**Research Findings**:
- RN test infrastructure exists (Jest + @testing-library/react-native) but will not be used
- React Navigation Drawer patterns: custom drawer content, route params, programmatic control, responsive drawer, GestureHandlerRootView requirement
- Current App.tsx uses custom `useState<NavigationState>` with manual screen switching

### Metis Review

**Identified Gaps (addressed)**:

**Critical Questions Resolved**:
- [✅] Global vs per-tab fontSize → Default: Global (applies to all tabs)
- [✅] Slider placement in BottomToolbox → Default: Inline in quick-key row, additive
- [✅] Default fontSize value → Default: 9px (middle of 6-12 range, improved from 6.5)
- [✅] TerminalScreen interface → Use wrapper to preserve existing props
- [✅] SessionTreeSidebar content scope → Show server list only for initial implementation
- [✅] Real-time preview → Yes, immediate update on slider drag

**Guardrails Applied**:
- Web: MUST NOT recreate Terminal when fontSize changes - use `term.options.fontSize` then `fitAddon.fit()`
- Web: MUST NOT change other terminal options (fontFamily, lineHeight, theme)
- RN: MUST NOT break existing Server/TmuxSession/TmuxWindow type definitions
- RN: MUST wrap app with GestureHandlerRootView
- RN: MUST maintain AsyncStorage server persistence during refactor
- Both: MUST NOT add new npm dependencies

**Scope Lock-Down**:
- FontSize ONLY - no fontFamily picker, lineHeight slider, or theme selector
- Single Drawer navigator - no nested navigators, tab bars, or stacks
- Props drilling via route.params only - no new state management (Redux/Context)
- SessionTreeSidebar shows servers only - no user profile, settings, or help links

---

## Work Objectives

### Core Objective
Implement terminal font size slider for web (6-12px, localStorage persisted) and replace custom React Native navigation with Drawer navigator featuring iOS-style sidebar.

### Concrete Deliverables
**Stream A (Web)**:
- Modified `web/app/src/App.jsx`: fontSize state with localStorage persistence
- Modified `web/app/src/components/BottomToolbox.jsx`: Font size slider UI
- Modified `web/app/src/components/TerminalPane.jsx`: Accept fontSize prop
- Modified `web/app/src/hooks/useTerminal.js`: Dynamic fontSize support without terminal recreation

**Stream B (React Native)**:
- Created `TmuxMobile/src/navigation/AppNavigator.tsx`: Drawer navigator setup
- Created `TmuxMobile/src/components/SessionTreeSidebar.tsx`: Custom drawer content
- Modified `TmuxMobile/App.tsx`: Replace manual navigation with AppNavigator
- Created `TmuxMobile/src/components/TerminalScreenWrapper.tsx`: Route.params to props bridge

### Definition of Done
- Web: `cd web/app && npm run build` exits 0
- RN: `cd TmuxMobile && npx tsc --noEmit` returns no errors
- All LSP diagnostics clean for modified files
- Runtime verification: Slider adjusts font, Drawer opens/closes, Navigation works

### Must Have
- Web fontSize persists in localStorage with key 'terminalFontSize'
- Web terminal NOT recreated when fontSize changes
- RN drawer opens via swipe and hamburger button
- RN TerminalScreen receives server/session/window via route.params
- RN server data persists in AsyncStorage through refactor

### Must NOT Have (Guardrails)
- FontSize slider does NOT change fontFamily, lineHeight, or theme
- No per-tab fontSize (global setting only)
- No new npm dependencies
- No nested navigators (single Drawer only)
- No global state management changes
- No deep linking
- No automated tests (as per user requirement)

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.
> This is NOT conditional — it applies to EVERY task.
>
> **FORBIDDEN** — acceptance criteria that require:
> - "User manually tests..." / "사용자가 직접 테스트..."
> - "User visually confirms..." / "사용자가 눈으로 확인..."
> - "User interacts with..." / "사용자가 직접 조작..."
> - "Ask user to verify..." / "사용자에게 확인 요청..."
> - ANY step where a human must perform an action

### Test Decision
- **Infrastructure exists**: NO (Web), YES (RN but declined)
- **Automated tests**: None for either stream
- **Framework**: None

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

> EVERY task includes Agent-Executed QA Scenarios describing how the executing agent
> DIRECTLY verifies the deliverable by running it (Playwright, interactive_bash, curl, etc.).

---

## Execution Strategy

### Parallel Execution Waves

> Stream A (Web) and Stream B (RN) are FULLY INDEPENDENT and run in parallel.

```
Wave 1 (Start Immediately - PARALLEL):
├── Task A: Web font size slider (Stream A)
└── Task B: RN drawer navigator (Stream B)

Wave 2 (After Wave 1 - SEQUENTIAL):
├── Task C: Verify web build & diagnostics
└── Task D: Verify RN build & diagnostics

Critical Path: Task A → Task C (independent from B→D)
Parallel Speedup: ~50% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| A (Web) | None | C | B |
| B (RN) | None | D | A |
| C (Web verify) | A | None | D |
| D (RN verify) | B | None | C |

### Agent Dispatch Summary

| Wave | Tasks | Parallelization |
|------|-------|-----------------|
| 1 | A (Web), B (RN) | FULLY INDEPENDENT - run both simultaneously |
| 2 | C (Web verify), D (RN verify) | Can run in parallel after Wave 1 completes |

---

## TODOs

> Implementation + Verification = Separate tasks for verification clarity.
> EVERY task MUST have: Recommended Agent Profile + Parallelization info.

---

## WAVE 1: Parallel Implementation

- [ ] **Task A: Web Terminal Font Size Slider (Stream A)**

  **What to do**:
  1. Modify `web/app/src/App.jsx`:
     - Add `fontSize` state with default value 9 (middle of 6-12 range)
     - Persist to localStorage with key 'terminalFontSize'
     - Pattern: Follow existing localStorage pattern for `openTabs`/`activeTabId` (useState + useEffect)
     - Pass `fontSize` and `onFontSizeChange` to BottomToolbox
     - Pass `fontSize` to TerminalPane
  2. Modify `web/app/src/components/BottomToolbox.jsx`:
     - Add font size slider (HTML `<input type="range">`)
     - Attributes: min="6", max="12", step="0.5", value={fontSize}
     - Add onChange handler to update fontSize via onFontSizeChange
     - Add label showing current fontSize value next to slider
     - Place in quick-key row or as inline control (don't remove existing buttons)
  3. Modify `web/app/src/components/TerminalPane.jsx`:
     - Accept `fontSize` prop
     - Pass `fontSize` to useTerminal hook
  4. Modify `web/app/src/hooks/useTerminal.js`:
     - Accept `fontSize` in options parameter (default 9 if not provided)
     - Use `fontSize` in Terminal constructor options
     - Add useEffect to handle fontSize changes WITHOUT recreating terminal:
       - Check if `termRef.current` exists
       - Update: `termRef.current.options.fontSize = fontSize`
       - Call: `fitAddon.fit()` to reflow
       - Dependency array: `[fontSize]`
     - CRITICAL: Do NOT add `fontSize` to the main terminal creation useEffect dependency (this would recreate terminal)

  **Must NOT do**:
  - Do NOT recreate Terminal instance when fontSize changes
  - Do NOT change fontFamily, lineHeight, or theme options
  - Do NOT add per-tab fontSize (global setting only)
  - Do NOT remove existing BottomToolbox UI elements

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Frontend state management and UI modifications, straightforward changes
  - **Skills**: None required beyond basic React knowledge
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Not needed - specific UI placement guidance provided

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task B)
  - **Blocks**: Task C (verification)
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References** (existing code to follow):
  - `web/app/src/App.jsx`: Lines with `useState(() => JSON.parse(localStorage.getItem('openTabs') || '[]'))` - localStorage pattern to replicate
  - `web/app/src/App.jsx`: `useEffect(() => localStorage.setItem('openTabs', JSON.stringify(openTabs)), [openTabs])` - persistence pattern
  - `web/app/src/hooks/useTerminal.js`: Line 45 - `fontSize: 6.5` hardcoded value to replace with prop
  - `web/app/src/hooks/useTerminal.js`: Lines 25-31 - `safeFit()` function pattern for calling fitAddon
  - `web/app/src/components/BottomToolbox.jsx`: Existing button elements to understand styling/class patterns

  **Documentation References**:
  - xterm.js API: `term.options.fontSize` - Runtime fontSize update API
  - xterm.js FitAddon: `fitAddon.fit()` - Required after fontSize change

  **External References**:
  - HTML Range Input: `<input type="range" min="6" max="12" step="0.5">` - Slider element spec

  **WHY Each Reference Matters**:
  - App.jsx localStorage pattern: Ensures consistent persistence behavior with existing features
  - useTerminal.js line 45: Exact location of hardcoded fontSize to replace
  - useTerminal.js safeFit: Required pattern to safely call fitAddon without errors
  - BottomToolbox existing UI: Ensures new slider matches existing visual style

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** — No human action permitted.

  - [ ] App.jsx adds `fontSize` state with default 9
  - [ ] App.jsx persists fontSize to localStorage with key 'terminalFontSize'
  - [ ] BottomToolbox.jsx contains `<input type="range">` with min="6", max="12", step="0.5"
  - [ ] BottomToolbox.jsx displays current fontSize value
  - [ ] TerminalPane.jsx accepts and passes `fontSize` prop
  - [ ] useTerminal.js accepts `fontSize` in options
  - [ ] useTerminal.js has useEffect to update fontSize without recreation
  - [ ] Build check: Run type checking on modified files

  **Agent-Executed QA Scenarios (MANDATORY — per-scenario, ultra-detailed):**

  **Scenario: Font size state initializes correctly**
  ```
  Scenario: Font size state initializes from localStorage or default
    Tool: Bash (node)
    Preconditions: web/app directory exists
    Steps:
      1. cd /Users/wudi/data/code/ai_tools/ios/opencode/opencode-iterm/web/app
      2. grep -n "useState.*fontSize" src/App.jsx
      3. Assert: Output contains useState with default value 9 or localStorage.getItem('terminalFontSize')
      4. grep -n "terminalFontSize" src/App.jsx
      5. Assert: Output shows localStorage usage with key 'terminalFontSize'
    Expected Result: State management correctly implemented
    Evidence: Grep output showing useState and localStorage patterns
  ```

  **Scenario: Slider element exists in BottomToolbox**
  ```
  Scenario: Font size slider element correctly added to BottomToolbox
    Tool: Bash (grep)
    Preconditions: web/app directory exists
    Steps:
      1. cd /Users/wudi/data/code/ai_tools/ios/opencode/opencode-iterm/web/app
      2. grep -n 'type="range"' src/components/BottomToolbox.jsx
      3. Assert: Output contains range input element
      4. grep -n 'min="6"' src/components/BottomToolbox.jsx
      5. grep -n 'max="12"' src/components/BottomToolbox.jsx
      6. grep -n 'step="0.5"' src/components/BottomToolbox.jsx
      7. Assert: All slider attributes present
    Expected Result: Slider element with correct range attributes
    Evidence: Grep output showing slider element
  ```

  **Scenario: useTerminal handles fontSize changes without recreation**
  ```
  Scenario: useTerminal useEffect correctly updates fontSize without terminal recreation
    Tool: Bash (grep)
    Preconditions: web/app directory exists
    Steps:
      1. cd /Users/wudi/data/code/ai_tools/ios/opencode/opencode-iterm/web/app
      2. grep -A 10 "useEffect.*fontSize" src/hooks/useTerminal.js
      3. Assert: Output contains useEffect dependency on fontSize
      4. Assert: Output contains `termRef.current.options.fontSize = fontSize`
      5. Assert: Output contains `fitAddon.fit()` or `safeFit()`
      6. Assert: Main terminal creation useEffect does NOT include fontSize in dependency array
    Expected Result: Font size updates without recreating terminal
    Evidence: Grep output showing useEffect implementation
  ```

  **Scenario: TypeScript/LSP check on modified files**
  ```
  Scenario: No TypeScript/LSP errors in modified web files
    Tool: Bash (npx tsc if TS configured, else visual inspection)
    Preconditions: Node modules installed
    Steps:
      1. cd /Users/wudi/data/code/ai_tools/ios/opencode/opencode-iterm/web/app
      2. npx tsc --noEmit 2>&1 || echo "No TS config, checking for syntax errors"
      3. If TS check exists: Assert no errors in App.jsx, BottomToolbox.jsx, TerminalPane.jsx, useTerminal.js
    Expected Result: No TypeScript errors or syntax issues
    Evidence: tsc output or error-free confirmation
  ```

  **Scenario: Invalid localStorage value is handled**
  ```
  Scenario: Invalid fontSize in localStorage is handled gracefully
    Tool: Bash (grep inspection)
    Preconditions: web/app directory exists
    Steps:
      1. cd /Users/wudi/data/code/ai_tools/ios/opencode/opencode-iterm/web/app
      2. grep -A 5 "useState.*fontSize" src/App.jsx
      3. Check for: JSON.parse fallback or default value when localStorage.getItem returns null/invalid
      4. Check for: Number validation or clamping to 6-12 range
      5. Assert: Code handles null/undefined/invalid values with fallback to default 9
    Expected Result: Code handles invalid localStorage data
    Evidence: Grep output showing error handling
  ```

  **Scenario: Slider value clamping prevents out-of-range values**
  ```
  Scenario: Slider onChange handler clamps values to 6-12 range
    Tool: Bash (grep inspection)
    Preconditions: web/app directory exists
    Steps:
      1. cd /Users/wudi/data/code/ai_tools/ios/opencode/opencode-iterm/web/app
      2. grep -A 10 "onChange.*fontSize" src/components/BottomToolbox.jsx
      3. Check for: Math.min(Math.max(value, 6), 12) or similar clamping
      4. Or verify: Input type="range" min="6" max="12" handles clamping at browser level
      5. Assert: Values outside 6-12 range are prevented
    Expected Result: Values clamped to 6-12 range
    Evidence: Grep output or browser native constraint confirmation
  ```

  **Evidence to Capture**:
  - [ ] Grep output for useState and localStorage patterns
  - [ ] Grep output for slider element
  - [ ] Grep output for useEffect implementation
  - [ ] TypeScript check results
  - [ ] Grep output for localStorage error handling

  **Commit**: NO (groups with Task C)

---

- [ ] **Task B: RN Drawer Navigator & SessionTreeSidebar (Stream B)**

  **What to do**:
  1. Create `TmuxMobile/src/navigation/AppNavigator.tsx`:
     - Import createDrawerNavigator from '@react-navigation/drawer'
     - Create AppNavigator component with Drawer.Navigator
     - Import GestureHandlerRootView and wrap Drawer.Navigator
     - Create screens: ServerListScreen, ServerDetailScreen, TerminalScreen, ServerEditScreen
     - Set custom drawerContent to SessionTreeSidebar component
     - Configure drawer screenOptions for responsive behavior (optional)
     - Export AppNavigator as default

  2. Create `TmuxMobile/src/components/SessionTreeSidebar.tsx`:
     - Create functional component accepting props: navigation, state, servers
     - Use DrawerContentScrollView from '@react-navigation/drawer'
     - Display server list from props.servers
     - Add TouchableOpacity for each server item
     - On tap: navigate to 'Terminal' with route params { serverId: server.id }
     - Style with NativeWind classes (Tailwind CSS)
     - Add "Add Server" button at bottom (optional, if needed)
     - Import Server type from types

  3. Create `TmuxMobile/src/components/TerminalScreenWrapper.tsx`:
     - Create wrapper component to bridge route.params to TerminalScreen props
     - Extract server, session, window from route.params
     - Render existing TerminalScreen with props
     - Handle onBack: navigation.goBack()
     - Handle onOpenAI: (same as existing App.tsx)
     - Import TerminalScreen from screens

  4. Modify `TmuxMobile/App.tsx`:
     - Replace manual navigation switch statement (lines 157-199) with AppNavigator
     - Keep server/connection state management (useState for servers, activeServer, etc.)
     - Keep AsyncStorage persistence for servers
     - Pass servers to AppNavigator as prop (or via Context)
     - Remove renderScreen() function
     - Wrap root with GestureHandlerRootView if not already present
     - Keep AIAssistantPanel at root level (render alongside AppNavigator or inside as modal)
     - Maintain existing server CRUD logic (addServer, updateServer, deleteServer, setActiveServer)

  **Must NOT do**:
  - Do NOT break existing Server/TmuxSession/TmuxWindow type definitions
  - Do NOT change TerminalScreen props interface directly (use wrapper)
  - Do NOT add nested navigators (single Drawer only)
  - Do NOT add deep linking
  - Do NOT modify AsyncStorage data format
  - Do NOT add new npm dependencies

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: React Navigation setup and component creation, straightforward navigation refactoring
  - **Skills**: None required beyond React Navigation knowledge (patterns provided)
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Not needed - iOS sidebar behavior documented

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task A)
  - **Blocks**: Task D (verification)
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References** (existing code to follow):
  - `TmuxMobile/App.tsx`: Lines 157-199 - renderScreen() switch statement to replace
  - `TmuxMobile/App.tsx`: Lines 22-106 - AsyncStorage server persistence pattern to maintain
  - `TmuxMobile/App.tsx`: Lines 14-20 - NavigationState type definition (for reference, will be removed)
  - `TmuxMobile/src/screens/TerminalScreen.tsx`: Props interface (server, session, window, onBack, onOpenAI)
  - `TmuxMobile/src/types/index.ts`: Server, TmuxSession, TmuxWindow type definitions

  **API References** (libraries to use):
  - `@react-navigation/drawer`: createDrawerNavigator, DrawerContentScrollView, Drawer.Navigator, Drawer.Screen
  - `@react-navigation/native`: NavigationContainer (if needed at root)
  - `react-native-gesture-handler`: GestureHandlerRootView
  - `@react-native-async-storage/async-storage`: AsyncStorage for server persistence

  **Documentation References**:
  - React Navigation Drawer: Custom drawer content pattern
  - React Navigation: Route params navigation pattern
  - iOS Reference: `VoiceTmuxApp/Sources/Views/MainView.swift` - NavigationSplitView behavior

  **External References**:
  - Librarian provided patterns (already in context)

  **WHY Each Reference Matters**:
  - App.tsx renderScreen(): Exact code to replace with AppNavigator
  - App.tsx AsyncStorage: Pattern to maintain for server persistence
  - TerminalScreen props: Interface to preserve via wrapper
  - types/index.ts: Type definitions to not break
  - MainView.swift: iOS reference for sidebar behavior

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** — No human action permitted.

  - [ ] AppNavigator.tsx created with Drawer.Navigator
  - [ ] AppNavigator.tsx wraps with GestureHandlerRootView
  - [ ] SessionTreeSidebar.tsx created and displays server list
  - [ ] SessionTreeSidebar.tsx navigates to Terminal with route params
  - [ ] TerminalScreenWrapper.tsx created and bridges params to props
  - [ ] App.tsx replaces renderScreen() with AppNavigator
  - [ ] App.tsx maintains AsyncStorage server persistence
  - [ ] App.tsx does NOT break server CRUD operations

  **Agent-Executed QA Scenarios (MANDATORY — per-scenario, ultra-detailed):**

  **Scenario: AppNavigator file structure is correct**
  ```
  Scenario: AppNavigator.tsx correctly implements Drawer navigator
    Tool: Bash (grep)
    Preconditions: TmuxMobile/src/navigation directory exists
    Steps:
      1. cd /Users/wudi/data/code/ai_tools/ios/opencode/opencode-iterm/TmuxMobile
      2. grep -n "createDrawerNavigator\|Drawer.Navigator\|Drawer.Screen" src/navigation/AppNavigator.tsx
      3. Assert: Output contains Drawer.Navigator and Drawer.Screen
      4. grep -n "GestureHandlerRootView" src/navigation/AppNavigator.tsx
      5. Assert: Output contains GestureHandlerRootView wrapper
      6. grep -n "SessionTreeSidebar" src/navigation/AppNavigator.tsx
      7. Assert: Output uses custom drawerContent
    Expected Result: AppNavigator correctly implements Drawer
    Evidence: Grep output showing Drawer API usage
  ```

  **Scenario: SessionTreeSidebar displays server list**
  ```
  Scenario: SessionTreeSidebar component displays servers and navigates
    Tool: Bash (grep)
    Preconditions: TmuxMobile/src/components directory exists
    Steps:
      1. cd /Users/wudi/data/code/ai_tools/ios/opencode/opencode-iterm/TmuxMobile
      2. grep -n "DrawerContentScrollView" src/components/SessionTreeSidebar.tsx
      3. Assert: Output contains DrawerContentScrollView
      4. grep -n "navigation.navigate\|navigate('Terminal'" src/components/SessionTreeSidebar.tsx
      5. Assert: Output contains navigation call with 'Terminal'
      6. grep -n "serverId\|server\." src/components/SessionTreeSidebar.tsx
      7. Assert: Output accesses server data
    Expected Result: SessionTreeSidebar displays servers and navigates
    Evidence: Grep output showing component structure
  ```

  **Scenario: TerminalScreenWrapper bridges params correctly**
  ```
  Scenario: TerminalScreenWrapper bridges route.params to TerminalScreen props
    Tool: Bash (grep)
    Preconditions: TmuxMobile/src/components directory exists
    Steps:
      1. cd /Users/wudi/data/code/ai_tools/ios/opencode/opencode-iterm/TmuxMobile
      2. grep -n "route.params" src/components/TerminalScreenWrapper.tsx
      3. Assert: Output extracts params from route
      4. grep -n "server\|session\|window" src/components/TerminalScreenWrapper.tsx
      5. Assert: Output extracts these props from params
      6. grep -n "onBack.*navigation.goBack" src/components/TerminalScreenWrapper.tsx
      7. Assert: Output handles onBack with navigation.goBack()
    Expected Result: Wrapper correctly bridges params to props
    Evidence: Grep output showing prop bridging
  ```

  **Scenario: App.tsx refactored to use AppNavigator**
  ```
  Scenario: App.tsx replaces manual navigation with AppNavigator
    Tool: Bash (grep)
    Preconditions: TmuxMobile directory exists
    Steps:
      1. cd /Users/wudi/data/code/ai_tools/ios/opencode/opencode-iterm/TmuxMobile
      2. grep -n "renderScreen" App.tsx
      3. Assert: renderScreen function is removed or unused
      4. grep -n "switch (nav.screen)" App.tsx
      5. Assert: Manual switch statement is removed
      6. grep -n "AppNavigator" App.tsx
      7. Assert: AppNavigator is imported and rendered
      8. grep -n "@TmuxMobile:servers" App.tsx
      9. Assert: AsyncStorage server persistence is maintained
    Expected Result: App.tsx refactored to use AppNavigator
    Evidence: Grep output showing refactored code
  ```

  **Scenario: TypeScript/LSP check on RN files**
  ```
  Scenario: No TypeScript errors in RN files
    Tool: Bash (npx tsc)
    Preconditions: Node modules installed
    Steps:
      1. cd /Users/wudi/data/code/ai_tools/ios/opencode/opencode-iterm/TmuxMobile
      2. npx tsc --noEmit 2>&1 | head -50
      3. Assert: No TypeScript errors in AppNavigator.tsx, SessionTreeSidebar.tsx, TerminalScreenWrapper.tsx, App.tsx
    Expected Result: No TypeScript errors
    Evidence: tsc output
  ```

  **Scenario: Empty server list is handled gracefully**
  ```
  Scenario: SessionTreeSidebar handles empty server list without crash
    Tool: Bash (grep inspection)
    Preconditions: TmuxMobile/src/components directory exists
    Steps:
      1. cd /Users/wudi/data/code/ai_tools/ios/opencode/opencode-iterm/TmuxMobile
      2. grep -A 20 "SessionTreeSidebar" src/components/SessionTreeSidebar.tsx
      3. Check for: Conditional rendering when props.servers is empty array
      4. Check for: Optional chaining (servers?.map) or array check (servers.length > 0)
      5. Assert: Component handles empty state without crashing
    Expected Result: Empty server list handled gracefully
    Evidence: Grep output showing empty state handling
  ```

  **Scenario: Undefined route.params handled in wrapper**
  ```
  Scenario: TerminalScreenWrapper handles undefined route.params
    Tool: Bash (grep inspection)
    Preconditions: TmuxMobile/src/components directory exists
    Steps:
      1. cd /Users/wudi/data/code/ai_tools/ios/opencode/opencode-iterm/TmuxMobile
      2. grep -A 15 "route.params" src/components/TerminalScreenWrapper.tsx
      3. Check for: Optional chaining (route.params?.server) or null checks
      4. Check for: Default values or null handling for undefined params
      5. Assert: Component handles undefined params without crashing
    Expected Result: Undefined route.params handled gracefully
    Evidence: Grep output showing param handling
  ```

  **Evidence to Capture**:
  - [ ] Grep output for AppNavigator Drawer implementation
  - [ ] Grep output for SessionTreeSidebar structure
  - [ ] Grep output for TerminalScreenWrapper bridging
  - [ ] Grep output for App.tsx refactoring
  - [ ] TypeScript check results
  - [ ] Grep output for empty state handling

  **Commit**: NO (groups with Task D)

---

## WAVE 2: Verification (Sequential)

- [ ] **Task C: Verify Web Build & Diagnostics (Stream A)**

  **What to do**:
  1. Run build command: `cd web/app && npm run build`
  2. Check exit code: Must be 0
  3. Check for build errors: No error output
  4. Verify localStorage key: Confirm 'terminalFontSize' is used correctly
  5. Review build output: No warnings related to fontSize changes

  **Must NOT do**:
  - Do NOT proceed if build fails
  - Do NOT ignore TypeScript/LSP errors

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple verification commands, no implementation
  - **Skills**: None required

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task D)
  - **Parallel Group**: Wave 2 (with Task D)
  - **Blocks**: None (final verification)
  - **Blocked By**: Task A (implementation)

  **References**:
  - `web/app/package.json`: Build scripts
  - Previous task outputs: Modified file list to check

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** — No human action permitted.

  - [ ] Build command exits with code 0
  - [ ] No build errors in output
  - [ ] localStorage key 'terminalFontSize' correctly used
  - [ ] No TypeScript/LSP errors in modified files

  **Agent-Executed QA Scenarios (MANDATORY — per-scenario, ultra-detailed):**

  **Scenario: Web build succeeds**
  ```
  Scenario: Web project builds successfully with no errors
    Tool: Bash
    Preconditions: Node modules installed in web/app
    Steps:
      1. cd /Users/wudi/data/code/ai_tools/ios/opencode/opencode-iterm/web/app
      2. npm run build 2>&1 | tee /tmp/web-build.log
      3. Check exit code: echo $?
      4. Assert: Exit code is 0
      5. grep -i "error\|Error\|ERROR" /tmp/web-build.log || echo "No errors found"
      6. Assert: No error messages in build output
    Expected Result: Build completes successfully
    Evidence: /tmp/web-build.log, exit code
  ```

  **Scenario: localStorage key verification**
  ```
  Scenario: localStorage key 'terminalFontSize' is correctly used
    Tool: Bash (grep)
    Preconditions: web/app directory exists
    Steps:
      1. cd /Users/wudi/data/code/ai_tools/ios/opencode/opencode-iterm/web/app
      2. grep -rn "terminalFontSize" src/
      3. Assert: Output shows 'terminalFontSize' in App.jsx (localStorage key)
      4. grep -n "getItem.*terminalFontSize\|setItem.*terminalFontSize" src/App.jsx
      5. Assert: localStorage usage pattern is correct
    Expected Result: localStorage key used correctly
    Evidence: Grep output
  ```

  **Scenario: Build failure detection**
  ```
  Scenario: Build failures are detected and reported
    Tool: Bash
    Preconditions: web/app directory exists
    Steps:
      1. cd /Users/wudi/data/code/ai_tools/ios/opencode/opencode-iterm/web/app
      2. npm run build 2>&1 | tee /tmp/web-build.log
      3. exit_code=$?
      4. if [ $exit_code -ne 0 ]; then echo "BUILD FAILED with exit code: $exit_code"; fi
      5. grep -E "error|Error|ERROR" /tmp/web-build.log || echo "No errors detected"
      6. Assert: If exit code != 0, error messages are present in log
    Expected Result: Build failures are detectable with error messages
    Evidence: /tmp/web-build.log, exit code
  ```

  **Evidence to Capture**:
  - [ ] Build log file (/tmp/web-build.log)
  - [ ] Exit code from build command
  - [ ] Grep output for localStorage verification
  - [ ] Build failure detection output

  **Commit**: YES (all Stream A changes together)
  - Message: `feat(web): add terminal font size slider with localStorage persistence (6-12px)`
  - Files: `web/app/src/App.jsx`, `web/app/src/components/BottomToolbox.jsx`, `web/app/src/components/TerminalPane.jsx`, `web/app/src/hooks/useTerminal.js`
  - Pre-commit: None (build already verified)

---

- [ ] **Task D: Verify RN Build & Diagnostics (Stream B)**

  **What to do**:
  1. Run TypeScript check: `cd TmuxMobile && npx tsc --noEmit`
  2. Check for TypeScript errors: Must be 0 errors
  3. Verify new files compile: AppNavigator.tsx, SessionTreeSidebar.tsx, TerminalScreenWrapper.tsx
  4. Check App.tsx refactoring: No type errors from changes
  5. Verify imports: All React Navigation imports resolve correctly

  **Must NOT do**:
  - Do NOT proceed if TypeScript check fails
  - Do NOT ignore type errors

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple verification commands, no implementation
  - **Skills**: None required

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task C)
  - **Parallel Group**: Wave 2 (with Task C)
  - **Blocks**: None (final verification)
  - **Blocked By**: Task B (implementation)

  **References**:
  - `TmuxMobile/tsconfig.json`: TypeScript configuration
  - `TmuxMobile/package.json`: TypeScript scripts
  - Previous task outputs: New/modified file list

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** — No human action permitted.

  - [ ] TypeScript check exits with no errors
  - [ ] No type errors in new files (AppNavigator, SessionTreeSidebar, TerminalScreenWrapper)
  - [ ] No type errors in modified App.tsx
  - [ ] All React Navigation imports resolve correctly

  **Agent-Executed QA Scenarios (MANDATORY — per-scenario, ultra-detailed):**

  **Scenario: RN TypeScript check passes**
  ```
  Scenario: React Native project passes TypeScript check
    Tool: Bash
    Preconditions: Node modules installed in TmuxMobile
    Steps:
      1. cd /Users/wudi/data/code/ai_tools/ios/opencode/opencode-iterm/TmuxMobile
      2. npx tsc --noEmit 2>&1 | tee /tmp/rn-tsc.log
      3. Check exit code: echo $?
      4. Assert: Exit code is 0
      5. grep -E "error TS" /tmp/rn-tsc.log || echo "No TS errors"
      6. Assert: No TypeScript errors
    Expected Result: TypeScript check passes
    Evidence: /tmp/rn-tsc.log, exit code
  ```

  **Scenario: New files compile without errors**
  ```
  Scenario: New files compile with no TypeScript errors
    Tool: Bash (grep)
    Preconditions: tsc log exists
    Steps:
      1. cd /Users/wudi/data/code/ai_tools/ios/opencode/opencode-iterm/TmuxMobile
      2. grep -E "AppNavigator\.tsx|SessionTreeSidebar\.tsx|TerminalScreenWrapper\.tsx" /tmp/rn-tsc.log
      3. Assert: No error lines contain new file names
    Expected Result: New files compile successfully
    Evidence: tsc log output
  ```

  **Scenario: React Navigation imports resolve**
  ```
  Scenario: All React Navigation imports resolve correctly
    Tool: Bash (grep)
    Preconditions: Files exist
    Steps:
      1. cd /Users/wudi/data/code/ai_tools/ios/opencode/opencode-iterm/TmuxMobile
      2. grep -rn "@react-navigation" src/navigation/AppNavigator.tsx src/components/SessionTreeSidebar.tsx
      3. Assert: Output shows React Navigation imports
      4. npx tsc --noEmit 2>&1 | grep -i "module.*not found.*react-navigation" || echo "No import errors"
      5. Assert: No "module not found" errors for react-navigation
    Expected Result: All imports resolve
    Evidence: Grep output, tsc log
  ```

  **Scenario: TypeScript errors are detected**
  ```
  Scenario: TypeScript errors in modified files are detected
    Tool: Bash
    Preconditions: TmuxMobile directory exists
    Steps:
      1. cd /Users/wudi/data/code/ai_tools/ios/opencode/opencode-iterm/TmuxMobile
      2. npx tsc --noEmit 2>&1 | tee /tmp/rn-tsc.log
      3. exit_code=$?
      4. if [ $exit_code -ne 0 ]; then echo "TSC FAILED with exit code: $exit_code"; fi
      5. error_count=$(grep -c "error TS" /tmp/rn-tsc.log || echo "0")
      6. Assert: If exit code != 0, error_count > 0
      7. grep -E "AppNavigator|SessionTreeSidebar|TerminalScreenWrapper|App\.tsx" /tmp/rn-tsc.log | grep "error TS" || echo "No errors in target files"
    Expected Result: TypeScript errors are detectable and file-specific
    Evidence: /tmp/rn-tsc.log, error_count
  ```

  **Evidence to Capture**:
  - [ ] TypeScript check log file (/tmp/rn-tsc.log)
  - [ ] Exit code from tsc command
  - [ ] Grep output for import verification
  - [ ] TypeScript error detection output

  **Commit**: YES (all Stream B changes together)
  - Message: `feat(rn): replace manual navigation with Drawer navigator and SessionTreeSidebar`
  - Files: `TmuxMobile/src/navigation/AppNavigator.tsx`, `TmuxMobile/src/components/SessionTreeSidebar.tsx`, `TmuxMobile/src/components/TerminalScreenWrapper.tsx`, `TmuxMobile/App.tsx`
  - Pre-commit: None (tsc check already verified)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| C | `feat(web): add terminal font size slider with localStorage persistence (6-12px)` | web/app/src/App.jsx, web/app/src/components/BottomToolbox.jsx, web/app/src/components/TerminalPane.jsx, web/app/src/hooks/useTerminal.js | Build already verified |
| D | `feat(rn): replace manual navigation with Drawer navigator and SessionTreeSidebar` | TmuxMobile/src/navigation/AppNavigator.tsx, TmuxMobile/src/components/SessionTreeSidebar.tsx, TmuxMobile/src/components/TerminalScreenWrapper.tsx, TmuxMobile/App.tsx | TypeScript check already verified |

---

## Success Criteria

### Verification Commands

**Web Stream:**
```bash
cd /Users/wudi/data/code/ai_tools/ios/opencode/opencode-iterm/web/app
npm run build
# Expected: Exit code 0, no errors
```

**RN Stream:**
```bash
cd /Users/wudi/data/code/ai_tools/ios/opencode/opencode-iterm/TmuxMobile
npx tsc --noEmit
# Expected: Exit code 0, no errors
```

### Final Checklist

**Web Stream:**
- [ ] Build passes (`npm run build` exits 0)
- [ ] localStorage key 'terminalFontSize' correctly used
- [ ] Slider exists in BottomToolbox with range 6-12, step 0.5
- [ ] useTerminal updates fontSize without recreation
- [ ] No TypeScript/LSP errors in modified files

**RN Stream:**
- [ ] TypeScript check passes (`npx tsc --noEmit` exits 0)
- [ ] AppNavigator.tsx created with Drawer.Navigator
- [ ] SessionTreeSidebar.tsx displays server list
- [ ] TerminalScreenWrapper.tsx bridges route.params to props
- [ ] App.tsx refactored to use AppNavigator
- [ ] AsyncStorage server persistence maintained
- [ ] All React Navigation imports resolve

**Both Streams:**
- [ ] No new npm dependencies added
- [ ] Scope boundaries respected (no creep)
- [ ] Guardrails followed (no terminal recreation, no type breaks)
