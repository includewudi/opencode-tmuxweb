import { MobilePanel } from './MobilePanel'
import { ImperialStudyPanel } from '../shared/components/imperial-study/components/ImperialStudyPanel'
import './MobileImperialStudy.css'

interface Props {
  open: boolean
  onClose: () => void
  activePaneKey?: string
}

export function MobileImperialStudy({ open, onClose, activePaneKey }: Props) {
  return (
    <MobilePanel title="御書房" open={open} onClose={onClose} zIndex={160}>
      <div className="mis-container">
        <ImperialStudyPanel activePaneKey={activePaneKey ?? ''} />
      </div>
    </MobilePanel>
  )
}
