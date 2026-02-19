import { useState, useEffect } from 'react'

interface TmuxPrefix {
  code: string
  label: string
}

export function useTmuxPrefix(): TmuxPrefix {
  const [prefix, setPrefix] = useState<TmuxPrefix>({ code: '\x02', label: 'Ctrl+B' })

  useEffect(() => {
    fetch('/api/tmux/config', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.code) setPrefix({ code: data.code, label: data.label || 'prefix' })
      })
      .catch(() => {})
  }, [])

  return prefix
}
