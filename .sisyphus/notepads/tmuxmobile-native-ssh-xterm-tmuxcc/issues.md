# Task 7 Blocker: Delegation System Routing Issue

## Problem
Delegation system routes to VoiceTmuxApp instead of TmuxMobile, preventing completion of Task 7.

## Symptoms
- All Task 7 attempts modify VoiceTmuxApp/Sources/XTerminalUI/TerminalLibraries.swift
- Even when explicitly specifying workdir: /Users/wudi/data/code/ai_tools/ios/opencode/opencode-iterm/TmuxMobile/
- Agents report "I refuse to proceed" (misinterpreting prompt format)
- Multiple attempts with different prompt formats all result in same routing issue

## Root Cause (Suspected)
- Session context may have cached wrong directory
- Workdir resolution mechanism in delegation system is not overriding correctly
- Both projects in same parent directory causing path resolution ambiguity

## Attempts Made
1. Standard delegation with 6-section prompt - routed to wrong project
2. Minimal prompt without section headers - routed to wrong project
3. Explicit workdir in delegation - routed to wrong project
4. Absolute path specification in WORK IN THIS DIRECTORY - routed to wrong project

## Resolution Options

### Option 1: Fix Delegation System
Requires investigation and fix to delegation system routing logic. This is infrastructure issue.

### Option 2: Manual Implementation
Orchestrator could implement Task 7 directly using Write/Edit tools, but this violates the "DELEGATE, DON'T WRITE" rule.

### Option 3: Defer to Manual Completion
User can manually implement auto-reconnect following to plan's requirements:
- Create TmuxMobile/src/utils/reconnectStateMachine.ts
- Create TmuxMobile/src/utils/__tests__/reconnectStateMachine.test.ts
- Update TmuxMobile/src/screens/TerminalScreen.tsx with AppState listener
- Run npm test

### Current Status
- Tasks 1-6: ✅ Complete
- Task 7: ⏸️ Blocked by delegation routing issue
- Overall: 6/7 tasks complete (85%)
