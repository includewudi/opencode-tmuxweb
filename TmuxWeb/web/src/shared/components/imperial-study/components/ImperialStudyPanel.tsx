// ImperialStudyPanel.tsx — Plugin Root Component
import { useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { WorkerSection } from './WorkerSection';
import { InboxSection } from './InboxSection';
import { ActivitySection } from './ActivitySection';
import { InboxDetailModal } from './InboxDetailModal';
import { useWorkerSessions } from '../hooks/useWorkerSessions';
import { useInboxItems } from '../hooks/useInboxItems';
import { useActivityEvents } from '../hooks/useActivityEvents';
import type { InboxItem } from '../types';
import '../imperial-study.css';

export function ImperialStudyPanel() {
    const { workers, refetch: refetchWorkers } = useWorkerSessions();
    const { items: inbox, unreadCount, refetch: refetchInbox } = useInboxItems();
    const { events, refetch: refetchActivity } = useActivityEvents();

    const [spinning, setSpinning] = useState(false);
    const [selectedInbox, setSelectedInbox] = useState<InboxItem | null>(null);

    const handleRefresh = useCallback(async () => {
        setSpinning(true);
        await Promise.all([refetchWorkers(), refetchInbox(), refetchActivity()]);
        setTimeout(() => setSpinning(false), 500);
    }, [refetchWorkers, refetchInbox, refetchActivity]);

    return (
        <div className="imperial-study">
            {/* ── Panel Header ── */}
            <div className="is-panel-header">
                <div className="is-panel-header__row">
                    <span className="is-panel-header__title">御書房</span>
                    <button
                        className={`is-icon-btn ${spinning ? 'spinning' : ''}`}
                        onClick={handleRefresh}
                        title="Refresh"
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>
                <span className="is-panel-header__subtitle">
                    {workers.length} workers · {unreadCount} inbox
                </span>
            </div>

            {/* ── Scrollable Content ── */}
            <div className="is-scroll-area">
                <WorkerSection workers={workers} />
                <InboxSection items={inbox} onItemClick={setSelectedInbox} />
                <ActivitySection events={events} />
            </div>

            {/* ── Inbox Detail Modal ── */}
            {selectedInbox && (
                <InboxDetailModal
                    item={selectedInbox}
                    onClose={() => setSelectedInbox(null)}
                    onReplied={() => {
                        setSelectedInbox(null);
                        refetchInbox();
                    }}
                />
            )}
        </div>
    );
}
