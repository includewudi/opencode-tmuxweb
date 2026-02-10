import { useState, useEffect, useCallback, useRef } from 'react'
import { Menu } from 'lucide-react'
import { MobileDrawer } from './MobileDrawer'
import { MobileTerminal } from './MobileTerminal'
import { LoginModal } from '../components/LoginModal'
import { checkAuth } from '../utils/auth'
import { TmuxSession, TmuxPane } from '../types'
import './mobile.css'

interface SelectedPane {
  paneId: string
  title: string
}

function getAllPaneIds(sessions: TmuxSession[]): Set<string> {
  const ids = new Set<string>()
  for (const s of sessions) {
    for (const w of s.windows) {
      for (const p of w.panes) {
        ids.add(p.paneId)
      }
    }
  }
  return ids
}

function getFirstPane(sessions: TmuxSession[]): SelectedPane | null {
  const s = sessions[0]
  if (!s?.windows?.length) return null
  const w = s.windows[0]
  if (!w?.panes?.length) return null
  return {
    paneId: w.panes[0].paneId,
    title: `${s.sessionName}/${w.windowName}`
  }
}

export default function MobileApp() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [sessions, setSessions] = useState<TmuxSession[]>([])
  const [selectedPane, setSelectedPane] = useState<SelectedPane | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Avoids stale closure in fetchTree's useCallback
  const selectedPaneRef = useRef<SelectedPane | null>(null)
  selectedPaneRef.current = selectedPane

  // Sequence counter: discard responses from superseded fetchTree calls
  const fetchSeqRef = useRef(0)

  useEffect(() => {
    checkAuth().then(ok => setIsAuthenticated(ok))
  }, [])

  const fetchTree = useCallback(async () => {
    const seq = ++fetchSeqRef.current
    setLoading(true)
    try {
      const res = await fetch('/api/tmux/tree', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch tree')
      const data = await res.json()

      if (seq !== fetchSeqRef.current) return

      const newSessions: TmuxSession[] = data.sessions || []
      setSessions(newSessions)
      setError(null)

      const current = selectedPaneRef.current
      if (current) {
        const allIds = getAllPaneIds(newSessions)
        if (allIds.has(current.paneId)) {
          return
        }
        setSelectedPane(getFirstPane(newSessions))
      } else {
        setSelectedPane(getFirstPane(newSessions))
      }
    } catch (err) {
      if (seq !== fetchSeqRef.current) return
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      if (seq === fetchSeqRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      fetchTree()
    }
  }, [isAuthenticated, fetchTree])

  const handleSelectPane = useCallback((pane: TmuxPane, sessionName: string, windowName: string) => {
    setSelectedPane({
      paneId: pane.paneId,
      title: `${sessionName}/${windowName}`
    })
    setDrawerOpen(false)
  }, [])

  const toggleDrawer = useCallback(() => {
    setDrawerOpen(prev => !prev)
  }, [])

  if (isAuthenticated === null) {
    return <div className="mobile-loading">Loading...</div>
  }

  if (!isAuthenticated) {
    return <LoginModal onLogin={() => setIsAuthenticated(true)} />
  }

  if (loading && sessions.length === 0) {
    return <div className="mobile-loading">Loading sessions...</div>
  }

  if (error) {
    return <div className="mobile-error">{error}</div>
  }

  return (
    <div className="mobile-app">
      <header className="mobile-header">
        <button className="mobile-menu-btn" onClick={toggleDrawer} type="button">
          <Menu size={24} />
        </button>
        <span className="mobile-title">{selectedPane?.title || 'Select a pane'}</span>
      </header>

      {drawerOpen && (
        <div className="mobile-overlay" onClick={() => setDrawerOpen(false)} />
      )}

      <MobileDrawer
        open={drawerOpen}
        sessions={sessions}
        selectedPaneId={selectedPane?.paneId || null}
        onSelectPane={handleSelectPane}
        onClose={() => setDrawerOpen(false)}
        onRefresh={fetchTree}
      />

      <main className="mobile-main">
        {selectedPane ? (
          <MobileTerminal paneId={selectedPane.paneId} />
        ) : (
          <div className="mobile-placeholder">
            <p>Tap <Menu size={20} /> to select a terminal</p>
          </div>
        )}
      </main>
    </div>
  )
}
