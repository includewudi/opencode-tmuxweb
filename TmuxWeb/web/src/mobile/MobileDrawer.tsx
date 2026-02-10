import { RefreshCw, X, ChevronRight, Terminal } from 'lucide-react'
import { TmuxSession, TmuxPane } from '../types'

interface Props {
  open: boolean
  sessions: TmuxSession[]
  selectedPaneId: string | null
  onSelectPane: (pane: TmuxPane, sessionName: string, windowName: string) => void
  onClose: () => void
  onRefresh: () => void
}

export function MobileDrawer({ 
  open, 
  sessions, 
  selectedPaneId, 
  onSelectPane, 
  onClose, 
  onRefresh 
}: Props) {
  return (
    <aside className={`mobile-drawer ${open ? 'open' : ''}`}>
      <div className="mobile-drawer-header">
        <span className="mobile-drawer-title">Sessions</span>
        <div className="mobile-drawer-actions">
          <button 
            className="mobile-drawer-btn" 
            onClick={onRefresh}
            type="button"
            title="Refresh"
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
        {sessions.length === 0 ? (
          <div className="mobile-drawer-empty">No sessions found</div>
        ) : (
          sessions.map(session => (
            <div key={session.sessionId} className="mobile-session">
              <div className="mobile-session-name">
                <ChevronRight size={14} />
                {session.sessionName}
              </div>
              {session.windows.map(window => (
                <div key={window.windowId} className="mobile-window">
                  <div className="mobile-window-name">{window.windowName}</div>
                  {window.panes.map(pane => (
                    <button
                      key={pane.paneId}
                      className={`mobile-pane ${selectedPaneId === pane.paneId ? 'selected' : ''}`}
                      onClick={() => onSelectPane(pane, session.sessionName, window.windowName)}
                      type="button"
                    >
                      <Terminal size={14} />
                      <span className="mobile-pane-title">
                        {pane.paneTitle || pane.paneCommand || pane.paneId}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
