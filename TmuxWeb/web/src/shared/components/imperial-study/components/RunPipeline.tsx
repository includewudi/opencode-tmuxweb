import { useState } from 'react';
import { ArrowRight, X, CheckCircle2, XCircle, Loader2, Send, ChevronDown, ChevronRight } from 'lucide-react';
import type { PipelineRun, PipelineStage } from '../types';

interface RunPipelineProps {
    runs: PipelineRun[];
    activeRun: PipelineRun | null;
    onDismiss: (runId: string) => void;
}

const STAGE_META: Record<PipelineStage, { label: string; sublabel: string }> = {
    outflow: { label: '出旨', sublabel: 'Outflow' },
    processing: { label: '执行', sublabel: 'Processing' },
    return: { label: '回銮', sublabel: 'Return' },
};

const STAGES: PipelineStage[] = ['outflow', 'processing', 'return'];

function StageIcon({ stage, run }: { stage: PipelineStage; run: PipelineRun }) {
    const reached = STAGES.indexOf(stage) <= STAGES.indexOf(run.stage);
    const isCurrent = stage === run.stage;

    if (!reached) {
        return <span className="is-pipeline__stage-icon dimmed" />;
    }
    if (stage === 'return' && isCurrent) {
        return run.status === 'success'
            ? <CheckCircle2 size={14} className="is-pipeline__stage-icon success" />
            : <XCircle size={14} className="is-pipeline__stage-icon failed" />;
    }
    if (isCurrent && run.status === 'running') {
        return <Loader2 size={14} className="is-pipeline__stage-icon running" />;
    }
    if (stage === 'outflow') {
        return <Send size={14} className="is-pipeline__stage-icon done" />;
    }
    return <CheckCircle2 size={14} className="is-pipeline__stage-icon done" />;
}

function formatTime(ts: string | null): string {
    if (!ts) return '';
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

export function RunPipeline({ runs, activeRun, onDismiss }: RunPipelineProps) {
    const [expanded, setExpanded] = useState(false);
    const run = activeRun ?? runs[0];
    if (!run) return null;

    const isActive = run.status === 'running' || run.status === 'pending';

    return (
        <div className="is-pipeline" data-status={run.status}>
            <div className="is-pipeline__header">
                <span className="is-pipeline__intent">{run.intent}</span>
                <button
                    className="is-pipeline__dismiss"
                    onClick={() => onDismiss(run.run_id)}
                    title="Dismiss"
                >
                    <X size={12} />
                </button>
            </div>

            <div className="is-pipeline__stages">
                {STAGES.map((stage, i) => (
                    <div key={stage} className="is-pipeline__stage-group">
                        <div
                            className={`is-pipeline__stage ${stage === run.stage ? 'current' : ''} ${STAGES.indexOf(stage) < STAGES.indexOf(run.stage) ? 'passed' : ''}`}
                            data-status={stage === run.stage ? run.status : STAGES.indexOf(stage) < STAGES.indexOf(run.stage) ? 'done' : 'pending'}
                        >
                            <StageIcon stage={stage} run={run} />
                            <span className="is-pipeline__stage-label">
                                {STAGE_META[stage].label}
                            </span>
                        </div>
                        {i < STAGES.length - 1 && (
                            <div className={`is-pipeline__connector ${isActive && STAGES.indexOf(stage) < STAGES.indexOf(run.stage) ? 'flow' : ''} ${isActive && stage === run.stage ? 'flow' : ''}`}>
                                <ArrowRight size={10} />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="is-pipeline__meta">
                <span className="is-pipeline__badge" data-strategy={run.routing.strategy}>
                    {run.routing.strategy}
                </span>
                <span className="is-pipeline__executor">{run.routing.executor}</span>
                {run.routing.cap_name && (
                    <span className="is-pipeline__cap">{run.routing.cap_name}</span>
                )}
                {run.events.length > 0 && (
                    <span className="is-pipeline__event-count">{run.events.length} events</span>
                )}
            </div>

            {run.result && (
                <div className={`is-pipeline__result ${run.status}`}>
                    {run.result}
                </div>
            )}

            {run.events.length > 0 && (
                <div className="is-pipeline__detail-toggle">
                    <button
                        className="is-pipeline__expand-btn"
                        onClick={() => setExpanded(!expanded)}
                    >
                        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <span>Timeline</span>
                    </button>
                </div>
            )}

            {expanded && run.events.length > 0 && (
                <div className="is-pipeline__detail">
                    {run.events.map((ev) => (
                        <div key={ev.id} className="is-pipeline__event">
                            <span className="is-pipeline__event-time">
                                {formatTime(ev.created_at)}
                            </span>
                            <span
                                className="is-pipeline__event-dot"
                                data-type={ev.event_type}
                            />
                            <span className="is-pipeline__event-text">
                                {ev.summary}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
