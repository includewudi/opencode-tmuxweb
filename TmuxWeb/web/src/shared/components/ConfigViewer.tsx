import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import './ConfigViewer.css'

interface ConfigFile {
  content: Record<string, unknown> | null
  path: string
  missing?: boolean
  error?: string
}

interface ConfigData {
  opencode?: ConfigFile
  oh_my_opencode?: ConfigFile
}

type ConfigTabId = 'opencode' | 'oh_my_opencode'

const TAB_LABELS: Record<ConfigTabId, string> = {
  opencode: 'opencode.json',
  oh_my_opencode: 'oh-my-opencode.json',
}

interface ConfigViewerProps {
  paneKey?: string | null
}

export function ConfigViewer({ paneKey }: ConfigViewerProps) {
  const [data, setData] = useState<ConfigData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ConfigTabId>('opencode')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    if (paneKey) params.set('paneKey', paneKey)

    fetch(`/api/opencode-config?${params}`, { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(json => {
        if (!cancelled) {
          setData(json)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [paneKey])

  if (loading) {
    return (
      <div className="config-viewer">
        <div className="config-viewer-loading">
          <Loader2 size={14} className="spinning" />
          <span>加载配置...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="config-viewer">
        <div className="config-viewer-error">加载失败: {error}</div>
      </div>
    )
  }

  const tabs: ConfigTabId[] = ['opencode', 'oh_my_opencode']
  const current = data?.[activeTab]

  return (
    <div className="config-viewer">
      <div className="config-viewer-tabs">
        {tabs.map(tab => (
          <button
            key={tab}
            className={`config-viewer-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {current?.path && (
        <div className="config-viewer-source" title={current.path}>
          📂 {current.path}
        </div>
      )}

      <div className="config-viewer-body">
        {current?.missing ? (
          <div className="config-viewer-empty">文件不存在</div>
        ) : current?.error ? (
          <div className="config-viewer-error">{current.error}</div>
        ) : current?.content ? (
          <pre>{JSON.stringify(current.content, null, 2)}</pre>
        ) : (
          <div className="config-viewer-empty">无数据</div>
        )}
      </div>
    </div>
  )
}
