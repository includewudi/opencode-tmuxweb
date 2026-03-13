import { useState, useEffect, useCallback } from 'react';
import type { ImperialStudy } from '../types';
import { BUTLER_API_BASE } from '../constants';

export function useImperialStudies() {
    const [studies, setStudies] = useState<ImperialStudy[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refetch = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${BUTLER_API_BASE}/imperial_studies?status=active`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            const data: ImperialStudy[] = json?.data?.imperial_studies ?? [];
            setStudies(data);
            setError(null);
        } catch (e: any) {
            setError(e);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch once on mount — studies rarely change, no polling needed
    useEffect(() => {
        refetch();
    }, [refetch]);

    return { studies, loading, error, refetch };
}
