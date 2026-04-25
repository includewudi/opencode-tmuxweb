import React, { useEffect } from 'react';
import { X, User, Bot, Wrench } from 'lucide-react';
import { useRunDetail } from '../hooks/useRunDetail';
import type { CliHistoryMessage } from '../types';

interface TaskDetailModalProps {
    runId: string;
    onClose: () => void;
}

function formatTime(iso: string | null): string {
    if (!iso) return '\u2014';
    return new Date(iso).toLocaleString();
}

function formatTimestamp(epoch: number): string {
    return new Date(epoch * 1000).toLocaleTimeString();
}

function MessageBubble({ msg }: { msg: CliHistoryMessage }) {
    const isUser = msg.role === 'user';
    const textParts = msg.parts.filter(p => p.type === 'text' && p.text);
    const toolParts = msg.parts.filter(p => p.type === 'tool');

    if (textParts.length === 0 && toolParts.length === 0) {
        const stepStart = msg.parts.find(p => p.type === 'step-start');
        if (stepStart) return null;
        return null;
    }

    return (
        <div className={`is-chat-msg is-chat-msg--${isUser ? 'user' : 'assistant'}`}>
            <div className="is-chat-msg__header">
                {isUser ? <User size={13} /> : <Bot size={13} />}
                <span className="is-chat-msg__agent">{msg.agent || msg.role}</span>
                {msg.modelID && <span className="is-chat-msg__model">{msg.modelID.split('/').pop()}</span>}
                {msg.tokens && <span className="is-chat-msg__tokens">{msg.tokens.total.toLocaleString()} tok</span>}
                <span className="is-chat-msg__time">{formatTimestamp(msg.timeCreated)}</span>
            </div>
            {textParts.map(p => (
                <div key={p.id} className="is-chat-msg__text">
                    {(p.text ?? '').slice(0, 2000)}
                    {(p.text ?? '').length > 2000 && '…'}
                </div>
            ))}
            {toolParts.length > 0 && (
                <div className="is-chat-msg__tools">
                    {toolParts.map(p => (
                        <div key={p.id} className="is-chat-tool-call">
                            <Wrench size={11} />
                            <span className="is-chat-tool-call__name">{p.tool || 'tool'}</span>
                            {p.duration != null && <span className="is-chat-tool-call__dur">{(p.duration / 1000).toFixed(1)}s</span>}
                            {p.output && (
                                <pre className="is-chat-tool-call__output">{p.output.slice(0, 500)}{p.output.length > 500 ? '…' : ''}</pre>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function TaskDetailModal({ runId, onClose }: TaskDetailModalProps) {
    const { run, events, messages, loading, error } = useRunDetail(runId);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose();
    };

    return (
        <div className="is-modal-overlay" onClick={handleOverlayClick}>
            <div className="is-modal is-task-detail-modal">
                <div className="is-modal__header">
                    <span className="is-modal__header-title">
                        {run ? `Run: ${run.id.slice(0, 8)}` : 'Run Detail'}
                    </span>
                    {run && (
                        <span className={`is-task-detail-state is-task-detail-state--${run.state}`}>
                            {run.state}
                        </span>
                    )}
                    <button
                        className="is-icon-btn is-modal__close"
                        onClick={onClose}
                        title="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                {loading && !run && (
                    <div className="is-task-detail-loading">加载中...</div>
                )}

                {error && !run && (
                    <div className="is-task-detail-error">
                        {error.includes('HTTP 404')
                            ? '该任务记录不存在（可能已随服务重启清除）'
                            : error}
                    </div>
                )}

                {run && (
                    <div className="is-task-detail-body">
                        <div className="is-task-detail-section">
                            <div className="is-task-detail-section__label">Intent</div>
                            <div className="is-task-detail-section__content">
                                {run.input_data?.intent || '\u2014'}
                            </div>
                        </div>

                        <div className="is-task-detail-section">
                            <div className="is-task-detail-section__label">Info</div>
                            <div className="is-task-detail-meta">
                                <span>Task: {run.task_id.slice(0, 8)}</span>
                                <span>Attempt: {run.attempt}</span>
                                <span>Started: {formatTime(run.started_at)}</span>
                                {run.ended_at && <span>Ended: {formatTime(run.ended_at)}</span>}
                            </div>
                        </div>

                        {messages.length > 0 ? (
                            <div className="is-task-detail-section">
                                <div className="is-task-detail-section__label">
                                    对话记录 ({messages.length})
                                </div>
                                <div className="is-chat-messages">
                                    {messages.map(msg => (
                                        <MessageBubble key={msg.id} msg={msg} />
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="is-task-detail-section">
                                <div className="is-task-detail-section__label">
                                    Events ({events.length})
                                </div>
                                <div className="is-events-timeline">
                                    {events
                                        .filter(ev => ev.event_type !== 'heartbeat')
                                        .map(ev => (
                                            <div key={ev.id} className="is-events-timeline__row">
                                                <span className="is-events-timeline__time">
                                                    {new Date(ev.created_at).toLocaleTimeString()}
                                                </span>
                                                <span className="is-events-timeline__type">
                                                    {ev.event_type}
                                                </span>
                                                {ev.event_type === 'log' && (
                                                    <span className="is-events-timeline__msg">
                                                        {(ev.payload as Record<string, unknown>)?.message as string ?? ''}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}

                        {(run.result || run.error) && (
                            <div className="is-task-detail-section">
                                <div className="is-task-detail-section__label">
                                    {run.error ? 'Error' : 'Result'}
                                </div>
                                <div className={`is-result-block ${run.error ? 'is-result-block--error' : ''}`}>
                                    {run.error ?? run.result}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
