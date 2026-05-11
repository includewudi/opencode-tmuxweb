import { useState, useMemo } from 'react'
import { RefreshCw, Search, ChevronRight, ChevronDown } from 'lucide-react'
import { MobilePanel } from './MobilePanel'
import { useProjectSummary, useProjectGoals } from '../shared/components/ProjectOverview/hooks/useProjectOverview'
import { timeAgo, projectName, stripSystemContent } from '../shared/components/ProjectOverview/helpers'
import type { ProjectSummary, Goal } from '../shared/components/ProjectOverview/types'
import '../shared/components/ProjectOverview/project-overview.css'
import './MobileProjectOverview.css'

interface MobileProjectOverviewProps {
  open: boolean
  onClose: () => void
}

export function MobileProjectOverview({ open, onClose }: MobileProjectOverviewProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set())

  const { projects, loading, error, refetch } = useProjectSummary()
  const { goals, loading: goalsLoading, refetch: refetchGoals } = useProjectGoals(selectedProjectId || '')

  const filtered = useMemo(() => {
    if (!search.trim()) return projects
    const q = search.toLowerCase()
    return projects.filter(p => {
      const name = projectName(p).toLowerCase()
      return name.includes(q) || p.path.toLowerCase().includes(q)
    })
  }, [projects, search])

  const selectedProject = useMemo(
    () => projects.find(p => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  )

  const toggleGoalExpand = (goalId: string) => {
    setExpandedGoals(prev => {
      const next = new Set(prev)
      if (next.has(goalId)) next.delete(goalId)
      else next.add(goalId)
      return next
    })
  }

  const headerActions = (
    <button
      className="mpo-refresh-btn"
      onClick={() => { refetch(); refetchGoals() }}
      title="刷新"
    >
      <RefreshCw size={16} />
    </button>
  )

  return (
    <MobilePanel title="项目总览" open={open} onClose={onClose} headerActions={headerActions} zIndex={162}>
      <div className="mpo-container">
        {/* Search */}
        <div className="mpo-search">
          <Search size={14} className="mpo-search-icon" />
          <input
            placeholder="搜索项目..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading && <div className="po-loading">加载中...</div>}
        {error && (
          <div className="po-error">
            加载失败
            <button className="po-error-retry" onClick={refetch}>重试</button>
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="po-empty">{projects.length === 0 ? '暂无项目数据' : '无匹配项目'}</div>
        )}

        {/* Project list (when no project selected) */}
        {!selectedProject && !loading && !error && (
          <div className="mpo-project-list">
            {filtered.map(p => (
              <div
                key={p.id}
                className="mpo-project-item"
                onClick={() => { setSelectedProjectId(p.id); setSelectedGoalId(null); setExpandedGoals(new Set()) }}
              >
                <MobileProjectRow project={p} />
              </div>
            ))}
          </div>
        )}

        {/* Goal panel (when project selected) */}
        {selectedProject && (
          <MobileGoalPanel
            project={selectedProject}
            goals={goals}
            loading={goalsLoading}
            selectedGoalId={selectedGoalId}
            expandedGoals={expandedGoals}
            onSelectGoal={setSelectedGoalId}
            onToggleExpand={toggleGoalExpand}
            onBack={() => { setSelectedProjectId(null); setSelectedGoalId(null); setExpandedGoals(new Set()) }}
          />
        )}
      </div>
    </MobilePanel>
  )
}

