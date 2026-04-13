import { useState, useEffect } from 'react'
import { Save, Loader2, Pencil, X, Terminal, Eye, GitCompare, Clock } from 'lucide-react'
import type { FileEntry } from './web-file-browser-helpers'
import { DiffView } from './DiffView'
import { getToken } from '../../../utils/auth'
import { isImageFile, isVideoFile, isDocFile } from './web-file-browser-helpers'
import { FileHistory } from './FileHistory'

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
  const isEditable = selectedFile && fileContent !== '(binary file)' && fileContent !== '(failed to load)'

  useEffect(() => {
    if (forceMode) { setMode(forceMode); onForceModeConsumed?.(); return }
    if (hasGitChanges && selectedFile?.git) setMode('diff')
    else setMode('preview')
  }, [selectedFile?.name, hasGitChanges, forceMode])

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
          <pre className="wfb-preview-content">{fileContent}</pre>
        )}
      </div>
    </div>
  )
}
