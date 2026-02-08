import { useState, useEffect } from 'react'
import { TmuxTree } from './components/TmuxTree'
import { TerminalTabs } from './components/TerminalTabs'
import { LoginModal } from './components/LoginModal'
import { checkAuth, logout } from './utils/auth'
import { TmuxSession, OpenTab } from './types'
import './styles/app.css'

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [sessions, setSessions] = useState<TmuxSession[]>([])
  const [tabs, setTabs] = useState<OpenTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkAuth().then(ok => setIsAuthenticated(ok))
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      fetchTree()
    }
  }, [isAuthenticated])

  async function fetchTree() {
    setLoading(true)
    try {
      const res = await fetch('/api/tmux/tree', {
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Failed to fetch tree')
      const data = await res.json()
      setSessions(data.sessions || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    await logout()
    setIsAuthenticated(false)
    setSessions([])
    setTabs([])
    setActiveTabId(null)
  }

  function openPane(paneId: string, paneName: string) {
    const existing = tabs.find(t => t.paneId === paneId)
    if (existing) {
      setActiveTabId(existing.id)
      return
    }
    const newTab: OpenTab = {
      id: `tab-${Date.now()}`,
      paneId,
      title: paneName
    }
    setTabs(prev => [...prev, newTab])
    setActiveTabId(newTab.id)
  }

  function closeTab(tabId: string) {
    setTabs(prev => prev.filter(t => t.id !== tabId))
    if (activeTabId === tabId) {
      setActiveTabId(tabs.length > 1 ? tabs[0].id : null)
    }
  }

  if (isAuthenticated === null) {
    return <div className="loading">Loading...</div>
  }

  if (!isAuthenticated) {
    return <LoginModal onLogin={() => setIsAuthenticated(true)} />
  }

  if (loading && sessions.length === 0) {
    return <div className="loading">Loading...</div>
  }

  if (error) {
    return <div className="error">{error}</div>
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <button className="logout-btn" onClick={handleLogout} title="Sign out">
            ⏻
          </button>
        </div>
        <TmuxTree sessions={sessions} onSelectPane={openPane} onRefresh={fetchTree} />
      </aside>
      <main className="main">
        <TerminalTabs
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={setActiveTabId}
          onCloseTab={closeTab}
        />
      </main>
    </div>
  )
}
