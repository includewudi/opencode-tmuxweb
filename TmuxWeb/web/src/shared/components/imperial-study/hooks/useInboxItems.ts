import { useState, useEffect, useCallback } from 'react';
import type { InboxItem } from '../types';
import { POLL_INBOX_MS, BUTLER_API_BASE } from '../constants';

interface InboxFilters {
    study_id?: string;
    status?: string;
    kind?: string;
}

export function useInboxItems(filters?: InboxFilters) {
    const [items, setItems] = useState<InboxItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refetch = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters?.study_id) params.set('study_id', filters.study_id);
            if (filters?.status) params.set('status', filters.status);
            if (filters?.kind) params.set('kind', filters.kind);
            const qs = params.toString();
            const url = `${BUTLER_API_BASE}/inbox_items${qs ? `?${qs}` : ''}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            const data: InboxItem[] = json?.data?.inbox_items ?? [];
            setItems(data);
            setUnreadCount(data.filter(i => i.status === 'pending').length);
            setError(null);
        } catch (e: any) {
            setError(e);
        } finally {
            setLoading(false);
        }
    }, [filters?.study_id, filters?.status, filters?.kind]);

    useEffect(() => {
        refetch();
        const interval = setInterval(refetch, POLL_INBOX_MS);
        return () => clearInterval(interval);
    }, [refetch]);

    return { items, unreadCount, loading, error, refetch };
}
