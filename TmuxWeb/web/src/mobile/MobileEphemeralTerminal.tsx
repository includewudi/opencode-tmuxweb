import { useEffect, useState } from 'react'
import { MobilePanel } from './MobilePanel'
import { EphemeralTerminal } from '../shared/components/ephemeral-terminal/EphemeralTerminal'
import './MobileEphemeralTerminal.css'

interface Props {
  open: boolean
  onClose: () => void
  cwd?: string
}

export function MobileEphemeralTerminal({ open, onClose, cwd }: Props) {
  const [activeDir, setActiveDir] = useState(cwd || '~')

  useEffect(() => {
    if (cwd) setActiveDir(cwd)
  }, [cwd])

  return (
    <MobilePanel title={`终端: ${activeDir}`} open={open} onClose={onClose} zIndex={160}>
      <div className="met-container">
        <EphemeralTerminal cwd={activeDir} />
      </div>
    </MobilePanel>
  )
}
