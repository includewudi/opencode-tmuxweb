import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { getToken } from '../utils/auth'
import 'xterm/css/xterm.css'
import './Terminal.css'

interface Props {
  paneId: string
  active: boolean
}

export function Terminal({ paneId, active }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4'
      }
    })

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)
    fit.fit()

    termRef.current = term
    fitRef.current = fit

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws/terminal?paneId=${encodeURIComponent(paneId)}&token=${getToken()}`
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
    }

    ws.onmessage = (event) => {
      term.write(event.data)
    }

    ws.onclose = () => {
      term.write('\r\n[Connection closed]\r\n')
    }

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data)
      }
    })

    wsRef.current = ws

    const handleResize = () => {
      if (fitRef.current && termRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
        fitRef.current.fit()
        wsRef.current.send(JSON.stringify({
          type: 'resize',
          cols: termRef.current.cols,
          rows: termRef.current.rows
        }))
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      setTimeout(handleResize, 100)
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      ws.close()
      term.dispose()
    }
  }, [paneId])

  useEffect(() => {
    if (active && fitRef.current) {
      setTimeout(() => {
        fitRef.current?.fit()
        termRef.current?.focus()
      }, 50)
    }
  }, [active])

  return <div ref={containerRef} className="terminal-container" />
}
