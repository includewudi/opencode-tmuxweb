import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Menu, X, History, ScrollText } from 'lucide-react'
import { MobileDrawer } from './MobileDrawer'
import { MobileTerminal } from './MobileTerminal'
import { TaskHistoryPanel } from '../shared/components/TaskHistoryPanel'
import { ImperialStudyPanel } from '../shared/components/imperial-study/components/ImperialStudyPanel'
import { LoginModal } from '../shared/components/LoginModal'
import { checkAuth, logout } from '../utils/auth'
import { TmuxSession, OpenTab, Profile, SessionGroup } from '../types'
import useVisualViewport from '../hooks/useVisualViewport'
import useShakeDetect from '../hooks/useShakeDetect'
import { VoiceInputHandle } from '../shared/components/VoiceInput'
import './mobile.css'

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

/** Map a raw tmux paneId (e.g. "%4") to a structured paneKey (e.g. "session:0:%4") */
function getPaneKey(sessions: TmuxSession[], paneId: string): string | null {
  for (const s of sessions) {
    for (let wi = 0; wi < s.windows.length; wi++) {
      const w = s.windows[wi]
      for (let pi = 0; pi < w.panes.length; pi++) {
        if (w.panes[pi].paneId === paneId) {
          return `${s.sessionName}:${w.windowIndex}:${w.panes[pi].paneId}`
        }
      }
    }
  }
  return null
}

