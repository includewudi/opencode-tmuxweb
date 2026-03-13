import { useState, useCallback, useEffect } from 'react'
import { Plus, Trash2, Play } from 'lucide-react'

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
  const [newName, setNewName] = useState('')
  const [newCommand, setNewCommand] = useState('')
  const [showForm, setShowForm] = useState(false)

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px', gap: '6px', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#abb2bf', fontSize: '13px', fontWeight: 600 }}>命令片段</span>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            background: '#4d78cc',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '3px 8px',
            fontSize: '11px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
          }}
          type="button"
        >
          <Plus size={11} /> 添加
        </button>
      </div>

      {showForm && (
        <div style={{
          background: '#1e2028',
          border: '1px solid #2c313a',
          borderRadius: '6px',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          <input
            placeholder="名称"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            style={{
              background: '#13151a',
              border: '1px solid #2c313a',
              borderRadius: '4px',
              padding: '6px',
              color: '#abb2bf',
              fontSize: '12px',
              outline: 'none',
            }}
          />
          <input
            placeholder="命令"
            value={newCommand}
            onChange={e => setNewCommand(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
            style={{
              background: '#13151a',
              border: '1px solid #2c313a',
              borderRadius: '4px',
              padding: '6px',
              color: '#98c379',
              fontSize: '12px',
              fontFamily: 'Menlo, Monaco, monospace',
              outline: 'none',
            }}
          />
          <button
            onClick={handleAdd}
            disabled={!newName.trim() || !newCommand.trim()}
            style={{
              background: '#4d78cc',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              opacity: (!newName.trim() || !newCommand.trim()) ? 0.5 : 1,
            }}
            type="button"
          >
            保存
          </button>
        </div>
      )}

      {snippets.length === 0 && !showForm && (
        <div style={{ color: '#555a66', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
          暂无片段，点击「添加」保存常用命令
        </div>
      )}

      {snippets.map((s, i) => (
        <div
          key={i}
          style={{
            background: '#1a1c20',
            border: '1px solid #2c313a',
            borderRadius: '6px',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#9da5b4', fontSize: '12px', fontWeight: 500 }}>{s.name}</div>
            <div style={{
              color: '#98c379',
              fontSize: '11px',
              fontFamily: 'Menlo, Monaco, monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {s.command}
            </div>
          </div>
          <button
            onClick={() => onSend(s.command + '\n')}
            disabled={disabled}
            style={{
              background: '#4d78cc',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 8px',
              cursor: 'pointer',
              opacity: disabled ? 0.5 : 1,
            }}
            type="button"
          >
            <Play size={12} />
          </button>
          <button
            onClick={() => handleDelete(i)}
            style={{
              background: 'none',
              border: 'none',
              color: '#e06c75',
              cursor: 'pointer',
              padding: '4px',
            }}
            type="button"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}
