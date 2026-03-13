import { useState, useCallback } from 'react'
import './AccessoryBar.css'

// Terminal escape sequences
const KEYS = {
  ESC: '\x1b',
  TAB: '\t',
  SPACE: ' ',
  ARROW_UP: '\x1b[A',
  ARROW_DOWN: '\x1b[B',
  ARROW_RIGHT: '\x1b[C',
  ARROW_LEFT: '\x1b[D',
} as const

interface Props {
  onSendText: (text: string) => void
  onPaste?: () => void
}

export function AccessoryBar({ onSendText, onPaste }: Props) {
  const [ctrlActive, setCtrlActive] = useState(false)

  const handleKey = useCallback((key: string) => {
    if (ctrlActive) {
      // Ctrl+key sends ASCII control character (A=1, B=2, ... Z=26)
      const upper = key.toUpperCase()
      if (upper >= 'A' && upper <= 'Z') {
        const code = upper.charCodeAt(0) - 64 // A=1, B=2, etc.
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

  const handlePaste = useCallback(() => {
    onPaste?.()
  }, [onPaste])

  return (
    <div className="accessory-bar">
      <button 
        className="accessory-key" 
        onClick={() => handleKey(KEYS.ESC)}
        type="button"
      >
        Esc
      </button>
      <button 
        className="accessory-key" 
        onClick={() => handleKey(KEYS.TAB)}
        type="button"
      >
        Tab
      </button>
      <button 
        className={`accessory-key accessory-ctrl ${ctrlActive ? 'active' : ''}`}
        onClick={toggleCtrl}
        type="button"
      >
        Ctrl
      </button>
      <button 
        className="accessory-key" 
        onClick={() => handleKey(KEYS.SPACE)}
        type="button"
      >
        ␣
      </button>
      <div className="accessory-arrows">
        <button 
          className="accessory-key accessory-arrow" 
          onClick={() => handleKey(KEYS.ARROW_LEFT)}
          type="button"
        >
          ←
        </button>
        <button 
          className="accessory-key accessory-arrow" 
          onClick={() => handleKey(KEYS.ARROW_UP)}
          type="button"
        >
          ↑
        </button>
        <button 
          className="accessory-key accessory-arrow" 
          onClick={() => handleKey(KEYS.ARROW_DOWN)}
          type="button"
        >
          ↓
        </button>
        <button 
          className="accessory-key accessory-arrow" 
          onClick={() => handleKey(KEYS.ARROW_RIGHT)}
          type="button"
        >
          →
        </button>
      </div>
      <button 
        className="accessory-key accessory-paste" 
        onClick={handlePaste}
        type="button"
      >
        Paste
      </button>
    </div>
  )
}
