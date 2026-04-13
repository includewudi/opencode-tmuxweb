import { useEffect, useState } from 'react'
import { FolderTree, Minus, X, Maximize2, Minimize2 } from 'lucide-react'
import { useFloatingPanel } from '../imperial-study/hooks/useFloatingPanel'
import { QuickOpenPanel } from './QuickOpenPanel'
import { WebFileBrowser } from './WebFileBrowser'
import './floating-quick-open.css'

interface FloatingQuickOpenProps {
  dir?: string
  onSendPath?: (path: string) => void
  onClose: () => void
}

export function FloatingQuickOpen({ dir, onSendPath, onClose }: FloatingQuickOpenProps) {
  const [maximized, setMaximized] = useState(false)
  const [activePath, setActivePath] = useState(dir || '~')

  useEffect(() => {
    if (dir) setActivePath(dir)
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
    storageKey: 'quick-open-floating',
    defaultSize: { width: 980, height: 620 },
    defaultOpacity: 0.95,
    minWidth: 640,
    minHeight: 360,
  })

  if (collapsed && !maximized) {
    return (
      <div
        className="qof-floating-bubble"
        style={{ left: position.x, top: position.y }}
        onClick={toggleCollapse}
        title="展开快速路径"
      >
        <FolderTree size={20} />
      </div>
    )
  }

  return (
    <div
      className={`qof-floating-panel${maximized ? ' qof-floating-panel--maximized' : ''}`}
      style={maximized ? undefined : {
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        '--panel-bg-alpha': opacity,
      } as React.CSSProperties}
    >
      <div className="qof-floating-panel__titlebar" onMouseDown={onDragStart}>
        <FolderTree size={12} className="qof-floating-panel__icon" />
        <span className="qof-floating-panel__title">快速路径</span>
        <span className="qof-floating-panel__stats">{activePath}</span>
        <div className="qof-floating-panel__actions">
          {!maximized && (
            <input
              type="range"
              className="qof-floating-panel__opacity-slider"
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
            className="qof-floating-panel__btn"
            onClick={(e) => { e.stopPropagation(); setMaximized(m => !m) }}
            title={maximized ? '还原' : '最大化'}
          >
            {maximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          <button
            className="qof-floating-panel__btn"
            onClick={(e) => { e.stopPropagation(); toggleCollapse() }}
            title="最小化"
          >
            <Minus size={12} />
          </button>
          <button
            className="qof-floating-panel__btn qof-floating-panel__btn--close"
            onClick={(e) => { e.stopPropagation(); onClose() }}
            title="关闭"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      <div className="qof-floating-panel__body">
        <QuickOpenPanel initialPath={activePath} onSelectPath={setActivePath} />
        <WebFileBrowser dir={activePath} onSendPath={onSendPath} />
      </div>

      {!maximized && (
        <div className="qof-floating-panel__resize" onMouseDown={onResizeStart} />
      )}
    </div>
  )
}
