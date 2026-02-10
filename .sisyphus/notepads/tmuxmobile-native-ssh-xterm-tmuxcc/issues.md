# TmuxMobile Native SSH + Xterm - Blockers & Issues

## 2026-02-08 Task 7: Auto-reconnect Implementation

### Current Status
- Tasks 1-6: Evidence files exist, implementations appear complete
- Task 7 (auto-reconnect): INCOMPLETE - multiple issues

### Issues Identified

#### 1. Reconnect State Machine Created but Not Integrated
**File**: `TmuxMobile/src/utils/reconnectStateMachine.ts`
- Complete TypeScript implementation with state machine, exponential backoff
- NOT integrated into `TerminalScreen.tsx`
- No AppState listener added
- No reconnect logic triggered on foreground return

**Blocker**: Reconnect logic exists as standalone code but is disconnected from actual UI component.

#### 2. No Jest Tests for Reconnect State Machine
- State machine file exists (`reconnectStateMachine.ts`)
- NO corresponding test file found
- Plan requires: "Add Jest tests for state machine transitions"

**Blocker**: Missing test coverage for reconnect state transitions.

#### 3. No Evidence for Task 7
- Evidence files exist for tasks 1-6
- No `.sisyphus/evidence/task-7-reconnect.log`
- Plan acceptance criteria for Task 7 are all unchecked

**Blocker**: Cannot verify completion without evidence.

#### 4. Subagent Refusal to Proceed
- Delegation refused with: "I refuse to proceed. You provided multiple tasks"
- Actual prompt contained ONE task with multiple sections (per atlas protocol)
- Subagent interpreted as multi-task request and refused to implement anything

**Blocker**: Delegation routing issue - need different approach or more focused prompt.

#### 5. TerminalScreen Missing AppState
- `TerminalScreen.tsx` imports from 'react-native' but NOT `AppState`
- No listener for 'change' events to detect foreground/foreground transitions
- No reconnection logic triggered

**Blocker**: Core requirement not implemented.

### Root Cause Analysis
The reconnect state machine was created (likely by a previous subagent) but:
- Integration step with TerminalScreen was skipped
- Test creation step was skipped
- Evidence generation step was skipped

The subagent's refusal may have been triggered by overly verbose prompt or misunderstanding of "multiple sections" as "multiple tasks."

### Required Work to Unblock Task 7
1. **Import AppState** into TerminalScreen.tsx
2. **Add AppState listener** that triggers reconnect when app returns to foreground
3. **Integrate ReconnectStateMachine** into TerminalScreen component
4. **Create Jest tests** for reconnect state machine transitions
5. **Add evidence file** documenting reconnect scenario

### Final Checklist Status (from plan)
```
- [ ] libssh2 native module connects with password (likely done, no evidence)
- [ ] xterm WebView renders tmux output correctly (likely done, task-2 evidence)
- [ ] App keyboard input works (likely done, task-5 evidence)
- [ ] tmux -CC attach works; %output parsing correct (likely done, task-4 tests)
- [ ] TOFU hostkey prompt works (likely done, task-6 evidence)
- [ ] Foreground reconnect works (NOT DONE - this task)
- [ ] Jest unit tests pass (DONE - all tests pass)
```

### Next Steps Options
1. **Focused delegation**: Create a very concise, single-paragraph prompt without 6 sections
2. **Manual intervention**: Require human to implement directly
3. **Break into smaller tasks**: Split Task 7 into sub-tasks (AppState integration, tests, evidence)
