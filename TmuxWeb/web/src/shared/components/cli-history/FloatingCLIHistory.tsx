import { useState } from 'react'
import { BrainCircuit, Minus, X, Maximize2, Minimize2 } from 'lucide-react'
import { useFloatingPanel } from '../imperial-study/hooks/useFloatingPanel'
import { CLIHistoryPanel } from './CLIHistoryPanel'
import '../file-browser/file-browser.css'
import './CLIHistoryPanel.css'

interface FloatingCLIHistoryProps {
  cwd?: string | null
  onClose: () => void
}

export function FloatingCLIHistory({ cwd, onClose }: FloatingCLIHistoryProps) {
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
    storageKey: 'cli-history-floating',
    defaultSize: { width: 1000, height: 560 },
    minWidth: 600,
    minHeight: 350,
  })

  const handleClose = () => onClose()

  if (collapsed && !maximized) {
    return (
      <div
        className="fb-floating-bubble"
        style={{ left: position.x, top: position.y }}
        onClick={toggleCollapse}
        title="CLI History"
      >
        <BrainCircuit size={20} />
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
        <BrainCircuit size={12} className="fb-floating-panel__icon" />
        <span className="fb-floating-panel__title">CLI History</span>
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
        <CLIHistoryPanel cwd={cwd} />
      </div>

      {!maximized && (
        <div className="fb-floating-panel__resize" onMouseDown={onResizeStart} />
      )}
    </div>
  )
}
