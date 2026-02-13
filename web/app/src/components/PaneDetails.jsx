import { useState, useEffect, useCallback } from 'react'
import { X, Clock, MessageSquare, Code, Plus } from 'lucide-react'
import TaskCard from './TaskCard'
import LogAccordion from './LogAccordion'
import SummarySection from './SummarySection'
import SummaryCandidatePicker from './SummaryCandidatePicker'
import './PaneDetails.css'

export default function PaneDetails({ paneKey, profileKey, onClose, onStatusChanged }) {
  const [tasks, setTasks] = useState([])
  const [selectedTask, setSelectedTask] = useState(null)
  const [status, setStatus] = useState('idle')
  const [loading, setLoading] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [showCandidatePicker, setShowCandidatePicker] = useState(false)

  const parsePaneKey = (key) => {
    const parts = key.split('/')
    return {
      session: parts[0] || '—',
      window: parts[1] || '—',
      pane: parts[2] || '—'
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
      const current = (data.tasks || []).find((t) => t.task_status === 'in_progress')
      if (current) {
        fetchTaskDetail(current.id)
      } else {
        setSelectedTask(null)
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
    } finally {
      setLoading(false)
    }
  }, [paneKey])

  const fetchTaskDetail = async (taskId) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/detail`, {
        credentials: 'include'
      })
      const data = await res.json()
      setSelectedTask(data)
    } catch (err) {
      console.error('Failed to fetch task detail:', err)
    }
  }

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

  const updateStatus = async (newStatus) => {
    if (!paneKey) return
    try {
      await fetch('/api/panes/status', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_key: profileKey,
          paneKey,
          status: newStatus
        })
      })
      setStatus(newStatus)
      onStatusChanged?.()
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  const createTask = async () => {
    if (!paneKey || !newTaskTitle.trim()) return
    try {
      const res = await fetch(`/api/panes/${encodeURIComponent(paneKey)}/tasks`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTaskTitle.trim() })
      })
      const data = await res.json()
      if (data.id) {
        setNewTaskTitle('')
        setIsCreatingTask(false)
        fetchTasks()
      }
    } catch (err) {
      console.error('Failed to create task:', err)
    }
  }

  const completeTask = async (taskId) => {
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

  const handleSummaryRegenerate = () => {
    if (selectedTask) {
      fetchTaskDetail(selectedTask.id)
    }
  }

  const handleLoadSummary = () => {
    setShowCandidatePicker(false)
    if (selectedTask) {
      fetchTaskDetail(selectedTask.id)
    }
  }

  if (!paneKey) return null

  const { session, window, pane } = parsePaneKey(paneKey)
  const currentTask = tasks.find(t => t.task_status === 'in_progress')
  const previousTasks = tasks.filter(t => t.task_status === 'completed')

  return (
    <div className="pane-details-container">
      <header className="drawer-header">
        <h2 className="drawer-title">Pane Details</h2>
        <button className="drawer-close" onClick={onClose}>
          <X size={16} />
        </button>
      </header>

      <div className="drawer-pane-info">
        <div className="pane-location">
          <span className="loc-session">{session}</span>
          <span className="loc-sep">/</span>
          <span className="loc-window">{window}</span>
          <span className="loc-sep">/</span>
          <span className="loc-pane">{pane}</span>
        </div>
        <div className="pane-status-row">
          <label className="status-label">Status:</label>
          <select
            className="status-select"
            value={status}
            onChange={e => updateStatus(e.target.value)}
          >
            <option value="idle">Idle</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>
        </div>
      </div>

      <div className="drawer-content">
        {loading ? (
          <div className="drawer-loading">Loading...</div>
        ) : (
          <>
            <section className="drawer-section">
              <div className="section-header">
                <h3 className="section-title">Current Task</h3>
                {!currentTask && !isCreatingTask && (
                  <button
                    className="btn-new-task"
                    onClick={() => setIsCreatingTask(true)}
                  >
                    <Plus size={14} style={{ marginRight: 4 }} />
                    New Task
                  </button>
                )}
              </div>

              {isCreatingTask && (
                <div className="new-task-form">
                  <input
                    type="text"
                    className="task-input"
                    placeholder="Task title..."
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') createTask()
                      if (e.key === 'Escape') {
                        setIsCreatingTask(false)
                        setNewTaskTitle('')
                      }
                    }}
                    autoFocus
                  />
                  <div className="form-actions">
                    <button className="btn-confirm" onClick={createTask}>Create</button>
                    <button
                      className="btn-cancel"
                      onClick={() => {
                        setIsCreatingTask(false)
                        setNewTaskTitle('')
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {currentTask && (
                <TaskCard
                  task={currentTask}
                  isCurrent
                  onComplete={() => completeTask(currentTask.id)}
                  onSelect={() => fetchTaskDetail(currentTask.id)}
                />
              )}

              {!currentTask && !isCreatingTask && (
                <div className="no-task">No active task</div>
              )}
            </section>

            {selectedTask && (
              <section className="drawer-section">
                <h3 className="section-title">Segment Logs</h3>
                
                <LogAccordion
                  title="Conversation"
                  count={selectedTask.conversation?.length || 0}
                  icon={<MessageSquare size={14} />}
                  defaultOpen
                >
                  <div className="log-list chat-log">
                    {(selectedTask.conversation || []).map((msg) => (
                      <div key={msg.id} className={`chat-msg ${msg.role}`}>
                        <span className="msg-role">{msg.role}:</span>
                        <span className="msg-content">{msg.content}</span>
                      </div>
                    ))}
                    {(!selectedTask.conversation || selectedTask.conversation.length === 0) && (
                      <div className="log-empty">No messages</div>
                    )}
                  </div>
                </LogAccordion>

                <LogAccordion
                  title="Commands"
                  count={selectedTask.commands?.length || 0}
                  icon={<Code size={14} />}
                >
                  <div className="log-list cmd-log">
                    {(selectedTask.commands || []).map((cmd) => (
                      <div key={cmd.id} className={`cmd-item ${cmd.exit_code !== 0 ? 'error' : ''}`}>
                        <code className="cmd-text">{cmd.command}</code>
                        {cmd.exit_code !== 0 && (
                          <span className="cmd-exit">exit: {cmd.exit_code}</span>
                        )}
                      </div>
                    ))}
                    {(!selectedTask.commands || selectedTask.commands.length === 0) && (
                      <div className="log-empty">No commands</div>
                    )}
                  </div>
                </LogAccordion>

                <SummarySection
                  taskId={selectedTask.id}
                  summary={selectedTask.summary}
                  onRegenerate={handleSummaryRegenerate}
                  onLoadPrevious={() => setShowCandidatePicker(true)}
                />
              </section>
            )}

            {previousTasks.length > 0 && (
              <section className="drawer-section">
                <LogAccordion
                  title="Previous Tasks"
                  count={previousTasks.length}
                  icon={<Clock size={14} />}
                >
                  <div className="task-list">
                    {previousTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onSelect={() => fetchTaskDetail(task.id)}
                      />
                    ))}
                  </div>
                </LogAccordion>
              </section>
            )}
          </>
        )}
      </div>

      {showCandidatePicker && paneKey && selectedTask && (
        <SummaryCandidatePicker
          paneKey={paneKey}
          taskId={selectedTask.id}
          currentCommandSummary={selectedTask.summary?.command_summary}
          currentOutputSummary={selectedTask.summary?.output_summary}
          onSelect={handleLoadSummary}
          onClose={() => setShowCandidatePicker(false)}
        />
      )}
    </div>
  )
}
