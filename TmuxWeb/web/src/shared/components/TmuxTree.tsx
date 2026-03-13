import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  Terminal,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  RefreshCw,
  MoreHorizontal,
  Pencil,
  FolderInput,
  FolderMinus,
  FolderPlus,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw
} from 'lucide-react'
import { NewTmuxButton } from './NewTmuxButton'
import { TmuxSession, SessionGroup, PaneStatus, PaneStatusInfo } from '../../types'
import { StatusBadge } from './StatusBadge'
import './TmuxTree.css'

interface Props {
  sessions: TmuxSession[]
  groups?: SessionGroup[]
  profileId?: number
  profileKey?: string
  onSelectPane: (paneId: string, paneName: string) => void
  onRefresh: () => void
  onOrderChange?: () => void
  onPaneContextMenu?: (paneKey: string) => void
  onPaneStatusClick?: (paneKey: string) => void
  statusRefreshToken?: number
  defaultExpanded?: boolean
}

async function renameWindow(sessionName: string, windowIndex: number, newName: string): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/tmux/windows/${encodeURIComponent(sessionName)}/${windowIndex}/rename`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newName })
      }
    )
    return res.ok
  } catch {
    return false
  }
}

interface OrderData {
  groups: { id: number; sort_order: number }[]
  sessions: { session_name: string; group_id: number | null; sort_order: number }[]
}

interface SessionOrder {
  session_name: string
  group_id: number | null
  sort_order: number
}

interface TreeItem {
  id: string
  type: 'session' | 'group'
  session?: TmuxSession
  group?: SessionGroup
  groupId: number | null
  sortOrder: number
}

async function saveOrder(profileId: number, orderData: OrderData) {
  await fetch(`/api/profiles/${profileId}/order`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(orderData)
  })
}

async function fetchPaneStatuses(profileKey: string, paneKeys: string[]): Promise<PaneStatusInfo[]> {
  if (!paneKeys.length) return []
  const encodedKeys = paneKeys.map(k => encodeURIComponent(k)).join(',')
  const res = await fetch(
    `/api/panes/status?profile_key=${encodeURIComponent(profileKey)}&paneKeys=${encodedKeys}`,
    { credentials: 'include' }
  )
  if (!res.ok) return []
  const data = await res.json()
  return data.panes || []
}

// Fetch per-pane AI task statuses from ai_conversation table
async function fetchTaskPaneStatuses(): Promise<Record<string, PaneStatus>> {
  try {
    const res = await fetch('/api/tasks?limit=500', { credentials: 'include' })
    if (!res.ok) return {}
    const data = await res.json()
    const map: Record<string, PaneStatus> = {}
    for (const task of (data.tasks || [])) {
      const key: string = task.pane_key
      const status: string = task.task_status
      if (!key) continue
      // Keep the 'hottest' status per pane: in_progress > failed > waiting > done
      const priority: Record<string, number> = { in_progress: 4, failed: 3, waiting: 2, done: 1, completed: 1 }
      const cur = map[key]
      const curP = priority[cur] ?? 0
      const newP = priority[status] ?? 0
      if (newP > curP) {
        // Normalise 'completed' -> 'done'
        map[key] = (status === 'completed' ? 'done' : status) as PaneStatus
      }
    }
    return map
  } catch {
    return {}
  }
}

function buildPaneKey(sessionName: string, windowIndex: number, paneId: string): string {
  return `${sessionName}:${windowIndex}:${paneId}`
}

function DragHandle() {
  return (
    <span className="drag-handle" aria-label="Drag to reorder">
      <GripVertical size={14} />
    </span>
  )
}

interface QuickGroupMenuProps {
  sessionName: string
  currentGroupId: number | null
  groups: SessionGroup[]
  profileKey: string
  position: { x: number; y: number }
  onClose: () => void
  onDone: () => void
}

function QuickGroupMenu({ sessionName, currentGroupId, groups, profileKey, position, onClose, onDone }: QuickGroupMenuProps) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (creating && inputRef.current) inputRef.current.focus()
  }, [creating])

  // Adjust menu position to stay in viewport
  useEffect(() => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    if (rect.right > window.innerWidth) {
      menuRef.current.style.left = `${window.innerWidth - rect.width - 8}px`
    }
    if (rect.bottom > window.innerHeight) {
      menuRef.current.style.top = `${window.innerHeight - rect.height - 8}px`
    }
  }, [creating])

  const assignToGroup = async (groupId: number | null) => {
    if (loading) return
    setLoading(true)
    try {
      await fetch(`/api/sessions/${encodeURIComponent(sessionName)}/group`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_key: profileKey, group_id: groupId })
      })
      onDone()
    } catch (err) {
      console.error('Failed to assign group:', err)
    } finally {
      setLoading(false)
      onClose()
    }
  }

  const createAndAssign = async () => {
    if (!newName.trim() || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_key: profileKey, group_name: newName.trim() })
      })
      const data = await res.json()
      if (data.id) {
        await fetch(`/api/sessions/${encodeURIComponent(sessionName)}/group`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile_key: profileKey, group_id: data.id })
        })
        onDone()
      }
    } catch (err) {
      console.error('Failed to create group:', err)
    } finally {
      setLoading(false)
      onClose()
    }
  }

  return (
    <>
      <div className="quick-group-backdrop" onClick={onClose} onTouchEnd={(e) => { e.preventDefault(); onClose() }} />
      <div
        ref={menuRef}
        className="quick-group-menu"
        style={{ left: position.x, top: position.y }}
      >
        <div className="quick-group-title">移动到分组</div>

        {groups.length > 0 && groups.map(g => (
          <button
            key={g.id}
            className={`quick-group-item ${g.id === currentGroupId ? 'current' : ''}`}
            onClick={() => assignToGroup(g.id)}
            disabled={loading || g.id === currentGroupId}
          >
            <FolderInput size={14} />
            <span>{g.group_name}</span>
            {g.id === currentGroupId && <span className="quick-group-check">✓</span>}
          </button>
        ))}

        {currentGroupId !== null && (
          <button
            className="quick-group-item ungroup"
            onClick={() => assignToGroup(null)}
            disabled={loading}
          >
            <FolderMinus size={14} />
            <span>移出分组</span>
          </button>
        )}

        <div className="quick-group-divider" />

        {creating ? (
          <div className="quick-group-create-row">
            <input
              ref={inputRef}
              type="text"
              className="quick-group-input"
              placeholder="分组名称..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') createAndAssign()
                if (e.key === 'Escape') { setCreating(false); setNewName('') }
              }}
              disabled={loading}
            />
            <button
              className="quick-group-confirm"
              onClick={createAndAssign}
              disabled={loading || !newName.trim()}
            >
              ✓
            </button>
          </div>
        ) : (
          <button
            className="quick-group-item create"
            onClick={() => setCreating(true)}
            disabled={loading}
          >
            <FolderPlus size={14} />
            <span>新建分组</span>
          </button>
        )}
      </div>
    </>
  )
}

function useLongPress(callback: (pos: { x: number; y: number }) => void, ms = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const movedRef = useRef(false)
  const firedRef = useRef(false)
  const posRef = useRef({ x: 0, y: 0 })

  const start = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    movedRef.current = false
    firedRef.current = false
    if ('touches' in e && e.touches.length > 0) {
      posRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    } else if ('clientX' in e) {
      posRef.current = { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY }
    }
    timerRef.current = setTimeout(() => {
      if (!movedRef.current) {
        firedRef.current = true
        callback(posRef.current)
      }
    }, ms)
  }, [callback, ms])

  const move = useCallback(() => {
    movedRef.current = true
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const end = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  return { onTouchStart: start, onTouchMove: move, onTouchEnd: end, onMouseDown: start, onMouseMove: move, onMouseUp: end, firedRef }
}

interface SortableSessionProps {
  item: TreeItem
  session: TmuxSession
  isInGroup: boolean
  isOver?: boolean
  statusMap: Record<string, PaneStatus>
  onSelectPane: (paneId: string, paneName: string) => void
  onPaneContextMenu?: (paneKey: string) => void
  onPaneStatusClick?: (paneKey: string) => void
  onRefresh: () => void
  defaultExpanded?: boolean
  groups?: SessionGroup[]
  profileKey?: string
  onGroupChanged?: () => void
}

function SortableSession({ item, session, isInGroup, isOver, statusMap, onSelectPane, onPaneContextMenu, onPaneStatusClick, onRefresh, defaultExpanded = false, groups = [], profileKey = '', onGroupChanged }: SortableSessionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [editingWindowIndex, setEditingWindowIndex] = useState<number | null>(null)
  const [editWindowName, setEditWindowName] = useState('')
  const [quickGroupMenu, setQuickGroupMenu] = useState<{ x: number; y: number } | null>(null)
  const [rebuilding, setRebuilding] = useState(false)

  const handleRebuild = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (rebuilding) return
    if (!confirm(`Rebuild session "${session.sessionName}"? This will kill all processes and recreate windows with the same directories.`)) return
    setRebuilding(true)
    try {
      const res = await fetch(`/api/tmux/sessions/${encodeURIComponent(session.sessionName)}/rebuild`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      if (res.ok) {
        onRefresh()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(`Rebuild failed: ${data.message || 'Unknown error'}`)
      }
    } catch (err) {
      alert(`Rebuild failed: ${err instanceof Error ? err.message : 'Network error'}`)
    } finally {
      setRebuilding(false)
    }
  }, [rebuilding, session.sessionName, onRefresh])

  // Aggregate session-level status from all panes
  const sessionStatus = useMemo(() => {
    let inProgress = 0
    let done = 0
    let failed = 0
    let waiting = 0
    let total = 0
    session.windows.forEach(w => {
      w.panes.forEach(p => {
        const key = buildPaneKey(session.sessionName, w.windowIndex, p.paneId)
        const st = statusMap[key] || 'idle'
        total++
        if (st === 'in_progress') inProgress++
        else if (st === 'done') done++
        else if (st === 'failed') failed++
        else if (st === 'waiting') waiting++
      })
    })
    return { inProgress, done, failed, waiting, total }
  }, [session, statusMap])

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleLongPress = useCallback((pos: { x: number; y: number }) => {
    if (!profileKey || !groups) return
    setQuickGroupMenu(pos)
  }, [profileKey, groups])

  const longPress = useLongPress(handleLongPress, 500)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`session-node ${isDragging ? 'dragging' : ''} ${isOver ? 'drop-target' : ''} ${isInGroup ? 'in-group' : ''}`}
    >
      <div
        className="session-row"
        {...longPress}
      >
        <span {...attributes} {...listeners}>
          <DragHandle />
        </span>
        <button
          className="expand-btn"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        <Terminal size={14} style={{ color: 'var(--blue-500)' }} />
        <span className="session-name">{session.sessionName}</span>
        {(sessionStatus.inProgress > 0 || sessionStatus.done > 0 || sessionStatus.failed > 0 || sessionStatus.waiting > 0) && (
          <span className="session-status-summary">
            {sessionStatus.inProgress > 0 && (
              <span className="session-stat session-stat--progress" title={`${sessionStatus.inProgress} 进行中`}>
                <Loader2 size={10} className="spinning" />
                {sessionStatus.inProgress}
              </span>
            )}
            {sessionStatus.done > 0 && (
              <span className="session-stat session-stat--done" title={`${sessionStatus.done} 已完成`}>
                <CheckCircle2 size={10} />
                {sessionStatus.done}
              </span>
            )}
            {sessionStatus.failed > 0 && (
              <span className="session-stat session-stat--failed" title={`${sessionStatus.failed} 失败`}>
                <XCircle size={10} />
                {sessionStatus.failed}
              </span>
            )}
            {sessionStatus.waiting > 0 && (
              <span className="session-stat session-stat--waiting" title={`${sessionStatus.waiting} 等待中`}>
                <Clock size={10} />
                {sessionStatus.waiting}
              </span>
            )}
          </span>
        )}
        <button
          className="rebuild-btn"
          onClick={handleRebuild}
          disabled={rebuilding}
          title="Rebuild session"
        >
          {rebuilding ? <Loader2 size={12} className="spinning" /> : <RotateCcw size={12} />}
        </button>
      </div>

      {quickGroupMenu && profileKey && (
        <QuickGroupMenu
          sessionName={session.sessionName}
          currentGroupId={item.groupId}
          groups={groups}
          profileKey={profileKey}
          position={quickGroupMenu}
          onClose={() => setQuickGroupMenu(null)}
          onDone={() => { setQuickGroupMenu(null); onGroupChanged?.() }}
        />
      )}

      {expanded && session.windows.map(window => (
        <div key={window.windowId} className="window-node">
          <div className="window-row">
            {editingWindowIndex === window.windowIndex ? (
              <input
                type="text"
                className="window-name-input"
                value={editWindowName}
                onChange={e => setEditWindowName(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Enter' && editWindowName.trim()) {
                    const ok = await renameWindow(session.sessionName, window.windowIndex, editWindowName.trim())
                    if (ok) onRefresh()
                    setEditingWindowIndex(null)
                  }
                  if (e.key === 'Escape') setEditingWindowIndex(null)
                }}
                onBlur={() => setEditingWindowIndex(null)}
                autoFocus
              />
            ) : (
              <>
                <span className="window-name">{window.windowIndex}: {window.windowName}</span>
                <button
                  className="window-rename-btn"
                  onClick={() => {
                    setEditWindowName(window.windowName)
                    setEditingWindowIndex(window.windowIndex)
                  }}
                  title="Rename window"
                >
                  <Pencil size={12} />
                </button>
              </>
            )}
          </div>
          {window.panes.map((pane) => {
            const paneKey = buildPaneKey(session.sessionName, window.windowIndex, pane.paneId)
            const paneStatus = statusMap[paneKey] || 'idle'
            return (
              <div
                key={pane.paneId}
                className="pane-node"
                onClick={() => onSelectPane(pane.paneId, `${session.sessionName}:${window.windowIndex}`)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  onPaneContextMenu?.(paneKey)
                }}
              >
                <span className="pane-id">{pane.paneId}</span>
                <span
                  className="pane-status-clickable"
                  onClick={(e) => {
                    e.stopPropagation()
                    onPaneStatusClick?.(paneKey)
                  }}
                  title="View task history"
                >
                  <StatusBadge status={paneStatus} size="small" />
                </span>
                <span className="pane-cmd">{pane.paneCommand}</span>
                {onPaneContextMenu && (
                  <button
                    className="pane-details-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      onPaneContextMenu(paneKey)
                    }}
                    title="View details"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

interface SortableGroupProps {
  item: TreeItem
  group: SessionGroup
  children: React.ReactNode
  isOver?: boolean
}

function SortableGroup({ item, group, children, isOver }: SortableGroupProps) {
  const [expanded, setExpanded] = useState(true)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group-node ${isDragging ? 'dragging' : ''} ${isOver ? 'drop-target-group' : ''}`}
    >
      <div className="group-row">
        <span {...attributes} {...listeners}>
          <DragHandle />
        </span>
        <button
          className="expand-btn"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        {expanded ? <FolderOpen size={14} style={{ color: 'var(--blue-500)' }} /> : <Folder size={14} style={{ color: 'var(--blue-500)' }} />}
        <span className="group-name">{group.group_name}</span>
        <span className="group-count">{group.session_count}</span>
      </div>

      {expanded && (
        <div className="group-children">
          {children}
        </div>
      )}
    </div>
  )
}

