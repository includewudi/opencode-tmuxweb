import { useState, useCallback } from 'react'
import { X, Plus, Pencil, Trash2 } from 'lucide-react'
import './RoleManagerModal.css'

interface Role {
  id: string
  emoji: string
  label: string
  desc: string
  prompt?: string
  suffix?: string
  isCustom?: boolean
}

interface RoleFormData {
  id: string
  emoji: string
  label: string
  desc: string
  prompt: string
  suffix: string
}

const emptyForm: RoleFormData = { id: '', emoji: '', label: '', desc: '', prompt: '', suffix: '' }

interface RoleManagerModalProps {
  open: boolean
  onClose: () => void
  roles: Role[]
  onRolesChanged: () => void
}

export function RoleManagerModal({ open, onClose, roles, onRolesChanged }: RoleManagerModalProps) {
  const [editingRole, setEditingRole] = useState<RoleFormData | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const handleSaveRole = useCallback(async (form: RoleFormData) => {
    try {
      const method = isCreating ? 'POST' : 'PUT'
      const url = isCreating ? '/api/roles' : `/api/roles/${form.id}`
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form)
      })
      if (res.ok) {
        await onRolesChanged()
        setEditingRole(null)
        setIsCreating(false)
      }
    } catch { /* ignore */ }
  }, [isCreating, onRolesChanged])

  const handleDeleteRole = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/roles/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (res.ok) {
        await onRolesChanged()
      }
    } catch { /* ignore */ }
  }, [onRolesChanged])

  const handleStartCreate = useCallback(() => {
    setEditingRole({ ...emptyForm })
    setIsCreating(true)
  }, [])

  const handleStartEdit = useCallback((r: Role) => {
    setEditingRole({
      id: r.id,
      emoji: r.emoji,
      label: r.label,
      desc: r.desc,
      prompt: r.prompt || '',
      suffix: r.suffix || '',
    })
    setIsCreating(false)
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingRole(null)
    setIsCreating(false)
  }, [])

  if (!open) return null

  const customRoles = roles.filter(r => r.isCustom)

  return (
    <div className="role-modal-overlay" onClick={onClose}>
      <div className="role-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="role-modal-header">
          <span className="role-modal-title">自定义角色</span>
          <button className="role-modal-close" onClick={onClose} type="button">
            <X size={16} />
          </button>
        </div>

        {/* Role list */}
        <div className="role-modal-body">
          {customRoles.length === 0 && !editingRole && (
            <div className="role-modal-empty">暂无自定义角色</div>
          )}

          {customRoles.map(r => (
            <div key={r.id} className="role-modal-item">
              <div className="role-modal-item-info">
                <span className="role-modal-item-emoji">{r.emoji}</span>
                <div className="role-modal-item-text">
                  <span className="role-modal-item-label">{r.label}</span>
                  <span className="role-modal-item-desc">{r.desc}</span>
                </div>
              </div>
              <div className="role-modal-item-actions">
                <button
                  onClick={() => handleStartEdit(r)}
                  className="role-modal-action-btn"
                  type="button"
                  title="编辑"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => handleDeleteRole(r.id)}
                  className="role-modal-action-btn role-modal-delete-btn"
                  type="button"
                  title="删除"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}

          {/* Edit / Create form */}
          {editingRole && (
            <div className="role-modal-form">
              <div className="role-modal-form-header">
                <span>{isCreating ? '新建角色' : '编辑角色'}</span>
                <button onClick={handleCancelEdit} className="role-modal-action-btn" type="button">
                  <X size={14} />
                </button>
              </div>
              {isCreating && (
                <input
                  placeholder="ID (英文)"
                  value={editingRole.id}
                  onChange={e => setEditingRole({ ...editingRole, id: e.target.value })}
                  className="role-modal-input"
                />
              )}
              <div className="role-modal-row">
                <input
                  placeholder="Emoji"
                  value={editingRole.emoji}
                  onChange={e => setEditingRole({ ...editingRole, emoji: e.target.value })}
                  className="role-modal-input role-modal-input-emoji"
                />
                <input
                  placeholder="名称"
                  value={editingRole.label}
                  onChange={e => setEditingRole({ ...editingRole, label: e.target.value })}
                  className="role-modal-input"
                  style={{ flex: 1 }}
                />
              </div>
              <input
                placeholder="描述"
                value={editingRole.desc}
                onChange={e => setEditingRole({ ...editingRole, desc: e.target.value })}
                className="role-modal-input"
              />
              <textarea
                placeholder="系统提示词"
                value={editingRole.prompt}
                onChange={e => setEditingRole({ ...editingRole, prompt: e.target.value })}
                rows={4}
                className="role-modal-textarea"
              />
              <textarea
                placeholder="后缀提示词"
                value={editingRole.suffix}
                onChange={e => setEditingRole({ ...editingRole, suffix: e.target.value })}
                rows={2}
                className="role-modal-textarea"
              />
              <button
                onClick={() => handleSaveRole(editingRole)}
                className="role-modal-save-btn"
                type="button"
              >
                保存
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {!editingRole && (
          <div className="role-modal-footer">
            <button onClick={handleStartCreate} className="role-modal-create-btn" type="button">
              <Plus size={14} /> 新建角色
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
