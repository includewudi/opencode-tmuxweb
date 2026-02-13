import { useState, useEffect, useRef } from 'react'
import { Plus, Check, X, Pencil, Trash2, ArrowRight, FolderCog } from 'lucide-react'
import { fetchGroups, createGroup, updateGroup, deleteGroup, assignSessionToGroup } from '../utils/api'
import './GroupManager.css'

export function GroupManagerTrigger({ onClick }) {
  return (
    <button className="group-trigger-btn" onClick={onClick} title="Manage Groups">
      <FolderCog size={16} />
      <span>Groups</span>
    </button>
  )
}

export function GroupManagerSheet({ profileKey, sessions, onGroupsChanged, open, onClose }) {
  const [groups, setGroups] = useState([])
  const [isCreating, setIsCreating] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [assigningSession, setAssigningSession] = useState(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const sheetRef = useRef(null)

  useEffect(() => {
    if (profileKey && open) loadGroups()
  }, [profileKey, open])

  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isCreating])

  useEffect(() => {
    if (!open) return
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const loadGroups = async () => {
    try {
      const data = await fetchGroups(profileKey)
      setGroups(data.groups || [])
    } catch (err) {
      console.error('Failed to fetch groups:', err)
    }
  }

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || loading) return
    setLoading(true)
    try {
      const data = await createGroup(profileKey, newGroupName.trim())
      if (data.id) {
        const newGroup = {
          id: data.id,
          group_name: data.group_name,
          sort_order: groups.length,
          session_count: 0
        }
        setGroups([...groups, newGroup])
        setNewGroupName('')
        setIsCreating(false)
        onGroupsChanged()
      }
    } catch (err) {
      console.error('Failed to create group:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateGroup = async (id) => {
    if (!editName.trim() || loading) return
    setLoading(true)
    try {
      await updateGroup(id, editName.trim())
      setGroups(groups.map(g => g.id === id ? { ...g, group_name: editName.trim() } : g))
      setEditingId(null)
      onGroupsChanged()
    } catch (err) {
      console.error('Failed to update group:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteGroup = async (id) => {
    const group = groups.find(g => g.id === id)
    if (!group || loading) return
    if (!confirm(`Delete group "${group.group_name}"?`)) return
    setLoading(true)
    try {
      await deleteGroup(id)
      setGroups(groups.filter(g => g.id !== id))
      onGroupsChanged()
    } catch (err) {
      console.error('Failed to delete group:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAssignSession = async (sessionName, groupId) => {
    setLoading(true)
    try {
      await assignSessionToGroup(sessionName, groupId)
      setAssigningSession(null)
      loadGroups()
      onGroupsChanged()
    } catch (err) {
      console.error('Failed to assign session:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e, action) => {
    if (e.key === 'Enter') action()
    if (e.key === 'Escape') {
      setIsCreating(false)
      setEditingId(null)
      setAssigningSession(null)
    }
  }

  return (
    <>
      <div
        className={`gm-backdrop ${open ? 'gm-backdrop-visible' : ''}`}
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className={`gm-sheet ${open ? 'gm-sheet-open' : ''}`}
      >
        <div className="gm-sheet-handle" onClick={onClose}>
          <div className="gm-handle-bar" />
        </div>

        <div className="gm-sheet-header">
          <span className="gm-sheet-title">Group Manager</span>
          <button className="gm-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="gm-sheet-body">
          <div className="gm-section">
            <div className="gm-section-header">
              <span className="gm-section-label">Groups</span>
              <button className="group-add-btn" onClick={() => setIsCreating(true)} title="Create group">
                <Plus size={14} />
              </button>
            </div>

            {isCreating && (
              <div className="group-create-row">
                <input
                  ref={inputRef}
                  type="text"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  onKeyDown={e => handleKeyDown(e, handleCreateGroup)}
                  placeholder="Group name..."
                  className="group-input"
                  disabled={loading}
                />
                <button onClick={handleCreateGroup} disabled={loading || !newGroupName.trim()} className="btn-sm btn-confirm">
                  <Check size={12} />
                </button>
                <button onClick={() => setIsCreating(false)} className="btn-sm btn-cancel">
                  <X size={12} />
                </button>
              </div>
            )}

            <div className="group-list">
              {groups.length === 0 && !isCreating && (
                <div className="group-empty">No groups yet</div>
              )}
              {groups.map(group => (
                <div key={group.id} className="group-item">
                  {editingId === group.id ? (
                    <div className="group-edit-row">
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => handleKeyDown(e, () => handleUpdateGroup(group.id))}
                        className="group-input"
                        autoFocus
                        disabled={loading}
                      />
                      <button
                        onClick={() => handleUpdateGroup(group.id)}
                        disabled={loading || !editName.trim()}
                        className="btn-sm btn-confirm"
                      >
                        <Check size={12} />
                      </button>
                      <button onClick={() => setEditingId(null)} className="btn-sm btn-cancel">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="group-row">
                      <span className="group-name">{group.group_name}</span>
                      <span className="group-count">{group.session_count}</span>
                      <div className="group-actions group-actions-visible">
                        <button
                          className="btn-icon"
                          onClick={() => {
                            setEditingId(group.id)
                            setEditName(group.group_name)
                          }}
                          title="Rename"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          className="btn-icon btn-danger"
                          onClick={() => handleDeleteGroup(group.id)}
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="gm-section">
            <div className="gm-section-header">
              <span className="gm-section-label">Assign Sessions</span>
            </div>
            <div className="session-list">
              {sessions.map(session => (
                <div key={session.sessionId || session.name} className="session-row">
                  <span className="session-name">{session.sessionName || session.name}</span>
                  {assigningSession === (session.sessionName || session.name) ? (
                    <select
                      className="group-select"
                      onChange={e => {
                        const val = e.target.value
                        handleAssignSession(session.sessionName || session.name, val ? parseInt(val, 10) : null)
                      }}
                      autoFocus
                      onBlur={() => setAssigningSession(null)}
                    >
                      <option value="">Ungrouped</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.group_name}</option>
                      ))}
                    </select>
                  ) : (
                    <button
                      className="btn-assign"
                      onClick={() => setAssigningSession(session.sessionName || session.name)}
                      title="Assign to group"
                    >
                      <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              ))}
              {sessions.length === 0 && (
                <div className="session-empty">No sessions available</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
