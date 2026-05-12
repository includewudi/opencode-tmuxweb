import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Settings, LogOut, Menu, X, Smartphone, Maximize2, Minimize2, TerminalSquare, ScrollText, FolderSearch, BrainCircuit, FolderTree, GitBranch, History, BarChart3, Languages } from 'lucide-react'
import { TmuxTree } from '../shared/components/TmuxTree'
import { TaskStatBadges } from '../shared/components/TaskStatBadges'
import { TerminalTabs } from './TerminalTabs'
import { LoginModal } from '../shared/components/LoginModal'
import { ProfileSelector } from '../shared/components/ProfileSelector'
import { GroupManager } from '../shared/components/GroupManager'
import { DesktopToolbox } from './DesktopToolbox'
import { ImperialStudyPanel } from '../shared/components/imperial-study/components/ImperialStudyPanel'
import { FloatingImperialStudy } from '../shared/components/imperial-study/components/FloatingImperialStudy'
import { FloatingYazi } from '../shared/components/file-browser/FloatingYazi'
import { FloatingQuickOpen } from '../shared/components/file-browser/FloatingQuickOpen'
import { FloatingGitPanel } from '../shared/components/file-browser/FloatingGitPanel'
import { FloatingTerminal } from '../shared/components/ephemeral-terminal/FloatingTerminal'
import { FloatingCLIHistory } from '../shared/components/cli-history/FloatingCLIHistory'
import { FloatingSessionBrowser } from '../shared/components/session-browser/FloatingSessionBrowser'
import { FloatingProjectOverview } from '../shared/components/ProjectOverview/components/FloatingProjectOverview'
import { FloatingTranslation } from '../shared/components/translation/FloatingTranslation'
import { TaskToastContainer } from '../shared/components/TaskToast'
import { ErrorBoundary } from '../shared/components/ErrorBoundary'
import { usePaneNavigation } from '../hooks/usePaneNavigation'
import { useGlobalTaskNotifications } from '../hooks/useGlobalTaskNotifications'
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
  const [pendingPaneKey, setPendingPaneKey] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('paneKey')
  })
  const [sidebarMode, setSidebarMode] = useState<'explorer' | 'imperial'>('explorer')
  const [imperialFloat, setImperialFloat] = useState(() => {
    try { return localStorage.getItem('imperial-float-mode') === 'true' } catch { return false }
  })
  const [yaziFloat, setYaziFloat] = useState(false)

  const [cliHistoryFloat, setCLIHistoryFloat] = useState(false)
  const [sessionBrowserFloat, setSessionBrowserFloat] = useState(false)
  const [quickOpenFloat, setQuickOpenFloat] = useState(false)
  const [gitFloat, setGitFloat] = useState(false)
  const [terminalFloat, setTerminalFloat] = useState(false)
  const [projectOverviewFloat, setProjectOverviewFloat] = useState(false)
  const [translationFloat, setTranslationFloat] = useState(false)
  const activePaneKey = useMemo(() => {
    const tab = tabs.find(t => t.id === activeTabId)
    if (!tab) return null
    return tab.title
  }, [tabs, activeTabId])

  const activePaneCwd = useMemo(() => {
    try {
      if (!activePaneKey) return null
      const [sessionName, windowIndex] = activePaneKey.split(':')
      const session = sessions.find(s => s.sessionName === sessionName)
      if (!session?.windows) return null
      const win = session.windows.find(w => String(w.windowIndex) === windowIndex)
      if (!win?.panes) return null
      const activeTab = tabs.find(t => t.id === activeTabId)
      const pane = activeTab
        ? win.panes.find(p => p.paneId === activeTab.paneId)
        : win.panes[0]
      return pane?.currentPath || win.panes[0]?.currentPath || null
    } catch (e) {
      console.warn('[activePaneCwd]', e)
      return null
    }
  }, [activePaneKey, sessions, tabs, activeTabId])

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

  useEffect(() => {
    if (!pendingPaneKey || sessions.length === 0) return
    window.dispatchEvent(new CustomEvent('navigate-to-pane', {
      detail: { paneKey: pendingPaneKey }
    }))
    setTaskHistoryPaneKey(pendingPaneKey)
    setPendingPaneKey(null)
    if (window.location.search) {
      window.history.replaceState({}, '', '/')
    }
  }, [pendingPaneKey, sessions])

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
    // paneName format: "sessionName:windowIndex" — extract sessionName by stripping trailing :number
    const lastColon = paneName.lastIndexOf(':')
    const sessionName = lastColon > 0 ? paneName.substring(0, lastColon) : paneName
    const newTab: OpenTab = {
      id: `tab-${Date.now()}`,
      paneId,
      title: paneName,
      sessionName
    }
    setTabs(prev => [...prev, newTab])
    setActiveTabId(newTab.id)
  }

  usePaneNavigation(sessions, openPane)
  const { notifications, dismissNotification } = useGlobalTaskNotifications()

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
              <button
                className={`activity-tab ${yaziFloat ? 'active' : ''}`}
                title="文件管理器 (yazi)"
                onClick={() => setYaziFloat(!yaziFloat)}
              >
                <span className={yaziFloat ? 'fb-float-pin' : ''}>
                  <FolderSearch size={22} strokeWidth={yaziFloat ? 2 : 1.5} />
                  {yaziFloat && <span className="fb-float-pin__indicator" />}
                </span>
              </button>
              <button
                className={`activity-tab ${quickOpenFloat ? 'active' : ''}`}
                title="快速路径"
                onClick={() => setQuickOpenFloat(!quickOpenFloat)}
              >
                <FolderTree size={22} strokeWidth={quickOpenFloat ? 2 : 1.5} />
              </button>
              <button
                className={`activity-tab ${gitFloat ? 'active' : ''}`}
                title="Git 操作"
                onClick={() => setGitFloat(!gitFloat)}
              >
                <span className={gitFloat ? 'fb-float-pin' : ''}>
                  <GitBranch size={22} strokeWidth={gitFloat ? 2 : 1.5} />
                {gitFloat && <span className="fb-float-pin__indicator" />}
                </span>
              </button>
              <button
                className={`activity-tab ${terminalFloat ? 'active' : ''}`}
                title="临时终端"
                onClick={() => setTerminalFloat(!terminalFloat)}
              >
                <span className={terminalFloat ? 'fb-float-pin' : ''}>
                  <TerminalSquare size={22} strokeWidth={terminalFloat ? 2 : 1.5} />
                  {terminalFloat && <span className="fb-float-pin__indicator" />}
                </span>
              </button>
              <button
                className={`activity-tab ${cliHistoryFloat ? 'active' : ''}`}
                title="CLI History"
                onClick={() => setCLIHistoryFloat(!cliHistoryFloat)}
              >
                <span className={cliHistoryFloat ? 'fb-float-pin' : ''}>
                  <BrainCircuit size={22} strokeWidth={cliHistoryFloat ? 2 : 1.5} />
                  {cliHistoryFloat && <span className="fb-float-pin__indicator" />}
                </span>
              </button>
              <button
                className={`activity-tab ${sessionBrowserFloat ? 'active' : ''}`}
                title="Session 目录"
                onClick={() => setSessionBrowserFloat(!sessionBrowserFloat)}
              >
                <span className={sessionBrowserFloat ? 'fb-float-pin' : ''}>
                  <History size={22} strokeWidth={sessionBrowserFloat ? 2 : 1.5} />
                  {sessionBrowserFloat && <span className="fb-float-pin__indicator" />}
                </span>
              </button>
              <button
                className={`activity-tab ${projectOverviewFloat ? 'active' : ''}`}
                title="项目总览"
                onClick={() => setProjectOverviewFloat(!projectOverviewFloat)}
              >
                <BarChart3 size={22} strokeWidth={projectOverviewFloat ? 2 : 1.5} />
              </button>
              <button
                className={`activity-tab ${translationFloat ? 'active' : ''}`}
                title="翻译"
                onClick={() => setTranslationFloat(!translationFloat)}
              >
                <Languages size={22} strokeWidth={translationFloat ? 2 : 1.5} />
              </button>
            </div>
            <div className="activity-bar-bottom">
