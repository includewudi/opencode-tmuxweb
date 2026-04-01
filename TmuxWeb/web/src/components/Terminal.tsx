import { useEffect, useRef, useCallback } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { getToken } from '../utils/auth'
import { isIOS, isAndroid, isMobile } from '../utils/platform'
import { log as telemetryLog, isDebugEnabled } from '../utils/telemetry'
import { useKeyboardAvoider } from '../hooks/useKeyboardAvoider'
import { VoiceInput } from '../shared/components/VoiceInput'
import { AccessoryBar } from './AccessoryBar'
import { Maximize2 } from 'lucide-react'
import 'xterm/css/xterm.css'
import './Terminal.css'

const DEC_1004_DISABLE = '\x1b[?1004l'
const BURST_SUPPRESSION_WINDOW_MS = 200  // Increased from 50ms
const SUPPRESSED_INPUTS = new Set([' ', '\r', '\n'])
const ACCESSORY_BAR_HEIGHT = 44
// Consecutive space detection - if we see N spaces in M ms, it is phantom
const SPACE_BURST_COUNT = 3
const SPACE_BURST_WINDOW_MS = 500
const ENTER_BURST_COUNT = 2
const ENTER_BURST_WINDOW_MS = 500
// Unique per page load — used by server to evict stale connections (prevents ghost text)
const CLIENT_ID = Math.random().toString(36).slice(2)

interface Props {
  paneId: string
  active: boolean
  onSendRef?: (sendFn: (text: string) => void) => void
}

