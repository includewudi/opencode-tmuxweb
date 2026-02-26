import { useState, useEffect, useCallback, useMemo } from 'react'
import { Task } from '../../types'
import { RefreshCw, TerminalSquare, CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react'
import './GlobalTaskOverview.css'

interface GlobalTaskOverviewProps {
    onSelectPane: (paneId: string, paneName: string) => void
    statusRefreshToken?: number
}

// Extend Task to include paneKey that we added in the backend
interface GlobalTask extends Task {
    paneKey: string
    session_name: string
    window_index: number
    pane_index: number
}

export function GlobalTaskOverview({ onSelectPane, statusRefreshToken }: GlobalTaskOverviewProps) {
    const [tasks, setTasks] = useState<GlobalTask[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchTasks = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/tasks?limit=100', { credentials: 'include' })
            if (!res.ok) throw new Error('Failed to fetch tasks')
            const data = await res.json()
            setTasks(data.tasks || [])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchTasks()
    }, [fetchTasks, statusRefreshToken])

    // Group tasks by status
    const groupedTasks = useMemo(() => {
        const groups: Record<string, GlobalTask[]> = {
            in_progress: [],
            waiting: [],
            failed: [],
            completed: []
        }

        tasks.forEach(task => {
            const status = task.task_status
            if (groups[status]) {
                groups[status].push(task)
            } else {
                // Fallback for unknown status
                groups.completed.push(task)
            }
        })

        return groups
    }, [tasks])

    const handleTaskClick = (task: GlobalTask) => {
        const paneName = `${task.session_name}:${task.window_index}`
        // the UI expects a paneId string like "%4" which we don't have directly parsed out as a distinct variable, 
        // but we can construct it or pass the exact paneKey components. MobileDrawer & App expect paneId (%id) and paneName
        // Let's pass the pane ID which is stored in pane_index (often an integer or string like "%4")
        // Note: the backend returns pane_index which might be the string %id. Let's use it directly.
        onSelectPane(String(task.pane_index), paneName)
    }

    const renderTaskGroup = (title: string, icon: React.ReactNode, groupTasks: GlobalTask[], emptyText?: string) => {
        if (groupTasks.length === 0 && !emptyText) return null

        return (
            <div className="task-group">
                <div className="task-group-header">
                    {icon}
                    <span>{title}</span>
                    <span className="task-group-count">{groupTasks.length}</span>
                </div>

                {groupTasks.length === 0 && emptyText ? (
                    <div className="task-group-empty">{emptyText}</div>
                ) : (
                    <div className="task-group-list">
                        {groupTasks.map(task => (
                            <div
                                key={task.id}
                                className={`task-item status-${task.task_status}`}
                                onClick={() => handleTaskClick(task)}
                            >
                                <div className="task-item-title">{task.task_title || 'Untitled Task'}</div>
                                <div className="task-item-meta">
                                    <TerminalSquare size={10} />
                                    <span>{task.session_name}:{task.window_index}</span>
                                    <span className="task-item-time">
                                        {new Date(task.mtime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="global-task-overview">
            <div className="global-task-header">
                <span className="global-task-title">Tasks</span>
                <button
                    className="global-task-refresh"
                    onClick={fetchTasks}
                    title="Refresh Tasks"
                    disabled={loading}
                >
                    <RefreshCw size={14} className={loading ? 'spinning' : ''} />
                </button>
            </div>

            <div className="global-task-content">
                {error ? (
                    <div className="global-task-error">
                        <XCircle size={16} />
                        <span>{error}</span>
                        <button onClick={fetchTasks}>Retry</button>
                    </div>
                ) : loading && tasks.length === 0 ? (
                    <div className="global-task-loading">
                        <Loader2 size={24} className="spinning" />
                        <span>Loading tasks...</span>
                    </div>
                ) : (
                    <>
                        {renderTaskGroup(
                            'In Progress',
                            <Loader2 size={12} className="spinning" style={{ color: 'var(--blue-400)' }} />,
                            groupedTasks.in_progress,
                            'No active tasks'
                        )}
                        {renderTaskGroup(
                            'Waiting',
                            <Clock size={12} style={{ color: 'var(--yellow-400)' }} />,
                            groupedTasks.waiting
                        )}
                        {renderTaskGroup(
                            'Failed',
                            <XCircle size={12} style={{ color: 'var(--red-400)' }} />,
                            groupedTasks.failed
                        )}
                        {renderTaskGroup(
                            'Completed',
                            <CheckCircle2 size={12} style={{ color: 'var(--green-400)' }} />,
                            groupedTasks.completed.slice(0, 15) // Show only recent 15 completed tasks
                        )}

                        {tasks.length === 0 && !loading && (
                            <div className="global-task-empty-all">
                                No tasks found across sessions
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
