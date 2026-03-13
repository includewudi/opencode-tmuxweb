// WorkerSection.tsx — Workers collapsible section + WorkerCard
import React, { useState, useCallback } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import type { WorkerSession, WorkerState } from '../types';
import { WORKER_STATE_DOT_COLOR, WORKER_STATE_LABEL_COLOR } from '../constants';
import { WorkerContextMenu } from './WorkerContextMenu';

// ── WorkerStatusDot ──────────────────────────────────────────────────────────
function WorkerStatusDot({ state }: { state: WorkerState }) {
    return (
        <span
            className="is-worker-dot"
            style={{ background: WORKER_STATE_DOT_COLOR[state] }}
            title={state}
        />
    );
}

// ── WorkerCard ───────────────────────────────────────────────────────────────
interface WorkerCardProps {
    worker: WorkerSession;
    intent?: string;
    onContextMenu: (e: React.MouseEvent, worker: WorkerSession) => void;
    onWorkerClick?: (runId: string) => void;
}

function WorkerCard({ worker, intent, onContextMenu, onWorkerClick }: WorkerCardProps) {
    const [flash, setFlash] = useState(false);

    const handleClick = () => {
        if (onWorkerClick && worker.run_id) {
            onWorkerClick(worker.run_id);
        } else {
            setFlash(true);
            setTimeout(() => setFlash(false), 200);
            window.dispatchEvent(new CustomEvent('imperial:focus-pane', {
                detail: { paneTarget: worker.pane_target }
            }));
        }
    };

    return (
        <div
            className={`is-worker-card ${flash ? 'flash' : ''}`}
            onClick={handleClick}
            onContextMenu={e => { e.preventDefault(); onContextMenu(e, worker); }}
            title={onWorkerClick && worker.run_id ? 'Click for details · Right-click for options' : 'Click to focus · Right-click for options'}
        >
            <div className="is-worker-card__row1">
                <WorkerStatusDot state={worker.state} />
                <span className="is-worker-card__name">{worker.session_id}</span>
                <span
                    className="is-worker-card__state"
                    style={{ color: WORKER_STATE_LABEL_COLOR[worker.state] }}
                >
                    {worker.state}
                </span>
            </div>
            <span className="is-worker-card__meta">
                {worker.project} · :{worker.port}
            </span>
            {intent && (
                <span className="is-worker-intent">
                    {intent}
                </span>
            )}
        </div>
    );
}

// ── WorkerSection ────────────────────────────────────────────────────────────
interface WorkerSectionProps {
    workers: WorkerSession[];
    intentMap?: Record<string, string>;
    onAddWorker?: () => void;
    onWorkerClick?: (runId: string) => void;
}

interface ContextMenuState {
    x: number;
    y: number;
    worker: WorkerSession;
}

export function WorkerSection({ workers, intentMap, onAddWorker, onWorkerClick }: WorkerSectionProps) {
    const [open, setOpen] = useState(true);
    const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);

    const handleContextMenu = useCallback((e: React.MouseEvent, worker: WorkerSession) => {
        setCtxMenu({ x: e.clientX, y: e.clientY, worker });
    }, []);

    return (
        <div className="is-section">
            {/* Section Header */}
            <div className="is-section__header" onClick={() => setOpen(o => !o)}>
                <ChevronRight
                    size={14}
                    className={`is-section__chevron ${open ? 'open' : ''}`}
                />
                <span className="is-section__label">Workers</span>
                {onAddWorker && (
                    <button
                        className="is-icon-btn is-section__action"
                        onClick={e => { e.stopPropagation(); onAddWorker(); }}
                        title="Launch new worker"
                    >
                        <Plus size={14} />
                    </button>
                )}
            </div>

            {/* Section Body */}
            <div
                className={`is-section__body ${open ? '' : 'collapsed'}`}
                style={{ maxHeight: open ? `${workers.length * 60 + 20}px` : '0' }}
            >
                {workers.length === 0 ? (
                    <p className="is-empty">No active workers</p>
                ) : (
                    workers.map(w => (
                        <WorkerCard
                            key={w.id}
                            worker={w}
                            intent={intentMap?.[w.run_id]}
                            onContextMenu={handleContextMenu}
                            onWorkerClick={onWorkerClick}
                        />
                    ))
                )}
            </div>

            {/* Right-click Context Menu */}
            {ctxMenu && (
                <WorkerContextMenu
                    x={ctxMenu.x}
                    y={ctxMenu.y}
                    workerId={ctxMenu.worker.id}
                    paneTarget={ctxMenu.worker.pane_target}
                    onClose={() => setCtxMenu(null)}
                />
            )}
        </div>
    );
}
