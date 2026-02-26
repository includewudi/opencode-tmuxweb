import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Plus, Terminal, FolderOpen } from 'lucide-react'
import { useNewWindow } from '../../hooks/useNewWindow'
import './NewWindowButton.css'

interface NewWindowButtonProps {
    session: string
    onCreated?: () => void
    compact?: boolean
}

export function NewWindowButton({ session, onCreated, compact }: NewWindowButtonProps) {
    const [open, setOpen] = useState(false)
    const [selectedDir, setSelectedDir] = useState<string | undefined>(undefined)
    const [nameInput, setNameInput] = useState('')
    const menuRef = useRef<HTMLDivElement>(null)
    const nameRef = useRef<HTMLInputElement>(null)
    const { quickDirs, createWindow, loading } = useNewWindow(onCreated)

    useEffect(() => {
        if (!open) return
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open])

    // 打开时聚焦 name input
    useEffect(() => {
        if (open) setTimeout(() => nameRef.current?.focus(), 50)
        else { setNameInput(''); setSelectedDir(undefined) }
    }, [open])

    const handleCreate = async (dir?: string) => {
        setOpen(false)
        try { await createWindow(session, dir, nameInput.trim() || undefined) } catch { /* ignored */ }
    }

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') handleCreate(selectedDir)
        if (e.key === 'Escape') setOpen(false)
    }

    return (
        <div className={`nwb-wrap${compact ? ' compact' : ''}`} ref={menuRef}>
            <button
                className="nwb-trigger"
                title="New tmux window"
                disabled={loading}
                onMouseDown={e => e.preventDefault()}
                onClick={() => setOpen(o => !o)}
            >
                <Plus size={compact ? 14 : 15} strokeWidth={2.5} />
            </button>

            {open && (
                <div className="nwb-menu">
                    <div className="nwb-header">
                        <Terminal size={13} />
                        <span>New Window</span>
                    </div>

                    {/* name input */}
                    <div className="nwb-name-row">
                        <input
                            ref={nameRef}
                            className="nwb-name-input"
                            placeholder="Window title (optional)"
                            value={nameInput}
                            onChange={e => setNameInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            maxLength={60}
                        />
                    </div>

                    <div className="nwb-sep" />

                    {/* Default dir */}
                    <button
                        className={`nwb-item${selectedDir === undefined ? ' selected' : ''}`}
                        onClick={() => { setSelectedDir(undefined); handleCreate(undefined) }}
                    >
                        <FolderOpen size={13} />
                        <span className="nwb-item-name">Default Dir</span>
                    </button>

                    {quickDirs.length > 0 && <div className="nwb-sep" />}

                    {quickDirs.map((d, i) => (
                        <button
                            key={i}
                            className={`nwb-item${selectedDir === d.path ? ' selected' : ''}`}
                            onClick={() => { setSelectedDir(d.path); handleCreate(d.path) }}
                            title={d.path}
                        >
                            <FolderOpen size={13} />
                            <span className="nwb-item-name">{d.name}</span>
                            <span className="nwb-item-path">{d.path.replace(/\/Users\/[^/]+/, '~')}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
