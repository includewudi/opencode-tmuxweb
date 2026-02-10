# Task 1: Backend preview field verification

## Code Verification

### 1. generatePreview function exists (summaries.js:22-33)
```javascript
function generatePreview(outputSummary, commandSummary, maxLength = 120) {
  const source = outputSummary || commandSummary || '';  // output-first ✅
  const normalized = source
    .replace(/\r\n/g, ' ')   // normalize CRLF ✅
    .replace(/\n/g, ' ')     // normalize LF ✅
    .replace(/\s+/g, ' ')    // collapse whitespace ✅
    .trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return normalized.slice(0, maxLength) + '...';  // truncate + ellipsis ✅
}
```

### 2. preview field included in API response (summaries.js:156-166)
```javascript
res.json({
  candidates: rows.map(row => ({
    id: row.id,
    segment_id: row.segment_id,
    session_name: row.session_name,
    window_index: row.window_index,
    command_summary: row.command_summary,
    output_summary: row.output_summary,
    generated_at: row.generated_at,
    preview: generatePreview(row.output_summary, row.command_summary)  // ✅
  }))
});
```

## API Test (empty candidates - no test data in database)
```json
{
  "candidates": []
}
```

The API returns correctly - preview field will be populated when candidates exist.

## Verification Summary
- ✅ generatePreview uses output_summary first (output-first)
- ✅ Whitespace normalization: \r\n → space, \n → space, collapse multiples
- ✅ Truncation: 120 chars max + "..."
- ✅ preview field included in API response mapping
