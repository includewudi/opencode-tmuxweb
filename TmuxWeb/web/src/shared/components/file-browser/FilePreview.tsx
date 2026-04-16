import { useState, useEffect, useRef, useCallback } from 'react'
import { Save, Loader2, Pencil, X, Terminal, Eye, GitCompare, Clock, Search, ChevronDown, ChevronRight } from 'lucide-react'
import type { FileEntry } from './web-file-browser-helpers'
import { DiffView } from './DiffView'
import { getToken } from '../../../utils/auth'
import { isImageFile, isVideoFile, isDocFile } from './web-file-browser-helpers'
import { FileHistory } from './FileHistory'

interface GrepLine {
  num: number
  line: string
  matchStart: number
  matchEnd: number
}

type PreviewMode = 'preview' | 'diff' | 'history'

interface Props {
  selectedFile: FileEntry | null
  filePath: string
  fileContent: string
  previewLoading: boolean
  saving: boolean
  onEdit: (content: string) => void
  onSave: () => void
  onCancelEdit: () => void
  onSendPath?: (path: string) => void
  onRestore?: (sha: string) => void
  diffContent?: string
  diffStats?: { additions: number; deletions: number }
  hasGitChanges?: boolean
  fileGitStatus?: string
  forceMode?: 'diff' | 'history' | null
  onForceModeConsumed?: () => void
}

