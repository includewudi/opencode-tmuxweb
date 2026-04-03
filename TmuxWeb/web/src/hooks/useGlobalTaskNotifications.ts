import { useEffect, useRef, useCallback, useState } from 'react'

export interface TaskNotification {
  id: string
  type: 'task_started' | 'task_completed' | 'task_failed' | 'task_waiting'
  paneKey: string
  conversationId: string
  userMessage: string
  assistantMessage: string
  timestamp: number
  startedAt: number
}

const DISMISS_MS: Record<string, number> = {
  task_started: 30_000,
  task_completed: 8_000,
  task_failed: 10_000,
  task_waiting: 12_000,
}

export function useGlobalTaskNotifications() {
  const [notifications, setNotifications] = useState<TaskNotification[]>([])
  const eventSourceRef = useRef<EventSource | null>(null)
  const idCounterRef = useRef(0)
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const clearTimer = useCallback((id: string) => {
    const t = timersRef.current.get(id)
    if (t) {
      clearTimeout(t)
      timersRef.current.delete(id)
    }
  }, [])

  const scheduleDismiss = useCallback((id: string, ms: number) => {
    clearTimer(id)
    timersRef.current.set(id, setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
      timersRef.current.delete(id)
    }, ms))
  }, [clearTimer])

  const dismissNotification = useCallback((id: string) => {
    clearTimer(id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [clearTimer])

  useEffect(() => {
    const es = new EventSource('/api/tasks/events/stream')
    eventSourceRef.current = es

    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data)
        const validTypes = ['task_started', 'task_completed', 'task_failed', 'task_waiting']
        if (!validTypes.includes(data.type)) return

        const conversationId = data.conversation_id || ''
        const ts = data.timestamp || Math.floor(Date.now() / 1000)

        setNotifications(prev => {
          const idx = conversationId ? prev.findIndex(n => n.conversationId === conversationId) : -1

          if (idx >= 0) {
            const updated = [...prev]
            const old = updated[idx]
            updated[idx] = {
              ...old,
              type: data.type,
              timestamp: ts,
              userMessage: data.user_message || old.userMessage,
              assistantMessage: data.assistant_message || old.assistantMessage,
            }
            scheduleDismiss(old.id, DISMISS_MS[data.type] ?? 8000)
            return updated
          }

          const id = `toast-${++idCounterRef.current}`
          scheduleDismiss(id, DISMISS_MS[data.type] ?? 8000)
          return [...prev, {
            id,
            type: data.type,
            paneKey: data.pane_key || '',
            conversationId,
            userMessage: data.user_message || '',
            assistantMessage: data.assistant_message || '',
            timestamp: ts,
            startedAt: ts,
          }]
        })
      } catch (err) {
        console.error('[useGlobalTaskNotifications] parse error:', err)
      }
    }

    es.onerror = () => {
      console.warn('[useGlobalTaskNotifications] SSE error, will auto-reconnect')
    }

    return () => {
      es.close()
      eventSourceRef.current = null
      for (const t of timersRef.current.values()) clearTimeout(t)
      timersRef.current.clear()
    }
  }, [scheduleDismiss])

  return { notifications, dismissNotification }
}
