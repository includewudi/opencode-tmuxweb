import { useEffect, useState } from 'react'
import { TerminalSquare, Minus, X, Maximize2, Minimize2 } from 'lucide-react'
import { useFloatingPanel } from '../imperial-study/hooks/useFloatingPanel'
import { EphemeralTerminal } from './EphemeralTerminal'
import './floating-terminal.css'

interface FloatingTerminalProps {
  cwd?: string
  onClose: () => void
}

export function FloatingTerminal({ cwd, onClose }: FloatingTerminalProps) {
  const [maximized, setMaximized] = useState(false)
  const [activeDir, setActiveDir] = useState(cwd || '~')

  useEffect(() => {
    if (cwd) setActiveDir(cwd)
  }, [cwd])

  const {
    collapsed,
    position,
    size,
    opacity,
    onDragStart,
    onResizeStart,
    toggleCollapse,
  } = useFloatingPanel({
    storageKey: 'terminal-floating',
    defaultSize: { width: 900, height: 520 },
    defaultOpacity: 0.95,
    minWidth: 500,
    minHeight: 300,
  })

  if (collapsed && !maximized) {
    return (
      <div
        className="etp-floating-bubble"
        style={{ left: position.x, top: position.y }}
        onClick={toggleCollapse}
        title="展开临时终端"
      >
        <TerminalSquare size={20} />
      </div>
    )
  }

  return (
    <div
      className={`etp-floating-panel${maximized ? ' etp-floating-panel--maximized' : ''}`}
      style={maximized ? undefined : {
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        '--panel-bg-alpha': opacity,
      } as React.CSSProperties}
    >
      <div className="etp-floating-panel__titlebar" onMouseDown={onDragStart}>
        <TerminalSquare size={12} className="etp-floating-panel__icon" />
        <span className="etp-floating-panel__title">临时终端</span>
        <span className="etp-floating-panel__stats">{activeDir}</span>
        <div className="etp-floating-panel__actions">
          <button
            className="etp-floating-panel__btn"
            onClick={(e) => { e.stopPropagation(); setMaximized(m => !m) }}
            title={maximized ? '还原' : '最大化'}
          >
            {maximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          <button
            className="etp-floating-panel__btn"
            onClick={(e) => { e.stopPropagation(); toggleCollapse() }}
            title="最小化"
          >
            <Minus size={12} />
          </button>
          <button
            className="etp-floating-panel__btn etp-floating-panel__btn--close"
            onClick={(e) => { e.stopPropagation(); onClose() }}
            title="关闭"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      <div className="etp-floating-panel__body">
        <EphemeralTerminal cwd={activeDir} />
      </div>

      {!maximized && (
        <div className="etp-floating-panel__resize" onMouseDown={onResizeStart} />
      )}
    </div>
  )
}
