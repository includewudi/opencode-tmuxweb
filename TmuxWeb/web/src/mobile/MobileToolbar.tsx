import { useState, useCallback } from 'react'

const KEYS = {
  ESC: '\x1b',
  TAB: '\t',
  ARROW_UP: '\x1b[A',
  ARROW_DOWN: '\x1b[B',
  ARROW_RIGHT: '\x1b[C',
  ARROW_LEFT: '\x1b[D',
} as const

interface Props {
  onSendText: (text: string) => void
  onPaste?: () => void
}

export function MobileToolbar({ onSendText, onPaste }: Props) {
  const [ctrlActive, setCtrlActive] = useState(false)

  const handleKey = useCallback((key: string) => {
    if (ctrlActive) {
      const upper = key.toUpperCase()
      if (upper >= 'A' && upper <= 'Z') {
        const code = upper.charCodeAt(0) - 64
        onSendText(String.fromCharCode(code))
        setCtrlActive(false)
        return
      }
    }
    onSendText(key)
  }, [ctrlActive, onSendText])

  const toggleCtrl = useCallback(() => {
    setCtrlActive(prev => !prev)
  }, [])

  return (
    <div className="mobile-toolbar">
      <button className="mobile-toolbar-key" onClick={() => handleKey(KEYS.ESC)} type="button">
        Esc
      </button>
      <button className="mobile-toolbar-key" onClick={() => handleKey(KEYS.TAB)} type="button">
        Tab
      </button>
      <button 
        className={`mobile-toolbar-key mobile-toolbar-ctrl ${ctrlActive ? 'active' : ''}`}
        onClick={toggleCtrl}
        type="button"
      >
        Ctrl
      </button>
      <div className="mobile-toolbar-arrows">
        <button className="mobile-toolbar-arrow" onClick={() => handleKey(KEYS.ARROW_LEFT)} type="button">
          ←
        </button>
        <button className="mobile-toolbar-arrow" onClick={() => handleKey(KEYS.ARROW_UP)} type="button">
          ↑
        </button>
        <button className="mobile-toolbar-arrow" onClick={() => handleKey(KEYS.ARROW_DOWN)} type="button">
          ↓
        </button>
        <button className="mobile-toolbar-arrow" onClick={() => handleKey(KEYS.ARROW_RIGHT)} type="button">
          →
        </button>
      </div>
      <button className="mobile-toolbar-key mobile-toolbar-paste" onClick={onPaste} type="button">
        Paste
      </button>
    </div>
  )
}