export function Terminal({ paneId, active, onSendRef }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)
  const isCleanupRef = useRef(false)

  const lastTransitionRef = useRef<{ type: 'reconnect' | 'visibility' | 'keyboard', time: number } | null>(null)

  const showAccessoryBar = isMobile()
  // Get keyboard metrics but don't use containerStyle (we use spacer-based layout instead)
  const { keyboardHeightPx, keyboardVisible, keyboardSpacerHeightPx } = useKeyboardAvoider(
    showAccessoryBar,
    showAccessoryBar ? ACCESSORY_BAR_HEIGHT : 0
  )

  const sendText = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(text)
    }
  }, [])

  useEffect(() => {
    onSendRef?.(sendText)
  }, [onSendRef, sendText])

  useEffect(() => {
    if (!containerRef.current) return
    isCleanupRef.current = false

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4'
      }
    })

    term.options.allowProposedApi = true

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)
    fit.fit()

    const textarea = containerRef.current.querySelector('textarea')
    if (textarea) {
      textarea.setAttribute('autocapitalize', 'off')
      textarea.setAttribute('autocorrect', 'off')
      textarea.setAttribute('spellcheck', 'false')
      textarea.setAttribute('autocomplete', 'off')
    }

    termRef.current = term
    fitRef.current = fit

    const buildWsUrl = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const token = getToken()
      return `${protocol}//${window.location.host}/ws/terminal?paneId=${encodeURIComponent(paneId)}&token=${token}&clientId=${CLIENT_ID}`
    }

    const connect = () => {
      if (isCleanupRef.current) return

      const ws = new WebSocket(buildWsUrl())
      ws.binaryType = 'arraybuffer'
      ws.onopen = () => {
        const wasReconnect = reconnectAttemptRef.current > 0
        reconnectAttemptRef.current = 0

        // Send resize on open. Also schedule a delayed check: if dims changed
        // since the first send (e.g., layout settled), send again. Skip if same
        // to avoid causing tools like gemini CLI to unnecessarily redraw.
        const getSize = () => termRef.current ? { cols: termRef.current.cols, rows: termRef.current.rows } : null
        const firstSize = getSize()
        if (firstSize && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', ...firstSize }))
        }
        setTimeout(() => {
          const size = getSize()
          if (size && ws.readyState === WebSocket.OPEN &&
            (size.cols !== firstSize?.cols || size.rows !== firstSize?.rows)) {
            ws.send(JSON.stringify({ type: 'resize', ...size }))
          }
        }, 300)

        if (isIOS()) {
          ws.send(DEC_1004_DISABLE)
          telemetryLog('dec1004-disable', { trigger: 'onopen' })

          if (wasReconnect) {
            lastTransitionRef.current = { type: 'reconnect', time: Date.now() }
            telemetryLog('reconnect', { timestamp: Date.now() })
          }
        }
      }

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          termRef.current?.write(new Uint8Array(event.data))
        } else {
          termRef.current?.write(event.data)
        }
      }

      ws.onerror = () => {
        termRef.current?.write('\r\n\x1b[33m[Connection error]\x1b[0m\r\n')
      }

      ws.onclose = () => {
        if (isCleanupRef.current) return

        termRef.current?.write('\r\n\x1b[33m[Disconnected - reconnecting...]\x1b[0m\r\n')
        scheduleReconnect()
      }

      wsRef.current = ws
    }

    const scheduleReconnect = () => {
      if (isCleanupRef.current) return
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }

      // Exponential backoff: 1s, 2s, 4s, 8s, max 10s
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 10000)
      reconnectAttemptRef.current++

      reconnectTimeoutRef.current = window.setTimeout(() => {
        if (!isCleanupRef.current) {
          connect()
        }
      }, delay)
    }

    // Handle page visibility for iOS PWA
    const handleVisibilityChange = () => {
      telemetryLog('visibilitychange', { state: document.visibilityState })

      if (document.visibilityState === 'visible') {
        if (isIOS()) {
          lastTransitionRef.current = { type: 'visibility', time: Date.now() }
        }

        if (wsRef.current?.readyState !== WebSocket.OPEN && wsRef.current?.readyState !== WebSocket.CONNECTING) {
          termRef.current?.write('\r\n\x1b[36m[Resuming connection...]\x1b[0m\r\n')
          reconnectAttemptRef.current = 0
          connect()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    let lastInputData = ''
    let lastInputTime = 0
    const spaceTimestamps: number[] = []
    const enterTimestamps: number[] = []

    const shouldSuppressBurstIOS = (data: string, now: number): boolean => {
      // iOS: space burst detection
      if (data === ' ') {
        spaceTimestamps.push(now)
        while (spaceTimestamps.length > 0 && now - spaceTimestamps[0] > SPACE_BURST_WINDOW_MS) {
          spaceTimestamps.shift()
        }
        if (spaceTimestamps.length >= SPACE_BURST_COUNT) {
          telemetryLog('suppressed', {
            data: JSON.stringify(data),
            reason: 'space-burst',
            count: spaceTimestamps.length
          })
          spaceTimestamps.length = 0
          return true
        }
      }

      // iOS: enter burst detection
      if (data === '\r' || data === '\n') {
        enterTimestamps.push(now)
        while (enterTimestamps.length > 0 && now - enterTimestamps[0] > ENTER_BURST_WINDOW_MS) {
          enterTimestamps.shift()
        }
        if (enterTimestamps.length >= ENTER_BURST_COUNT) {
          telemetryLog('suppressed', {
            data: JSON.stringify(data),
            reason: 'enter-burst',
            count: enterTimestamps.length
          })
          enterTimestamps.length = 0
          return true
        }
      }

      // iOS: post-transition suppression (reconnect, visibility, keyboard)
      if (!SUPPRESSED_INPUTS.has(data)) return false
      const transition = lastTransitionRef.current
      if (!transition) return false
      const elapsed = now - transition.time
      if (elapsed < BURST_SUPPRESSION_WINDOW_MS) {
        telemetryLog('suppressed', {
          data: JSON.stringify(data),
          transitionType: transition.type,
          elapsed
        })
        return true
      }
      return false
    }

    const shouldSuppressBurstAndroid = (data: string, now: number): boolean => {
      // Android: space burst detection
      if (data === ' ') {
        spaceTimestamps.push(now)
        while (spaceTimestamps.length > 0 && now - spaceTimestamps[0] > SPACE_BURST_WINDOW_MS) {
          spaceTimestamps.shift()
        }
        if (spaceTimestamps.length >= SPACE_BURST_COUNT) {
          telemetryLog('suppressed', {
            data: JSON.stringify(data),
            reason: 'space-burst',
            count: spaceTimestamps.length
          })
          spaceTimestamps.length = 0
          return true
        }
      }

      // Android: enter burst detection
      if (data === '\r' || data === '\n') {
        enterTimestamps.push(now)
        while (enterTimestamps.length > 0 && now - enterTimestamps[0] > ENTER_BURST_WINDOW_MS) {
          enterTimestamps.shift()
        }
        if (enterTimestamps.length >= ENTER_BURST_COUNT) {
          telemetryLog('suppressed', {
            data: JSON.stringify(data),
            reason: 'enter-burst',
            count: enterTimestamps.length
          })
          enterTimestamps.length = 0
          return true
        }
      }

      return false
    }

    const shouldSuppressBurst = (data: string): boolean => {
      const now = Date.now()
      if (isIOS()) return shouldSuppressBurstIOS(data, now)
      if (isAndroid()) return shouldSuppressBurstAndroid(data, now)
      return false
    }

    term.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        if (data === '\x1b[I' || data === '\x1b[O' ||
          (data.startsWith('\x1b[?') && data.endsWith('c')) ||
          (data.startsWith('\x1b[>') && data.endsWith('c')) ||
          data.startsWith('\x1b]')) {
          console.log('[Terminal] Filtered control sequence:', JSON.stringify(data))
          return
        }

        if (shouldSuppressBurst(data)) {
          return
        }

        const now = Date.now()

        if (data === lastInputData && (now - lastInputTime) < 50) {
          console.log('[Terminal] Dropped duplicate input')
          return
        }
        lastInputData = data
        lastInputTime = now

        telemetryLog('onData', { data: JSON.stringify(data), len: data.length })
        wsRef.current.send(data)
      }
    })

    // Initial connection
    connect()

    const handleFocus = () => telemetryLog('focus', { timestamp: Date.now() })
    const handleBlur = () => telemetryLog('blur', { timestamp: Date.now() })

    if (isIOS() && isDebugEnabled()) {
      term.textarea?.addEventListener('focus', handleFocus)
      term.textarea?.addEventListener('blur', handleBlur)
    }

    let viewportCleanup: (() => void) | undefined
    if (isIOS() && window.visualViewport) {
      const handleViewportResize = () => {
        lastTransitionRef.current = { type: 'keyboard', time: Date.now() }
        telemetryLog('viewport-resize', {
          height: window.visualViewport?.height,
          width: window.visualViewport?.width,
        })
      }
      window.visualViewport.addEventListener('resize', handleViewportResize)
      viewportCleanup = () => window.visualViewport?.removeEventListener('resize', handleViewportResize)
    }

    let lastCols = 0
    let lastRows = 0

    const handleResize = () => {
      if (!fitRef.current || !termRef.current) return

      fitRef.current.fit()

      const cols = termRef.current.cols
      const rows = termRef.current.rows

      if (cols !== lastCols || rows !== lastRows) {
        lastCols = cols
        lastRows = rows
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }))
        }
      }
    }

    let resizeTimeout: number | null = null
    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimeout) clearTimeout(resizeTimeout)
      resizeTimeout = window.setTimeout(handleResize, 150)
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      isCleanupRef.current = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      term.textarea?.removeEventListener('focus', handleFocus)
      term.textarea?.removeEventListener('blur', handleBlur)
      viewportCleanup?.()
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }
      resizeObserver.disconnect()
      wsRef.current?.close()
      term.dispose()
    }
  }, [paneId])

  useEffect(() => {
    if (active && fitRef.current) {
      setTimeout(() => {
        fitRef.current?.fit()
        const textarea = containerRef.current?.querySelector('textarea')
        console.log('[Terminal] Active effect:', { active, activeElement: document.activeElement?.tagName, isTextarea: document.activeElement === textarea })
        if (textarea && document.activeElement !== textarea) {
          console.log('[Terminal] Calling focus()')
          termRef.current?.focus()
        }
      }, 50)
    }
  }, [active])

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        sendText(text)
      }
    } catch {
      console.log('[Terminal] Clipboard access denied')
    }
  }, [sendText])

  const handleFitWindow = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && termRef.current && fitRef.current) {
      fitRef.current.fit()
      const cols = termRef.current.cols
      const rows = termRef.current.rows
      wsRef.current.send(JSON.stringify({ type: "fit-window", cols, rows }))
    }
  }, [])


  return (
    <div
      className="terminal-wrapper"
      data-keyboard-visible={showAccessoryBar ? keyboardVisible : undefined}
      data-keyboard-height={showAccessoryBar ? keyboardHeightPx : undefined}
      data-keyboard-spacer-height={showAccessoryBar ? keyboardSpacerHeightPx : undefined}
    >
      <div
        ref={containerRef}
        className="terminal-container"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
      <div className="terminal-toolbar">
        <button
          className="fit-window-btn"
          onClick={handleFitWindow}
          title="撑满当前终端"
        >
          <Maximize2 size={14} />
          <span>撑满</span>
        </button>
        <VoiceInput onText={sendText} />
      </div>
      {showAccessoryBar && (
        <AccessoryBar onSendText={sendText} onPaste={handlePaste} />
      )}
      {showAccessoryBar && (
        <div
          className="keyboard-spacer"
          style={{ height: keyboardSpacerHeightPx }}
        />
      )}
    </div>
  )
}