export function FilePreview({ selectedFile, filePath, fileContent, previewLoading, saving, onEdit, onSave, onCancelEdit, onSendPath, onRestore, diffContent, diffStats, hasGitChanges, fileGitStatus, forceMode, onForceModeConsumed }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [editable, setEditable] = useState('')
  const [mode, setMode] = useState<PreviewMode>('preview')
  const [showFind, setShowFind] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [findResults, setFindResults] = useState<GrepLine[]>([])
  const [findLoading, setFindLoading] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set())
  const findInputRef = useRef<HTMLInputElement>(null)
  const isEditable = selectedFile && fileContent !== '(binary file)' && fileContent !== '(failed to load)'

  useEffect(() => {
    if (forceMode) { setMode(forceMode); onForceModeConsumed?.(); return }
    if (hasGitChanges && selectedFile?.git) setMode('diff')
    else setMode('preview')
  }, [selectedFile?.name, hasGitChanges, forceMode])

  useEffect(() => {
    if (showFind) findInputRef.current?.focus()
  }, [showFind])

  useEffect(() => {
    setShowFind(false)
    setFindQuery('')
    setFindResults([])
  }, [filePath])

  const doFind = useCallback(async (raw: string) => {
    if (raw.length < 1 || !filePath) { setFindResults([]); return }
    setFindLoading(true)
    const isSymbol = raw.startsWith('@')
    const q = isSymbol ? raw.slice(1) : raw
    if (!q) { setFindResults([]); setFindLoading(false); return }
    try {
      const token = getToken()
      const params = new URLSearchParams({ q, file: filePath, limit: '100', token })
      if (isSymbol) params.set('mode', 'symbol')
      const res = await fetch(`/api/files/grep?${params}`)
      if (res.ok) {
        const data = await res.json()
        setFindResults(data.results || [])
        setCollapsedGroups(new Set())
      } else { setFindResults([]) }
    } catch { setFindResults([]) }
    finally { setFindLoading(false) }
  }, [filePath])

  useEffect(() => {
    if (!showFind || !findQuery) { setFindResults([]); return }
    const timer = setTimeout(() => doFind(findQuery), 300)
    return () => clearTimeout(timer)
  }, [findQuery, showFind, doFind])

  const contentLines = fileContent.split('\n')

  const groups: { startLine: number; endLine: number; results: GrepLine[] }[] = []
  let currentGroup: { startLine: number; endLine: number; results: GrepLine[] } | null = null
  for (const r of findResults) {
    const ctxStart = Math.max(1, r.num - 2)
    if (currentGroup && ctxStart <= currentGroup.endLine + 1) {
      currentGroup.endLine = Math.max(currentGroup.endLine, r.num + 2)
      currentGroup.results.push(r)
    } else {
      if (currentGroup) groups.push(currentGroup)
      currentGroup = { startLine: ctxStart, endLine: r.num + 2, results: [r] }
    }
  }
  if (currentGroup) groups.push(currentGroup)

  const renderContentWithContext = () => {
    if (findResults.length === 0) {
      return <pre className="wfb-preview-content">{fileContent}</pre>
    }
    return (
      <div className="wfb-find-content">
        {groups.map((g, gi) => {
          const collapsed = collapsedGroups.has(gi)
          const first = g.results[0]
          return (
            <div key={gi} className="wfb-find-group">
              <div className="wfb-find-group__header" onClick={() => setCollapsedGroups(prev => {
                const next = new Set(prev)
                if (next.has(gi)) next.delete(gi); else next.add(gi)
                return next
              })}>
                {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                <span className="wfb-find-group__loc">Line {first.num}</span>
                <span className="wfb-find-group__text">{first.line.slice(0, 80)}</span>
              </div>
              {!collapsed && contentLines.slice(g.startLine - 1, g.endLine).map((line, idx) => {
                const num = g.startLine + idx
                const match = g.results.find(r => r.num === num)
                return (
                  <div key={num} className={`wfb-find-line${match ? ' wfb-find-line--match' : ''}`}>
                    <span className="wfb-find-line__num">{num}</span>
                    {match ? (
                      <span className="wfb-find-line__text">
                        {match.line.slice(0, match.matchStart)}
                        <mark>{match.line.slice(match.matchStart, match.matchEnd)}</mark>
                        {match.line.slice(match.matchEnd)}
                      </span>
                    ) : (
                      <span className="wfb-find-line__text">{line}</span>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    )
  }

  const startEdit = () => { setEditable(fileContent); setIsEditing(true) }
  const cancelEdit = () => { setIsEditing(false); onCancelEdit() }
  const save = () => { onEdit(editable); onSave(); setIsEditing(false) }

  const tabs = [
    { key: 'preview' as const, icon: <Eye size={13} />, label: 'Preview' },
    { key: 'diff' as const, icon: <GitCompare size={13} />, label: 'Diff' },
    { key: 'history' as const, icon: <Clock size={13} />, label: 'History' },
  ]

  const encodedPath = filePath ? encodeURIComponent(filePath) : ''
  const mediaUrl = filePath ? `/api/files/preview?path=${encodedPath}&token=${getToken()}` : ''
  const isImage = filePath ? isImageFile(filePath) : false
  const isVideo = filePath ? isVideoFile(filePath) : false
  const isDoc = filePath ? isDocFile(filePath) : false

  return (
    <div className="wfb-preview-panel">
      <div className="wfb-preview-header">
        <div className="wfb-preview-header__info">
          <span className="wfb-preview-header__file">{selectedFile?.name || ''}</span>
          <span className="wfb-preview-header__path" title={filePath}>{filePath}</span>
        </div>
        {isEditable && !isEditing && (
          <div className="wfb-preview-header__actions">
            {onSendPath && (
              <button className="wfb-icon-btn" onClick={() => onSendPath(filePath)} title="Send path to terminal"><Terminal size={14} /></button>
            )}
            <button className={`wfb-icon-btn${showFind ? ' wfb-icon-btn--active' : ''}`} onClick={() => setShowFind(v => !v)} title="Find in file"><Search size={14} /></button>
            <button className="wfb-icon-btn" onClick={startEdit} title="Edit"><Pencil size={14} /></button>
          </div>
        )}
        {isEditing && (
          <div className="wfb-preview-header__actions">
            <button className="wfb-icon-btn" onClick={save} disabled={saving} title="Save">
              {saving ? <Loader2 size={14} className="wfb-spin" /> : <Save size={14} />}
            </button>
            <button className="wfb-icon-btn" onClick={cancelEdit} title="Cancel"><X size={14} /></button>
          </div>
        )}
      </div>
      <div className="wfb-preview-header__tabs">
        {tabs.map(t => (
          <button key={t.key} className={`wfb-tab${mode === t.key ? ' wfb-tab--active' : ''}`}
            onClick={() => setMode(t.key)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {showFind && mode === 'preview' && !isEditing && (
        <div className="wfb-find-bar">
          <Search size={13} className="wfb-find-bar__icon" />
          <input ref={findInputRef} className="wfb-find-bar__input"
            value={findQuery} onChange={e => setFindQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { setShowFind(false); setFindQuery(''); setFindResults([]) } }}
            placeholder="搜索内容… @搜索方法"
            spellCheck={false}
          />
          {findLoading && <Loader2 size={13} className="wfb-spin" />}
          {findResults.length > 0 && <span className="wfb-find-bar__count">{findResults.length} matches</span>}
          <button className="wfb-icon-btn" onClick={() => { setShowFind(false); setFindQuery(''); setFindResults([]) }}><X size={13} /></button>
        </div>
      )}
      <div className="wfb-preview-body">
        {previewLoading ? (
          <div className="wfb-loading"><Loader2 size={20} className="wfb-spin" /></div>
        ) : !selectedFile ? (
          <div className="wfb-empty">Select a file to preview</div>
        ) : isEditing ? (
          <textarea className="wfb-preview-editor" value={editable}
            onChange={e => setEditable(e.target.value)} spellCheck={false}
          />
        ) : mode === 'diff' ? (
          <DiffView diff={diffContent || ''} hasChanges={!!hasGitChanges}
            fileStatus={fileGitStatus} stats={diffStats}
          />
        ) : mode === 'history' && onRestore ? (
          <FileHistory filePath={filePath} onRestore={onRestore} />
        ) : isImage ? (
          <div className="wfb-media-preview">
            <div className="wfb-media-preview__toolbar">
              <a className="wfb-media-preview__action" href={mediaUrl} target="_blank" rel="noreferrer">View original</a>
            </div>
            <img className="wfb-media-preview__image" src={mediaUrl} alt={selectedFile?.name || 'image'} loading="lazy" />
          </div>
        ) : isVideo ? (
          <div className="wfb-media-preview">
            <video className="wfb-media-preview__video" src={mediaUrl} controls />
          </div>
        ) : isDoc ? (
          <div className="wfb-media-preview">
            <iframe className="wfb-media-preview__doc" src={mediaUrl} title={selectedFile?.name || 'document'} />
            <div className="wfb-media-preview__toolbar">
              <a className="wfb-media-preview__action" href={mediaUrl} target="_blank" rel="noreferrer">View original</a>
            </div>
          </div>
        ) : (
          renderContentWithContext()
        )}
      </div>
    </div>
  )
}
