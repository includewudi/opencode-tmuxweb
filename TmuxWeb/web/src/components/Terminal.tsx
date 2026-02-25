import { useEffect, useRef, useCallback } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { getToken } from '../utils/auth'
import { isIOS, isMobile } from '../utils/platform'
import { log as telemetryLog, isDebugEnabled } from '../utils/telemetry'
import { useKeyboardAvoider } from '../hooks/useKeyboardAvoider'
import { VoiceInput } from '../shared/components/VoiceInput'
import { AccessoryBar } from './AccessoryBar'
import 'xterm/css/xterm.css'
import './Terminal.css'

const DEC_1004_DISABLE = '\x1b[?1004l'
const BURST_SUPPRESSION_WINDOW_MS = 200  // Increased from 50ms
const SUPPRESSED_INPUTS = new Set([' ', '\r', '\n'])
const ACCESSORY_BAR_HEIGHT = 44
// Consecutive space detection - if we see N spaces in M ms, it's phantom
const SPACE_BURST_COUNT = 3
const SPACE_BURST_WINDOW_MS = 500

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
      return `${protocol}//${window.location.host}/ws/terminal?paneId=${encodeURIComponent(paneId)}&token=${token}`
    }

    const connect = () => {
      if (isCleanupRef.current) return
      
      const ws = new WebSocket(buildWsUrl())

      ws.onopen = () => {
        const wasReconnect = reconnectAttemptRef.current > 0
        reconnectAttemptRef.current = 0
        if (termRef.current) {
          ws.send(JSON.stringify({ type: 'resize', cols: termRef.current.cols, rows: termRef.current.rows }))
        }
        
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
        termRef.current?.write(event.data)
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
    
    const shouldSuppressBurst = (data: string): boolean => {
      if (!isIOS()) return false
      
      const now = Date.now()
      
      // Track space timestamps for burst detection
      if (data === ' ') {
        spaceTimestamps.push(now)
        // Keep only recent timestamps
        while (spaceTimestamps.length > 0 && now - spaceTimestamps[0] > SPACE_BURST_WINDOW_MS) {
          spaceTimestamps.shift()
        }
        // If we see too many spaces in the window, it's phantom input
        if (spaceTimestamps.length >= SPACE_BURST_COUNT) {
          telemetryLog('suppressed', { 
            data: JSON.stringify(data), 
            reason: 'space-burst',
            count: spaceTimestamps.length
          })
          spaceTimestamps.length = 0  // Reset after suppression
          return true
        }
      }
      
      // Transition-based suppression (reconnect, visibility, keyboard)
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
