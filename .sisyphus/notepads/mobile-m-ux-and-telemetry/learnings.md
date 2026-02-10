
## [2026-02-10] Task 1: Fix /m pane selection snap-back

### Root Cause
`fetchTree()` was a regular (non-memoized) function that read `selectedPane` via closure. The check `if (!selectedPane && ...)` used the closure-captured value which could be stale — particularly when `fetchTree` was called from `onRefresh` prop, the closure from the render when MobileDrawer was created still had `selectedPane = null`. This caused re-selection of the first pane on every refresh.

### Fix Applied (MobileApp.tsx)
1. **`selectedPaneRef`** — sync ref on every render so `useCallback([], [])` always reads latest selection without stale closure
2. **Selection preservation logic** — after fetchTree, check if `selectedPaneRef.current.paneId` exists in new tree via `getAllPaneIds()`. If yes → keep unchanged. If no → fallback to `getFirstPane()`
3. **Race condition guard (`fetchSeqRef`)** — sequence counter incremented at call start; if another fetchTree fires before response arrives, the stale response is discarded (seq mismatch)
4. **Extracted helpers** — `getAllPaneIds()` and `getFirstPane()` as pure functions outside component

### Patterns
- React ref-sync pattern: `const ref = useRef(x); ref.current = stateValue;` on every render avoids stale closures in memoized callbacks
- Sequence counter pattern for async race conditions: simpler than AbortController for fetch-then-setState flows
- MobileDrawer.tsx required NO changes — its `onRefresh` / `onSelectPane` / `selectedPaneId` wiring was already correct

## [2026-02-10] Task 1: Fix /m Pane Selection Snap-back

### Problem Analysis

**Symptom**: User selects a non-first pane on `/m`, but after 1-2 seconds it snaps back to the first pane.

**Root Cause**: 
- `fetchTree()` was called periodically or on re-render
- After fetching new tree data, it always executed `setSelectedPane(getFirstPane(newSessions))`
- No logic to check if current selection still exists in new tree

### Solution Implemented

**File Modified**: `TmuxWeb/web/src/mobile/MobileApp.tsx`

**Key Changes**:

1. **Selection Preservation Logic** (lines 71-80):
```typescript
const current = selectedPaneRef.current
if (current) {
  const allIds = getAllPaneIds(newSessions)
  if (allIds.has(current.paneId)) {
    return  // Keep current selection - DO NOT reset!
  }
  // Only fallback if pane disappeared
  setSelectedPane(getFirstPane(newSessions))
} else {
  setSelectedPane(getFirstPane(newSessions))
}
```

2. **Race Condition Protection** (lines 51, 58, 65, 82, 85):
```typescript
const fetchSeqRef = useRef(0)
const seq = ++fetchSeqRef.current
// ... in async callback:
if (seq !== fetchSeqRef.current) return  // Discard stale responses
```

3. **Ref Pattern to Avoid Stale Closure** (lines 47-48):
```typescript
const selectedPaneRef = useRef<SelectedPane | null>(null)
selectedPaneRef.current = selectedPane  // Always fresh
```

### Implementation Details

**Helper Functions**:
- `getAllPaneIds(sessions)`: Collects all paneId strings from tree into a Set
- `getFirstPane(sessions)`: Returns first available pane or null

**Behavior**:
- When fetchTree completes: check if current `selectedPane.paneId` exists in new tree
- If YES → keep selection unchanged (early return)
- If NO → fallback to first pane
- If no current selection → auto-select first pane

**Race Protection**:
- Multiple overlapping fetchTree() calls won't interfere
- Only the latest fetch updates state
- Sequence counter pattern prevents TOCTOU bugs

### Verification

✅ LSP diagnostics clean (zero errors)
✅ TypeScript types correct
✅ Logic matches plan requirements

**Pending**: Manual QA to verify 5-second persistence in browser

### Architecture Decisions

1. **Why useRef for selectedPane?**
   - Avoids stale closure in useCallback(fetchTree)
   - Always reads fresh value without adding to dependencies

2. **Why sequence counter instead of AbortController?**
   - Simpler for this use case
   - Already pattern established in codebase
   - AbortController would work but adds complexity

3. **Why early return instead of conditional setState?**
   - Clearer intent: "nothing changed, do nothing"
   - Avoids unnecessary state update even with same value
   - Better performance

### Edge Cases Handled

✅ Pane disappears (killed in tmux) → fallback to first
✅ Multiple rapid fetchTree calls → only latest wins
✅ No sessions available → shows placeholder UI
✅ Drawer still allows manual selection override

### Ready for QA

Implementation complete and verified via static analysis.
Next: Browser-based manual QA to confirm 5-second persistence.


## [2026-02-10] Task 2: Backend Telemetry Endpoints (NDJSON)

### Implementation

**Files Created/Modified**:
- `TmuxWeb/server/routes/telemetry.js` (new — 116 lines)
- `TmuxWeb/server/index.js` (2 lines added: require + mount)
- `TmuxWeb/backend/data/telemetry/` directory created

### Debug Gating Strategy

No existing debug mechanism found in codebase (config.json has no debug flag, middleware/auth.js only does token validation). Used `?debug=1` query param as the simplest approach — applied as router-level middleware via `router.use(requireDebug)` so all three endpoints are gated.

### Key Patterns

- **NDJSON**: One `JSON.stringify(obj)` per line, `\n` separated. `fsp.appendFile` for atomic-ish appends.
- **Batch + single**: Accept `{"events":[...]}` or single `{...}` — normalize to array early.
- **File rotation**: Check `stat.size > 10MB` before each write; rename with `YYYYMMDD-HHmmss` timestamp.
- **ENOENT handling**: Both `rotateIfNeeded()` and GET handler gracefully handle missing file (rotation skips, GET returns `[]`).
- **Route mounting**: Placed alongside `taskEventsRouter` — both are unauthenticated routes (telemetry self-gates via debug param).

### Test Results (8/8 PASS)

1. ✅ No debug → 403
2. ✅ POST batch → 204, events appended
3. ✅ POST single → 204
4. ✅ GET tail=1 → last event correct
5. ✅ GET tail=10 → all 3 events
6. ✅ POST /clear → 204, then tail returns []
7. ✅ GET without debug → 403
8. ✅ POST /clear without debug → 403

### Codebase Conventions Observed

- Express routes export `router` directly (not wrapped)
- Error logging uses `console.error('[tag] message:', err.message)` pattern
- Routes use `async (req, res) => {}` with try/catch
- No TypeScript in server code — pure CommonJS
