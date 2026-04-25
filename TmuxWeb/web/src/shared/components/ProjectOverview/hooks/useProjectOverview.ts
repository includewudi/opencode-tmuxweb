import { useState, useEffect, useCallback, useRef } from 'react';
import type { ProjectSummary, ProjectDetail, Goal } from '../types';
import { PROJECT_OVERVIEW_API, POLL_INTERVAL_MS } from '../constants';

export function useProjectSummary() {
    const [projects, setProjects] = useState<ProjectSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const mountedRef = useRef(true);

    const fetchProjects = useCallback(async () => {
        try {
            const res = await fetch(`${PROJECT_OVERVIEW_API}/summary`, { credentials: 'include' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            if (json.success && mountedRef.current) {
                setProjects(json.data.projects);
                setError(null);
            }
        } catch (e) {
            if (mountedRef.current) setError(e as Error);
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        fetchProjects();
        const interval = setInterval(fetchProjects, POLL_INTERVAL_MS);
        return () => {
            mountedRef.current = false;
            clearInterval(interval);
        };
    }, [fetchProjects]);

    return { projects, loading, error, refetch: fetchProjects };
}

export function useProjectDetail(projectId: string) {
    const [detail, setDetail] = useState<ProjectDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const mountedRef = useRef(true);

    const fetchDetail = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const res = await fetch(`${PROJECT_OVERVIEW_API}/project/${projectId}`, { credentials: 'include' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            if (json.success && mountedRef.current) {
                setDetail(json.data);
                setError(null);
            }
        } catch (e) {
            if (mountedRef.current) setError(e as Error);
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    return { detail, loading, error, fetchDetail };
}

export function useProjectGoals(projectId: string) {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const mountedRef = useRef(true);

    const fetchGoals = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const res = await fetch(`${PROJECT_OVERVIEW_API}/project/${projectId}/goals`, { credentials: 'include' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            if (json.success && mountedRef.current) {
                setGoals(json.data.goals);
                setError(null);
            }
        } catch (e) {
            if (mountedRef.current) setError(e as Error);
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        mountedRef.current = true;
        fetchGoals();
        const interval = setInterval(fetchGoals, POLL_INTERVAL_MS);
        return () => {
            mountedRef.current = false;
            clearInterval(interval);
        };
    }, [fetchGoals]);

    return { goals, loading, error, refetch: fetchGoals };
}
