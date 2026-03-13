import { ReactNode } from 'react'
import { X } from 'lucide-react'
import { OpenTab } from '../types'
import { Terminal } from '../components/Terminal'
import './TerminalTabs.css'

interface Props {
  tabs: OpenTab[]
  activeTabId: string | null
  onSelectTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  onSendRef?: (tabId: string, sendFn: (text: string) => void) => void
  headerRight?: ReactNode
}

export function TerminalTabs({ tabs, activeTabId, onSelectTab, onCloseTab, onSendRef, headerRight }: Props) {
  if (tabs.length === 0) {
    return (
      <div className="no-tabs-wrapper">
        {headerRight && <div className="tabs-bar"><div className="tabs-bar-spacer" />{headerRight}</div>}
        <div className="no-tabs">Select a pane from the tree to open</div>
      </div>
    )
  }

  return (
    <div className="terminal-tabs">
      <div className="tabs-bar">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={() => onSelectTab(tab.id)}
          >
            <span className="tab-title">{tab.title}</span>
            <button
              className="close-btn"
              onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
        <div className="tabs-bar-spacer" />
        {headerRight}
      </div>
      <div className="tabs-content">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab-panel ${tab.id === activeTabId ? 'visible' : 'hidden'}`}
          >
            <Terminal
              paneId={tab.paneId}
              active={tab.id === activeTabId}
              onSendRef={onSendRef ? (sendFn) => onSendRef(tab.id, sendFn) : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
