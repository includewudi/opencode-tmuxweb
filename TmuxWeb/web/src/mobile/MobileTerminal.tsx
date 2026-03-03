import { useState, useEffect, useRef, useCallback } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { getToken } from '../utils/auth'
import { isIOS, isAndroid } from '../utils/platform'
import { log as telemetryLog } from '../utils/telemetry'
import { createTelemetryEmitter, type TelemetryEmitter } from '../utils/telemetryEmitter'
import { MobileToolbox } from './MobileToolbox'
import { VoiceInputHandle } from '../shared/components/VoiceInput'
import { Maximize2 } from 'lucide-react'
import 'xterm/css/xterm.css'

const DEC_1004_DISABLE = '\x1b[?1004l'
const LONG_PRESS_MS = 650
const LONG_PRESS_MOVE_TOLERANCE = 10
const BURST_SUPPRESSION_WINDOW_MS = 200
const SUPPRESSED_INPUTS = new Set([' ', '\r', '\n'])
const SPACE_BURST_COUNT = 3
const SPACE_BURST_WINDOW_MS = 500
const ENTER_BURST_COUNT = 2
const ENTER_BURST_WINDOW_MS = 500
const SCROLL_THRESHOLD = 20
const MAX_RECONNECT_ATTEMPTS = 3
// 每个页面加载唯一 ID，用于服务端驱逐旧的 WS 连接（消除重影）
const CLIENT_ID = Math.random().toString(36).slice(2)

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
  taskHistoryPaneKey?: string | null
  onStatusChange?: () => void
}

