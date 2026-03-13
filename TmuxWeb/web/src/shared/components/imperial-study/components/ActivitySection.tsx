// ActivitySection.tsx — Activity event log
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { ActivityEvent } from '../types';

// Simple mapping to reuse worker dots for specific events
function getEventColor(type: string) {
    if (type.includes('fail') || type.includes('error')) return 'var(--red-400)';
    if (type.includes('complete') || type.includes('✓')) return 'var(--green-500)';
    if (type.includes('launch') || type.includes('start')) return 'var(--yellow-500)';
    if (type.includes('reply') || type.includes('inbox')) return 'var(--blue-500)';
    return 'var(--zinc-500)';
}

interface ActivitySectionProps {
    events: ActivityEvent[];
    onActivityClick?: (event: ActivityEvent) => void;
}

export function ActivitySection({ events, onActivityClick }: ActivitySectionProps) {
    const [open, setOpen] = useState(false); // Collapsed by default

    return (
        <div className="is-section">
            <div className="is-section__header" onClick={() => setOpen(o => !o)}>
                <ChevronRight
                    size={14}
                    className={`is-section__chevron ${open ? 'open' : ''}`}
                />
                <span className="is-section__label">Activity</span>
            </div>
            <div
                className={`is-section__body ${open ? '' : 'collapsed'}`}
                style={{ maxHeight: open ? '200px' : '0' }}
            >
                {events.length === 0 ? (
                    <p className="is-empty">No recent activity</p>
                ) : (
                    <div className="is-activity-list">
                        {events.map(ev => {
                            const d = ev.created_at ? new Date(ev.created_at) : new Date();
                            const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

                            return (
                                <div
                                    key={ev.id}
                                    className={`is-activity-row ${onActivityClick ? 'is-clickable' : ''}`}
                                    onClick={() => onActivityClick?.(ev)}
                                    data-clickable={onActivityClick ? true : undefined}
                                >
                                    <span className="is-activity-row__time">{timeStr}</span>
                                    <span className="is-activity-row__worker">{ev.worker_id}</span>
                                    <span
                                        className="is-activity-dot"
                                        style={{ background: getEventColor(ev.event_type) }}
                                    />
                                    <span className="is-activity-row__summary" title={ev.summary}>
                                        {ev.summary}
                                    </span>
                                    {ev.detail && (
                                        <span className="is-activity-detail">
                                            {ev.detail}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
