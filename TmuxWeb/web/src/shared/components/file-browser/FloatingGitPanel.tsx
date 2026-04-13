import { useEffect, useState } from 'react'
import { GitBranch, Minus, X, Maximize2, Minimize2 } from 'lucide-react'
import { useFloatingPanel } from '../imperial-study/hooks/useFloatingPanel'
import { GitPanel } from './GitPanel'
import './floating-git-panel.css'

interface FloatingGitPanelProps {
  dir?: string
  onClose: () => void
}

export function FloatingGitPanel({ dir, onClose }: FloatingGitPanelProps) {
  const [maximized, setMaximized] = useState(false)
  const [activeDir, setActiveDir] = useState(dir || '~')

  useEffect(() => {
    if (dir) setActiveDir(dir)
  }, [dir])

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
    storageKey: 'git-floating',
    defaultSize: { width: 780, height: 680 },
    defaultOpacity: 0.95,
    minWidth: 520,
    minHeight: 400,
  })

  if (collapsed && !maximized) {
    return (
      <div
        className="gfp-floating-bubble"
        style={{ left: position.x, top: position.y }}
        onClick={toggleCollapse}
        title="展开 Git 面板"
      >
        <GitBranch size={20} />
      </div>
    )
  }

  return (
    <div
      className={`gfp-floating-panel${maximized ? ' gfp-floating-panel--maximized' : ''}`}
      style={maximized ? undefined : {
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        '--panel-bg-alpha': opacity,
      } as React.CSSProperties}
    >
      <div className="gfp-floating-panel__titlebar" onMouseDown={onDragStart}>
        <GitBranch size={12} className="gfp-floating-panel__icon" />
        <span className="gfp-floating-panel__title">Git 操作</span>
        <span className="gfp-floating-panel__stats">{activeDir}</span>
        <div className="gfp-floating-panel__actions">
          {!maximized && (
            <input
              type="range"
              className="gfp-floating-panel__opacity-slider"
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
            className="gfp-floating-panel__btn"
            onClick={(e) => { e.stopPropagation(); setMaximized(m => !m) }}
            title={maximized ? '还原' : '最大化'}
          >
            {maximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          <button
            className="gfp-floating-panel__btn"
            onClick={(e) => { e.stopPropagation(); toggleCollapse() }}
            title="最小化"
          >
            <Minus size={12} />
          </button>
          <button
            className="gfp-floating-panel__btn gfp-floating-panel__btn--close"
            onClick={(e) => { e.stopPropagation(); onClose() }}
            title="关闭"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      <div className="gfp-floating-panel__body">
        <GitPanel dir={activeDir} onRefresh={() => {}} />
      </div>

      {!maximized && (
        <div className="gfp-floating-panel__resize" onMouseDown={onResizeStart} />
      )}
    </div>
  )
}
