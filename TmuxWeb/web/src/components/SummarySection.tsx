import { useState } from 'react'
import { TaskSummary } from '../types'
import './SummarySection.css'

interface Props {
  taskId: number
  summary: TaskSummary | null
  onRegenerate: (type: 'command' | 'output') => void
  onLoadPrevious: () => void
}

type SummaryServiceState = 'available' | 'not_configured' | 'unknown'

export function SummarySection({ taskId, summary, onRegenerate, onLoadPrevious }: Props) {
  const [expandedCommand, setExpandedCommand] = useState(false)
  const [expandedOutput, setExpandedOutput] = useState(false)
  const [generating, setGenerating] = useState<'command' | 'output' | null>(null)
  const [serviceState, setServiceState] = useState<SummaryServiceState>('unknown')

  const handleGenerate = async (type: 'command' | 'output') => {
    setGenerating(type)
    try {
      const res = await fetch(`/api/tasks/${taskId}/summarize`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      })
      
      if (res.status === 501) {
        setServiceState('not_configured')
        return
      }
      
      if (res.ok) {
        setServiceState('available')
        onRegenerate(type)
      }
    } catch (err) {
      console.error('Failed to generate summary:', err)
    } finally {
      setGenerating(null)
    }
  }

  const renderSummaryStatus = (status: TaskSummary['summary_status']) => {
    switch (status) {
      case 'pending':
        return <span className="summary-status pending">Generating...</span>
      case 'running':
        return <span className="summary-status running">Processing...</span>
      case 'error':
        return <span className="summary-status error">Failed to generate</span>
      default:
        return null
    }
  }

  const renderSummaryContent = (
    content: string | null,
    type: 'command' | 'output',
    expanded: boolean,
    onToggle: () => void
  ) => {
    const status = summary?.summary_status

    if (serviceState === 'not_configured') {
      return (
        <span className="summary-not-configured">Summary service not configured</span>
      )
    }

    if (status === 'pending' || status === 'running') {
      return renderSummaryStatus(status)
    }

    if (status === 'error') {
      return (
        <div className="summary-error-row">
          {renderSummaryStatus(status)}
          <button
            className="summary-btn summary-btn-retry"
            onClick={() => handleGenerate(type)}
            disabled={generating === type}
          >
            {generating === type ? 'Retrying...' : 'Retry'}
          </button>
        </div>
      )
    }

    if (!content) {
      return (
        <div className="summary-empty-row">
          <span className="summary-empty">(not generated)</span>
          <button
            className="summary-btn summary-btn-generate"
            onClick={() => handleGenerate(type)}
            disabled={generating === type}
          >
            {generating === type ? 'Generating...' : 'Generate'}
          </button>
        </div>
      )
    }

    const isLong = content.length > 200
    const displayText = isLong && !expanded ? content.slice(0, 200) + '...' : content

    return (
      <div className="summary-content-row">
        <p className="summary-text">{displayText}</p>
        <div className="summary-actions">
          {isLong && (
            <button className="summary-btn summary-btn-expand" onClick={onToggle}>
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
          <button
            className="summary-btn summary-btn-regenerate"
            onClick={() => handleGenerate(type)}
            disabled={generating === type}
          >
            {generating === type ? 'Regenerating...' : 'Regenerate'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="summary-section">
      <div className="summary-header">
        <h4 className="summary-title">Summaries</h4>
        <button className="summary-btn summary-btn-load" onClick={onLoadPrevious}>
          Load Previous
        </button>
      </div>

      <div className="summary-divider" />

      <div className="summary-item">
        <div className="summary-label">Command Summary</div>
        {renderSummaryContent(
          summary?.command_summary ?? null,
          'command',
          expandedCommand,
          () => setExpandedCommand(!expandedCommand)
        )}
      </div>

      <div className="summary-divider-subtle" />

      <div className="summary-item">
        <div className="summary-label">Output Summary</div>
        {renderSummaryContent(
          summary?.output_summary ?? null,
          'output',
          expandedOutput,
          () => setExpandedOutput(!expandedOutput)
        )}
      </div>
    </div>
  )
}
