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
  return res.json()
}

function buildPaneKey(sessionName: string, windowIndex: number, paneIndex: number): string {
  return `${sessionName}:${windowIndex}:${paneIndex}`
}

function DragHandle() {
  return (
    <span className="drag-handle" aria-label="Drag to reorder">
      ⋮⋮
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
}

function SortableSession({ item, session, isInGroup, isOver, statusMap, onSelectPane }: SortableSessionProps) {
  const [expanded, setExpanded] = useState(false)
  
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
          {expanded ? '▼' : '▶'}
        </button>
        <span className="session-name">{session.sessionName}</span>
      </div>
      
      {expanded && session.windows.map(window => (
        <div key={window.windowId} className="window-node">
          <div className="window-name">{window.windowIndex}: {window.windowName}</div>
          {window.panes.map((pane, paneIndex) => {
            const paneKey = buildPaneKey(session.sessionName, window.windowIndex, paneIndex)
            const paneStatus = statusMap[paneKey] || 'idle'
            return (
              <div
                key={pane.paneId}
                className="pane-node"
                onClick={() => onSelectPane(pane.paneId, `${session.sessionName}:${window.windowIndex}`)}
              >
                <span className="pane-id">{pane.paneId}</span>
                <StatusBadge status={paneStatus} size="small" />
                <span className="pane-cmd">{pane.paneCommand}</span>
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
          {expanded ? '▼' : '▶'}
        </button>
        <span className="group-name">[{group.group_name}]</span>
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
        <span className="expand-btn">▶</span>
        <span className="session-name">{item.session.sessionName}</span>
      </div>
    )
  }
  
  if (item.type === 'group' && item.group) {
    return (
      <div className="drag-preview group-preview">
        <DragHandle />
        <span className="expand-btn">▼</span>
        <span className="group-name">[{item.group.group_name}]</span>
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
  onOrderChange 
}: Props) {
  const [sessionOrders, setSessionOrders] = useState<SessionOrder[]>([])
  const [activeItem, setActiveItem] = useState<TreeItem | null>(null)
  const [overItemId, setOverItemId] = useState<string | null>(null)
  const [statusMap, setStatusMap] = useState<Record<string, PaneStatus>>({})
  
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

    fetchPaneStatuses(profileKey, allPaneKeys).then((statuses) => {
      const map: Record<string, PaneStatus> = {}
      statuses.forEach((s) => {
        map[s.paneKey] = s.status
      })
      setStatusMap(map)
    })
  }, [profileKey, allPaneKeys])

  const treeItems = useMemo(() => {
    const sortedGroups = [...groups].sort((a, b) => a.sort_order - b.sort_order)
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
        sortOrder: g.sort_order
      }))
    ].sort((a, b) => a.sortOrder - b.sortOrder)
    
    return { rootItems: allRootItems, orderMap }
  }, [sessions, groups, sessionOrders])
  
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
    
    const orderData: OrderData = {
      groups: groups.map((g, idx) => ({
        id: g.id,
        sort_order: treeItems.rootItems.findIndex(i => i.id === `group-${g.id}`) * 10 || idx * 10
      })),
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
        <button onClick={onRefresh} className="refresh-btn">↻</button>
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
