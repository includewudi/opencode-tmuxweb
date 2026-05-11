import { MobilePanel } from './MobilePanel'
import { CLIHistoryPanel } from '../shared/components/cli-history/CLIHistoryPanel'
import './MobileCLIHistory.css'

interface MobileCLIHistoryProps {
  open: boolean
  onClose: () => void
  cwd?: string | null
}

export function MobileCLIHistory({ open, onClose, cwd }: MobileCLIHistoryProps) {
  return (
    <MobilePanel title="CLI History" open={open} onClose={onClose} zIndex={160}>
      <div className="mclh-container">
        <CLIHistoryPanel cwd={cwd} />
      </div>
    </MobilePanel>
  )
}
