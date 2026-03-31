import { useState } from 'react'
import { FolderSearch, Minus, X, Maximize2, Minimize2 } from 'lucide-react'
import { useFloatingPanel } from '../imperial-study/hooks/useFloatingPanel'
import { WebFileBrowser } from './WebFileBrowser'
import './file-browser.css'

interface FloatingYaziProps {
  dir?: string
  onSendPath?: (path: string) => void
  onClose: () => void
}

export function FloatingYazi({ dir, onSendPath, onClose }: FloatingYaziProps) {
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
    storageKey: 'yazi-floating',
    defaultSize: { width: 900, height: 520 },
    minWidth: 500,
    minHeight: 300,
  })

  const handleClose = () => onClose()

  if (collapsed && !maximized) {
    return (
      <div
        className="fb-floating-bubble"
        style={{ left: position.x, top: position.y }}
        onClick={toggleCollapse}
        title="展开文件管理器"
      >
        <FolderSearch size={20} />
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
        <FolderSearch size={12} className="fb-floating-panel__icon" />
        <span className="fb-floating-panel__title">文件管理器</span>
        <span className="fb-floating-panel__stats">
          {dir || '~'}
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
        <WebFileBrowser dir={dir || '~'} onSendPath={onSendPath} />
      </div>

      {!maximized && (
        <div className="fb-floating-panel__resize" onMouseDown={onResizeStart} />
      )}
    </div>
  )
}
