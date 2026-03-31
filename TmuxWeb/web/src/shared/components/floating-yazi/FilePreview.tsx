import { useState } from 'react'
import { Save, Loader2, Pencil, X, Terminal } from 'lucide-react'
import type { FileEntry } from './web-file-browser-helpers'

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
}

export function FilePreview({ selectedFile, filePath, fileContent, previewLoading, saving, onEdit, onSave, onCancelEdit, onSendPath }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [editable, setEditable] = useState('')
  const isEditable = selectedFile && fileContent !== '(binary file)' && fileContent !== '(failed to load)'

  const startEdit = () => { setEditable(fileContent); setIsEditing(true) }
  const cancelEdit = () => { setIsEditing(false); onCancelEdit() }
  const save = () => { onEdit(editable); onSave(); setIsEditing(false) }

  return (
    <div className="wfb-preview-panel">
      <div className="wfb-preview-header">
        <div className="wfb-preview-header__info">
          <span className="wfb-preview-header__file">{selectedFile?.name || ''}</span>
          <span className="wfb-preview-header__path" title={filePath}>{filePath}</span>
        </div>
        {isEditable && (
          <div className="wfb-preview-header__actions">
            {onSendPath && (
              <button className="wfb-icon-btn" onClick={() => onSendPath(filePath)} title="Send path to terminal"><Terminal size={14} /></button>
            )}
            {isEditing ? (
              <>
                <button className="wfb-icon-btn" onClick={save} disabled={saving} title="Save">
                  {saving ? <Loader2 size={14} className="wfb-spin" /> : <Save size={14} />}
                </button>
                <button className="wfb-icon-btn" onClick={cancelEdit} title="Cancel"><X size={14} /></button>
              </>
            ) : (
              <button className="wfb-icon-btn" onClick={startEdit} title="Edit"><Pencil size={14} /></button>
            )}
          </div>
        )}
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
        ) : (
          <pre className="wfb-preview-content">{fileContent}</pre>
        )}
      </div>
    </div>
  )
}