function loadTabs(): OpenTab[] {
  try {
    const raw = localStorage.getItem('mobile-openTabs')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveTabs(tabs: OpenTab[]) {
  localStorage.setItem('mobile-openTabs', JSON.stringify(tabs))
}

function loadActiveTabId(): string | null {
  return localStorage.getItem('mobile-activeTabId') || null
}

function saveActiveTabId(id: string | null) {
  if (id) {
    localStorage.setItem('mobile-activeTabId', id)
  } else {
    localStorage.removeItem('mobile-activeTabId')
  }
}

export default function MobileApp() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [sessions, setSessions] = useState<TmuxSession[]>([])
  const [tabs, setTabs] = useState<OpenTab[]>(loadTabs)
  const [activeTabId, setActiveTabId] = useState<string | null>(loadActiveTabId)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [rightPanelOpen, setRightPanelOpen] = useState(false)
  const [taskHistoryPaneKey, setTaskHistoryPaneKey] = useState<string | null>(null)
  const [statusRefreshToken, setStatusRefreshToken] = useState(0)
  const [imperialOpen, setImperialOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('terminal-font-size')
    return saved ? parseFloat(saved) : 10
  })

  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [groups, setGroups] = useState<SessionGroup[]>([])

  const voiceRef = useRef<VoiceInputHandle>(null)

  // Persist tabs & activeTabId
  useEffect(() => { saveTabs(tabs) }, [tabs])
  useEffect(() => { saveActiveTabId(activeTabId) }, [activeTabId])
  // Reset explicit task-history pane override when switching tabs,
  // so the history panel follows the active terminal tab
  useEffect(() => { setTaskHistoryPaneKey(null) }, [activeTabId])

  // Visual viewport CSS vars (--vvh, --vv-offset)
  useVisualViewport()

  // Shake-to-record: toggle voice input on shake
  useShakeDetect(() => {
    voiceRef.current?.toggle()
  }, { enabled: tabs.length > 0 })

  const handleFontSizeChange = useCallback((size: number) => {
    setFontSize(size)
    localStorage.setItem('terminal-font-size', String(size))
  }, [])

  // Ref for stale-closure avoidance in fetchTree
  const tabsRef = useRef<OpenTab[]>(tabs)
  tabsRef.current = tabs

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

      // Prune tabs whose paneId no longer exists
      const allIds = getAllPaneIds(newSessions)
      const currentTabs = tabsRef.current
      const validTabs = currentTabs.filter(t => allIds.has(t.paneId))
      if (validTabs.length !== currentTabs.length) {
        setTabs(validTabs)
        setActiveTabId(prev => {
          if (prev && validTabs.some(t => t.id === prev)) return prev
          return validTabs[0]?.id ?? null
        })
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

  const fetchGroups = useCallback(async (profileKey: string) => {
    try {
      const res = await fetch(`/api/groups?profile_key=${encodeURIComponent(profileKey)}`, {
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Failed to fetch groups')
      const data = await res.json()
      setGroups(data.groups || [])
    } catch (err) {
      console.error('Failed to fetch groups:', err)
      setGroups([])
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      fetchTree()
    }
  }, [isAuthenticated, fetchTree])

  const handleProfileChange = useCallback((profile: Profile) => {
    setCurrentProfile(profile)
    setGroups([])
    fetchTree()
    fetchGroups(profile.profile_key)
  }, [fetchTree, fetchGroups])

  const handleGroupsChanged = useCallback(() => {
    fetchTree()
    if (currentProfile) {
      fetchGroups(currentProfile.profile_key)
    }
  }, [fetchTree, fetchGroups, currentProfile])

  // Add or focus a tab when pane is selected from drawer
  const handleSelectPane = useCallback((paneId: string, paneName: string) => {
    setTabs(prev => {
      const existing = prev.find(t => t.paneId === paneId)
      if (existing) {
        setActiveTabId(existing.id)
        return prev
      }
      const newTab: OpenTab = { id: `tab-${paneId}`, paneId, title: paneName }
      setActiveTabId(newTab.id)
      return [...prev, newTab]
    })
    setDrawerOpen(false)
  }, [])

  // Open task history for a specific pane (from status icon click in drawer)
  const handlePaneStatusClick = useCallback((paneKey: string) => {
    setTaskHistoryPaneKey(paneKey)
    setRightPanelOpen(true)
  }, [])

  const handleCloseTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === tabId)
      const next = prev.filter(t => t.id !== tabId)
      setActiveTabId(prevActive => {
        if (prevActive !== tabId) return prevActive
        if (next.length === 0) return null
        // Activate adjacent tab
        const newIdx = Math.min(idx, next.length - 1)
        return next[newIdx].id
      })
      return next
    })
  }, [])

  const handleSelectTab = useCallback((tabId: string) => {
    setActiveTabId(tabId)
  }, [])

  const handleLogout = useCallback(async () => {
    await logout()
    setIsAuthenticated(false)
    setSessions([])
    setTabs([])
    setActiveTabId(null)
    setCurrentProfile(null)
    setGroups([])
  }, [])

  const toggleDrawer = useCallback(() => {
    setDrawerOpen(prev => !prev)
  }, [])

  // Right panel shows task history for current pane
  const activeTab = tabs.find(t => t.id === activeTabId) ?? null
  const activePaneKey = useMemo(() => {
    return activeTab ? getPaneKey(sessions, activeTab.paneId) : null
  }, [activeTab, sessions])

  const toggleRightPanel = useCallback(() => {
    setRightPanelOpen(prev => {
      const next = !prev
      if (next && !taskHistoryPaneKey) {
        // Auto-select active pane when opening
        setTaskHistoryPaneKey(activePaneKey)
      }
      return next
    })
  }, [taskHistoryPaneKey, activePaneKey])

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

  // Effective history pane: explicit click overrides active pane
  const historyPaneKey = taskHistoryPaneKey ?? activePaneKey

  return (
    <div className="mobile-app">
      <header className="mobile-header">
        <button className="mobile-menu-btn" onClick={toggleDrawer} type="button">
          <Menu size={24} />
        </button>
        {tabs.length > 0 ? (
          <div className="mobile-tabs-bar">
            {tabs.map(tab => (
              <div
                key={tab.id}
                className={`mobile-tab ${tab.id === activeTabId ? 'active' : ''}`}
                onClick={() => handleSelectTab(tab.id)}
              >
                <span className="mobile-tab-title">{tab.title}</span>
                <button
                  className="mobile-tab-close"
                  onClick={(e) => { e.stopPropagation(); handleCloseTab(tab.id) }}
                  type="button"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <span className="mobile-title">Select a pane</span>
        )}
        {activeTab && (
          <>
            <button className="mobile-menu-btn" onClick={() => setImperialOpen(true)} type="button" title="\u5fa1\u66f8\u623f">
              <ScrollText size={22} />
            </button>
            <button className="mobile-menu-btn" onClick={toggleRightPanel} type="button" title="Task history">
              <History size={22} />
            </button>
          </>
        )}
      </header>

      {(drawerOpen || rightPanelOpen || imperialOpen) && (
        <div className="mobile-overlay" onClick={() => { setDrawerOpen(false); setRightPanelOpen(false); setImperialOpen(false) }} />
      )}

      {/* Full-screen \u5fa1\u66f8\u623f panel */}
      {imperialOpen && (
        <div className="mobile-imperial-panel">
          <header className="mobile-imperial-header">
            <span>\u5fa1\u66f8\u623f</span>
            <button className="mobile-menu-btn" onClick={() => setImperialOpen(false)} type="button">
              <X size={22} />
            </button>
          </header>
          <ImperialStudyPanel activePaneKey={activePaneKey} />
        </div>
      )}

      <MobileDrawer
        open={drawerOpen}
        sessions={sessions}
        currentProfile={currentProfile}
        groups={groups}
        statusRefreshToken={statusRefreshToken}
        onProfileChange={handleProfileChange}
        onGroupsChanged={handleGroupsChanged}
        onSelectPane={handleSelectPane}
        onPaneStatusClick={handlePaneStatusClick}
        onClose={() => setDrawerOpen(false)}
        onRefresh={fetchTree}
        onLogout={handleLogout}
      />

      {/* Right panel: task history */}
      <aside className={`mobile-right-panel ${rightPanelOpen ? 'open' : ''}`}>
        {rightPanelOpen && (
          <TaskHistoryPanel
            paneKey={historyPaneKey}
            onClose={() => setRightPanelOpen(false)}
            onStatusChange={() => setStatusRefreshToken(prev => prev + 1)}
          />
        )}
      </aside>

      <main className="mobile-main">
        {tabs.length > 0 ? (
          <div className="mobile-tabs-content">
            {tabs.map(tab => (
              <div
                key={tab.id}
                className={`mobile-tab-panel ${tab.id === activeTabId ? 'visible' : 'hidden'}`}
              >
                <MobileTerminal
                  paneId={tab.paneId}
                  fontSize={fontSize}
                  onFontSizeChange={handleFontSizeChange}
                  voiceRef={tab.id === activeTabId ? voiceRef : undefined}
                  taskHistoryPaneKey={tab.id === activeTabId ? historyPaneKey : null}
                  onStatusChange={tab.id === activeTabId ? () => setStatusRefreshToken(prev => prev + 1) : undefined}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="mobile-placeholder">
            <p>Tap <Menu size={20} /> to select a terminal</p>
          </div>
        )}
      </main>
    </div>
  )
}
