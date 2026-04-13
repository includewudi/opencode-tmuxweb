import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderSearch, Loader2, RefreshCw } from 'lucide-react'
import { getToken } from '../../../utils/auth'
import { joinPath, sortByFoldersFirst, FileEntry } from './web-file-browser-helpers'
import './quick-open-panel.css'

interface QuickOpenPanelProps {
  initialPath?: string
  onSelectPath?: (path: string) => void
}

interface PathNode {
  path: string
  name: string
  loading: boolean
  entries: FileEntry[]
}

const ROOT = '/'

export function QuickOpenPanel({ initialPath, onSelectPath }: QuickOpenPanelProps) {
  const [inputPath, setInputPath] = useState(initialPath || ROOT)
  const [currentPath, setCurrentPath] = useState(initialPath || ROOT)
  const [pathNodes, setPathNodes] = useState<PathNode[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (!initialPath) return
    setInputPath(initialPath)
    setCurrentPath(initialPath)
  }, [initialPath])

  const normalizedPath = useMemo(() => {
    if (!currentPath) return ROOT
    const trimmed = currentPath.trim()
    if (trimmed === '~') return '~'
    const normalized = trimmed.replace(/\\/g, '/').replace(/\/+$/, '')
    return normalized === '' ? ROOT : normalized
  }, [currentPath])

  const loadDir = useCallback(async (dirPath: string): Promise<FileEntry[]> => {
    try {
      const token = getToken()
      const res = await fetch(`/api/files/tree?dir=${encodeURIComponent(dirPath)}&showHidden=1&token=${token}`)
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to load directory')
      }
      const data = await res.json()
      const items = Array.isArray(data) ? data : (data.items || data.entries || [])
      return sortByFoldersFirst(items).filter((entry: FileEntry) => entry.type === 'dir')
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to load directory')
    }
  }, [])

  const buildNodes = useCallback(async (targetPath: string) => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setLoading(true)
    setError(null)
    const parts = targetPath === ROOT
      ? [ROOT]
      : targetPath === '~'
        ? ['~']
        : targetPath.split('/').filter(Boolean)

    const nodes: PathNode[] = []
    let current = parts[0] === '~' ? '~' : ROOT
    nodes.push({ path: current, name: current, loading: true, entries: [] })

    for (let i = 0; i < parts.length; i += 1) {
      if (parts[i] === ROOT || parts[i] === '~') continue
      current = joinPath(current, parts[i])
      nodes.push({ path: current, name: parts[i], loading: true, entries: [] })
    }

    try {
      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i]
        node.loading = true
        const entries = await loadDir(node.path)
        node.entries = entries
        node.loading = false
      }
      if (requestIdRef.current === requestId) {
        setPathNodes(nodes)
        setError(null)
      }
    } catch (err) {
      if (requestIdRef.current === requestId) {
        setError(err instanceof Error ? err.message : 'Failed to load path')
        setPathNodes(nodes.map(node => ({ ...node, loading: false })))
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false)
      }
    }
  }, [loadDir])

  useEffect(() => {
    buildNodes(normalizedPath)
  }, [normalizedPath, buildNodes])

  const handlePathSubmit = (path: string) => {
    const trimmed = path.trim() || ROOT
    setCurrentPath(trimmed)
    setInputPath(trimmed)
    onSelectPath?.(trimmed)
  }

  const handleSelectSubdir = (parentPath: string, entry: FileEntry) => {
    const nextPath = joinPath(parentPath, entry.name)
    setCurrentPath(nextPath)
    setInputPath(nextPath)
    onSelectPath?.(nextPath)
  }

  return (
    <div className="quick-open">
      <div className="quick-open__header">
        <FolderSearch size={14} />
        <span>快速路径</span>
        <button className="quick-open__refresh" onClick={() => buildNodes(normalizedPath)} title="刷新">
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="quick-open__input-row">
        <input
          className="quick-open__input"
          value={inputPath}
          onChange={(e) => setInputPath(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handlePathSubmit(inputPath) }}
          placeholder="输入路径，例如 /Users/..."
        />
        <button className="quick-open__go" onClick={() => handlePathSubmit(inputPath)}>
          打开
        </button>
      </div>

      {error && <div className="quick-open__error">{error}</div>}

      <div className="quick-open__tree">
        {pathNodes.map((node) => (
          <div className="quick-open__node" key={node.path}>
            <div className="quick-open__node-header">
              <ChevronDown size={14} />
              <Folder size={14} />
              <span className="quick-open__node-path" title={node.path}>{node.path}</span>
              {node.loading && <Loader2 size={12} className="quick-open__spin" />}
            </div>
            <div className="quick-open__node-children">
              {node.entries.length === 0 && !node.loading && (
                <div className="quick-open__empty">空目录</div>
              )}
              {node.entries.map((entry) => (
                <button
                  key={entry.name}
                  className="quick-open__child"
                  onClick={() => handleSelectSubdir(node.path, entry)}
                >
                  <ChevronRight size={12} />
                  <span>{entry.name}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {loading && pathNodes.length === 0 && (
          <div className="quick-open__loading"><Loader2 size={16} className="quick-open__spin" />加载中...</div>
        )}
      </div>
    </div>
  )
}
