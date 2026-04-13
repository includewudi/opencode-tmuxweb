import { useEffect, useCallback, useRef } from 'react'
import { TmuxSession } from '../types'
import { resolvePaneTarget } from './paneNavigationUtils'

interface NavigateToPaneDetail {
  paneKey: string
}

type OpenPaneFn = (paneId: string, paneName: string) => void

/**
 * Resolves a pane_key (session name or session/window/pane path) to a concrete
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
    const target = resolvePaneTarget(currentSessions, paneKey)
    if (!target) {
      console.warn(`[usePaneNavigation] Pane target "${paneKey}" not found in tree`)
      return false
    }

    openPaneRef.current(target.paneId, target.paneName)
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
