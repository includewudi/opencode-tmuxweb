import { PaneStatus } from '../../types'
import { Check, Circle, Loader2, XCircle, Clock } from 'lucide-react'
import './StatusBadge.css'

interface Props {
  status: PaneStatus
  onChange?: (newStatus: PaneStatus) => void
  size?: 'small' | 'medium'
}

const statusLabels: Record<PaneStatus, string> = {
  idle: 'Idle',
  in_progress: 'In Progress',
  done: 'Done',
  failed: 'Failed',
  waiting: 'Waiting'
}

const statusOptions: PaneStatus[] = ['idle', 'in_progress', 'done', 'failed', 'waiting']

function StatusIcon({ status, size }: { status: PaneStatus; size: 'small' | 'medium' }) {
  const iconSize = size === 'small' ? 10 : 12
  if (status === 'in_progress') {
    return <Loader2 size={iconSize} className="status-icon status-icon--spinning" />
  }
  if (status === 'done') {
    return <Check size={iconSize} className="status-icon status-icon--done" />
  }
  if (status === 'failed') {
    return <XCircle size={iconSize} className="status-icon status-icon--failed" />
  }
  if (status === 'waiting') {
    return <Clock size={iconSize} className="status-icon status-icon--waiting" />
  }
  return <Circle size={iconSize} className="status-icon status-icon--idle" />
}

export function StatusBadge({ status, onChange, size = 'small' }: Props) {
  const isEditable = !!onChange

  if (isEditable) {
    return (
      <div className={`status-badge status-badge--${status} status-badge--${size} status-badge--editable`}>
        <StatusIcon status={status} size={size} />
        <select
          className="status-badge__select"
          value={status}
          onChange={(e) => onChange(e.target.value as PaneStatus)}
          onClick={(e) => e.stopPropagation()}
        >
          {statusOptions.map((opt) => (
            <option key={opt} value={opt}>
              {statusLabels[opt]}
            </option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div className={`status-badge status-badge--${status} status-badge--${size}`}>
      <StatusIcon status={status} size={size} />
      {size === 'medium' && <span className="status-badge__label">{statusLabels[status]}</span>}
    </div>
  )
}
