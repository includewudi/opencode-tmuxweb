import { useEffect, useState } from 'react'
import { QuickOpenPanel } from './QuickOpenPanel'
import { WebFileBrowser } from './WebFileBrowser'
import './quick-open-sidebar.css'

interface QuickOpenSidebarProps {
  initialPath: string
  onSendPath?: (path: string) => void
}

export function QuickOpenSidebar({ initialPath, onSendPath }: QuickOpenSidebarProps) {
  const [activePath, setActivePath] = useState(initialPath)

  useEffect(() => {
    if (initialPath) setActivePath(initialPath)
  }, [initialPath])

  return (
    <div className="quick-open-sidebar">
      <QuickOpenPanel initialPath={activePath} onSelectPath={setActivePath} />
      <div className="quick-open-sidebar__browser">
        <WebFileBrowser dir={activePath} onSendPath={onSendPath} />
      </div>
    </div>
  )
}
