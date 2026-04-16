import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Folder, File, ChevronUp, ChevronRight, Plus, Loader2, Pencil, Trash2, Terminal, GitCompare, Clock, FileStack, Sparkles, X, Search } from 'lucide-react'
import { getToken } from '../../../utils/auth'
import { FileEntry, ContextMenuState, formatSize, sortByFoldersFirst, joinPath, isMediaFile } from './web-file-browser-helpers'
import { FilePreview } from './FilePreview'
import { SearchPanel } from './SearchPanel'
import './web-file-browser.css'

interface Props {
  dir: string
  onSendPath?: (path: string) => void
}

export function WebFileBrowser({ dir, onSendPath }: Props) {
  const normalizedDir = useMemo(() => {
    if (!dir) return '/'
    const normalized = dir.replace(/\\/g, '/').replace(/\/+$/, '')
    return normalized === '' ? '/' : normalized
  }, [dir])
  const childrenCacheRef = useRef<Map<string, FileEntry[]>>(new Map())
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [childrenCache, setChildrenCache] = useState<Map<string, FileEntry[]>>(new Map())
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set())
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null)
  const [selectedFilePath, setSelectedFilePath] = useState('')
  const [fileContent, setFileContent] = useState('')
  const [filePath, setFilePath] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [editingEntry, setEditingEntry] = useState<{ entry: FileEntry; dirPath: string; newName: string } | null>(null)
  const [creatingNew, setCreatingNew] = useState<'file' | 'folder' | null>(null)
  const [newName, setNewName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const treePanelRef = useRef<HTMLDivElement>(null)
  const [splitPos, setSplitPos] = useState(250)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [diffContent, setDiffContent] = useState('')
  const [diffStats, setDiffStats] = useState<{ additions: number; deletions: number } | undefined>()
  const [fileGitStatus, setFileGitStatus] = useState<string | undefined>()
  const [forceMode, setForceMode] = useState<'diff' | 'history' | null>(null)
  const [showSearch, setShowSearch] = useState(false)

  const fetchDir = useCallback(async (dirPath: string, force = false) => {
    if (!force && childrenCacheRef.current.has(dirPath)) return childrenCacheRef.current.get(dirPath)!
    setLoadingDirs(prev => new Set(prev).add(dirPath))
    try {
      const token = getToken()
      const res = await fetch(`/api/files/tree?dir=${encodeURIComponent(dirPath)}&showHidden=1&token=${token}`)
      if (res.ok) {
        const data = await res.json()
        const items = Array.isArray(data) ? data : (data.items || data.entries || [])
        const sorted = sortByFoldersFirst(items)
        childrenCacheRef.current.set(dirPath, sorted)
        setChildrenCache(prev => new Map(prev).set(dirPath, sorted))
        return sorted
      }
    } catch {}
    setLoadingDirs(prev => { const n = new Set(prev); n.delete(dirPath); return n })
    return []
  }, [])

  const toggleDir = useCallback(async (dirPath: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev)
      if (next.has(dirPath)) { next.delete(dirPath) }
      else { next.add(dirPath) }
      return next
    })
  }, [])

  useEffect(() => {
    if (expandedDirs.size === 0) return
    for (const d of expandedDirs) {
      if (!childrenCacheRef.current.has(d)) fetchDir(d)
    }
  }, [expandedDirs, fetchDir])

  useEffect(() => {
    if ((creatingNew || editingEntry) && inputRef.current) inputRef.current.focus()
  }, [creatingNew, editingEntry])

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [contextMenu])

  const previewFile = async (fp: string, entry: FileEntry) => {
    setSelectedFile(entry); setSelectedFilePath(fp); setFilePath(fp); setPreviewLoading(true)
    setDiffContent(''); setDiffStats(undefined); setFileGitStatus(undefined)
    if (entry.git && entry.git !== 'untracked') {
      try {
        const token = getToken()
        const res = await fetch(`/api/files/diff?path=${encodeURIComponent(fp)}&token=${token}`)
        if (res.ok) {
          const data = await res.json()
          setDiffContent(data.diff || '')
          setDiffStats(data.stats ? { additions: data.stats.additions || 0, deletions: data.stats.deletions || 0 } : undefined)
          setFileGitStatus(entry.git)
        }
      } catch {}
    }
    try {
      if (isMediaFile(fp)) {
        setFileContent('')
      } else {
        const res = await fetch(`/api/files/content?path=${encodeURIComponent(fp)}&token=${getToken()}`)
        if (res.ok) {
          const data = await res.json()
          if (data.error) setFileContent(data.error === 'binary_file' ? '(binary file)' : `(error: ${data.error})`)
          else setFileContent(data.content)
        } else setFileContent('(failed to load)')
      }
    } catch { setFileContent('(failed to load)') }
    setPreviewLoading(false)
  }

  const saveFile = async (content: string) => {
    if (!filePath) return
    setSaving(true)
    try {
      await fetch(`/api/files/content?token=${getToken()}`,
        { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: filePath, content }) })
      setFileContent(content)
    } catch {}
    setSaving(false)
  }

  const deleteEntry = async (entry: FileEntry, dirPath: string) => {
    const fp = joinPath(dirPath, entry.name)
    if (!confirm(`Delete "${entry.name}"?`)) return
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(fp)}&token=${getToken()}`, { method: 'DELETE' })
      if (res.ok) setChildrenCache(prev => new Map(prev).set(dirPath, (prev.get(dirPath) || []).filter(e => e.name !== entry.name)))
    } catch {}
  }

  const renameEntry = async (dirPath: string, oldName: string, nn: string) => {
    if (!nn.trim() || nn === oldName) { setEditingEntry(null); return }
    try {
      await fetch(`/api/files/rename?token=${getToken()}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPath: joinPath(dirPath, oldName), newPath: joinPath(dirPath, nn.trim()) })
      })
      setChildrenCache(prev => {
        const items = (prev.get(dirPath) || []).map(e => e.name === oldName ? { ...e, name: nn.trim() } : e)
        return new Map(prev).set(dirPath, items)
      })
      if (selectedFilePath === joinPath(dirPath, oldName)) {
        const newFp = joinPath(dirPath, nn.trim())
        setFilePath(newFp); setSelectedFilePath(newFp)
      }
    } catch {}
    setEditingEntry(null)
  }

  const createNew = async (type: 'file' | 'folder', name: string) => {
    if (!name.trim()) { setCreatingNew(null); return }
    const targetDir = dir
    const fp = joinPath(targetDir, name.trim())
    try {
      const res = await fetch(`/api/files?token=${getToken()}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fp, type })
      })
      if (res.ok) {
        setChildrenCache(prev => {
          const newEntry: FileEntry = { name: name.trim(), type: type === 'file' ? 'file' : 'dir', git: type === 'file' ? 'untracked' as const : undefined }
          const items = sortByFoldersFirst([...(prev.get(targetDir) || []), newEntry])
          return new Map(prev).set(targetDir, items)
        })
        setExpandedDirs(prev => new Set(prev).add(targetDir))
      }
    } catch {}
    setCreatingNew(null); setNewName('')
  }

  const goUp = () => {
    if (normalizedDir === '/') return
    const parent = normalizedDir.split('/').slice(0, -1).join('/') || '/'
    setExpandedDirs(prev => new Set(prev).add(parent))
  }

  const handleDrag = useCallback((e: React.MouseEvent) => {
    if (!treePanelRef.current) return
    const startX = e.clientX, startW = treePanelRef.current.offsetWidth
    const onMove = (ev: MouseEvent) => setSplitPos(Math.max(120, Math.min(startW + (ev.clientX - startX), 600)))
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }, [])

  const handleRestore = async (sha: string) => {
    if (!filePath) return
    setPreviewLoading(true)
    try {
      const ref = sha === 'HEAD' ? 'HEAD' : sha
      const res = await fetch(`/api/files/original?path=${encodeURIComponent(filePath)}&ref=${encodeURIComponent(ref)}&token=${getToken()}`)
      if (res.ok) {
        const data = await res.json()
        setFileContent(data.content || '(failed to load)')
      }
    } catch { setFileContent('(failed to load)') }
    setPreviewLoading(false)
  }

  const renderTree = (dirPath: string, level: number): React.ReactNode[] => {
    const items = childrenCache.get(dirPath)
    const nodes: React.ReactNode[] = []
    if (!items) {
      if (loadingDirs.has(dirPath)) {
        nodes.push(
          <div key={dirPath + '-loading'} className="wfb-tree-item" style={{ paddingLeft: 8 + level * 16 }}>
            <Loader2 size={14} className="wfb-tree-item__loading wfb-spin" />
          </div>
        )
      }
      return nodes
    }
    for (const entry of items) {
      const fp = joinPath(dirPath, entry.name)
      const isExpanded = expandedDirs.has(fp)
      const isSelected = selectedFilePath === fp
      if (entry.type === 'dir') {
        nodes.push(
          <div key={fp} className={`wfb-tree-item${isExpanded ? ' wfb-tree-item--expanded' : ''}${entry.git === 'ignored' ? ' wfb-tree-item--ignored' : ''}`}
            style={{ paddingLeft: 8 + level * 16 }}
            onClick={() => toggleDir(fp)}
            onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, entry, dirPath }) }}>
            <ChevronRight size={14} className="wfb-tree-item__chevron" />
            <Folder size={14} className="wfb-icon-folder" />
            <span className="wfb-tree-item__name">{entry.name}</span>
            {entry.git && <span className={`wfb-git-badge wfb-git-badge--${entry.git}`}>{entry.git === 'modified' ? 'M' : entry.git === 'staged' ? 'S' : entry.git === 'conflicted' ? '!' : entry.git === 'ignored' ? 'I' : '?'}</span>}
          </div>
        )
        if (isExpanded) nodes.push(...renderTree(fp, level + 1))
      } else {
        nodes.push(
          <div key={fp} className={`wfb-tree-item${isSelected ? ' wfb-tree-item--selected' : ''}${entry.git === 'ignored' ? ' wfb-tree-item--ignored' : ''}`}
            style={{ paddingLeft: 8 + level * 16 }}
            onClick={() => previewFile(fp, entry)}
            onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, entry, dirPath }) }}>
            <span className="wfb-tree-item__chevron wfb-tree-item__chevron--spacer"><ChevronRight size={14} /></span>
            <File size={14} className="wfb-icon-file" />
            <span className="wfb-tree-item__name">{entry.name}</span>
            <span className="wfb-tree-item__meta">{formatSize(entry.size)}</span>
            {entry.git && <span className={`wfb-git-badge wfb-git-badge--${entry.git}`}>{entry.git === 'modified' ? 'M' : entry.git === 'staged' ? 'S' : entry.git === 'conflicted' ? '!' : entry.git === 'ignored' ? 'I' : '?'}</span>}
            {editingEntry?.entry.name === entry.name && editingEntry?.dirPath === dirPath && (
              <input ref={inputRef} className="wfb-inline-input wfb-inline-input--rename"
                value={editingEntry.newName} autoFocus onClick={e => e.stopPropagation()}
                onChange={e => setEditingEntry({ ...editingEntry, newName: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') renameEntry(dirPath, entry.name, editingEntry.newName); if (e.key === 'Escape') setEditingEntry(null) }}
                onBlur={() => setEditingEntry(null)}
              />
            )}
          </div>
        )
      }
    }
    return nodes
  }

  useEffect(() => {
    setExpandedDirs(new Set())
    setSelectedFile(null)
    setSelectedFilePath('')
    setFileContent('')
    setFilePath('')
    setDiffContent('')
    setDiffStats(undefined)
    setFileGitStatus(undefined)
    setForceMode(null)
    fetchDir(normalizedDir, true)
  }, [normalizedDir, fetchDir])

  const displayPath = normalizedDir.replace(/^\/home\/[^/]+/, '~')

  return (
    <div className="wfb-container">
      <div className="wfb-tree-panel" ref={treePanelRef} style={{ width: splitPos }}>
        <div className="wfb-tree-header">
          <div className="wfb-tree-header__path">
            <button className="wfb-icon-btn" onClick={goUp} disabled={normalizedDir === '/'} title="Up"><ChevronUp size={14} /></button>
            <span className="wfb-tree-header__dir" title={normalizedDir}>{displayPath}</span>
          </div>
          <div className="wfb-tree-header__actions">
            <button className={`wfb-icon-btn${showSearch ? ' wfb-icon-btn--active' : ''}`} onClick={() => setShowSearch(s => !s)} title="搜索"><Search size={14} /></button>
            <button className="wfb-icon-btn" onClick={async () => {
              setAiLoading(true); setAiSummary(null)
              try {
                const token = getToken()
                const res = await fetch(`/api/files/changes-summary?dir=${encodeURIComponent(normalizedDir)}&token=${token}`)
                const data = await res.json()
                setAiSummary(data.summary || data.error || 'No summary')
              } catch { setAiSummary('Failed to analyze') }
              setAiLoading(false)
            }} title="AI summary">{aiLoading ? <Loader2 size={14} className="wfb-spin" /> : <Sparkles size={14} />}</button>
            <button className="wfb-icon-btn" onClick={() => {
              const token = getToken()
              window.open(`/api/files/diff-report?dir=${encodeURIComponent(normalizedDir)}&token=${token}`, '_blank')
            }} title="Changes report"><FileStack size={14} /></button>
            <button className="wfb-icon-btn" onClick={() => { setCreatingNew('file'); setNewName('') }} title="New file"><Plus size={14} /></button>
            <button className="wfb-icon-btn" onClick={() => { setCreatingNew('folder'); setNewName('') }} title="New folder"><Folder size={14} /></button>
          </div>
        </div>

        {creatingNew && (
          <div className="wfb-new-input-row">
            <input ref={inputRef} className="wfb-inline-input" value={newName}
              placeholder={creatingNew === 'file' ? 'filename...' : 'folder name...'}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createNew(creatingNew, newName); if (e.key === 'Escape') { setCreatingNew(null); setNewName('') } }}
              onBlur={() => { setCreatingNew(null); setNewName('') }}
            />
          </div>
        )}

        {showSearch && (
          <SearchPanel
            dir={normalizedDir}
            onSelectFile={(fp) => {
              const entry: FileEntry = { name: fp.split('/').pop() || '', type: 'file' }
              previewFile(fp, entry)
              setShowSearch(false)
            }}
            onClose={() => setShowSearch(false)}
          />
        )}

        <div className="wfb-tree-list">
          {loadingDirs.has(dir) && childrenCache.get(dir) === undefined ? (
            <div className="wfb-loading"><Loader2 size={20} className="wfb-spin" /></div>
          ) : (childrenCache.get(dir) || []).length === 0 ? (
            <div className="wfb-empty">Empty directory</div>
          ) : renderTree(dir, 0)}
        </div>
      </div>

      <div className="wfb-splitter" onMouseDown={handleDrag} />

      <FilePreview selectedFile={selectedFile} filePath={filePath} fileContent={fileContent}
        previewLoading={previewLoading} saving={saving} onEdit={saveFile} onSave={() => {}} onCancelEdit={() => {}}
        onSendPath={onSendPath} onRestore={handleRestore}
        diffContent={diffContent} diffStats={diffStats}
        hasGitChanges={!!selectedFile?.git && selectedFile.git !== 'untracked'} fileGitStatus={fileGitStatus}
        forceMode={forceMode} onForceModeConsumed={() => setForceMode(null)}
      />

      {contextMenu && (
        <div className="wfb-ctx-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          {contextMenu.entry.git && (
            <div className="wfb-ctx-menu__item" onClick={() => { previewFile(joinPath(contextMenu.dirPath, contextMenu.entry.name), contextMenu.entry); setContextMenu(null) }}>
              <GitCompare size={13} /><span>Show Diff</span>
            </div>
          )}
          <div className="wfb-ctx-menu__item" onClick={() => { previewFile(joinPath(contextMenu.dirPath, contextMenu.entry.name), contextMenu.entry); setForceMode('history'); setContextMenu(null) }}>
            <Clock size={13} /><span>Show History</span>
          </div>
          {contextMenu.entry.type === 'file' && contextMenu.entry.git && (
            <div className="wfb-ctx-menu__item" onClick={() => { handleRestore('HEAD'); setContextMenu(null) }}>
              <Terminal size={13} /><span>Show Original</span>
            </div>
          )}
          <div className="wfb-ctx-menu__item" onClick={() => { setEditingEntry({ entry: contextMenu.entry, dirPath: contextMenu.dirPath, newName: contextMenu.entry.name }); setContextMenu(null) }}>
            <Pencil size={13} /><span>Rename</span>
          </div>
          {onSendPath && (
            <div className="wfb-ctx-menu__item" onClick={() => { onSendPath(joinPath(contextMenu.dirPath, contextMenu.entry.name)); setContextMenu(null) }}>
              <Terminal size={13} /><span>Send path to terminal</span>
            </div>
          )}
          <div className="wfb-ctx-menu__item wfb-ctx-menu__item--danger" onClick={() => { deleteEntry(contextMenu.entry, contextMenu.dirPath); setContextMenu(null) }}>
            <Trash2 size={13} /><span>Delete</span>
          </div>
        </div>
      )}

      {aiSummary && (
        <div className="wfb-ai-overlay" onClick={() => setAiSummary(null)}>
          <div className="wfb-ai-panel" onClick={e => e.stopPropagation()}>
            <div className="wfb-ai-panel__header">
              <Sparkles size={14} /><span>AI Changes Summary</span>
              <button className="wfb-icon-btn" onClick={() => setAiSummary(null)}><X size={14} /></button>
            </div>
            <pre className="wfb-ai-panel__content">{aiSummary}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
