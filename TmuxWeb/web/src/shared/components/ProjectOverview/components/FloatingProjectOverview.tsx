import { useState, useMemo } from 'react';
import { BarChart3, Minus, X, RefreshCw, Search, ChevronRight, ChevronDown } from 'lucide-react';
import { useFloatingPanel } from '../../imperial-study/hooks/useFloatingPanel';
import { useProjectSummary, useProjectGoals } from '../hooks/useProjectOverview';
import { timeAgo, projectName, stripSystemContent } from '../helpers';
import type { ProjectSummary, Goal } from '../types';
import '../project-overview.css';

interface Props { onClose: () => void }

export function FloatingProjectOverview({ onClose }: Props) {
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());

    const { collapsed, position, size, onDragStart, onResizeStart, toggleCollapse } = useFloatingPanel({
        storageKey: 'project-overview-panel',
        defaultSize: { width: 1020, height: 740 },
        minWidth: 700,
        minHeight: 450,
    });

    const { projects, loading, error, refetch } = useProjectSummary();
    const { goals, loading: goalsLoading, refetch: refetchGoals } = useProjectGoals(selectedProjectId || '');

    const filtered = useMemo(() => {
        if (!search.trim()) return projects;
        const q = search.toLowerCase();
        return projects.filter(p => {
            const name = projectName(p).toLowerCase();
            return name.includes(q) || p.path.toLowerCase().includes(q);
        });
    }, [projects, search]);

    const selectedProject = useMemo(
        () => projects.find(p => p.id === selectedProjectId) ?? null,
        [projects, selectedProjectId]
    );

    const toggleGoalExpand = (goalId: string) => {
        setExpandedGoals(prev => {
            const next = new Set(prev);
            if (next.has(goalId)) next.delete(goalId);
            else next.add(goalId);
            return next;
        });
    };

    if (collapsed) {
        return (
            <div className="is-floating-bubble" style={{ left: position.x, top: position.y }} onClick={toggleCollapse} title="展开项目总览">
                <BarChart3 size={20} />
                {projects.length > 0 && <span className="is-floating-bubble__badge">{projects.length}</span>}
            </div>
        );
    }

    return (
        <div className="is-floating-panel po-float-panel" style={{ left: position.x, top: position.y, width: size.width, height: size.height }}>
            <div className="is-floating-panel__titlebar" onMouseDown={(e) => { if ((e.target as HTMLElement).closest('button')) return; onDragStart(e); }}>
                <BarChart3 size={12} className="is-floating-panel__icon" />
                <span className="is-floating-panel__title">项目总览</span>
                <span className="is-floating-panel__stats">{projects.length} 个项目</span>
                <div className="is-floating-panel__actions">
                    <button className="is-floating-panel__btn" onClick={(e) => { e.stopPropagation(); refetch(); refetchGoals(); }} title="刷新"><RefreshCw size={12} /></button>
                    <button className="is-floating-panel__btn" onClick={(e) => { e.stopPropagation(); toggleCollapse(); }} title="最小化"><Minus size={12} /></button>
                    <button className="is-floating-panel__btn is-floating-panel__btn--close" onClick={(e) => { e.stopPropagation(); onClose(); }} title="关闭"><X size={12} /></button>
                </div>
            </div>

            <div className="po-split">
                <div className="po-split-left">
                    <div className="po-split-search">
                        <Search size={14} className="po-split-search-icon" />
                        <input placeholder="搜索项目..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    {loading && <div className="po-loading">加载中...</div>}
                    {error && <div className="po-error">加载失败<button className="po-error-retry" onClick={refetch}>重试</button></div>}
                    {!loading && !error && filtered.length === 0 && <div className="po-empty">{projects.length === 0 ? '暂无项目数据' : '无匹配项目'}</div>}
                    <div className="po-split-list">
                        {filtered.map(p => (
                            <div key={p.id} className={`po-split-item${selectedProjectId === p.id ? ' selected' : ''}`} onClick={() => { setSelectedProjectId(prev => prev === p.id ? null : p.id); setSelectedGoalId(null); setExpandedGoals(new Set()); }}>
                                <ProjectRowContent project={p} />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="po-split-right">
                    {!selectedProject && <div className="po-split-empty">← 选择一个项目查看目标</div>}
                    {selectedProject && (
                        <GoalPanel project={selectedProject} goals={goals} loading={goalsLoading} selectedGoalId={selectedGoalId} expandedGoals={expandedGoals} onSelectGoal={setSelectedGoalId} onToggleExpand={toggleGoalExpand} />
                    )}
                </div>
            </div>
            <div className="is-floating-panel__resize" onMouseDown={onResizeStart} />
        </div>
    );
}

function ProjectRowContent({ project }: { project: ProjectSummary }) {
    const name = projectName(project);
    const { total, completed } = project.todoStats;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const allDone = total > 0 && completed === total;
    const msg = stripSystemContent(project.latestMessage);
    return (
        <>
            <div className="po-split-item-name" title={project.path}>{name}</div>
            <div className="po-split-item-meta">
                {project.lastActivity && <span>{timeAgo(project.lastActivity)}</span>}
                <span>📊 {project.sessionCount}</span>
                {project.activePlan && <span className="po-badge-plan">📋 {project.activePlan}</span>}
            </div>
            {total > 0 && (
                <div className="po-progress-wrap">
                    <div className="po-progress-bar"><div className={`po-progress-fill ${allDone ? 'done' : 'pending'}`} style={{ width: `${pct}%` }} /></div>
                    <span className="po-progress-text">{completed}/{total}</span>
                </div>
            )}
            {msg && <div className="po-split-item-msg">{msg.length > 80 ? msg.slice(0, 80) + '…' : msg}</div>}
        </>
    );
}

function GoalPanel({ project, goals, loading, selectedGoalId, expandedGoals, onSelectGoal, onToggleExpand }: {
    project: ProjectSummary; goals: Goal[]; loading: boolean; selectedGoalId: string | null; expandedGoals: Set<string>; onSelectGoal: (id: string | null) => void; onToggleExpand: (id: string) => void;
}) {
    const name = projectName(project);
    return (
        <div className="po-goal-panel">
            <div className="po-detail-header">
                <div className="po-detail-name">{name}</div>
                <div className="po-detail-path" title={project.path}>{project.path}</div>
                <div className="po-detail-meta">
                    {project.lastActivity && <span>🕐 {timeAgo(project.lastActivity)}</span>}
                    {project.activePlan && <span style={{ color: '#eab308' }}>📋 {project.activePlan}</span>}
                    {project.completedPlans.length > 0 && <span>✅ {project.completedPlans.length} 已完成</span>}
                </div>
            </div>
            {loading && <div className="po-loading">加载目标...</div>}
            {!loading && goals.length === 0 && <div className="po-empty">暂无目标数据</div>}
            <div className="po-goal-list">
                {goals.map(goal => {
                    const isExpanded = expandedGoals.has(goal.id);
                    const isSelected = selectedGoalId === goal.id;
                    return (
                        <div key={goal.id} className={`po-goal-item${isSelected ? ' selected' : ''}`}>
                            <div className="po-goal-item-header" onClick={() => onSelectGoal(isSelected ? null : goal.id)}>
                                <button className="po-goal-expand-btn" onClick={(e) => { e.stopPropagation(); onToggleExpand(goal.id); }}>
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                                <span className={`po-goal-status ${goal.status}`}>{goal.status === 'completed' ? '✅' : '🔄'}</span>
                                <div className="po-goal-item-info">
                                    <div className="po-goal-title" title={goal.title}>{goal.title}</div>
                                    <div className="po-goal-item-badges">
                                        <span>💬{goal.sessionCount}s</span>
                                        <span>🔄{goal.userMessages + goal.assistantMessages}轮</span>
                                        {goal.todoStats.total > 0 && <span className={goal.todoStats.pending > 0 ? 'po-badge-todo-pending' : 'po-badge-todo-done'}>📋{goal.todoStats.completed}/{goal.todoStats.total}</span>}
                                        {goal.codeChanges.additions > 0 && <span className="po-badge-code">+{goal.codeChanges.additions}/-{goal.codeChanges.deletions} ({goal.codeChanges.files}f)</span>}
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
                                                    <span className="po-goal-session-title">{s.firstUserMessage ? s.firstUserMessage.slice(0, 60) : (s.title || s.id)}</span>
                                                    {s.agent && <span className="po-goal-session-agent">{s.agent}</span>}
                                                    {s.summaryAdditions > 0 && <span className="po-badge-code">+{s.summaryAdditions}/-{s.summaryDeletions}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
