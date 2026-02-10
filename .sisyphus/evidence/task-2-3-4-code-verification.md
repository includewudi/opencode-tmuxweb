# Tasks 2-4: Frontend Code Verification

## Task 2: SummaryCandidatePicker uses preview (output-first)

### Interface includes preview field (line 11)
```typescript
interface SummaryCandidate {
  ...
  preview?: string  // ✅ Added
}
```

### getPreview uses preview field with output-first fallback (lines 95-102)
```typescript
const getPreview = (candidate: SummaryCandidate) => {
  if (candidate.preview) {
    return candidate.preview  // ✅ Uses backend preview first
  }
  const text = candidate.output_summary || candidate.command_summary || ''  // ✅ output-first fallback
  const normalized = text.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
  return normalized.length > 120 ? normalized.slice(0, 120) + '...' : normalized  // ✅ 120 char truncation
}
```

## Task 3: Overwrite Confirmation

### Props accept current summaries (lines 17-18)
```typescript
interface Props {
  ...
  currentCommandSummary?: string | null
  currentOutputSummary?: string | null
  ...
}
```

### hasExistingSummary check (line 50)
```typescript
const hasExistingSummary = Boolean(currentCommandSummary?.trim() || currentOutputSummary?.trim())
```

### handleLoadClick shows confirm if needed (lines 52-59)
```typescript
const handleLoadClick = () => {
  if (selectedId === null) return
  if (hasExistingSummary) {
    setShowOverwriteConfirm(true)  // ✅ Shows confirm modal
  } else {
    doLoad()  // ✅ Direct load if no existing summary
  }
}
```

### Overwrite confirm modal (lines 174-196)
```typescript
{showOverwriteConfirm && (
  <div className="overwrite-confirm-overlay">
    <div className="overwrite-confirm-modal">
      <h4>Overwrite existing summaries?</h4>
      <p>The current task already has summaries. Loading this will overwrite them.</p>
      <button onClick={() => setShowOverwriteConfirm(false)}>Cancel</button>  // ✅ Cancel stays on picker
      <button onClick={doLoad}>Overwrite</button>  // ✅ Overwrite proceeds with load
    </div>
  </div>
)}
```

## Task 4: Status Sync

### App.tsx - statusRefreshToken state and callback
```typescript
const [statusRefreshToken, setStatusRefreshToken] = useState(0)
const handleStatusChanged = () => setStatusRefreshToken(prev => prev + 1)
```

### App.tsx - Pass to TmuxTree
```typescript
<TmuxTree 
  ...
  statusRefreshToken={statusRefreshToken}  // ✅ Passed
/>
```

### App.tsx - Pass callback to PaneDetails
```typescript
<PaneDetails
  ...
  onStatusChanged={handleStatusChanged}  // ✅ Passed
/>
```

### TmuxTree.tsx - Props interface
```typescript
interface Props {
  ...
  statusRefreshToken?: number  // ✅ Added
}
```

### TmuxTree.tsx - Effect dependency
```typescript
useEffect(() => {
  if (!profileKey || allPaneKeys.length === 0) return
  fetchPaneStatuses(profileKey, allPaneKeys).then(...)
}, [profileKey, allPaneKeys, statusRefreshToken])  // ✅ Triggers refetch
```

### PaneDetails.tsx - Props interface
```typescript
interface Props {
  ...
  onStatusChanged?: () => void  // ✅ Added
}
```

### PaneDetails.tsx - Callback after status update
```typescript
const updateStatus = async (newStatus: PaneStatus) => {
  ...
  setStatus(newStatus)
  onStatusChanged?.()  // ✅ Triggers Tree refresh
}
```

## Verification Summary
- ✅ Task 2: preview field used, output-first fallback, 120 char truncation
- ✅ Task 3: Overwrite confirm shows when existing summary, Cancel stays on picker, Overwrite proceeds
- ✅ Task 4: Status change triggers Tree refetch via token mechanism
