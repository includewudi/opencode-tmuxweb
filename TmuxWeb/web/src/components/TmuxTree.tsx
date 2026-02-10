import { useState, useMemo, useEffect } from 'react'
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
  Terminal, 
  ChevronRight, 
  ChevronDown, 
  GripVertical, 
  Folder,
  FolderOpen,
  RefreshCw,
  MoreHorizontal,
  Pencil
} from 'lucide-react'
import { TmuxSession, SessionGroup, PaneStatus, PaneStatusInfo } from '../types'
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
  statusRefreshToken?: number
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
  const res = await fetch(
    `/api/panes/status?profile_key=${encodeURIComponent(profileKey)}&paneKeys=${paneKeys.join(',')}`,
    { credentials: 'include' }
  )
  if (!res.ok) return []
  const data = await res.json()
  return data.panes || []
}

function buildPaneKey(sessionName: string, windowIndex: number, paneIndex: number): string {
  return `${sessionName}:${windowIndex}:${paneIndex}`
}

function DragHandle() {
  return (
    <span className="drag-handle" aria-label="Drag to reorder">
      <GripVertical size={14} />
    </span>
  )
}

interface SortableSessionProps {
  item: TreeItem
  session: TmuxSession
  isInGroup: boolean
  isOver?: boolean
  statusMap: Record<string, PaneStatus>
  onSelectPane: (paneId: string, paneName: string) => void
  onPaneContextMenu?: (paneKey: string) => void
  onRefresh: () => void
}

function SortableSession({ item, session, isInGroup, isOver, statusMap, onSelectPane, onPaneContextMenu, onRefresh }: SortableSessionProps) {
  const [expanded, setExpanded] = useState(false)
  const [editingWindowIndex, setEditingWindowIndex] = useState<number | null>(null)
  const [editWindowName, setEditWindowName] = useState('')
  
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
      className={`session-node ${isDragging ? 'dragging' : ''} ${isOver ? 'drop-target' : ''} ${isInGroup ? 'in-group' : ''}`}
    >
      <div className="session-row">
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
      </div>
      
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
          {window.panes.map((pane, paneIndex) => {
            const paneKey = buildPaneKey(session.sessionName, window.windowIndex, paneIndex)
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
                <StatusBadge status={paneStatus} size="small" />
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
  statusRefreshToken
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
  }, [profileId])
  
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
        window.panes.forEach((_, paneIndex) => {
          keys.push(buildPaneKey(session.sessionName, window.windowIndex, paneIndex))
        })
      })
    })
    return keys
  }, [sessions])

  useEffect(() => {
    if (!profileKey || allPaneKeys.length === 0) return

    fetchPaneStatuses(profileKey, allPaneKeys).then((items) => {
      const map: Record<string, PaneStatus> = {}
      items.forEach((s) => {
        map[s.paneKey] = s.status
      })
      setStatusMap(map)
    })
  }, [profileKey, allPaneKeys, statusRefreshToken])

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
  
  return (
    <div className="tmux-tree">
      <div className="tree-header">
        <span>Sessions</span>
        <button onClick={onRefresh} className="refresh-btn" title="Refresh">
          <RefreshCw size={14} />
        </button>
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
                          onRefresh={onRefresh}
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
                    onRefresh={onRefresh}
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
