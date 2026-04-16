import { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { getToken } from '../../../utils/auth'
import 'xterm/css/xterm.css'

interface EphemeralTerminalProps {
  cwd: string
}

export function EphemeralTerminal({ cwd }: EphemeralTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sessionRef = useRef<{ sessionName: string; paneId: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let term: XTerm | null = null
    let fit: FitAddon | null = null
    let ws: WebSocket | null = null
    let disposed = false

    const clientId = Math.random().toString(36).slice(2)

    async function init() {
      try {
        const res = await fetch('/api/ephemeral-terminal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ cwd }),
        })
        if (!res.ok) {
          const data = await res.json()
          setError(data.message || 'Failed to create terminal session')
          return
        }
        const { sessionName, paneId } = await res.json()
        if (disposed) {
          fetch(`/api/ephemeral-terminal/${sessionName}`, { method: 'DELETE', credentials: 'include' })
          return
        }
        sessionRef.current = { sessionName, paneId }

        term = new XTerm({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: 'Menlo, Monaco, monospace',
          theme: { background: '#1e1e1e', foreground: '#d4d4d4' },
        })
        term.options.allowProposedApi = true

        fit = new FitAddon()
        term.loadAddon(fit)
        term.open(container!)
        fit.fit()

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const token = getToken()
        ws = new WebSocket(
          `${protocol}//${window.location.host}/ws/terminal?paneId=${encodeURIComponent(paneId)}&token=${token}&clientId=${clientId}`
        )
        ws.binaryType = 'arraybuffer'

        ws.onopen = () => {
          if (term && fit) {
            ws!.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
          }
        }

        ws.onmessage = (event) => {
          if (term) {
            if (event.data instanceof ArrayBuffer) {
              term.write(new Uint8Array(event.data))
            } else {
              term.write(event.data)
            }
          }
        }

        term.onData((data) => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(data)
          }
        })

        const ro = new ResizeObserver(() => {
          if (fit && term) {
            fit.fit()
            if (ws?.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
            }
          }
        })
        ro.observe(container!)

        return () => ro.disconnect()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    }

    const initPromise = init()

    return () => {
      disposed = true
      initPromise.then((cleanup) => {
        ws?.close()
        term?.dispose()
        cleanup?.()
        if (sessionRef.current) {
          fetch(`/api/ephemeral-terminal/${sessionRef.current.sessionName}`, {
            method: 'DELETE',
            credentials: 'include',
          }).catch(() => {})
          sessionRef.current = null
        }
      })
    }
  }, [cwd])

  if (error) {
    return (
      <div style={{ padding: 16, color: '#f87171', fontFamily: 'monospace', fontSize: 13 }}>
        Error: {error}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  )
}
