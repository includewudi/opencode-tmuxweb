import { useState, useEffect, useMemo } from 'react';
import { useProjectSummary, useProjectDetail } from '../hooks/useProjectOverview';
import { timeAgo, projectName, stripSystemContent } from '../helpers';
import type { ProjectSummary } from '../types';
import '../project-overview.css';

export function ProjectOverviewSidebar() {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    const { projects, loading, error, refetch } = useProjectSummary();
    const { detail, fetchDetail, loading: detailLoading } = useProjectDetail(selectedId || '');

    useEffect(() => {
        if (selectedId) fetchDetail();
    }, [selectedId, fetchDetail]);

    const filtered = useMemo(() => {
        if (!search.trim()) return projects;
        const q = search.toLowerCase();
        return projects.filter(p => {
            const name = projectName(p).toLowerCase();
            return name.includes(q) || p.path.toLowerCase().includes(q);
        });
    }, [projects, search]);

    const selectedProject = useMemo(
        () => projects.find(p => p.id === selectedId) ?? null,
        [projects, selectedId]
    );

    const handleSelect = (id: string) => {
        setSelectedId(prev => prev === id ? null : id);
    };

    return (
        <div className="po-sidebar">
            {/* Left: project list */}
            <div className="po-sidebar-left">
                <div className="po-sidebar-left-header">📊 项目总览</div>
                <div className="po-sidebar-search">
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

                <div className="po-sidebar-list">
                    {filtered.map(p => (
                        <ProjectListItem
                            key={p.id}
                            project={p}
                            selected={selectedId === p.id}
                            onClick={() => handleSelect(p.id)}
                        />
                    ))}
                </div>
            </div>

            {/* Right: project detail */}
            <div className="po-sidebar-right">
                {!selectedProject && (
                    <div className="po-sidebar-empty">← 选择一个项目查看详情</div>
                )}
                {selectedProject && (
                    <ProjectDetailPanel
                        project={selectedProject}
                        detail={detail}
                        detailLoading={detailLoading}
                    />
                )}
            </div>
        </div>
    );
}

function ProjectListItem({ project, selected, onClick }: {
    project: ProjectSummary;
    selected: boolean;
    onClick: () => void;
}) {
    const name = projectName(project);
    const { total, completed } = project.todoStats;
    const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const allDone = total > 0 && completed === total;
    const displayMsg = stripSystemContent(project.latestMessage);

    return (
        <div
            className={`po-sidebar-item${selected ? ' selected' : ''}`}
            onClick={onClick}
        >
            <div className="po-sidebar-item-name" title={project.path}>{name}</div>
            <div className="po-sidebar-item-time">
                {project.lastActivity ? timeAgo(project.lastActivity) : ''}
                {project.lastActivity && project.sessionCount > 0 && ' · '}
                {project.sessionCount > 0 && `📊 ${project.sessionCount}`}
            </div>

            {total > 0 && (
                <div className="po-progress-wrap">
                    <div className="po-progress-bar">
                        <div
                            className={`po-progress-fill ${allDone ? 'done' : 'pending'}`}
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                    <span className="po-progress-text">{completed}/{total}</span>
                </div>
            )}

            {project.activePlan && (
                <div style={{ fontSize: 10, color: '#eab308', marginTop: 2 }}>
                    📋 {project.activePlan}
                </div>
            )}

            {displayMsg && (
                <div className="po-sidebar-item-msg">
                    {displayMsg.length > 60 ? displayMsg.slice(0, 60) + '…' : displayMsg}
                </div>
            )}
        </div>
    );
}