export function MobileTerminal({ paneId, fontSize, onFontSizeChange, voiceRef, taskHistoryPaneKey, onStatusChange }: Props) {
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
  const selectOverlayRef = useRef<HTMLDivElement | null>(null)

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
        .catch(() => { })
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
    let longPressTimer: number | null = null
    let longPressStartX = 0
    let longPressStartY = 0

    const cancelLongPress = () => {
      if (longPressTimer !== null) {
        clearTimeout(longPressTimer)
        longPressTimer = null
      }
    }

    const showSelectionOverlay = () => {
      const container = containerRef.current
      const term = termRef.current
      if (!container || !term) return

      // Read visible buffer as plain text
      const buf = term.buffer.active
      const lines: string[] = []
      const start = Math.max(0, buf.viewportY)
      const end = start + term.rows
      for (let i = start; i < end; i++) {
        const line = buf.getLine(i)
        if (line) lines.push(line.translateToString(true))
      }
      // Trim trailing empty lines
      while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop()
      const text = lines.join('\n')
      if (!text) return

      // Create opaque overlay with plain text
      const overlay = document.createElement('div')
      overlay.className = 'select-mode-overlay'

      // Toolbar at top
      const toolbar = document.createElement('div')
      toolbar.className = 'select-mode-toolbar'
      const copyBtn = document.createElement('button')
      copyBtn.className = 'select-mode-btn select-mode-copy-btn'
      copyBtn.textContent = '\u590D\u5236\u5E76\u9000\u51FA'
      const exitBtn = document.createElement('button')
      exitBtn.className = 'select-mode-btn select-mode-exit-btn'
      exitBtn.textContent = '\u9000\u51FA'
      toolbar.appendChild(copyBtn)
      toolbar.appendChild(exitBtn)
      overlay.appendChild(toolbar)

      // Plain text content area
      const textArea = document.createElement('pre')
      textArea.className = 'select-mode-text'
      textArea.textContent = text
      overlay.appendChild(textArea)

      // Copy handler
      copyBtn.addEventListener('touchend', async (ev) => {
        ev.preventDefault()
        ev.stopPropagation()
        const sel = window.getSelection()?.toString()
        if (sel) {
          try {
            await navigator.clipboard.writeText(sel)
          } catch {
            const ta = document.createElement('textarea')
            ta.value = sel
            ta.style.cssText = 'position:fixed;left:-9999px'
            document.body.appendChild(ta)
            ta.select()
            document.execCommand('copy')
            document.body.removeChild(ta)
          }
          // Show '已复制' feedback for 2 seconds
          copyBtn.textContent = '已复制 ✓'
          copyBtn.classList.add('select-mode-copied')
          setTimeout(() => hideSelectionOverlay(), 2000)
          return
        }
        hideSelectionOverlay()
      })

      // Exit handler
      exitBtn.addEventListener('touchend', (ev) => {
        ev.preventDefault()
        ev.stopPropagation()
        hideSelectionOverlay()
      })

      container.style.position = 'relative'
      container.appendChild(overlay)
      selectOverlayRef.current = overlay
    }

    const hideSelectionOverlay = () => {
      const overlay = selectOverlayRef.current
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay)
      }
      selectOverlayRef.current = null
      window.getSelection()?.removeAllRanges()
    }
    const onTouchStart = (e: TouchEvent) => {
      const prevGesture = gesture
      if (e.touches.length === 2) {
        gesture = 'twoFingerScroll'
        cancelLongPress()
        e.preventDefault()
        e.stopPropagation()
        twoFingerStartY = (e.touches[0].clientY + e.touches[1].clientY) / 2
        twoFingerAccum = 0
      } else if (e.touches.length === 1 && gesture === 'idle') {
        gesture = 'oneFinger'
        // Start long-press timer
        longPressStartX = e.touches[0].clientX
        longPressStartY = e.touches[0].clientY
        longPressTimer = window.setTimeout(() => {
          longPressTimer = null
          showSelectionOverlay()
        }, LONG_PRESS_MS)
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
      // Cancel long-press if finger moved too far
      if (longPressTimer !== null && e.touches.length === 1) {
        const dx = e.touches[0].clientX - longPressStartX
        const dy = e.touches[0].clientY - longPressStartY
        if (Math.sqrt(dx * dx + dy * dy) > LONG_PRESS_MOVE_TOLERANCE) {
          cancelLongPress()
        }
      }
      if (gesture === 'oneFinger' && e.touches.length === 2) {
        gesture = 'twoFingerScroll'
        cancelLongPress()
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
      cancelLongPress()
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
      return `${protocol}//${window.location.host}/ws/terminal?paneId=${encodeURIComponent(paneId)}&token=${token}&clientId=${CLIENT_ID}`
    }

    const connect = () => {
      if (isCleanupRef.current) return
      // Clear any manual reconnect listener
      manualReconnectDisposable.current?.dispose()
      manualReconnectDisposable.current = null

      const ws = new WebSocket(buildWsUrl())
      ws.binaryType = 'arraybuffer'
      ws.onopen = () => {
        const wasReconnect = reconnectAttemptRef.current > 0
        reconnectAttemptRef.current = 0
        if (termRef.current) {
          ws.send(JSON.stringify({ type: 'resize', cols: termRef.current.cols, rows: termRef.current.rows }))
        }
        // 重连成功：清除上一行的断线提示
        if (wasReconnect) {
          termRef.current?.write('\r\x1b[2K\x1b[32m[已重连]\x1b[0m\r\n')
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
        if (event.data instanceof ArrayBuffer) {
          termRef.current?.write(new Uint8Array(event.data))
        } else {
          termRef.current?.write(event.data)
        }
      }

      ws.onerror = () => {
        termRef.current?.write('\r\n\x1b[33m[Connection error]\x1b[0m\r\n')
      }

      // WS 断线重连：指数退避，最多 MAX_RECONNECT_ATTEMPTS 次
      ws.onclose = () => {
        if (isCleanupRef.current || intentionalCloseRef.current) return
        reconnectAttemptRef.current += 1
        const attempt = reconnectAttemptRef.current
        if (attempt <= MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 16000) // 1s,2s,4s,8s,16s
          termRef.current?.write(`\r\n\x1b[33m[连接断开，${Math.round(delay / 1000)}s 后重连 (${attempt}/${MAX_RECONNECT_ATTEMPTS})...]\x1b[0m`)
          reconnectTimeoutRef.current = window.setTimeout(() => {
            if (!isCleanupRef.current && !intentionalCloseRef.current) connect()
          }, delay)
        } else {
          termRef.current?.write('\r\n\x1b[31m[重连失败]\x1b[0m \x1b[33m按任意键重连，或关闭重新打开\x1b[0m\r\n')
          if (termRef.current) {
            manualReconnectDisposable.current = termRef.current.onData(() => {
              manualReconnectDisposable.current?.dispose()
              manualReconnectDisposable.current = null
              reconnectAttemptRef.current = 0
              connect()
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

        // 先取消 pending 的重连 timer，防止和下面的立即重连形成双重连接
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
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
          emitter.emit('mobile-suppress', {
            reason: 'space-burst',
            data: JSON.stringify(data),
            count: spaceTimestamps.length,
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
          emitter.emit('mobile-suppress', {
            reason: 'enter-burst',
            data: JSON.stringify(data),
            count: enterTimestamps.length,
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
          emitter.emit('mobile-suppress', {
            reason: 'space-burst',
            data: JSON.stringify(data),
            count: spaceTimestamps.length,
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
          emitter.emit('mobile-suppress', {
            reason: 'enter-burst',
            data: JSON.stringify(data),
            count: enterTimestamps.length,
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
      cancelLongPress()
      hideSelectionOverlay()
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

  const handleFitWindow = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && termRef.current && fitRef.current) {
      fitRef.current.fit()
      const cols = termRef.current.cols
      const rows = termRef.current.rows
      wsRef.current.send(JSON.stringify({ type: "fit-window", cols, rows }))
    }
  }, [])


  return (
    <div className="mobile-terminal-wrapper">
      <div className="mobile-terminal-area">
        <div ref={containerRef} className="mobile-terminal-container" />
        <button
          className="mobile-fit-window-btn"
          onClick={handleFitWindow}
          title="撑满当前终端"
        >
          <Maximize2 size={12} />
          <span>撑满</span>
        </button>
      </div>
      <MobileToolbox
        onSend={sendText}
        disabled={false}
        fontSize={fontSize}
        onFontSizeChange={onFontSizeChange}
        voiceRef={voiceRef}
        keyboardMode={showKeyboard}
        onToggleKeyboard={toggleKeyboard}
        taskHistoryPaneKey={taskHistoryPaneKey}
        onStatusChange={onStatusChange}
      />
    </div>
  )
}
