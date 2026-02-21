import { useState, useEffect, useRef, useCallback } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { getToken } from '../utils/auth'
import { isIOS } from '../utils/platform'
import { log as telemetryLog } from '../utils/telemetry'
import { createTelemetryEmitter, type TelemetryEmitter } from '../utils/telemetryEmitter'
import { MobileToolbox } from './MobileToolbox'
import { VoiceInputHandle } from '../components/VoiceInput'
import 'xterm/css/xterm.css'

const DEC_1004_DISABLE = '\x1b[?1004l'
const BURST_SUPPRESSION_WINDOW_MS = 200
const SUPPRESSED_INPUTS = new Set([' ', '\r', '\n'])
const SPACE_BURST_COUNT = 3
const SPACE_BURST_WINDOW_MS = 500
const SCROLL_THRESHOLD = 20

const TERMINAL_THEME = {
  background: '#0f1115',
  foreground: '#abb2bf',
  cursor: '#4d78cc',
  selectionBackground: 'rgba(77, 120, 204, 0.3)',
  black: '#1e2127',
  red: '#e06c75',
  green: '#98c379',
  yellow: '#d19a66',
  blue: '#61afef',
  magenta: '#c678dd',
  cyan: '#56b6c2',
  white: '#abb2bf',
}

interface Props {
  paneId: string
  fontSize: number
  onFontSizeChange: (size: number) => void
  voiceRef?: React.RefObject<VoiceInputHandle | null>
}

