import type { ProjectSummary, TodoItem, RecentSession } from '../types';
import { timeAgo, projectName, stripSystemContent } from '../helpers';
import '../project-overview.css';

interface ProjectCardProps {
    project: ProjectSummary;
    todos?: TodoItem[];
    recentSessions?: RecentSession[];
    expanded?: boolean;
    onToggle?: () => void;
}

export function ProjectCard({ project, todos, recentSessions, expanded, onToggle }: ProjectCardProps) {
    const name = projectName(project);
    const { total, completed } = project.todoStats;
    const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const allDone = total > 0 && completed === total;
    const displayMessage = stripSystemContent(project.latestMessage);

    return (
        <div className="po-card" onClick={onToggle}>
            <div className="po-card-header">
                <span className="po-card-name" title={project.path}>{name}</span>
                <span className={`po-card-arrow ${expanded ? 'open' : ''}`}>▸</span>
            </div>

            <div className="po-card-meta">
                {project.lastActivity && (
                    <span className="po-card-time">{timeAgo(project.lastActivity)}</span>
                )}
                <span className="po-card-session-count">📊 {project.sessionCount}</span>
                {project.activePlan && (
                    <span className="po-card-active-plan">📋 {project.activePlan}</span>
                )}
                {project.completedPlans.length > 0 && (
                    <span className="po-card-completed-plans">✅ {project.completedPlans.length} plans completed</span>
                )}
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

            {displayMessage && (
                <div className="po-card-message" title={displayMessage}>
                    💬 {displayMessage.length > 200 ? displayMessage.slice(0, 200) + '…' : displayMessage}
                </div>
            )}

            <div className={`po-card-expanded ${expanded ? 'open' : ''}`}>
                <hr className="po-card-divider" />

                <div className="po-todo-section-label">待办事项</div>
                {!todos || todos.length === 0 ? (
                    <div className="po-todo-empty">暂无待办</div>
                ) : (
                    <>
                        {todos.slice(0, 20).map((todo, i) => (
                            <div className="po-todo-item" key={i}>
                                <span className="po-todo-icon">
                                    {todo.status === 'completed' ? '✅' : '⬜'}
                                </span>
                                <span className="po-todo-content" title={todo.content}>{todo.content}</span>
                                <span className={`po-todo-priority ${todo.priority}`}>{todo.priority}</span>
                            </div>
                        ))}
                        {todos.length > 20 && (
                            <div className="po-todo-more">还有 {todos.length - 20} 条...</div>
                        )}
                    </>
                )}

                <div className="po-session-section-label">最近会话</div>
                {!recentSessions || recentSessions.length === 0 ? (
                    <div className="po-todo-empty">暂无会话</div>
                ) : (
                    recentSessions.map(session => {
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
                    })
                )}
            </div>
        </div>
    );
}
