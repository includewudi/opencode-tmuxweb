import { useState, useEffect } from 'react'
import './SummaryCandidatePicker.css'

interface SummaryCandidate {
  id: number
  command_summary: string | null
  output_summary: string | null
  generated_at: string
  window_index?: number
  pane_index?: number
}

interface Props {
  paneKey: string
  taskId: number
  onSelect: (summaryId: number) => void
  onClose: () => void
}

export function SummaryCandidatePicker({ paneKey, taskId, onSelect, onClose }: Props) {
  const [candidates, setCandidates] = useState<SummaryCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchCandidates()
  }, [paneKey])

  const fetchCandidates = async () => {
    try {
      const res = await fetch(`/api/panes/${encodeURIComponent(paneKey)}/summary-candidates`, {
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Failed to fetch candidates')
      const data = await res.json()
      setCandidates(data.candidates || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleLoad = async () => {
    if (selectedId === null) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/load-summary`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary_id: selectedId })
      })
      if (res.ok) {
        onSelect(selectedId)
      }
    } catch (err) {
      console.error('Failed to load summary:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }) + ' ' + d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  const getPreview = (candidate: SummaryCandidate) => {
    const text = candidate.command_summary || candidate.output_summary || ''
    return text.length > 60 ? text.slice(0, 60) + '...' : text
  }

  const sessionName = paneKey.split(':')[0] || 'session'

  return (
    <div className="candidate-overlay" onClick={onClose}>
      <div className="candidate-modal" onClick={e => e.stopPropagation()}>
        <div className="candidate-header">
          <h3>Load previous summary?</h3>
          <button className="candidate-close" onClick={onClose}>×</button>
        </div>

        <div className="candidate-subtitle">
          Found {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} for session "{sessionName}"
        </div>

        {loading && (
          <div className="candidate-loading">Loading candidates...</div>
        )}

        {error && (
          <div className="candidate-error">{error}</div>
        )}

        {!loading && !error && candidates.length === 0 && (
          <div className="candidate-empty">No previous summaries found</div>
        )}

        {!loading && !error && candidates.length > 0 && (
          <div className="candidate-list">
            {candidates.map(candidate => (
              <label
                key={candidate.id}
                className={`candidate-item ${selectedId === candidate.id ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="summary-candidate"
                  checked={selectedId === candidate.id}
                  onChange={() => setSelectedId(candidate.id)}
                />
                <div className="candidate-info">
                  <div className="candidate-meta">
                    <span className="candidate-date">{formatDate(candidate.generated_at)}</span>
                    {candidate.window_index !== undefined && (
                      <span className="candidate-location">
                        window {candidate.window_index} / pane {candidate.pane_index ?? 0}
                      </span>
                    )}
                  </div>
                  <div className="candidate-preview">
                    {getPreview(candidate) || '(empty summary)'}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}

        <div className="candidate-actions">
          <button className="candidate-btn candidate-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="candidate-btn candidate-btn-load"
            onClick={handleLoad}
            disabled={selectedId === null || submitting}
          >
            {submitting ? 'Loading...' : 'Load Selected'}
          </button>
        </div>
      </div>
    </div>
  )
}