function MobileProjectRow({ project }: { project: ProjectSummary }) {
  const name = projectName(project)
  const { total, completed } = project.todoStats
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  const allDone = total > 0 && completed === total
  const msg = stripSystemContent(project.latestMessage)
  return (
    <>
      <div className="mpo-project-name" title={project.path}>{name}</div>
      <div className="po-split-item-meta">
        {project.lastActivity && <span>{timeAgo(project.lastActivity)}</span>}
        <span>📊 {project.sessionCount}</span>
        {project.activePlan && <span className="po-badge-plan">📋 {project.activePlan}</span>}
      </div>
      {total > 0 && (
        <div className="po-progress-wrap">
          <div className="po-progress-bar">
            <div
              className={`po-progress-fill ${allDone ? 'done' : 'pending'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="po-progress-text">{completed}/{total}</span>
        </div>
      )}
      {msg && (
        <div className="po-split-item-msg">
          {msg.length > 100 ? msg.slice(0, 100) + '…' : msg}
        </div>
      )}
    </>
  )
}

function MobileGoalPanel({ project, goals, loading, selectedGoalId, expandedGoals, onSelectGoal, onToggleExpand, onBack }: {
  project: ProjectSummary
  goals: Goal[]
  loading: boolean
  selectedGoalId: string | null
  expandedGoals: Set<string>
  onSelectGoal: (id: string | null) => void
  onToggleExpand: (id: string) => void
  onBack: () => void
}) {
  const name = projectName(project)
  return (
    <div className="mpo-goal-panel">
      {/* Back button + project header */}
      <div className="mpo-goal-header">
        <button className="mpo-back-btn" onClick={onBack}>← 返回列表</button>
        <div className="po-detail-header">
          <div className="po-detail-name">{name}</div>
          <div className="po-detail-path" title={project.path}>{project.path}</div>
          <div className="po-detail-meta">
            {project.lastActivity && <span>🕐 {timeAgo(project.lastActivity)}</span>}
            {project.activePlan && <span style={{ color: '#eab308' }}>📋 {project.activePlan}</span>}
            {project.completedPlans.length > 0 && <span>✅ {project.completedPlans.length} 已完成</span>}
          </div>
        </div>
      </div>

      {loading && <div className="po-loading">加载目标...</div>}
      {!loading && goals.length === 0 && <div className="po-empty">暂无目标数据</div>}

      <div className="po-goal-list">
        {goals.map(goal => {
          const isExpanded = expandedGoals.has(goal.id)
          const isSelected = selectedGoalId === goal.id
          return (
            <div key={goal.id} className={`po-goal-item${isSelected ? ' selected' : ''}`}>
              <div className="po-goal-item-header" onClick={() => onSelectGoal(isSelected ? null : goal.id)}>
                <button className="po-goal-expand-btn" onClick={(e) => { e.stopPropagation(); onToggleExpand(goal.id); }}>
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <span className={`po-goal-status ${goal.status}`}>
                  {goal.status === 'completed' ? '✅' : '🔄'}
                </span>
                <div className="po-goal-item-info">
                  <div className="po-goal-title" title={goal.title}>{goal.title}</div>
                  <div className="po-goal-item-badges">
                    <span>💬{goal.sessionCount}s</span>
                    <span>🔄{goal.userMessages + goal.assistantMessages}轮</span>
                    {goal.todoStats.total > 0 && (
                      <span className={goal.todoStats.pending > 0 ? 'po-badge-todo-pending' : 'po-badge-todo-done'}>
                        📋{goal.todoStats.completed}/{goal.todoStats.total}
                      </span>
                    )}
                    {goal.codeChanges.additions > 0 && (
                      <span className="po-badge-code">
                        +{goal.codeChanges.additions}/-{goal.codeChanges.deletions} ({goal.codeChanges.files}f)
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {isExpanded && (
                <div className="po-goal-item-body">
                  {goal.todoStats.total > 0 && (
                    <div className="po-goal-todos">
                      {goal.todos.map((todo, i) => (
                        <div className="po-todo-item" key={i}>
                          <span className="po-todo-icon">{todo.status === 'completed' ? '✅' : '⬜'}</span>
                          <span className="po-todo-content" title={todo.content}>{todo.content}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {goal.sessions.length > 1 && (
                    <div className="po-goal-sessions">
                      <div className="po-goal-sessions-title">子会话 ({goal.sessions.length})</div>
                      {goal.sessions.map(s => (
                        <div className="po-goal-session-row" key={s.id} title={s.firstUserMessage || s.title || undefined}>
                          <span className="po-goal-session-title">
                            {s.firstUserMessage ? s.firstUserMessage.slice(0, 60) : (s.title || s.id)}
                          </span>
                          {s.agent && <span className="po-goal-session-agent">{s.agent}</span>}
                          {s.summaryAdditions > 0 && <span className="po-badge-code">+{s.summaryAdditions}/-{s.summaryDeletions}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
