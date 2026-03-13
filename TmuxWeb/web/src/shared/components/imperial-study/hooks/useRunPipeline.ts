import { useState, useCallback, useRef, useEffect } from 'react';
import type { ActivityEvent, RoutingInfo, PipelineRun, PipelineStage, PipelineStatus } from '../types';
import { BUTLER_API_BASE } from '../constants';

const MAX_RUNS = 5;
const BURST_FAST_MS = 500;
const BURST_SLOW_MS = 1000;
const BURST_FAST_DURATION = 5_000;
const BURST_TOTAL_DURATION = 20_000;

function isTerminal(stage: PipelineRun['stage']): boolean {
    return stage === 'return';
}

function deriveStage(
    events: ActivityEvent[],
): { stage: PipelineRun['stage']; status: PipelineRun['status']; result?: string } {
    for (let i = events.length - 1; i >= 0; i--) {
        const ev = events[i];
        if (ev.event_type === 'task_completed') {
            return { stage: 'return', status: 'success', result: ev.summary };
        }
        if (ev.event_type === 'task_failed') {
            return { stage: 'return', status: 'failed', result: ev.summary };
        }
    }
    for (let i = events.length - 1; i >= 0; i--) {
        const ev = events[i];
        if (ev.event_type === 'task_started' || ev.event_type === 'worker_launched') {
            return { stage: 'processing', status: 'running' };
        }
    }
    return { stage: 'outflow', status: 'pending' };
}


interface DashboardRun {
    id: string;
    task_id: string;
    state: string;
    assistant: string | null;
    intent: string | null;
    queued_at: string | null;
    started_at: string | null;
    ended_at: string | null;
    elapsed_seconds: number | null;
}

function mapState(s: string): { stage: PipelineStage; status: PipelineStatus } {
    switch (s) {
        case 'succeeded': return { stage: 'return', status: 'success' };
        case 'failed':    return { stage: 'return', status: 'failed' };
        case 'cancelled': return { stage: 'return', status: 'failed' };
        case 'running':   return { stage: 'processing', status: 'running' };
        default:          return { stage: 'outflow', status: 'pending' };
    }
}

function dashboardToPipelineRun(r: DashboardRun): PipelineRun {
    const { stage, status } = mapState(r.state);
    return {
        run_id: r.id,
        task_id: r.task_id,
        intent: r.intent ?? '',
        routing: { strategy: r.assistant ?? 'unknown', executor: r.assistant ?? '', delegated: false },
        stage,
        status,
        events: [],
        startedAt: r.queued_at ? new Date(r.queued_at).getTime() : Date.now(),
    };
}

export function useRunPipeline() {
    const [runs, setRuns] = useState<PipelineRun[]>([]);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const burstStartRef = useRef<number>(0);


    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${BUTLER_API_BASE}/dashboard/runs?limit=${MAX_RUNS}`);
                if (!res.ok || cancelled) return;
                const json = await res.json();
                const loaded: DashboardRun[] = json?.data?.runs ?? [];
                if (!cancelled && loaded.length > 0) {
                    setRuns(loaded.map(dashboardToPipelineRun));
                }
            } catch { /* ignore */ }
        })();
        return () => { cancelled = true; };
    }, []);
    const stopBurst = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const pollForRun = useCallback(
        (runId: string) => {
            const elapsed = Date.now() - burstStartRef.current;
            if (elapsed >= BURST_TOTAL_DURATION) {
                stopBurst();
                return;
            }

            const interval = elapsed < BURST_FAST_DURATION ? BURST_FAST_MS : BURST_SLOW_MS;

            timerRef.current = setTimeout(async () => {
                try {
                    const params = new URLSearchParams({ limit: '50' });
                    const res = await fetch(`${BUTLER_API_BASE}/activity_events?${params}`);
                    if (!res.ok) return;
                    const json = await res.json();
                    const allEvents: ActivityEvent[] = json?.data?.activity_events ?? [];

                    const matched = allEvents.filter(
                        (ev) =>
                            ev.detail?.includes(runId) ||
                            ev.summary?.includes(runId),
                    );

                    const derived = deriveStage(matched);

                    setRuns((prev) =>
                        prev.map((r) =>
                            r.run_id === runId
                                ? { ...r, events: matched, ...derived }
                                : r,
                        ),
                    );

                    if (!isTerminal(derived.stage)) {
                        pollForRun(runId);
                    }
                } catch {
                    pollForRun(runId);
                }
            }, interval);
        },
        [stopBurst],
    );

    const dispatch = useCallback(
        (intent: string, routing: RoutingInfo, runId: string, taskId?: string) => {
            stopBurst();

            const newRun: PipelineRun = {
                run_id: runId,
                task_id: taskId,
                intent,
                routing,
                stage: 'outflow',
                status: 'pending',
                events: [],
                startedAt: Date.now(),
            };

            setRuns((prev) => [newRun, ...prev.filter((r) => r.run_id !== runId)].slice(0, MAX_RUNS));

            burstStartRef.current = Date.now();
            pollForRun(runId);
        },
        [stopBurst, pollForRun],
    );

    const dismiss = useCallback((runId: string) => {
        setRuns((prev) => prev.filter((r) => r.run_id !== runId));
    }, []);

    const activeRun = runs.find((r) => !isTerminal(r.stage)) ?? null;

    return { runs, activeRun, dispatch, dismiss };
}
