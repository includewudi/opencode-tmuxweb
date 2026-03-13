import { Task } from '../../types'

interface Props {
  task: Task
  isCurrent?: boolean
  onComplete?: () => void
  onSelect?: () => void
}

export function TaskCard({ task, isCurrent = false, onComplete, onSelect }: Props) {
  const formatTime = (timestamp: number) => {
    if (!timestamp) return '—'
    const date = new Date(timestamp * 1000)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div
      className={`task-card ${isCurrent ? 'current' : ''} ${task.task_status}`}
      onClick={onSelect}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      <div className="task-header">
        <span className="task-id">#{task.id}</span>
        <span className={`task-badge ${task.task_status}`}>
          {task.task_status === 'in_progress' ? '● Active' : '✓ Done'}
        </span>
      </div>
      <div className="task-title">{task.task_title || 'Untitled Task'}</div>
      <div className="task-meta">
        <span className="task-time">Started: {formatTime(task.started_at)}</span>
        {task.completed_at > 0 && (
          <span className="task-time">Completed: {formatTime(task.completed_at)}</span>
        )}
      </div>
      {isCurrent && task.task_status === 'in_progress' && onComplete && (
        <div className="task-actions">
          <button
            className="btn-complete"
            onClick={(e) => {
              e.stopPropagation()
              onComplete()
            }}
          >
            Mark Done
          </button>
        </div>
      )}
    </div>
  )
}
