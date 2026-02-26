import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Plus, Terminal, LayoutPanelTop, FolderOpen } from 'lucide-react'
import { getToken } from '../../utils/auth'
import { TmuxSession } from '../../types'
import './NewTmuxButton.css'

interface QuickDir {
    name: string
    path: string
}

interface NewTmuxButtonProps {
    sessions: TmuxSession[]
    onCreated?: () => void
}

export function NewTmuxButton({ sessions, onCreated }: NewTmuxButtonProps) {
    const [open, setOpen] = useState(false)
    const [quickDirs, setQuickDirs] = useState<QuickDir[]>([])

    // new-session fields
    const [sName, setSName] = useState('')
    const [sDir, setSDir] = useState<string | undefined>(undefined)

    // new-window fields
    const [wSession, setWSession] = useState('')
    const [wName, setWName] = useState('')
    const [wDir, setWDir] = useState<string | undefined>(undefined)

    const [loading, setLoading] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const token = getToken()
        fetch(`/api/tmux/quick-dirs?token=${token}`)
            .then(r => r.json())
            .then(d => setQuickDirs(d.dirs || []))
            .catch(() => { })
    }, [])

    // Default wSession to first available session
    useEffect(() => {
        if (sessions.length > 0 && !wSession) {
            setWSession(sessions[0].sessionName)
        }
    }, [sessions, wSession])

    // Close on outside click
    useEffect(() => {
        if (!open) return
        const h = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', h)
        return () => document.removeEventListener('mousedown', h)
    }, [open])

    const reset = () => {
        setSName(''); setSDir(undefined)
        setWName(''); setWDir(undefined)
    }

    const post = async (url: string, body: object) => {
        const token = getToken()
        const res = await fetch(`${url}?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error((await res.json()).message)
        return res.json()
    }

    const createSession = async () => {
        if (loading) return
        setLoading(true)
        try {
            await post('/api/tmux/new-session', { name: sName.trim() || undefined, dir: sDir })
            setOpen(false); reset(); onCreated?.()
        } catch { /* ignore */ } finally { setLoading(false) }
    }

    const createWindow = async () => {
        if (!wSession || loading) return
        setLoading(true)
        try {
            await post('/api/tmux/new-window', {
                session: wSession,
                name: wName.trim() || undefined,
                dir: wDir,
            })
            setOpen(false); reset(); onCreated?.()
        } catch { /* ignore */ } finally { setLoading(false) }
    }

    const DirChips = ({ selected, onSelect }: { selected?: string; onSelect: (p?: string) => void }) => (
        <div className="ntb-chips">
            <button className={`ntb-chip${!selected ? ' active' : ''}`} onClick={() => onSelect(undefined)}>~</button>
            {quickDirs.map((d, i) => (
                <button
                    key={i}
                    className={`ntb-chip${selected === d.path ? ' active' : ''}`}
                    onClick={() => onSelect(d.path)}
                    title={d.path}
                >{d.name}</button>
            ))}
        </div>
    )

    return (
        <div className="ntb-wrap" ref={menuRef}>
            <button
                className="ntb-trigger"
                title="New session / window"
                disabled={loading}
                onClick={() => setOpen(o => !o)}
            >
                <Plus size={14} strokeWidth={2.5} />
            </button>

            {open && (
                <div className="ntb-menu">
                    {/* ── New Session ── */}
                    <div className="ntb-section">
                        <div className="ntb-section-title green">
                            <Terminal size={13} /> New Session
                        </div>
                        <input
                            className="ntb-input"
                            placeholder="Session name (optional)"
                            value={sName}
                            onChange={e => setSName(e.target.value)}
                            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') createSession() }}
                            maxLength={60}
                        />
                        <DirChips selected={sDir} onSelect={setSDir} />
                        <button className="ntb-action green" onClick={createSession} disabled={loading}>
                            <FolderOpen size={12} /> Create Session
                        </button>
                    </div>

                    <div className="ntb-sep" />

                    {/* ── New Window ── */}
                    <div className="ntb-section">
                        <div className="ntb-section-title blue">
                            <LayoutPanelTop size={13} /> New Window
                        </div>
                        {sessions.length > 1 && (
                            <select
                                className="ntb-select"
                                value={wSession}
                                onChange={e => setWSession(e.target.value)}
                            >
                                {sessions.map(s => (
                                    <option key={s.sessionName} value={s.sessionName}>{s.sessionName}</option>
                                ))}
                            </select>
                        )}
                        <input
                            className="ntb-input"
                            placeholder="Window title (optional)"
                            value={wName}
                            onChange={e => setWName(e.target.value)}
                            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') createWindow() }}
                            maxLength={60}
                        />
                        <DirChips selected={wDir} onSelect={setWDir} />
                        <button className="ntb-action blue" onClick={createWindow} disabled={loading || !wSession}>
                            <LayoutPanelTop size={12} /> Add Window
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
