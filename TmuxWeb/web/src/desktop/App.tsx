import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Settings, LogOut, Menu, X, Smartphone, Maximize2, Minimize2, TerminalSquare, ScrollText } from 'lucide-react'
import { TmuxTree } from '../shared/components/TmuxTree'
import { TaskStatBadges } from '../shared/components/TaskStatBadges'
import { TerminalTabs } from './TerminalTabs'
import { LoginModal } from '../shared/components/LoginModal'
import { ProfileSelector } from '../shared/components/ProfileSelector'
import { GroupManager } from '../shared/components/GroupManager'
import { DesktopToolbox } from './DesktopToolbox'
import { ImperialStudyPanel } from '../shared/components/imperial-study/components/ImperialStudyPanel'
import { FloatingImperialStudy } from '../shared/components/imperial-study/components/FloatingImperialStudy'
import { checkAuth, logout } from '../utils/auth'
import { isMobile } from '../utils/platform'
import { TmuxSession, OpenTab, Profile, SessionGroup } from '../types'
import { VoiceInputHandle } from '../shared/components/VoiceInput'
import '../styles/app.css'


function loadTabs(): OpenTab[] {
  try {
    const raw = localStorage.getItem('openTabs')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function loadActiveTabId(): string | null {
  return localStorage.getItem('activeTabId') || null
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [sessions, setSessions] = useState<TmuxSession[]>([])
  const [tabs, setTabs] = useState<OpenTab[]>(loadTabs)
  const [activeTabId, setActiveTabId] = useState<string | null>(loadActiveTabId)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [groups, setGroups] = useState<SessionGroup[]>([])
  const [showGroupManager, setShowGroupManager] = useState(false)
  const [_selectedPaneKey, setSelectedPaneKey] = useState<string | null>(null)
  const [statusRefreshToken, setStatusRefreshToken] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(true) // Default to open on desktop
  const [showMobileHint, setShowMobileHint] = useState(() => isMobile())
  const [fullscreen, setFullscreen] = useState(false)
  const [taskHistoryPaneKey, setTaskHistoryPaneKey] = useState<string | null>(null)
  const [sidebarMode, setSidebarMode] = useState<'explorer' | 'imperial'>('explorer')
  const [imperialFloat, setImperialFloat] = useState(() => {
    try { return localStorage.getItem('imperial-float-mode') === 'true' } catch { return false }
  })

  // Auto-derive pane key from active tab (title = session:window, paneId = %N)
  const activePaneKey = useMemo(() => {
    const tab = tabs.find(t => t.id === activeTabId)
    return tab ? `${tab.title}:${tab.paneId}` : null
  }, [tabs, activeTabId])

  // Persist floating mode preference
  useEffect(() => {
    localStorage.setItem('imperial-float-mode', String(imperialFloat))
  }, [imperialFloat])

  const toggleImperialFloat = useCallback(() => {
    setImperialFloat(prev => {
      if (!prev) {
        // Switching to float: if sidebar was on imperial, go back to explorer
        if (sidebarMode === 'imperial') setSidebarMode('explorer')
      }
      return !prev
    })
  }, [sidebarMode])

  const terminalSendRefs = useRef<Record<string, (text: string) => void>>({})
  const voiceRef = useRef<VoiceInputHandle | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
        e.preventDefault()
        voiceRef.current?.toggle()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])


  useEffect(() => {
    localStorage.setItem('openTabs', JSON.stringify(tabs))
  }, [tabs])

  useEffect(() => {
    if (activeTabId) {
      localStorage.setItem('activeTabId', activeTabId)
    } else {
      localStorage.removeItem('activeTabId')
    }
  }, [activeTabId])

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

  async function fetchGroups(profileKey: string) {
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
  }

  async function handleLogout() {
    await logout()
    setIsAuthenticated(false)
    setSessions([])
    setTabs([])
    setActiveTabId(null)
    setCurrentProfile(null)
  }

  function handleProfileChange(profile: Profile) {
    setCurrentProfile(profile)
    setGroups([])
    fetchTree()
    fetchGroups(profile.profile_key)
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
    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabId)
      if (activeTabId === tabId && filtered.length > 0) {
        setActiveTabId(filtered[filtered.length - 1].id)
      } else if (activeTabId === tabId) {
        setActiveTabId(null)
      }
      return filtered
    })
    delete terminalSendRefs.current[tabId]
  }

  function handlePaneSelect(paneKey: string) {
    setSelectedPaneKey(paneKey)
    setTaskHistoryPaneKey(paneKey)
  }

  const handleSendRef = useCallback((tabId: string, sendFn: (text: string) => void) => {
    terminalSendRefs.current[tabId] = sendFn
  }, [])

  const sendToActiveTerminal = useCallback((text: string) => {
    if (activeTabId && terminalSendRefs.current[activeTabId]) {
      terminalSendRefs.current[activeTabId](text)
    }
  }, [activeTabId])

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
    <div className={`app ${fullscreen ? 'app-fullscreen' : ''}`}>
      {showMobileHint && (
        <div className="mobile-hint">
          <Smartphone size={16} />
          <span>Better experience on mobile?</span>
          <a href="/m" className="mobile-hint-link">Open mobile view</a>
          <button className="mobile-hint-close" onClick={() => setShowMobileHint(false)}>×</button>
        </div>
      )}

      {!fullscreen && (
        <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      )}

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {!fullscreen && (
        <aside className={`sidebar-container ${sidebarOpen ? 'open' : ''}`}>
          {/* Activity Bar */}
          <div className="activity-bar">
            <div className="activity-bar-top">
              <button
                className={`activity-tab ${sidebarMode === 'explorer' && sidebarOpen ? 'active' : ''}`}
                title="Explorer (Sessions)"
                onClick={() => {
                  if (sidebarMode === 'explorer') { setSidebarOpen(!sidebarOpen) }
                  else { setSidebarMode('explorer'); setSidebarOpen(true) }
                }}
              >
                <TerminalSquare size={22} strokeWidth={sidebarMode === 'explorer' && sidebarOpen ? 2 : 1.5} />
              </button>
              <button
                className={`activity-tab ${sidebarMode === 'imperial' && sidebarOpen && !imperialFloat ? 'active' : ''}`}
                title={imperialFloat ? '御書房 (浮窗模式)' : '御書房 (Butler)'}
                onClick={() => {
                  if (imperialFloat) {
                    // Already floating — toggle float off, open in sidebar
                    setImperialFloat(false)
                    setSidebarMode('imperial')
                    setSidebarOpen(true)
                  } else {
                    if (sidebarMode === 'imperial') { setSidebarOpen(!sidebarOpen) }
                    else { setSidebarMode('imperial'); setSidebarOpen(true) }
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  toggleImperialFloat()
                }}
              >
                <span className={imperialFloat ? 'is-float-pin' : ''}>
                  <ScrollText size={22} strokeWidth={sidebarMode === 'imperial' && sidebarOpen && !imperialFloat ? 2 : 1.5} />
                  {imperialFloat && <span className="is-float-pin__indicator" />}
                </span>
              </button>
            </div>
            <div className="activity-bar-bottom">
              <button className="activity-tab" onClick={() => setShowGroupManager(!showGroupManager)} title="Manage groups">
                <Settings size={22} strokeWidth={1.5} />
              </button>
              <button className="activity-tab" onClick={handleLogout} title="Sign out">
                <LogOut size={22} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Primary Sidebar Content */}
          <div className="primary-sidebar">
            {sidebarMode === 'imperial' && !imperialFloat ? (
              <ImperialStudyPanel activePaneKey={activePaneKey} />
            ) : (
              <>
                <div className="sidebar-header">
                  <ProfileSelector
                    currentProfile={currentProfile}
                    onProfileChange={handleProfileChange}
                  />
                </div>

                {/* Task stat badges — always visible, no tab switching */}
                <TaskStatBadges refreshToken={statusRefreshToken} />

                {showGroupManager && currentProfile && (
                  <GroupManager
                    profileKey={currentProfile.profile_key}
                    sessions={sessions}
                    onGroupsChanged={fetchTree}
                  />
                )}

                <div className="sidebar-content-area">
                  <TmuxTree
                    sessions={sessions}
                    groups={groups}
                    profileId={currentProfile?.id}
                    profileKey={currentProfile?.profile_key}
                    onSelectPane={openPane}
                    onRefresh={fetchTree}
                    onOrderChange={() => currentProfile && fetchGroups(currentProfile.profile_key)}
                    onPaneContextMenu={handlePaneSelect}
                    onPaneStatusClick={(paneKey) => setTaskHistoryPaneKey(paneKey)}
                    statusRefreshToken={statusRefreshToken}
                  />
                </div>
              </>
            )}
          </div>
        </aside>
      )}

      <main className="main">
        <TerminalTabs
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={setActiveTabId}
          onCloseTab={closeTab}
          onSendRef={handleSendRef}
          headerRight={
            <>
              {fullscreen && (
                <button
                  className="fullscreen-sidebar-btn"
                  onClick={() => setFullscreen(false)}
                  title="退出全屏"
                >
                  <Menu size={16} />
                </button>
              )}
              <button
                className="fullscreen-btn"
                onClick={() => setFullscreen(f => !f)}
                title={fullscreen ? '退出全屏' : '全屏模式'}
              >
                {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            </>
          }
        />
      </main>

      {!fullscreen && (
        <aside className="toolbox-panel">
          <DesktopToolbox
            onSend={sendToActiveTerminal}
            disabled={!activeTabId}
            voiceRef={voiceRef}
            taskHistoryPaneKey={taskHistoryPaneKey ?? activePaneKey}
            onStatusChange={() => setStatusRefreshToken(prev => prev + 1)}
          />
        </aside>
      )}

      {imperialFloat && (
        <FloatingImperialStudy
          activePaneKey={activePaneKey}
          onClose={() => setImperialFloat(false)}
        />
      )}

    </div>
  )
}
