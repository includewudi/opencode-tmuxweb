import { useState, useCallback, useEffect } from 'react'
import { Plus } from 'lucide-react'
import './SnippetsTab.css'

interface Snippet {
  name: string
  command: string
}

interface SnippetsTabProps {
  onSend: (text: string) => void
  disabled?: boolean
}

export function SnippetsTab({ onSend, disabled }: SnippetsTabProps) {
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCommand, setNewCommand] = useState('')

  const fetchSnippets = useCallback(async () => {
    try {
      const res = await fetch('/api/snippets', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setSnippets(data.snippets || [])
      }
    } catch { /* non-critical */ }
  }, [])

  useEffect(() => { fetchSnippets() }, [fetchSnippets])

  const handleAdd = useCallback(async () => {
    if (!newName.trim() || !newCommand.trim()) return
    try {
      const res = await fetch('/api/snippets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newName.trim(), command: newCommand.trim() })
      })
      if (res.ok) {
        setNewName('')
        setNewCommand('')
        setShowForm(false)
        await fetchSnippets()
      }
    } catch { /* non-critical */ }
  }, [newName, newCommand, fetchSnippets])

  const handleDelete = useCallback(async (index: number) => {
    try {
      const res = await fetch(`/api/snippets?index=${index}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (res.ok) await fetchSnippets()
    } catch { /* non-critical */ }
  }, [fetchSnippets])

  return (
    <div className="snippets-tab">
      <div className="snippets-header">
        <span className="snippets-title">命令片段</span>
        <button
          className="snippets-add-btn"
          onClick={() => setShowForm(!showForm)}
          type="button"
        >
          <Plus size={12} />
        </button>
      </div>

      {showForm && (
        <div className="snippets-form">
          <input
            className="snippets-form-input"
            placeholder="名称"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <input
            className="snippets-form-input snippets-form-cmd"
            placeholder="命令"
            value={newCommand}
            onChange={e => setNewCommand(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          />
          <button
            className="snippets-form-save"
            onClick={handleAdd}
            disabled={!newName.trim() || !newCommand.trim()}
            type="button"
          >
            保存
          </button>
        </div>
      )}

      {snippets.length === 0 && !showForm && (
        <div className="snippets-empty">暂无片段</div>
      )}

      <div className="snippets-buttons">
        {snippets.map((s, i) => (
          <button
            key={i}
            className="snippet-btn"
            title={`${s.name}: ${s.command}`}
            onClick={() => onSend(s.command + '\n')}
            disabled={disabled}
            onContextMenu={e => { e.preventDefault(); handleDelete(i) }}
            type="button"
          >
            {s.name}
          </button>
        ))}
      </div>

      {snippets.length > 0 && (
        <div className="snippets-hint">右键删除</div>
      )}
    </div>
  )
}
