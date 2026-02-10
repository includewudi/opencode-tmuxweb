import { useEffect, useRef, useCallback } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { getToken } from '../utils/auth'
import { isIOS } from '../utils/platform'
import { log as telemetryLog } from '../utils/telemetry'
import { createTelemetryEmitter, type TelemetryEmitter } from '../utils/telemetryEmitter'
import { useKeyboardAvoider } from '../hooks/useKeyboardAvoider'
import { MobileToolbar } from './MobileToolbar'
import 'xterm/css/xterm.css'

const DEC_1004_DISABLE = '\x1b[?1004l'
const BURST_SUPPRESSION_WINDOW_MS = 200
const SUPPRESSED_INPUTS = new Set([' ', '\r', '\n'])
const SPACE_BURST_COUNT = 3
const SPACE_BURST_WINDOW_MS = 500
const TOOLBAR_HEIGHT = 48

interface Props {
  paneId: string
}

export function MobileTerminal({ paneId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)
  const isCleanupRef = useRef(false)
  const lastTransitionRef = useRef<{ type: 'reconnect' | 'visibility' | 'keyboard', time: number } | null>(null)
  const emitterRef = useRef<TelemetryEmitter | null>(null)

  const { keyboardSpacerHeightPx } = useKeyboardAvoider(true, TOOLBAR_HEIGHT)

  const sendText = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(text)
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current) return
    isCleanupRef.current = false

    const emitter = createTelemetryEmitter(paneId)
    emitterRef.current = emitter

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
      const backendPort = window.location.port === '5215' ? '8215' : window.location.port
      const host = window.location.hostname
      const wsHost = backendPort ? `${host}:${backendPort}` : host
      const token = getToken()
      return `${protocol}//${wsHost}/ws/terminal?paneId=${encodeURIComponent(paneId)}&token=${token}`
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
            emitter.emit('mobile-transition', { kind: 'reconnect' })
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
      
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 10000)
      reconnectAttemptRef.current++
      
      reconnectTimeoutRef.current = window.setTimeout(() => {
        if (!isCleanupRef.current) {
          connect()
        }
      }, delay)
    }

    const handleVisibilityChange = () => {
      telemetryLog('visibilitychange', { state: document.visibilityState })
      emitter.emit('mobile-transition', { kind: 'visibility', state: document.visibilityState })
      
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

    const spaceTimestamps: number[] = []
    
    const shouldSuppressBurst = (data: string): boolean => {
      if (!isIOS()) return false
      
      const now = Date.now()
      
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
          emitter.emit('mobile-suppress', {
            reason: 'space-burst',
            data: JSON.stringify(data),
            count: spaceTimestamps.length,
          })
          spaceTimestamps.length = 0
          return true
        }
      }
      
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
        emitter.emit('mobile-suppress', {
          reason: 'post-transition',
          data: JSON.stringify(data),
          transitionType: transition.type,
          elapsed,
        })
        return true
      }
      return false
    }

    let lastInputData = ''
    let lastInputTime = 0
    
    term.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        if (data === '\x1b[I' || data === '\x1b[O' ||
            (data.startsWith('\x1b[?') && data.endsWith('c')) ||
            (data.startsWith('\x1b[>') && data.endsWith('c')) ||
            data.startsWith('\x1b]')) {
          return
        }
        
        if (shouldSuppressBurst(data)) {
          return
        }
        
        const now = Date.now()
        if (data === lastInputData && (now - lastInputTime) < 50) {
          return
        }
        lastInputData = data
        lastInputTime = now
        
        telemetryLog('onData', { data: JSON.stringify(data), len: data.length })
        emitter.emit('mobile-onData', {
          data: JSON.stringify(data),
          len: data.length,
          wsReadyState: wsRef.current.readyState,
        })
        wsRef.current.send(data)
      }
    })

    connect()

    let viewportCleanup: (() => void) | undefined
    if (isIOS() && window.visualViewport) {
      const handleViewportResize = () => {
        lastTransitionRef.current = { type: 'keyboard', time: Date.now() }
        telemetryLog('viewport-resize', { 
          height: window.visualViewport?.height,
          width: window.visualViewport?.width,
        })
        emitter.emit('mobile-transition', {
          kind: 'keyboard',
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
      emitter.destroy()
      emitterRef.current = null
      document.removeEventListener('visibilitychange', handleVisibilityChange)
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
    if (fitRef.current) {
      setTimeout(() => {
        fitRef.current?.fit()
        termRef.current?.focus()
      }, 50)
    }
  }, [keyboardSpacerHeightPx])

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        sendText(text)
      }
    } catch {
      console.log('[MobileTerminal] Clipboard access denied')
    }
  }, [sendText])

  return (
    <div className="mobile-terminal-wrapper">
      <div ref={containerRef} className="mobile-terminal-container" />
      <MobileToolbar onSendText={sendText} onPaste={handlePaste} />
      <div className="mobile-keyboard-spacer" style={{ height: keyboardSpacerHeightPx }} />
    </div>
  )
}