function DragPreview({ item }: { item: TreeItem | null }) {
  if (!item) return null

  if (item.type === 'session' && item.session) {
    return (
      <div className="drag-preview session-preview">
        <DragHandle />
        <ChevronRight size={12} />
        <Terminal size={14} style={{ color: 'var(--blue-500)' }} />
        <span className="session-name">{item.session.sessionName}</span>
      </div>
    )
  }

  if (item.type === 'group' && item.group) {
    return (
      <div className="drag-preview group-preview">
        <DragHandle />
        <ChevronDown size={12} />
        <FolderOpen size={14} style={{ color: 'var(--blue-500)' }} />
        <span className="group-name">{item.group.group_name}</span>
      </div>
    )
  }

  return null
}

export function TmuxTree({
  sessions,
  groups = [],
  profileId,
  profileKey = '',
  onSelectPane,
  onRefresh,
  onOrderChange,
  onPaneContextMenu,
  onPaneStatusClick,
  statusRefreshToken,
  defaultExpanded = false
}: Props) {
  const [sessionOrders, setSessionOrders] = useState<SessionOrder[]>([])
  const [groupOrders, setGroupOrders] = useState<{ id: number; sort_order: number }[]>([])
  const [activeItem, setActiveItem] = useState<TreeItem | null>(null)
  const [overItemId, setOverItemId] = useState<string | null>(null)
  const [statusMap, setStatusMap] = useState<Record<string, PaneStatus>>({})

  useEffect(() => {
    if (!profileId) {
      setSessionOrders([])
      setGroupOrders([])
      return
    }

    fetch(`/api/profiles/${profileId}/order`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) return

        const orders: SessionOrder[] = []

        for (const g of data.groups || []) {
          for (const s of g.sessions || []) {
            orders.push({
              session_name: s.session_name,
              group_id: g.id,
              sort_order: s.sort_order
            })
          }
        }

        for (const s of data.ungrouped || []) {
          orders.push({
            session_name: s.session_name,
            group_id: null,
            sort_order: s.sort_order
          })
        }

        setSessionOrders(orders)

        setGroupOrders((data.groups || []).map((g: { id: number; sort_order: number }) => ({
          id: g.id,
          sort_order: g.sort_order
        })))
      })
      .catch(err => console.error('Failed to fetch order:', err))
  }, [profileId, groups])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const allPaneKeys = useMemo(() => {
    const keys: string[] = []
    sessions.forEach((session) => {
      session.windows.forEach((window) => {
        window.panes.forEach((pane) => {
          keys.push(buildPaneKey(session.sessionName, window.windowIndex, pane.paneId))
        })
      })
    })
    return keys
  }, [sessions])

  const buildStatusMap = async () => {
    // Start with pane process statuses
    const paneItems = profileKey && allPaneKeys.length > 0
      ? await fetchPaneStatuses(profileKey, allPaneKeys)
      : []
    const map: Record<string, PaneStatus> = {}
    paneItems.forEach((s) => { map[s.paneKey] = s.status })
    // Overlay with AI task statuses (take priority over idle)
    const taskMap = await fetchTaskPaneStatuses()
    for (const [key, status] of Object.entries(taskMap)) {
      if (!map[key] || map[key] === 'idle' || status === 'in_progress') {
        map[key] = status
      }
    }
    setStatusMap(map)
  }

  useEffect(() => {
    buildStatusMap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileKey, allPaneKeys, statusRefreshToken])

  // Auto-poll pane + task statuses every 10 seconds
  useEffect(() => {
    if (!profileKey && allPaneKeys.length === 0) return
    const interval = setInterval(() => {
      buildStatusMap()
    }, 10000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileKey, allPaneKeys])

  const treeItems = useMemo(() => {
    const groupOrderMap = new Map(groupOrders.map(o => [o.id, o.sort_order]))
    const sortedGroups = [...groups].sort((a, b) => {
      const aOrder = groupOrderMap.get(a.id) ?? a.sort_order
      const bOrder = groupOrderMap.get(b.id) ?? b.sort_order
      return aOrder - bOrder
    })
    const orderMap = new Map(sessionOrders.map(o => [o.session_name, o]))

    const ungroupedSessions = sessions.filter(s => {
      const order = orderMap.get(s.sessionName)
      return !order || order.group_id === null
    }).map((s, idx) => {
      const order = orderMap.get(s.sessionName)
      return {
        id: `session-${s.sessionName}`,
        type: 'session' as const,
        session: s,
        groupId: null,
        sortOrder: order?.sort_order ?? idx * 10
      }
    }).sort((a, b) => a.sortOrder - b.sortOrder)

    const allRootItems: TreeItem[] = [
      ...ungroupedSessions,
      ...sortedGroups.map(g => ({
        id: `group-${g.id}`,
        type: 'group' as const,
        group: g,
        groupId: null,
        sortOrder: groupOrderMap.get(g.id) ?? g.sort_order
      }))
    ].sort((a, b) => a.sortOrder - b.sortOrder)

    return { rootItems: allRootItems, orderMap }
  }, [sessions, groups, sessionOrders, groupOrders])

  const getGroupSessions = (groupId: number): TreeItem[] => {
    return sessions
      .filter(s => {
        const order = treeItems.orderMap.get(s.sessionName)
        return order?.group_id === groupId
      })
      .map((s, idx) => {
        const order = treeItems.orderMap.get(s.sessionName)
        return {
          id: `session-${s.sessionName}`,
          type: 'session' as const,
          session: s,
          groupId,
          sortOrder: order?.sort_order ?? idx * 10
        }
      })
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const id = active.id as string

    let item = treeItems.rootItems.find(i => i.id === id)
    if (!item) {
      for (const g of groups) {
        const groupSessions = getGroupSessions(g.id)
        item = groupSessions.find(i => i.id === id)
        if (item) break
      }
    }

    setActiveItem(item || null)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event
    setOverItemId(over?.id as string | null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    setActiveItem(null)
    setOverItemId(null)

    if (!over || active.id === over.id) return

    const activeId = active.id as string
    const overId = over.id as string

    const isActiveSession = activeId.startsWith('session-')
    const isActiveGroup = activeId.startsWith('group-')
    const isOverSession = overId.startsWith('session-')
    const isOverGroup = overId.startsWith('group-')

    let foundActiveItem = treeItems.rootItems.find(i => i.id === activeId)
    if (!foundActiveItem) {
      for (const g of groups) {
        const groupSessions = getGroupSessions(g.id)
        foundActiveItem = groupSessions.find(i => i.id === activeId)
        if (foundActiveItem) break
      }
    }

    let overItem = treeItems.rootItems.find(i => i.id === overId)
    if (!overItem) {
      for (const g of groups) {
        const groupSessions = getGroupSessions(g.id)
        overItem = groupSessions.find(i => i.id === overId)
        if (overItem) break
      }
    }

    if (!foundActiveItem || !overItem) return

    const newSessionOrders = [...sessionOrders]
    const newGroupOrders = [...groupOrders]
    const activeSessionName = foundActiveItem.session?.sessionName

    if (isActiveSession && activeSessionName) {
      let orderEntry = newSessionOrders.find(o => o.session_name === activeSessionName)
      if (!orderEntry) {
        orderEntry = { session_name: activeSessionName, group_id: foundActiveItem.groupId, sort_order: 0 }
        newSessionOrders.push(orderEntry)
      }

      if (isOverGroup) {
        const targetGroupId = parseInt(overId.replace('group-', ''))
        orderEntry.group_id = targetGroupId
        orderEntry.sort_order = 0
      } else if (isOverSession) {
        orderEntry.group_id = overItem.groupId
        orderEntry.sort_order = overItem.sortOrder + (foundActiveItem.sortOrder < overItem.sortOrder ? 1 : -1)
      }

      setSessionOrders(newSessionOrders)
    }

    if (isActiveGroup && foundActiveItem.group) {
      const activeGroupId = foundActiveItem.group.id
      let groupOrder = newGroupOrders.find(g => g.id === activeGroupId)
      if (!groupOrder) {
        groupOrder = { id: activeGroupId, sort_order: foundActiveItem.sortOrder }
        newGroupOrders.push(groupOrder)
      }

      if (isOverGroup || isOverSession) {
        const overSortOrder = overItem.sortOrder
        groupOrder.sort_order = overSortOrder + (foundActiveItem.sortOrder < overSortOrder ? 1 : -1)
      }

      setGroupOrders(newGroupOrders)
    }

    const orderData: OrderData = {
      groups: groups.map((g) => {
        const order = newGroupOrders.find(o => o.id === g.id)
        return {
          id: g.id,
          sort_order: order?.sort_order ?? g.sort_order
        }
      }),
      sessions: newSessionOrders.length > 0 ? newSessionOrders : sessions.map((s, idx) => ({
        session_name: s.sessionName,
        group_id: null,
        sort_order: idx * 10
      }))
    }

    try {
      if (profileId !== undefined) {
        await saveOrder(profileId, orderData)
      }
      onOrderChange?.()
    } catch (err) {
      console.error('Failed to save order:', err)
    }
  }

  const allSortableIds = useMemo(() => {
    const ids = treeItems.rootItems.map(i => i.id)
    for (const g of groups) {
      const groupSessions = getGroupSessions(g.id)
      ids.push(...groupSessions.map(s => s.id))
    }
    return ids
  }, [treeItems.rootItems, groups])

  const taskStats = useMemo(() => {
    const values = Object.values(statusMap)
    return {
      inProgress: values.filter(s => s === 'in_progress').length,
      done: values.filter(s => s === 'done').length,
      failed: values.filter(s => s === 'failed').length,
      waiting: values.filter(s => s === 'waiting').length,
      total: values.length
    }
  }, [statusMap])

  return (
    <div className="tmux-tree">
      <div className="tree-header">
        <span>Sessions</span>
        <div className="task-stats">
          {taskStats.inProgress > 0 && (
            <span className="task-stat task-stat--progress">
              <Loader2 size={10} className="spinning" />
              {taskStats.inProgress} 进行中
            </span>
          )}
          {taskStats.done > 0 && (
            <span className="task-stat task-stat--done">
              <CheckCircle2 size={10} />
              {taskStats.done} 已完成
            </span>
          )}
          {taskStats.failed > 0 && (
            <span className="task-stat task-stat--failed">
              <XCircle size={10} />
              {taskStats.failed} 失败
            </span>
          )}
          {taskStats.waiting > 0 && (
            <span className="task-stat task-stat--waiting">
              <Clock size={10} />
              {taskStats.waiting} 等待中
            </span>
          )}
        </div>
        <button onClick={onRefresh} className="refresh-btn" title="Refresh">
          <RefreshCw size={12} />
        </button>
        <NewTmuxButton sessions={sessions} onCreated={onRefresh} />
      </div>

      {sessions.length === 0 && groups.length === 0 && (
        <div className="empty">No sessions</div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={allSortableIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="tree-content">
            {treeItems.rootItems.map(item => {
              if (item.type === 'group' && item.group) {
                const groupSessions = getGroupSessions(item.group.id)
                return (
                  <SortableGroup
                    key={item.id}
                    item={item}
                    group={item.group}
                    isOver={overItemId === item.id}
                  >
                    {groupSessions.length === 0 ? (
                      <div className="group-empty-drop">Drop sessions here</div>
                    ) : (
                      groupSessions.map(sessionItem => (
                        <SortableSession
                          key={sessionItem.id}
                          item={sessionItem}
                          session={sessionItem.session!}
                          isInGroup={true}
                          isOver={overItemId === sessionItem.id}
                          statusMap={statusMap}
                          onSelectPane={onSelectPane}
                          onPaneContextMenu={onPaneContextMenu}
                          onPaneStatusClick={onPaneStatusClick}
                          onRefresh={onRefresh}
                          defaultExpanded={defaultExpanded}
                          groups={groups}
                          profileKey={profileKey}
                          onGroupChanged={onOrderChange}
                        />
                      ))
                    )}
                  </SortableGroup>
                )
              }

              if (item.type === 'session' && item.session) {
                return (
                  <SortableSession
                    key={item.id}
                    item={item}
                    session={item.session}
                    isInGroup={false}
                    isOver={overItemId === item.id}
                    statusMap={statusMap}
                    onSelectPane={onSelectPane}
                    onPaneContextMenu={onPaneContextMenu}
                    onPaneStatusClick={onPaneStatusClick}
                    onRefresh={onRefresh}
                    defaultExpanded={defaultExpanded}
                    groups={groups}
                    profileKey={profileKey}
                    onGroupChanged={onOrderChange}
                  />
                )
              }

              return null
            })}
          </div>
        </SortableContext>

        <DragOverlay>
          <DragPreview item={activeItem} />
        </DragOverlay>
      </DndContext>
    </div>
  )
}
