import { useEffect, useState, useCallback } from 'react'
import { MobilePanel } from './MobilePanel'
import { QuickOpenPanel } from '../shared/components/file-browser/QuickOpenPanel'
import { WebFileBrowser } from '../shared/components/file-browser/WebFileBrowser'
import './MobileQuickOpen.css'

interface Props {
  open: boolean
  onClose: () => void
  dir?: string
  onSendPath?: (path: string) => void
}

export function MobileQuickOpen({ open, onClose, dir, onSendPath }: Props) {
  const [activePath, setActivePath] = useState(dir || '~')

  useEffect(() => {
    if (dir) setActivePath(dir)
  }, [dir])

  const handleSelectPath = useCallback((path: string) => {
    setActivePath(path)
  }, [])

  const handleSendPath = useCallback((path: string) => {
    onSendPath?.(path)
    onClose()
  }, [onSendPath, onClose])

  return (
    <MobilePanel title="快速路径" open={open} onClose={onClose} zIndex={160}>
      <div className="mqo-container">
        <div className="mqo-quick-open">
          <QuickOpenPanel initialPath={activePath} onSelectPath={handleSelectPath} />
        </div>
        <div className="mqo-browser">
          <WebFileBrowser dir={activePath} onSendPath={handleSendPath} />
        </div>
      </div>
    </MobilePanel>
  )
}
