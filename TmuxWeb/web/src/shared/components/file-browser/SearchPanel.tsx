import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, File, Folder, Loader2 } from 'lucide-react'
import { getToken } from '../../../utils/auth'
import { formatSize } from './web-file-browser-helpers'

interface SearchPanelProps {
  dir: string
  onSelectFile: (path: string) => void
  onClose: () => void
}

interface FilenameResult {
  name: string
  path: string
  type: 'file' | 'dir'
  size?: number
}

export function SearchPanel({ dir, onSelectFile, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FilenameResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null) as React.MutableRefObject<ReturnType<typeof setTimeout> | null>

  useEffect(() => { inputRef.current?.focus() }, [])

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setLoading(true); setError(null)
    try {
      const token = getToken()
      const res = await fetch(`/api/files/search?q=${encodeURIComponent(q)}&dir=${encodeURIComponent(dir)}&limit=50&token=${token}`)
      if (!res.ok) { setError('搜索失败'); return }
      const data = await res.json()
      setResults(data.results || [])
    } catch { setError('搜索失败') }
    finally { setLoading(false) }
  }, [dir])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 2) { setResults([]); return }
    debounceRef.current = setTimeout(() => doSearch(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, doSearch])

  return (
    <div className="wfb-search-overlay" onClick={onClose}>
      <div className="wfb-search-dropdown" onClick={e => e.stopPropagation()}>
        <div className="wfb-search-dropdown__input-row">
          <Search size={14} className="wfb-search-dropdown__icon" />
          <input ref={inputRef} className="wfb-search-dropdown__input"
            value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') onClose() }}
            placeholder="模糊搜索文件名..."
            spellCheck={false}
          />
          {loading && <Loader2 size={14} className="wfb-spin" />}
          <button className="wfb-icon-btn" onClick={onClose}><X size={14} /></button>
        </div>
        {error && <div className="wfb-search-dropdown__error">{error}</div>}
        <div className="wfb-search-dropdown__results">
          {results.map(r => {
            const absPath = r.path.startsWith('/') ? r.path : (dir === '/' ? '/' + r.path : dir + '/' + r.path)
            return (
              <div key={r.path} className="wfb-search-dropdown__item" onClick={() => onSelectFile(absPath)}>
                {r.type === 'dir'
                  ? <Folder size={14} className="wfb-icon-folder" />
                  : <File size={14} className="wfb-icon-file" />
                }
                <span className="wfb-search-dropdown__name">{r.name}</span>
                <span className="wfb-search-dropdown__path">{r.path}</span>
                {r.size != null && <span className="wfb-search-dropdown__size">{formatSize(r.size)}</span>}
              </div>
            )
          })}
          {!loading && query.length >= 2 && results.length === 0 && !error && (
            <div className="wfb-search-dropdown__empty">无结果</div>
          )}
        </div>
      </div>
    </div>
  )
}
