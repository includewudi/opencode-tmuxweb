import { useState, useEffect, useRef, useCallback } from 'react';
import type { TaskRunDetail, TaskEventDetail, CliHistoryMessage } from '../types';
import { BUTLER_API_BASE } from '../constants';

const POLL_MS = 3_000;
const TERMINAL_STATES = new Set(['succeeded', 'failed', 'cancelled']);
const SESSION_ID_RE = /OpenCode session: (ses_\S+)/;

export function useRunDetail(runId: string | null) {
    const [run, setRun] = useState<TaskRunDetail | null>(null);
    const [events, setEvents] = useState<TaskEventDetail[]>([]);
    const [messages, setMessages] = useState<CliHistoryMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const sessionRef = useRef<string | null>(null);

    const extractSessionId = useCallback((eventsData: TaskEventDetail[]): string | null => {
        const logEvents = eventsData.filter(ev => ev.event_type === 'log');
        const logMatch = logEvents.find(ev => {
            const msg = (ev.payload as Record<string, unknown>)?.message as string ?? '';
            return SESSION_ID_RE.test(msg);
        });
        if (logMatch) {
            return SESSION_ID_RE.exec(
                (logMatch.payload as Record<string, unknown>)?.message as string ?? ''
            )?.[1] ?? null;
        }

        for (const ev of eventsData) {
            const p = ev.payload as Record<string, unknown> | null;
            if (!p) continue;
            const sid = p.opencode_session ?? p.session_id;
            if (typeof sid === 'string' && sid.startsWith('ses_')) return sid;
        }

        return null;
    }, []);

    const fetchCliHistory = useCallback(async (sessionId: string, signal: AbortSignal): Promise<CliHistoryMessage[] | null> => {
        try {
            const res = await fetch(`/api/cli-history/sessions/${sessionId}?provider=opencode`, { signal });
            if (!res.ok || signal.aborted) return null;
            const json = await res.json();
            const msgs: CliHistoryMessage[] = json?.messages ?? [];
            return msgs.length > 0 ? msgs : null;
        } catch {
            return null;
        }
    }, []);

    const fetchOpenCodeMessages = useCallback(async (sessionId: string, signal: AbortSignal): Promise<CliHistoryMessage[] | null> => {
        try {
            const res = await fetch(`${BUTLER_API_BASE}/oc/session/${sessionId}/message`, { signal });
            if (!res.ok || signal.aborted) return null;
            const json = await res.json();
            const raw: CliHistoryMessage[] = Array.isArray(json) ? json : json?.messages ?? json?.data ?? [];
            return raw.length > 0 ? raw : null;
        } catch {
            return null;
        }
    }, []);

    const fetchMessages = useCallback(async (sessionId: string, signal: AbortSignal) => {
        if (signal.aborted) return;

        const [cliResult, ocResult] = await Promise.all([
            fetchCliHistory(sessionId, signal),
            fetchOpenCodeMessages(sessionId, signal),
        ]);

        if (signal.aborted) return;

        if (cliResult && cliResult.length > 0) {
            setMessages(cliResult);
        } else if (ocResult && ocResult.length > 0) {
            setMessages(ocResult);
        }
    }, [fetchCliHistory, fetchOpenCodeMessages]);

    const fetchDetail = useCallback(async (id: string, signal: AbortSignal) => {
        try {
            const [runRes, eventsRes] = await Promise.all([
                fetch(`${BUTLER_API_BASE}/runs/${id}`, { signal }),
                fetch(`${BUTLER_API_BASE}/runs/${id}/events`, { signal }),
            ]);
            if (signal.aborted) return null;

            if (!runRes.ok) throw new Error(`Run: HTTP ${runRes.status}`);
            if (!eventsRes.ok) throw new Error(`Events: HTTP ${eventsRes.status}`);

            const runJson = await runRes.json();
            const eventsJson = await eventsRes.json();

            const runData: TaskRunDetail = runJson?.data ?? runJson;
            const eventsData: TaskEventDetail[] = eventsJson?.data?.events ?? [];

            setRun(runData);
            setEvents(eventsData);
            setError(null);

            const sessionId = extractSessionId(eventsData);
            if (sessionId) {
                sessionRef.current = sessionId;
                await fetchMessages(sessionId, signal);
            }

            return runData;
        } catch (e: any) {
            if (!signal.aborted) {
                setError(e.message ?? 'Failed to fetch run detail');
            }
            return null;
        }
    }, [extractSessionId, fetchMessages]);

    useEffect(() => {
        if (!runId) {
            setRun(null);
            setEvents([]);
            setMessages([]);
            setError(null);
            setLoading(false);
            sessionRef.current = null;
            return;
        }

        const controller = new AbortController();
        abortRef.current = controller;
        let timer: ReturnType<typeof setTimeout> | null = null;

        const poll = async () => {
            const result = await fetchDetail(runId, controller.signal);
            if (controller.signal.aborted) return;

            if (result && !TERMINAL_STATES.has(result.state)) {
                const cached = sessionRef.current;
                if (cached) {
                    try {
                        const ocMsgs = await fetchOpenCodeMessages(cached, controller.signal);
                        if (controller.signal.aborted) return;
                        if (ocMsgs && ocMsgs.length > 0) {
                            setMessages(prev => ocMsgs.length > prev.length ? ocMsgs : prev);
                        }
                    } catch { /* non-critical */ }
                }
                timer = setTimeout(poll, POLL_MS);
            }
        };

        setLoading(true);
        poll().finally(() => {
            if (!controller.signal.aborted) setLoading(false);
        });

        return () => {
            controller.abort();
            if (timer) clearTimeout(timer);
        };
    }, [runId, fetchDetail, fetchOpenCodeMessages]);

    return { run, events, messages, loading, error };
}
