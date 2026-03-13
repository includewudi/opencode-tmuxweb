// ImperialStudyPanel.tsx — Plugin Root Component
import { useState, useCallback, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { WorkerSection } from './WorkerSection';
import { InboxSection } from './InboxSection';
import { ActivitySection } from './ActivitySection';
import { InboxDetailModal } from './InboxDetailModal';
import { TaskDetailModal } from './TaskDetailModal';
import { CommandInput } from './CommandInput';
import { RunPipeline } from './RunPipeline';
import { AssistantChatPanel } from './AssistantChatPanel';
import { useWorkerSessions } from '../hooks/useWorkerSessions';
import { useAssistantPanes } from '../hooks/useAssistantPanes';
import { useInboxItems } from '../hooks/useInboxItems';
import { useActivityEvents } from '../hooks/useActivityEvents';
import { useRunPipeline } from '../hooks/useRunPipeline';
import type { InboxItem } from '../types';
import '../imperial-study.css';

interface ImperialStudyPanelProps {
    activePaneKey?: string | null;
    floating?: boolean;
}

export function ImperialStudyPanel({ activePaneKey, floating }: ImperialStudyPanelProps) {
    const { workers, refetch: refetchWorkers } = useWorkerSessions();
    const { items: inbox, unreadCount, refetch: refetchInbox } = useInboxItems();
    const { events, refetch: refetchActivity } = useActivityEvents();

    const [spinning, setSpinning] = useState(false);
    const [selectedInbox, setSelectedInbox] = useState<InboxItem | null>(null);
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
    const [activeTag, setActiveTag] = useState<string | null>(null);
    const assistant = useAssistantPanes();
    const pipeline = useRunPipeline();


    const intentMap = useMemo(() => {
        const map: Record<string, string> = {};
        for (const r of pipeline.runs) {
            if (r.intent) map[r.run_id] = r.intent;
        }
        return map;
    }, [pipeline.runs]);
    const handleRefresh = useCallback(async () => {
        setSpinning(true);
        await Promise.all([refetchWorkers(), refetchInbox(), refetchActivity()]);
        setTimeout(() => setSpinning(false), 500);
    }, [refetchWorkers, refetchInbox, refetchActivity]);

    return (
        <div className={`imperial-study ${floating ? 'is-floating' : ''}`}>
            {/* ── Panel Header (hidden in floating mode — titlebar replaces it) ── */}
            {!floating && (
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
            )}

            {/* ── Command Input ── */}
            <CommandInput
                paneTarget={activePaneKey}
                onDispatched={(result) => {
                    refetchWorkers();
                    refetchActivity();
                    if (result.routing && result.run_id) {
                        pipeline.dispatch(result.intent, result.routing, result.run_id, result.task_id);
                    }
                }}
                activeTag={activeTag}
                onTagChange={setActiveTag}
                onAssistantSend={(content, type) => assistant.sendMessage(content, type)}
            />

            {/* ── Run Pipeline ── */}
            {pipeline.runs.length > 0 && (
                <RunPipeline
                    runs={pipeline.runs}
                    activeRun={pipeline.activeRun}
                    onDismiss={pipeline.dismiss}
                />
            )}

            {/* ── Assistant Chat ── */}
            {(assistant.messages.length > 0 || assistant.streaming) && (
                <AssistantChatPanel
                    messages={assistant.messages}
                    streaming={assistant.streaming}
                    onClear={assistant.clearMessages}
                />
            )}

            {/* ── Sections: horizontal in float, vertical in sidebar ── */}
            <div className="is-scroll-area">
                <WorkerSection
                    workers={workers}
                    intentMap={intentMap}
                    onWorkerClick={setSelectedRunId}
                />
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

            {/* Task Detail Modal */}
            {selectedRunId && (
                <TaskDetailModal
                    runId={selectedRunId}
                    onClose={() => setSelectedRunId(null)}
                />
            )}
        </div>
    );
}
