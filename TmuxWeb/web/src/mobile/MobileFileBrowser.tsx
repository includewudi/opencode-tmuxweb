import { useCallback } from 'react'
import { MobilePanel } from './MobilePanel'
import { WebFileBrowser } from '../shared/components/file-browser/WebFileBrowser'
import './MobileFileBrowser.css'

interface Props {
  open: boolean
  onClose: () => void
  dir?: string
  onSendPath?: (path: string) => void
}

export function MobileFileBrowser({ open, onClose, dir, onSendPath }: Props) {
  const handleSendPath = useCallback((path: string) => {
    onSendPath?.(path)
    onClose()
  }, [onSendPath, onClose])

  return (
    <MobilePanel title="文件管理器" open={open} onClose={onClose} zIndex={160}>
      <div className="mfb-container">
        <WebFileBrowser dir={dir || '/'} onSendPath={handleSendPath} />
      </div>
    </MobilePanel>
  )
}
