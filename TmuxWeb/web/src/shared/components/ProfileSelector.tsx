import { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, Plus, Check, X, Pencil, Trash2 } from 'lucide-react'
import { Profile } from '../../types'
import './ProfileSelector.css'

interface Props {
  currentProfile: Profile | null
  onProfileChange: (profile: Profile) => void
}

export function ProfileSelector({ currentProfile, onProfileChange }: Props) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [newName, setNewName] = useState('')
  const [editName, setEditName] = useState('')
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchProfiles()
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setIsCreating(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isCreating])

  const fetchProfiles = async () => {
    try {
      const res = await fetch('/api/profiles', { credentials: 'include' })
      const data = await res.json()
      setProfiles(data.profiles || [])
      if (!currentProfile && data.profiles?.length > 0) {
        onProfileChange(data.profiles[0])
      }
    } catch (err) {
      console.error('Failed to fetch profiles:', err)
    }
  }

  const createProfile = async () => {
    if (!newName.trim() || loading) return
    setLoading(true)
    try {
      const name = newName.trim()
      const profile_key = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `profile-${Date.now()}`
      const res = await fetch('/api/profiles', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, profile_key })
      })
      const data = await res.json()
      if (data.id) {
        const newProfile: Profile = {
          id: data.id,
          profile_key: data.profile_key,
          name: data.name,
          sort_order: profiles.length
        }
        setProfiles([...profiles, newProfile])
        onProfileChange(newProfile)
        setNewName('')
        setIsCreating(false)
      }
    } catch (err) {
      console.error('Failed to create profile:', err)
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async () => {
    if (!currentProfile || !editName.trim() || loading) return
    setLoading(true)
    try {
      await fetch(`/api/profiles/${currentProfile.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() })
      })
      const updated = profiles.map(p =>
        p.id === currentProfile.id ? { ...p, name: editName.trim() } : p
      )
      setProfiles(updated)
      onProfileChange({ ...currentProfile, name: editName.trim() })
      setIsEditing(false)
    } catch (err) {
      console.error('Failed to update profile:', err)
    } finally {
      setLoading(false)
    }
  }

  const deleteProfile = async () => {
    if (!currentProfile || profiles.length <= 1 || loading) return
    if (!confirm(`Delete profile "${currentProfile.name}"?`)) return
    setLoading(true)
    try {
      await fetch(`/api/profiles/${currentProfile.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      const remaining = profiles.filter(p => p.id !== currentProfile.id)
      setProfiles(remaining)
      onProfileChange(remaining[0])
      setIsEditing(false)
    } catch (err) {
      console.error('Failed to delete profile:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') action()
    if (e.key === 'Escape') {
      setIsCreating(false)
      setIsEditing(false)
    }
  }

  return (
    <div className="profile-selector" ref={dropdownRef}>
      <div className="profile-current" onClick={() => setIsOpen(!isOpen)}>
        <span className="profile-name">{currentProfile?.name || 'Select Profile'}</span>
        <span className="profile-chevron">
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </div>

      {isOpen && (
        <div className="profile-dropdown">
          <div className="profile-list">
            {profiles.map(profile => (
              <div
                key={profile.id}
                className={`profile-item ${profile.id === currentProfile?.id ? 'active' : ''}`}
                onClick={() => {
                  onProfileChange(profile)
                  setIsOpen(false)
                }}
              >
                <span>{profile.name}</span>
                {profile.id === currentProfile?.id && <Check size={14} className="check" />}
              </div>
            ))}
          </div>

          <div className="profile-actions">
            {isCreating ? (
              <div className="profile-input-row">
                <input
                  ref={inputRef}
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => handleKeyDown(e, createProfile)}
                  placeholder="Profile name..."
                  className="profile-input"
                  disabled={loading}
                />
                <button onClick={createProfile} disabled={loading || !newName.trim()} className="btn-confirm">
                  <Check size={14} />
                </button>
                <button onClick={() => setIsCreating(false)} className="btn-cancel">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button className="profile-add-btn" onClick={() => setIsCreating(true)}>
                <Plus size={14} /> New Profile
              </button>
            )}
          </div>

          {currentProfile && (
            <div className="profile-edit-section">
              {isEditing ? (
                <div className="profile-input-row">
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => handleKeyDown(e, updateProfile)}
                    placeholder="Rename profile..."
                    className="profile-input"
                    disabled={loading}
                  />
                  <button onClick={updateProfile} disabled={loading || !editName.trim()} className="btn-confirm">
                    <Check size={14} />
                  </button>
                  <button onClick={() => setIsEditing(false)} className="btn-cancel">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="profile-edit-actions">
                  <button
                    className="btn-edit"
                    onClick={() => {
                      setEditName(currentProfile.name)
                      setIsEditing(true)
                    }}
                  >
                    <Pencil size={12} style={{ marginRight: 4 }} /> Edit
                  </button>
                  <button
                    className="btn-delete"
                    onClick={deleteProfile}
                    disabled={profiles.length <= 1}
                    title={profiles.length <= 1 ? 'Cannot delete last profile' : ''}
                  >
                    <Trash2 size={12} style={{ marginRight: 4 }} /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
