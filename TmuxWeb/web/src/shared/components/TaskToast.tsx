import { useState, useEffect } from 'react'
import { X, CheckCircle2, Clock, Terminal, MessageSquare } from 'lucide-react'
import type { TaskNotification } from '../../hooks/useGlobalTaskNotifications'
import { waitingActionLabel } from '../../hooks/taskNotificationUtils'
import './TaskToast.css'

interface TaskToastContainerProps {
  notifications: TaskNotification[]
  onDismiss: (id: string) => void
}

const STATUS_CONFIG: Record<string, {
  icon: typeof CheckCircle2
  color: string
  label: string
  borderColor: string
}> = {
  task_completed: { icon: CheckCircle2, color: 'var(--green-400, #4ade80)',  label: 'Completed',   borderColor: 'var(--green-500, #22c55e)' },
  task_waiting:   { icon: Clock,        color: 'var(--yellow-400, #facc15)', label: 'Waiting',     borderColor: 'var(--yellow-500, #eab308)' },
}

function ElapsedTime({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  const secs = Math.max(0, now - startedAt)
  if (secs < 60) return <span>{secs}s</span>
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return <span>{m}m {s}s</span>
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max) + '…'
}

export function TaskToastContainer({ notifications, onDismiss }: TaskToastContainerProps) {
  if (notifications.length === 0) return null

  return (
    <div className="task-toast-container">
      {notifications.map(n => {
        const config = STATUS_CONFIG[n.type]
        const Icon = config.icon
        const label = n.type === 'task_waiting'
          ? waitingActionLabel(n.waitingAction ?? null)
          : config.label
        const glow = n.type === 'task_completed' ? '74, 222, 128' : '250, 204, 21'
        const style = {
          '--island-accent': config.color,
          '--island-glow': glow,
        } as React.CSSProperties

        const handleClick = () => {
          window.dispatchEvent(new CustomEvent('navigate-to-pane', {
            detail: { paneKey: n.paneKey }
          }))
          onDismiss(n.id)
        }

        return (
          <div
            key={n.id}
            className="task-toast"
            style={style}
            onClick={handleClick}
            role="button"
            tabIndex={0}
          >
            <div className="task-toast-header">
              <Icon size={14} style={{ color: config.color, flexShrink: 0 }} />
              <span className="task-toast-label" style={{ color: config.color }}>{label}</span>
              <div className="task-toast-header-right">
                <Terminal size={10} style={{ color: 'var(--zinc-500, #71717a)' }} />
                <span className="task-toast-pane">{n.paneKey}</span>
                <span className="task-toast-elapsed">
                  <ElapsedTime startedAt={n.startedAt} />
                </span>
                <button
                  className="task-toast-close"
                  onClick={(e) => { e.stopPropagation(); onDismiss(n.id) }}
                >
                  <X size={11} />
                </button>
              </div>
            </div>

            {n.userMessage && (
              <div className="task-toast-question">
                <MessageSquare size={10} style={{ color: 'var(--zinc-500, #71717a)', flexShrink: 0, marginTop: 2 }} />
                <span>{truncate(n.userMessage, 120)}</span>
              </div>
            )}

            {n.assistantMessage && (
              <div className="task-toast-reply">
                {truncate(n.assistantMessage, 160)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
