import { useState, useEffect, useCallback } from 'react';
import type { ActivityEvent } from '../types';
import { POLL_ACTIVITY_MS, BUTLER_API_BASE } from '../constants';

export function useActivityEvents(studyId?: string, limit = 20) {
    const [events, setEvents] = useState<ActivityEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refetch = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: String(limit) });
            if (studyId) params.set('study_id', studyId);
            const res = await fetch(`${BUTLER_API_BASE}/activity_events?${params}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            const data: ActivityEvent[] = json?.data?.activity_events ?? [];
            setEvents(data);
            setError(null);
        } catch (e: any) {
            setError(e);
        } finally {
            setLoading(false);
        }
    }, [studyId, limit]);

    useEffect(() => {
        refetch();
        // Activity is historical — poll less frequently
        const interval = setInterval(refetch, POLL_ACTIVITY_MS);
        return () => clearInterval(interval);
    }, [refetch]);

    return { events, loading, error, refetch };
}
