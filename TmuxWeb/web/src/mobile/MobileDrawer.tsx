import { RefreshCw, X, Settings, LogOut } from 'lucide-react'
import { TmuxSession, Profile, SessionGroup } from '../types'
import { ProfileSelector } from '../shared/components/ProfileSelector'
import { GroupManager } from '../shared/components/GroupManager'
import { TmuxTree } from '../shared/components/TmuxTree'
import { GlobalTaskOverview } from '../shared/components/GlobalTaskOverview'
import { useState } from 'react'
import { TerminalSquare, CheckSquare } from 'lucide-react'

interface Props {
  open: boolean
  sessions: TmuxSession[]
  currentProfile: Profile | null
  groups: SessionGroup[]
  onProfileChange: (profile: Profile) => void
  onGroupsChanged: () => void
  onSelectPane: (paneId: string, paneName: string) => void
  onClose: () => void
  onRefresh: () => void
  onLogout: () => void
}

export function MobileDrawer({
  open,
  sessions,
  currentProfile,
  groups,
  onProfileChange,
  onGroupsChanged,
  onSelectPane,
  onClose,
  onRefresh,
  onLogout,
}: Props) {
  const [showGroupManager, setShowGroupManager] = useState(false)
  const [activeTab, setActiveTab] = useState<'sessions' | 'tasks'>('sessions')

  const handleSelectPane = (paneId: string, paneName: string) => {
    onSelectPane(paneId, paneName)
    onClose()
  }

  return (
    <aside className={`mobile-drawer ${open ? 'open' : ''}`}>
      <div className="mobile-drawer-header">
        <div className="mobile-drawer-tabs">
          <button
            className={`mobile-drawer-tab ${activeTab === 'sessions' ? 'active' : ''}`}
            onClick={() => setActiveTab('sessions')}
          >
            <TerminalSquare size={16} />
            <span>Sessions</span>
          </button>
          <button
            className={`mobile-drawer-tab ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('tasks')}
          >
            <CheckSquare size={16} />
            <span>Tasks</span>
          </button>
        </div>
        <div className="mobile-drawer-actions">
          {activeTab === 'sessions' && (
            <button
              className="mobile-drawer-btn"
              onClick={() => setShowGroupManager(!showGroupManager)}
              type="button"
              title="Manage groups"
            >
              <Settings size={18} />
            </button>
          )}
          <button
            className="mobile-drawer-btn"
            onClick={activeTab === 'sessions' ? onRefresh : undefined} // Task Overview has its own refresh
            type="button"
            title="Refresh"
            style={{ opacity: activeTab === 'tasks' ? 0.3 : 1, pointerEvents: activeTab === 'tasks' ? 'none' : 'auto' }}
          >
            <RefreshCw size={18} />
          </button>
          <button
            className="mobile-drawer-btn"
            onClick={onClose}
            type="button"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="mobile-drawer-content">
        <div className="mobile-drawer-profile">
          <ProfileSelector
            currentProfile={currentProfile}
            onProfileChange={onProfileChange}
          />
          <button
            className="mobile-drawer-logout"
            onClick={onLogout}
            type="button"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>

        {activeTab === 'sessions' && showGroupManager && currentProfile && (
          <GroupManager
            profileKey={currentProfile.profile_key}
            sessions={sessions}
            onGroupsChanged={onGroupsChanged}
          />
        )}

        {activeTab === 'sessions' ? (
          <div className="mobile-drawer-scrollable">
            <TmuxTree
              sessions={sessions}
              groups={groups}
              profileId={currentProfile?.id}
              profileKey={currentProfile?.profile_key}
              onSelectPane={handleSelectPane}
              onRefresh={onRefresh}
              onOrderChange={onGroupsChanged}
              defaultExpanded={false}
            />
          </div>
        ) : (
          <div className="mobile-drawer-scrollable">
            <GlobalTaskOverview
              onSelectPane={handleSelectPane}
            />
          </div>
        )}
      </div>
    </aside>
  )
}