function ProjectDetailPanel({ project, detail, detailLoading }: {
    project: ProjectSummary;
    detail: import('../types').ProjectDetail | null;
    detailLoading: boolean;
}) {
    const name = projectName(project);
    const { total, completed } = project.todoStats;
    const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const allDone = total > 0 && completed === total;
    const displayMessage = stripSystemContent(project.latestMessage);

    const todos = detail?.todos ?? [];
    const sessions = detail?.recentSessions ?? [];

    return (
        <>
            {/* Section 1: project header */}
            <div className="po-sidebar-project-name">{name}</div>
            <div className="po-sidebar-project-path" title={project.path}>{project.path}</div>
            <div className="po-sidebar-project-meta">
                {project.lastActivity && <span>🕐 {timeAgo(project.lastActivity)}</span>}
                <span>📊 {project.sessionCount} 会话</span>
                {project.activePlan && <span style={{ color: '#eab308' }}>📋 {project.activePlan}</span>}
                {project.completedPlans.length > 0 && <span>✅ {project.completedPlans.length} 已完成</span>}
            </div>

            {total > 0 && (
                <div className="po-progress-wrap">
                    <div className="po-progress-bar">
                        <div
                            className={`po-progress-fill ${allDone ? 'done' : 'pending'}`}
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                    <span className="po-progress-text">{completed}/{total}</span>
                </div>
            )}

            {/* Section 2: latest message */}
            <div className="po-sidebar-section-title">💬 最新需求</div>
            <div style={{ fontSize: 14, color: '#d4d4d8', lineHeight: 1.5 }}>
                {displayMessage
                    ? (displayMessage.length > 500 ? displayMessage.slice(0, 500) + '…' : displayMessage)
                    : '暂无'}
            </div>

            {/* Section 3: TODO list */}
            <div className="po-sidebar-section-title">📋 待办 ({completed}/{total})</div>
            {detailLoading && <div className="po-loading-small">加载详情...</div>}
            {!detailLoading && todos.length === 0 && (
                <div className="po-todo-empty">暂无待办</div>
            )}
            {todos.slice(0, 30).map((todo, i) => (
                <div className="po-todo-item" key={i}>
                    <span className="po-todo-icon">
                        {todo.status === 'completed' ? '✅' : '⬜'}
                    </span>
                    <span className="po-todo-content" title={todo.content}>{todo.content}</span>
                    <span className={`po-todo-priority ${todo.priority}`}>{todo.priority}</span>
                </div>
            ))}
            {todos.length > 30 && (
                <div className="po-todo-more">还有 {todos.length - 30} 条...</div>
            )}

            {/* Section 4: recent sessions */}
            <div className="po-sidebar-section-title">📝 最近会话</div>
            {!detailLoading && sessions.length === 0 && (
                <div className="po-todo-empty">暂无会话</div>
            )}
            {sessions.slice(0, 15).map(session => {
                const userMsg = stripSystemContent(session.latestUserMessage);
                const asstMsg = stripSystemContent(session.latestAssistantMessage);
                return (
                    <div className="po-session-item" key={session.id}>
                        <div className="po-session-title" title={session.title ?? undefined}>
                            {session.title || 'Untitled session'}
                        </div>
                        {session.timeUpdated && (
                            <div className="po-session-time">{timeAgo(session.timeUpdated)}</div>
                        )}
                        {(session.summaryAdditions > 0 || session.summaryDeletions > 0 || session.summaryFiles > 0) && (
                            <div className="po-session-stats">
                                <span className="add">+{session.summaryAdditions}</span>{' '}
                                <span className="del">-{session.summaryDeletions}</span>{' '}
                                <span className="files">📄{session.summaryFiles}</span>
                            </div>
                        )}
                        {userMsg && (
                            <div className="po-session-msg user" title={userMsg}>
                                💬 {userMsg.length > 150 ? userMsg.slice(0, 150) + '…' : userMsg}
                            </div>
                        )}
                        {asstMsg && (
                            <div className="po-session-msg assistant" title={asstMsg}>
                                🤖 {asstMsg.length > 150 ? asstMsg.slice(0, 150) + '…' : asstMsg}
                            </div>
                        )}
                    </div>
                );
            })}
        </>
    );
}
