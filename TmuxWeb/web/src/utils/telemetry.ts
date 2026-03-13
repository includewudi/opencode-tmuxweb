/**
 * iOS-only telemetry for debugging phantom input issues
 * Only active when debug mode is enabled
 */

import { isIOS } from './platform'

export type TelemetryEventType = 
  | 'focus'
  | 'blur'
  | 'visibilitychange'
  | 'reconnect'
  | 'viewport-resize'
  | 'onData'
  | 'suppressed'
  | 'dec1004-disable'

export interface TelemetryEvent {
  type: TelemetryEventType
  timestamp: number
  data?: Record<string, unknown>
}

const MAX_EVENTS = 50
const SAMPLE_RATE = 10 // Log 1 in 10 for high-frequency events like onData

class TelemetryRingBuffer {
  private events: TelemetryEvent[] = []
  private sampleCounters: Map<TelemetryEventType, number> = new Map()

  add(event: TelemetryEvent): void {
    this.events.push(event)
    if (this.events.length > MAX_EVENTS) {
      this.events.shift()
    }
  }

  getRecent(count: number = MAX_EVENTS): TelemetryEvent[] {
    return this.events.slice(-count)
  }

  shouldSample(type: TelemetryEventType): boolean {
    // High-frequency events get sampled
    if (type === 'onData') {
      const count = (this.sampleCounters.get(type) ?? 0) + 1
      this.sampleCounters.set(type, count)
      return count % SAMPLE_RATE === 0
    }
    // Low-frequency events always log
    return true
  }

  clear(): void {
    this.events = []
    this.sampleCounters.clear()
  }
}

const buffer = new TelemetryRingBuffer()

/**
 * Check if debug mode is enabled
 * - localStorage: tmux-debug === '1'
 * - URL param: ?debug=1
 */
export function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  
  // Check localStorage
  try {
    if (localStorage.getItem('tmux-debug') === '1') {
      return true
    }
  } catch {
    // localStorage may be unavailable
  }
  
  // Check URL param
  const params = new URLSearchParams(window.location.search)
  if (params.get('debug') === '1') {
    return true
  }
  
  return false
}

/**
 * Log a telemetry event (iOS only, debug mode only)
 * Samples high-frequency events to avoid spam
 */
export function log(type: TelemetryEventType, data?: Record<string, unknown>): void {
  // Only log on iOS when debug enabled
  if (!isIOS() || !isDebugEnabled()) return
  
  const event: TelemetryEvent = {
    type,
    timestamp: Date.now(),
    data,
  }

  // Check sampling for high-frequency events
  if (!buffer.shouldSample(type)) {
    buffer.add(event) // Still store, just don't console.log
    return
  }

  buffer.add(event)

  // Structured console output
  const prefix = `[Telemetry:${type}]`
  if (data) {
    console.log(prefix, JSON.stringify(data))
  } else {
    console.log(prefix)
  }
}

/**
 * Get recent telemetry events for debugging
 */
export function getRecentEvents(count?: number): TelemetryEvent[] {
  return buffer.getRecent(count)
}

/**
 * Clear telemetry buffer
 */
export function clearEvents(): void {
  buffer.clear()
}

/**
 * Export telemetry to console as JSON (for debugging)
 */
export function dumpTelemetry(): void {
  const events = buffer.getRecent()
  console.log('[Telemetry] Recent events:', JSON.stringify(events, null, 2))
}

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).tmuxTelemetry = {
    getRecent: getRecentEvents,
    dump: dumpTelemetry,
    clear: clearEvents,
    isEnabled: isDebugEnabled,
  }
}
