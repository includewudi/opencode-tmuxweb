import { useState, useEffect, useCallback } from 'react'
import { X, ChevronDown, ChevronRight, Bot, Briefcase } from 'lucide-react'
import { Task, PaneStatus, AiConversation } from '../../types'
import { TaskCard } from './TaskCard'
import { LogAccordion } from './LogAccordion'
import { useAIConversations } from '../../hooks/useAIConversations'
import './PaneDetails.css'

interface Props {
  paneKey: string | null
  profileKey: string
  onClose: () => void
  onStatusChanged?: () => void
}

function formatRelativeTime(unixSeconds: number): string {
  const now = Date.now() / 1000
  const diff = now - unixSeconds
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(unixSeconds * 1000).toLocaleDateString()
}

function formatDuration(startedAt: number, completedAt: number | null): string {
  const end = completedAt || Date.now() / 1000
  const diff = end - startedAt
  if (diff < 60) return `${Math.floor(diff)}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${Math.floor(diff % 60)}s`
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`
}

function ConversationCard({ conv }: { conv: AiConversation }) {
  const [expanded, setExpanded] = useState(false)
  const hasReply = conv.conv_status === 'completed' && conv.assistant_message

  return (
    <div className={`conv-card ${conv.conv_status}`}>
      <div className="conv-card-header" onClick={() => hasReply && setExpanded(!expanded)}>
        <div className="conv-card-left">
          <span className={`conv-status-dot ${conv.conv_status}`} />
          <span className="conv-user-msg">
            {conv.user_message || '—'}
          </span>
        </div>
        <div className="conv-card-right">
          <span className="conv-time">{formatRelativeTime(conv.started_at)}</span>
          {hasReply && (
            expanded
              ? <ChevronDown size={12} className="conv-chevron" />
              : <ChevronRight size={12} className="conv-chevron" />
          )}
        </div>
      </div>

      <div className="conv-card-meta">
        <span className={`conv-badge ${conv.conv_status}`}>
          {conv.conv_status === 'in_progress' ? 'running'
            : conv.conv_status === 'failed' ? 'failed'
            : conv.conv_status === 'waiting' ? 'waiting'
            : conv.conv_status}
        </span>
        <span className="conv-duration">
          {formatDuration(conv.started_at, conv.completed_at)}
        </span>
      </div>

      {conv.conv_status === 'in_progress' && (
        <div className="conv-running-indicator">
          <span className="conv-running-dot" />
          Processing...
        </div>
      )}

      {conv.conv_status === 'waiting' && (
        <div className="conv-running-indicator waiting">
          <span className="conv-waiting-dot" />
          Waiting for input...
        </div>
      )}

      {expanded && hasReply && (
        <div className="conv-reply">
          <div className="conv-reply-content">{conv.assistant_message}</div>
        </div>
      )}
    </div>
  )
}

export function PaneDetails({ paneKey, profileKey, onClose }: Props) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [_status, setStatus] = useState<PaneStatus>('idle')
  const [_loading, setLoading] = useState(false)
  const { conversations: aiConversations, loading: convLoading } = useAIConversations(paneKey)

  const parsePaneKey = (key: string) => {
    const parts = key.split(':')
    return {
      session: parts.slice(0, -2).join(':') || '—',
      window: parts[parts.length - 2] || '—',
      pane: parts[parts.length - 1] || '—'
    }
  }

  const fetchTasks = useCallback(async () => {
    if (!paneKey) return
    setLoading(true)
    try {
      const res = await fetch(`/api/panes/${encodeURIComponent(paneKey)}/tasks`, {
        credentials: 'include'
      })
      const data = await res.json()
      setTasks(data.tasks || [])
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
    } finally {
      setLoading(false)
    }
  }, [paneKey])

  const fetchStatus = useCallback(async () => {
    if (!paneKey || !profileKey) return
    try {
      const res = await fetch(
        `/api/panes/status?profile_key=${encodeURIComponent(profileKey)}&paneKey=${encodeURIComponent(paneKey)}`,
        { credentials: 'include' }
      )
      const data = await res.json()
      const panes = data.panes || []
      if (panes.length > 0) {
        setStatus(panes[0].status)
      }
    } catch (err) {
      console.error('Failed to fetch status:', err)
    }
  }, [paneKey, profileKey])

  useEffect(() => {
    if (paneKey) {
      fetchTasks()
      fetchStatus()
    }
  }, [paneKey, fetchTasks, fetchStatus])

  const completeTask = async (taskId: number) => {
    try {
      await fetch(`/api/tasks/${taskId}/complete`, {
        method: 'POST',
        credentials: 'include'
      })
      fetchTasks()
    } catch (err) {
      console.error('Failed to complete task:', err)
    }
  }

  if (!paneKey) return null

  const { session, window: win, pane } = parsePaneKey(paneKey)

    const sortedConversations = [...aiConversations].sort((a, b) => b.started_at - a.started_at)
  const runningCount = aiConversations.filter(c => c.conv_status === 'in_progress').length

  const allTasks = tasks
  const currentTask = allTasks.find(t => t.task_status === 'in_progress')

  return (
    <div className="pane-details-container">
      <header className="drawer-header">
        <div className="drawer-header-left">
          <h2 className="drawer-title">Execution History</h2>
          <span className="drawer-pane-badge">
            {session}<span className="badge-sep">:</span>{win}<span className="badge-sep">:</span>{pane}
          </span>
        </div>
        <button className="drawer-close" onClick={onClose}>
          <X size={16} />
        </button>
      </header>

      <div className="drawer-content">
        <section className="drawer-section conv-section">
          <div className="conv-section-header">
            <div className="conv-section-title-row">
              <Bot size={14} className="conv-section-icon" />
              <span className="conv-section-title">Tasks</span>
              <span className="conv-count-badge">{aiConversations.length}</span>
            </div>
            {runningCount > 0 && (
              <span className="conv-running-badge">
                {runningCount} running
              </span>
            )}
          </div>

          {convLoading && aiConversations.length === 0 ? (
            <div className="drawer-loading">Loading...</div>
          ) : sortedConversations.length === 0 ? (
            <div className="conv-empty">
              <Bot size={24} className="conv-empty-icon" />
              <span>No tasks yet</span>
              <span className="conv-empty-hint">Tasks appear automatically when you use AI</span>
            </div>
          ) : (
            <div className="conv-list">
              {sortedConversations.map(conv => (
                <ConversationCard key={conv.conversation_id} conv={conv} />
              ))}
            </div>
          )}
        </section>

        {allTasks.length > 0 && (
          <section className="drawer-section manual-tasks-section">
            <LogAccordion
              title="Manual Tasks"
              count={allTasks.length}
              icon={<Briefcase size={14} />}
            >
              <div className="task-list">
                {allTasks
                  .filter(t => t.task_status === "in_progress")
                  .map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isCurrent={task === currentTask}
                      onComplete={() => completeTask(task.id)}
                    />
                  ))}
                {allTasks
                  .filter(t => t.task_status === "completed")
                  .map(task => (
                    <TaskCard key={task.id} task={task} />
                  ))}
              </div>
            </LogAccordion>
          </section>
        )}
      </div>
    </div>
  )
}
