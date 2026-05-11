import { ReactNode } from 'react'
import { X } from 'lucide-react'
import './MobilePanel.css'

interface MobilePanelProps {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Extra header actions (right side, before close button) */
  headerActions?: ReactNode
  /** z-index override */
  zIndex?: number
}

export function MobilePanel({ title, open, onClose, children, headerActions, zIndex = 150 }: MobilePanelProps) {
  if (!open) return null

  return (
    <>
      <div className="mp-overlay" onClick={onClose} />
      <div className="mp-panel" style={{ zIndex }}>
        <header className="mp-header">
          <span className="mp-title">{title}</span>
          <div className="mp-header-actions">
            {headerActions}
            <button className="mp-close-btn" onClick={onClose} type="button" aria-label="Close">
              <X size={20} />
            </button>
          </div>
        </header>
        <div className="mp-body">
          {children}
        </div>
      </div>
    </>
  )
}
