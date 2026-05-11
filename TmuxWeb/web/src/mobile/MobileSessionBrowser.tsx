import { MobilePanel } from './MobilePanel'
import { SessionBrowserPanel } from '../shared/components/session-browser/SessionBrowserPanel'
import './MobileSessionBrowser.css'

interface MobileSessionBrowserProps {
  open: boolean
  onClose: () => void
  cwd?: string | null
  onSwitchSession?: (sessionId: string) => void
}

export function MobileSessionBrowser({ open, onClose, cwd, onSwitchSession }: MobileSessionBrowserProps) {
  return (
    <MobilePanel title="Session Browser" open={open} onClose={onClose} zIndex={161}>
      <div className="msb-container">
        <SessionBrowserPanel cwd={cwd} onSwitchSession={onSwitchSession} />
      </div>
    </MobilePanel>
  )
}
