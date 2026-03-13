import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useRunDetail } from '../hooks/useRunDetail';

interface TaskDetailModalProps {
    runId: string;
    onClose: () => void;
}

function formatTime(iso: string | null): string {
    if (!iso) return '\u2014';
    return new Date(iso).toLocaleString();
}

export function TaskDetailModal({ runId, onClose }: TaskDetailModalProps) {
    const { run, events, loading, error } = useRunDetail(runId);

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

    const thinkingEvents = events.filter(
        ev => ev.event_type === 'thinking' || ev.event_type === 'reasoning'
    );

    return (
        <div className="is-modal-overlay" onClick={handleOverlayClick}>
            <div className="is-modal is-task-detail-modal">
                {/* Header */}
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
                    <div className="is-task-detail-error">{error}</div>
                )}

                {run && (
                    <div className="is-task-detail-body">
                        {/* Intent Section */}
                        <div className="is-task-detail-section">
                            <div className="is-task-detail-section__label">Intent</div>
                            <div className="is-task-detail-section__content">
                                {run.input_data?.intent || '\u2014'}
                            </div>
                        </div>

                        {/* Meta */}
                        <div className="is-task-detail-section">
                            <div className="is-task-detail-section__label">Info</div>
                            <div className="is-task-detail-meta">
                                <span>Task: {run.task_id.slice(0, 8)}</span>
                                <span>Attempt: {run.attempt}</span>
                                <span>Started: {formatTime(run.started_at)}</span>
                                {run.ended_at && <span>Ended: {formatTime(run.ended_at)}</span>}
                            </div>
                        </div>

                        {/* Thinking Chain */}
                        {thinkingEvents.length > 0 && (
                            <div className="is-task-detail-section">
                                <div className="is-task-detail-section__label">
                                    Thinking ({thinkingEvents.length})
                                </div>
                                <div className="is-thinking-chain">
                                    {thinkingEvents.map(ev => (
                                        <div key={ev.id} className="is-thinking-chain__entry">
                                            <span className="is-thinking-chain__time">
                                                {new Date(ev.created_at).toLocaleTimeString()}
                                            </span>
                                            <span className="is-thinking-chain__text">
                                                {typeof ev.payload === 'object' && ev.payload
                                                    ? (ev.payload as Record<string, unknown>).text as string ?? JSON.stringify(ev.payload)
                                                    : String(ev.payload ?? '')}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Result / Error */}
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

                        {/* All Events Timeline */}
                        {events.length > 0 && (
                            <div className="is-task-detail-section">
                                <div className="is-task-detail-section__label">
                                    Events ({events.length})
                                </div>
                                <div className="is-events-timeline">
                                    {events.map(ev => (
                                        <div key={ev.id} className="is-events-timeline__row">
                                            <span className="is-events-timeline__time">
                                                {new Date(ev.created_at).toLocaleTimeString()}
                                            </span>
                                            <span className="is-events-timeline__type">
                                                {ev.event_type}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