export function MobileTerminal({ paneId, fontSize, onFontSizeChange, voiceRef }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)
  const isCleanupRef = useRef(false)
  const lastTransitionRef = useRef<{ type: 'reconnect' | 'visibility' | 'keyboard', time: number } | null>(null)
  const emitterRef = useRef<TelemetryEmitter | null>(null)
  const intentionalCloseRef = useRef(false)
  const manualReconnectDisposable = useRef<{ dispose: () => void } | null>(null)
  const [showKeyboard, setShowKeyboard] = useState(false)

  const sendText = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(text)
    }
  }, [])

  const toggleKeyboard = useCallback(() => {
    setShowKeyboard(prev => {
      const next = !prev
      if (next) {
        // Entering keyboard mode — focus the xterm textarea
        const textarea = document.querySelector('.xterm-helper-textarea') as HTMLTextAreaElement | null
        textarea?.focus()
      }
      return next
    })
  }, [])

  // Update terminal font size when prop changes
  useEffect(() => {
    if (termRef.current && fitRef.current) {
      termRef.current.options.fontSize = fontSize
      // iOS fit retries: immediate + 100ms + 300ms
      fitRef.current.fit()
      setTimeout(() => fitRef.current?.fit(), 100)
      setTimeout(() => {
        fitRef.current?.fit()
        if (wsRef.current?.readyState === WebSocket.OPEN && termRef.current) {
          wsRef.current.send(JSON.stringify({
            type: 'resize',
            cols: termRef.current.cols,
            rows: termRef.current.rows,
          }))
        }
      }, 300)
    }
  }, [fontSize])

  useEffect(() => {
    if (!containerRef.current) return
    isCleanupRef.current = false
    intentionalCloseRef.current = false

    const emitter = createTelemetryEmitter(paneId)
    emitterRef.current = emitter

    const term = new XTerm({
      cursorBlink: true,
      fontSize,
      fontFamily: 'Menlo, Monaco, monospace',
      theme: TERMINAL_THEME,
      scrollback: 5000,
      lineHeight: 1.2,
      drawBoldTextInBrightColors: true,
      cursorStyle: 'bar',
    })

    term.options.allowProposedApi = true

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)
    // iOS fit retries
    fit.fit()
    setTimeout(() => fit.fit(), 100)
    setTimeout(() => fit.fit(), 300)

    const textarea = containerRef.current.querySelector('textarea')
    if (textarea) {
      textarea.setAttribute('autocapitalize', 'off')
      textarea.setAttribute('autocorrect', 'off')
      textarea.setAttribute('spellcheck', 'false')
      textarea.setAttribute('autocomplete', 'off')
    }

    termRef.current = term
    fitRef.current = fit

    let paneInAltScreen = false

    const checkPaneMode = () => {
      const token = getToken()
      fetch(`/api/tmux/pane-mode?paneId=${encodeURIComponent(paneId)}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include',
      })
        .then(r => r.json())
        .then(data => { paneInAltScreen = !!(data.alternate_on && data.mouse_any_flag) })
        .catch(() => {})
    }
    checkPaneMode()
    const paneModeInterval = setInterval(checkPaneMode, 5000)

    const sendScroll = (lines: number) => {
      if (lines === 0 || wsRef.current?.readyState !== WebSocket.OPEN) return
      const count = Math.min(Math.abs(lines), 10)
      // Always use SGR mouse wheel events — works both in normal mode
      // and alt-screen (tmux mouse on handles it). Arrow keys get eaten
      // by TUI input fields like opencode's prompt.
      const cols = termRef.current?.cols ?? 80
      const rows = termRef.current?.rows ?? 24
      const cx = Math.floor(cols / 2)
      const cy = Math.floor(rows / 2)
      const button = lines > 0 ? 65 : 64
      for (let i = 0; i < count; i++) {
        wsRef.current!.send(`\x1b[<${button};${cx};${cy}M`)
      }
    }

    type GestureState = 'idle' | 'oneFinger' | 'twoFingerScroll'
    let gesture: GestureState = 'idle'
    let twoFingerStartY = 0
    let twoFingerAccum = 0
    let clickBlockedUntil = 0

    const onTouchStart = (e: TouchEvent) => {
      const prevGesture = gesture
      if (e.touches.length === 2) {
        gesture = 'twoFingerScroll'
        e.preventDefault()
        e.stopPropagation()
        twoFingerStartY = (e.touches[0].clientY + e.touches[1].clientY) / 2
        twoFingerAccum = 0
      } else if (e.touches.length === 1 && gesture === 'idle') {
        gesture = 'oneFinger'
      }
      emitter.emit('touch-start', {
        touches: e.touches.length,
        prevGesture,
        newGesture: gesture,
        prevented: e.touches.length === 2,
        y0: e.touches[0]?.clientY,
        y1: e.touches[1]?.clientY,
      })
    }

    const onTouchMove = (e: TouchEvent) => {
      if (gesture === 'oneFinger' && e.touches.length === 2) {
        gesture = 'twoFingerScroll'
        e.preventDefault()
        e.stopPropagation()
        twoFingerStartY = (e.touches[0].clientY + e.touches[1].clientY) / 2
        twoFingerAccum = 0
        emitter.emit('touch-move', { upgrade: true, from: 'oneFinger', touches: 2 })
        return
      }
      if (gesture === 'twoFingerScroll' && e.touches.length >= 2) {
        e.preventDefault()
        e.stopPropagation()
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2
        const deltaY = twoFingerStartY - midY
        twoFingerAccum += deltaY
        twoFingerStartY = midY
        const lines = Math.trunc(twoFingerAccum / SCROLL_THRESHOLD)
        if (lines !== 0) {
          twoFingerAccum -= lines * SCROLL_THRESHOLD
          sendScroll(lines)
          emitter.emit('touch-scroll', {
            lines,
            deltaY: Math.round(deltaY),
            accum: Math.round(twoFingerAccum),
            altScreen: paneInAltScreen,
          })
        }
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      const prevGesture = gesture
      if (gesture === 'twoFingerScroll') {
        e.preventDefault()
        e.stopPropagation()
        if (e.touches.length === 0) {
          clickBlockedUntil = Date.now() + 300
          gesture = 'idle'
        }
      } else if (gesture === 'oneFinger' && e.touches.length === 0) {
        gesture = 'idle'
      }
      emitter.emit('touch-end', {
        prevGesture,
        newGesture: gesture,
        remainingTouches: e.touches.length,
        prevented: prevGesture === 'twoFingerScroll',
      })
    }

    const onClickBlock = (e: MouseEvent) => {
      if (Date.now() < clickBlockedUntil) {
        e.preventDefault()
        e.stopPropagation()
        emitter.emit('touch-click-blocked', { ttl: clickBlockedUntil - Date.now() })
      }
    }

    const termContainer = containerRef.current
    const xtermScreen = termContainer.querySelector('.xterm-screen') as HTMLElement | null
    const touchTarget = xtermScreen || termContainer
    touchTarget.addEventListener('touchstart', onTouchStart, { capture: true, passive: false })
    touchTarget.addEventListener('touchmove', onTouchMove, { capture: true, passive: false })
    touchTarget.addEventListener('touchend', onTouchEnd, { capture: true, passive: false })
    touchTarget.addEventListener('touchcancel', onTouchEnd, { capture: true, passive: false })
    touchTarget.addEventListener('click', onClickBlock, { capture: true })
    emitter.emit('touch-gesture-info', {
      msg: 'gesture-listeners-bound',
      targetTag: touchTarget.tagName,
      targetClass: touchTarget.className,
      isXtermScreen: !!xtermScreen,
    })

    const buildWsUrl = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const token = getToken()
      return `${protocol}//${window.location.host}/ws/terminal?paneId=${encodeURIComponent(paneId)}&token=${token}`
    }

    const connect = () => {
      if (isCleanupRef.current) return
      // Clear any manual reconnect listener
      manualReconnectDisposable.current?.dispose()
      manualReconnectDisposable.current = null

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

      // WS reconnect: 2s retry once, then press-any-key-to-reload
      ws.onclose = () => {
        if (isCleanupRef.current || intentionalCloseRef.current) return
        reconnectAttemptRef.current += 1
        if (reconnectAttemptRef.current <= 1) {
          termRef.current?.write('\r\n\x1b[33m[连接断开，2秒后重连...]\x1b[0m\r\n')
          reconnectTimeoutRef.current = window.setTimeout(() => {
            if (!isCleanupRef.current && !intentionalCloseRef.current) connect()
          }, 2000)
        } else {
          termRef.current?.write('\r\n\x1b[31m[重连失败]\x1b[0m \x1b[33m按任意键刷新页面\x1b[0m\r\n')
          if (termRef.current) {
            manualReconnectDisposable.current = termRef.current.onData(() => {
              window.location.reload()
            })
          }
        }
      }

      wsRef.current = ws
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
      intentionalCloseRef.current = true
      emitter.destroy()
      emitterRef.current = null
      manualReconnectDisposable.current?.dispose()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      viewportCleanup?.()
      clearInterval(paneModeInterval)
      touchTarget.removeEventListener('touchstart', onTouchStart, true)
      touchTarget.removeEventListener('touchmove', onTouchMove, true)
      touchTarget.removeEventListener('touchend', onTouchEnd, true)
      touchTarget.removeEventListener('touchcancel', onTouchEnd, true)
      touchTarget.removeEventListener('click', onClickBlock, true)
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

  return (
    <div className="mobile-terminal-wrapper">
      <div ref={containerRef} className="mobile-terminal-container" />
      <MobileToolbox
        onSend={sendText}
        disabled={false}
        fontSize={fontSize}
        onFontSizeChange={onFontSizeChange}
        voiceRef={voiceRef}
        keyboardMode={showKeyboard}
        onToggleKeyboard={toggleKeyboard}
      />
    </div>
  )
}