<button className="activity-tab" onClick={() => { setShowGroupManager(!showGroupManager); setSidebarOpen(true); if (sidebarMode === 'imperial') setSidebarMode('explorer') }} title="Manage groups">
                <Settings size={22} strokeWidth={showGroupManager ? 2 : 1.5} />
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
        <ErrorBoundary>
          <FloatingImperialStudy
            activePaneKey={activePaneKey}
            onClose={() => setImperialFloat(false)}
          />
        </ErrorBoundary>
      )}

      {yaziFloat && (
        <ErrorBoundary>
          <FloatingYazi
            dir={activePaneCwd || undefined}
            onSendPath={sendToActiveTerminal}
            onClose={() => setYaziFloat(false)}
          />
        </ErrorBoundary>
      )}

      {cliHistoryFloat && (
        <ErrorBoundary>
          <FloatingCLIHistory
            cwd={activePaneCwd}
            onClose={() => setCLIHistoryFloat(false)}
          />
        </ErrorBoundary>
      )}

      {sessionBrowserFloat && (
        <ErrorBoundary>
          <FloatingSessionBrowser
            cwd={activePaneCwd}
            onClose={() => setSessionBrowserFloat(false)}
            onSendToTerminal={sendToActiveTerminal}
          />
        </ErrorBoundary>
      )}

      {quickOpenFloat && (
        <ErrorBoundary>
          <FloatingQuickOpen
            dir={activePaneCwd || undefined}
            onSendPath={sendToActiveTerminal}
            onClose={() => setQuickOpenFloat(false)}
          />
        </ErrorBoundary>
      )}

      {gitFloat && (
        <ErrorBoundary>
          <FloatingGitPanel
            dir={activePaneCwd || undefined}
            onClose={() => setGitFloat(false)}
          />
        </ErrorBoundary>
      )}

      {terminalFloat && (
        <ErrorBoundary>
          <FloatingTerminal
            cwd={activePaneCwd || undefined}
            onClose={() => setTerminalFloat(false)}
          />
        </ErrorBoundary>
      )}

      {projectOverviewFloat && (
        <ErrorBoundary>
          <FloatingProjectOverview onClose={() => setProjectOverviewFloat(false)} />
        </ErrorBoundary>
      )}

      {translationFloat && (
        <ErrorBoundary>
          <FloatingTranslation
            paneId={activePaneKey}
            onClose={() => setTranslationFloat(false)}
          />
        </ErrorBoundary>
      )}

      {/* Group Manager Overlay */}
      {showGroupManager && (
<div className="gm-overlay" onClick={() => { setShowGroupManager(false) }}>
          <div className="gm-panel">
            <header className="gm-header">
              <span>分组管理</span>
              <button className="gm-close" onClick={() => setShowGroupManager(false)} type="button"><X size={16} /></button>
            </header>
            <GroupManager
              profileKey={currentProfile?.profile_key || ''}
              sessions={sessions}
              onGroupsChanged={fetchTree}
            />
          </div>
        </div>
      )}

      <TaskToastContainer notifications={notifications} onDismiss={dismissNotification} />

    </div>
  )
}
