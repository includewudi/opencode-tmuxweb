import { useCallback } from 'react'
import { MobilePanel } from './MobilePanel'
import { GitPanel } from '../shared/components/file-browser/GitPanel'
import './MobileGitPanel.css'

interface Props {
  open: boolean
  onClose: () => void
  dir?: string
}

export function MobileGitPanel({ open, onClose, dir }: Props) {
  const handleRefresh = useCallback(() => {}, [])

  return (
    <MobilePanel title="Git 操作" open={open} onClose={onClose} zIndex={160}>
      <div className="mgp-container">
        <GitPanel dir={dir || '~'} onRefresh={handleRefresh} />
      </div>
    </MobilePanel>
  )
}
