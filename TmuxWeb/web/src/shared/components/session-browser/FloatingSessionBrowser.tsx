import { useState, useCallback } from 'react'
import { History, Minus, X, Maximize2, Minimize2 } from 'lucide-react'
import { useFloatingPanel } from '../imperial-study/hooks/useFloatingPanel'
import { SessionBrowserPanel } from './SessionBrowserPanel'
import '../file-browser/file-browser.css'
import './SessionBrowser.css'

interface FloatingSessionBrowserProps {
  cwd?: string | null
  onClose: () => void
  onSendToTerminal?: (text: string) => void
}

export function FloatingSessionBrowser({ cwd, onClose, onSendToTerminal }: FloatingSessionBrowserProps) {
  const [maximized, setMaximized] = useState(false)

  const {
    collapsed,
    position,
    size,
    opacity,
    onDragStart,
    onResizeStart,
    toggleCollapse,
    setOpacity,
  } = useFloatingPanel({
    storageKey: 'session-browser-floating',
    defaultSize: { width: 1000, height: 560 },
    minWidth: 600,
    minHeight: 350,
  })

  const handleClose = () => onClose()

  const handleSwitchSession = useCallback((sessionId: string) => {
    if (!onSendToTerminal) return
    onSendToTerminal('/exit\r')
    setTimeout(() => {
      onSendToTerminal(`opencode -s ${sessionId}\r`)
      onClose()
    }, 2000)
  }, [onSendToTerminal, onClose])

  if (collapsed && !maximized) {
    return (
      <div
        className="fb-floating-bubble"
        style={{ left: position.x, top: position.y }}
        onClick={toggleCollapse}
        title="Session 目录"
      >
        <History size={20} />
      </div>
    )
  }

  return (
    <div
      className={`fb-floating-panel${maximized ? ' fb-floating-panel--maximized' : ''}`}
      style={maximized ? undefined : {
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        '--panel-bg-alpha': opacity,
      } as React.CSSProperties}
    >
      <div className="fb-floating-panel__titlebar" onMouseDown={onDragStart}>
        <History size={12} className="fb-floating-panel__icon" />
        <span className="fb-floating-panel__title">Session 目录</span>
        <span className="fb-floating-panel__stats">
          {cwd ? cwd.split('/').slice(-2).join('/') : 'OpenCode Sessions'}
        </span>
        <div className="fb-floating-panel__actions">
          {!maximized && (
            <input
              type="range"
              className="fb-floating-panel__opacity-slider"
              min={0}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              onMouseDown={(e) => e.stopPropagation()}
              title={`透明度 ${Math.round(opacity * 100)}%`}
            />
          )}
          <button
            className="fb-floating-panel__btn"
            onClick={(e) => { e.stopPropagation(); setMaximized(m => !m); }}
            title={maximized ? '还原' : '最大化'}
          >
            {maximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          <button
            className="fb-floating-panel__btn"
            onClick={(e) => { e.stopPropagation(); toggleCollapse(); }}
            title="最小化"
          >
            <Minus size={12} />
          </button>
          <button
            className="fb-floating-panel__btn fb-floating-panel__btn--close"
            onClick={(e) => { e.stopPropagation(); handleClose(); }}
            title="关闭"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      <div className="fb-floating-panel__body">
        <SessionBrowserPanel cwd={cwd} onSwitchSession={handleSwitchSession} />
      </div>

      {!maximized && (
        <div className="fb-floating-panel__resize" onMouseDown={onResizeStart} />
      )}
    </div>
  )
}
