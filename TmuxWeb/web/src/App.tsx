import { useState, useEffect } from 'react'
import { Settings, LogOut, ChevronLeft, ChevronRight, Menu, X, Smartphone } from 'lucide-react'
import { TmuxTree } from './components/TmuxTree'
import { TerminalTabs } from './components/TerminalTabs'
import { LoginModal } from './components/LoginModal'
import { ProfileSelector } from './components/ProfileSelector'
import { GroupManager } from './components/GroupManager'
import { PaneDetails } from './components/PaneDetails'
import { checkAuth, logout } from './utils/auth'
import { isMobile } from './utils/platform'
import { TmuxSession, OpenTab, Profile, SessionGroup } from './types'
import './styles/app.css'

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [sessions, setSessions] = useState<TmuxSession[]>([])
  const [tabs, setTabs] = useState<OpenTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [groups, setGroups] = useState<SessionGroup[]>([])
  const [showGroupManager, setShowGroupManager] = useState(false)
  const [selectedPaneKey, setSelectedPaneKey] = useState<string | null>(null)
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(true)
  const [statusRefreshToken, setStatusRefreshToken] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showMobileHint, setShowMobileHint] = useState(() => isMobile())

  const handleStatusChanged = () => setStatusRefreshToken(prev => prev + 1)

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
      setSidebarOpen(false)
      return
    }
    const newTab: OpenTab = {
      id: `tab-${Date.now()}`,
      paneId,
      title: paneName
    }
    setTabs(prev => [...prev, newTab])
    setActiveTabId(newTab.id)
    setSidebarOpen(false)
  }

  function closeTab(tabId: string) {
    setTabs(prev => prev.filter(t => t.id !== tabId))
    if (activeTabId === tabId) {
      setActiveTabId(tabs.length > 1 ? tabs[0].id : null)
    }
  }

  function handlePaneSelect(paneKey: string) {
    setSelectedPaneKey(paneKey)
    setDetailsPanelOpen(true)
  }

  function toggleDetailsPanel() {
    setDetailsPanelOpen(!detailsPanelOpen)
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

  const showDetailsPanel = selectedPaneKey && currentProfile

  return (
    <div className="app">
      {showMobileHint && (
        <div className="mobile-hint">
          <Smartphone size={16} />
          <span>Better experience on mobile?</span>
          <a href="/m" className="mobile-hint-link">Open mobile view</a>
          <button className="mobile-hint-close" onClick={() => setShowMobileHint(false)}>×</button>
        </div>
      )}
      <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <ProfileSelector 
            currentProfile={currentProfile} 
            onProfileChange={handleProfileChange} 
          />
          <div className="header-actions">
            <button 
              className="group-btn" 
              onClick={() => setShowGroupManager(!showGroupManager)}
              title="Manage groups"
            >
              <Settings size={16} />
            </button>
            <button className="logout-btn" onClick={handleLogout} title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
        
        {showGroupManager && currentProfile && (
          <GroupManager 
            profileKey={currentProfile.profile_key}
            sessions={sessions}
            onGroupsChanged={fetchTree}
          />
        )}
        
        <TmuxTree 
          sessions={sessions}
          groups={groups}
          profileId={currentProfile?.id}
          profileKey={currentProfile?.profile_key}
          onSelectPane={openPane} 
          onRefresh={fetchTree}
          onOrderChange={() => currentProfile && fetchGroups(currentProfile.profile_key)}
          onPaneContextMenu={handlePaneSelect}
          statusRefreshToken={statusRefreshToken}
        />
      </aside>
      
      <main className={`main ${showDetailsPanel && detailsPanelOpen ? 'with-details' : ''}`}>
        <TerminalTabs
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={setActiveTabId}
          onCloseTab={closeTab}
        />
      </main>

      {showDetailsPanel && (
        <aside className={`details-panel ${detailsPanelOpen ? 'open' : 'collapsed'}`}>
          <button 
            className="details-toggle" 
            onClick={toggleDetailsPanel}
            title={detailsPanelOpen ? 'Collapse panel' : 'Expand panel'}
          >
            {detailsPanelOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          {detailsPanelOpen && (
            <PaneDetails
              paneKey={selectedPaneKey}
              profileKey={currentProfile!.profile_key}
              onClose={() => setSelectedPaneKey(null)}
              onStatusChanged={handleStatusChanged}
            />
          )}
        </aside>
      )}
    </div>
  )
}
