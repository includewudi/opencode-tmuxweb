import { isDebugEnabled } from './telemetry'

export type MobileTelemetryEventType =
  | 'mobile-onData'
  | 'mobile-suppress'
  | 'mobile-transition'
  | 'touch-start'
  | 'touch-move'
  | 'touch-end'
  | 'touch-scroll'
  | 'touch-click-blocked'
  | 'touch-gesture-info'

export interface MobileTelemetryEvent {
  ts: number
  event: MobileTelemetryEventType
  paneId: string
  [key: string]: unknown
}

const FLUSH_INTERVAL_MS = 1000
const FLUSH_BATCH_SIZE = 50

function getEndpointUrl(): string {
  return `${window.location.origin}/api/telemetry?debug=1`
}

function postEvents(events: MobileTelemetryEvent[]): void {
  if (events.length === 0) return
  try {
    fetch(getEndpointUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // noop
  }
}

function postEventsBeacon(events: MobileTelemetryEvent[]): void {
  if (events.length === 0) return
  try {
    navigator.sendBeacon(
      getEndpointUrl(),
      new Blob([JSON.stringify({ events })], { type: 'application/json' })
    )
  } catch {
    // noop
  }
}

export interface TelemetryEmitter {
  emit(event: MobileTelemetryEventType, meta?: Record<string, unknown>): void
  flush(): void
  destroy(): void
}

export function createTelemetryEmitter(paneId: string): TelemetryEmitter {
  if (!isDebugEnabled()) {
    return { emit: () => {}, flush: () => {}, destroy: () => {} }
  }

  let batch: MobileTelemetryEvent[] = []
  let timer: ReturnType<typeof setInterval> | null = null

  const flush = () => {
    if (batch.length === 0) return
    const toSend = batch
    batch = []
    postEvents(toSend)
  }

  const flushBeacon = () => {
    if (batch.length === 0) return
    const toSend = batch
    batch = []
    postEventsBeacon(toSend)
  }

  timer = setInterval(flush, FLUSH_INTERVAL_MS)

  const handleVisibilityChange = () => {
    if (document.hidden) flushBeacon()
  }

  const handleBeforeUnload = () => {
    flushBeacon()
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('beforeunload', handleBeforeUnload)

  const emit = (event: MobileTelemetryEventType, meta?: Record<string, unknown>) => {
    const entry: MobileTelemetryEvent = {
      ts: Date.now(),
      event,
      paneId,
      ...meta,
    }

    if (typeof entry.data === 'string' && entry.data.length > 100) {
      entry.data = (entry.data as string).substring(0, 100) + '...[truncated]'
    }

    batch.push(entry)

    if (batch.length >= FLUSH_BATCH_SIZE) {
      flush()
    }
  }

  const destroy = () => {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('beforeunload', handleBeforeUnload)
    flushBeacon()
  }

  return { emit, flush, destroy }
}
