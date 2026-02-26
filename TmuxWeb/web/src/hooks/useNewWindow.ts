import { useState, useEffect, useCallback } from 'react'
import { getToken } from '../utils/auth'

export interface QuickDir {
    name: string
    path: string
}

export function useNewWindow(onSuccess?: () => void) {
    const [quickDirs, setQuickDirs] = useState<QuickDir[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const token = getToken()
        fetch(`/api/tmux/quick-dirs?token=${token}`)
            .then(r => r.json())
            .then(data => setQuickDirs(data.dirs || []))
            .catch(() => setQuickDirs([]))
    }, [])

    const createWindow = useCallback(async (session: string, dir?: string, name?: string) => {
        setLoading(true)
        setError(null)
        try {
            const token = getToken()
            const res = await fetch(`/api/tmux/new-window?token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session, dir, name }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message || 'Failed to create window')
            onSuccess?.()
            return data
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Unknown error'
            setError(msg)
            throw err
        } finally {
            setLoading(false)
        }
    }, [onSuccess])

    return { quickDirs, createWindow, loading, error }
}
