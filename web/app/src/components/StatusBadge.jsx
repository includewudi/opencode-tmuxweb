import './StatusBadge.css'

const statusLabels = {
  idle: 'Idle',
  in_progress: 'In Progress',
  done: 'Done'
}

const statusOptions = ['idle', 'in_progress', 'done']

export function StatusBadge({ status, onChange, size = 'small' }) {
  const isEditable = !!onChange

  if (isEditable) {
    return (
      <div className={`status-badge status-badge--${status} status-badge--${size} status-badge--editable`}>
        <span className="status-badge__dot" />
        <select
          className="status-badge__select"
          value={status}
          onChange={(e) => onChange(e.target.value)}
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
      <span className="status-badge__dot" />
      {size === 'medium' && <span className="status-badge__label">{statusLabels[status]}</span>}
    </div>
  )
}
