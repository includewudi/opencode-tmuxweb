import { useEffect, useCallback, useRef } from 'react'
import { TmuxSession } from '../types'

interface NavigateToPaneDetail {
  paneKey: string
}

type OpenPaneFn = (paneId: string, paneName: string) => void

/**
 * Resolves a pane_key (session name like "im-bot-server") to a concrete
 * paneId + paneName by searching the live sessions tree, then calls openPane.
 *
 * Also listens for the global 'navigate-to-pane' CustomEvent so any component
 * can trigger navigation without prop-drilling.
 */
export function usePaneNavigation(
  sessions: TmuxSession[],
  openPane: OpenPaneFn
) {
  const sessionsRef = useRef(sessions)
  sessionsRef.current = sessions

  const openPaneRef = useRef(openPane)
  openPaneRef.current = openPane

  const navigateToPane = useCallback((paneKey: string) => {
    const currentSessions = sessionsRef.current
    const session = currentSessions.find(s => s.sessionName === paneKey)
    if (!session || session.windows.length === 0) {
      console.warn(`[usePaneNavigation] Session "${paneKey}" not found in tree`)
      return false
    }

    const window = session.windows[0]
    if (!window.panes || window.panes.length === 0) {
      console.warn(`[usePaneNavigation] Session "${paneKey}" has no panes`)
      return false
    }

    const pane = window.panes[0]
    const paneName = `${session.sessionName}:${window.windowIndex}`
    openPaneRef.current(pane.paneId, paneName)
    return true
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<NavigateToPaneDetail>).detail
      if (detail?.paneKey) {
        navigateToPane(detail.paneKey)
      }
    }

    window.addEventListener('navigate-to-pane', handler)
    return () => window.removeEventListener('navigate-to-pane', handler)
  }, [navigateToPane])

  return { navigateToPane }
}
