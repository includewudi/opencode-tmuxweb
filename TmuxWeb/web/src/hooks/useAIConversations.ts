import { useState, useEffect, useCallback, useRef } from 'react'
import { AiConversation } from '../types'

export function useAIConversations(paneKey: string | null) {
  const [conversations, setConversations] = useState<AiConversation[]>([])
  const [loading, setLoading] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  const fetchConversations = useCallback(async () => {
    if (!paneKey) return
    setLoading(true)
    try {
      const res = await fetch(`/api/tasks/events/${encodeURIComponent(paneKey)}`, {
        credentials: 'include'
      })
      const data = await res.json()
      setConversations(data.conversations || [])
    } catch (err) {
      console.error('Failed to fetch AI conversations:', err)
    } finally {
      setLoading(false)
    }
  }, [paneKey])

  useEffect(() => {
    if (!paneKey) {
      setConversations([])
      return
    }

    fetchConversations()

    const es = new EventSource(`/api/tasks/events/stream/${encodeURIComponent(paneKey)}`)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (['task_started', 'task_completed', 'task_failed', 'task_waiting'].includes(data.type)) {
          fetchConversations()
        }
      } catch (err) {
        console.error('Failed to parse SSE event:', err)
      }
    }

    es.onerror = () => {
      console.warn('[useAIConversations] SSE connection error, will auto-reconnect')
    }

    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [paneKey, fetchConversations])

  return { conversations, loading, refetch: fetchConversations }
}
