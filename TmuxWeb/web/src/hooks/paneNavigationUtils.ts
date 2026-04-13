import type { TmuxSession } from '../types'

export interface ResolvedPaneTarget {
  paneId: string
  paneName: string
}

function parsePaneKey(paneKey: string) {
  const parts = paneKey.split('/')
  if (parts.length < 3) {
    return {
      sessionName: paneKey,
      windowIndex: null as number | null,
      paneId: null as string | null,
    }
  }

  const sessionName = parts.slice(0, -2).join('/') || parts[0]
  const windowIndexRaw = parts[parts.length - 2] ?? ''
  const paneId = parts[parts.length - 1] ?? null
  const windowIndex = Number.parseInt(windowIndexRaw, 10)

  return {
    sessionName,
    windowIndex: Number.isNaN(windowIndex) ? null : windowIndex,
    paneId,
  }
}

export function resolvePaneTarget(
  sessions: TmuxSession[],
  paneKey: string,
): ResolvedPaneTarget | null {
  const { sessionName, windowIndex, paneId } = parsePaneKey(paneKey)
  const session = sessions.find(s => s.sessionName === sessionName)

  if (!session || session.windows.length === 0) return null

  if (windowIndex !== null && paneId) {
    const exactWindow = session.windows.find(w => w.windowIndex === windowIndex)
    const exactPane = exactWindow?.panes.find(p => p.paneId === paneId)

    if (exactWindow && exactPane) {
      return {
        paneId: exactPane.paneId,
        paneName: `${session.sessionName}:${exactWindow.windowIndex}`,
      }
    }

    return null
  }

  for (const window of session.windows) {
    const firstPane = window.panes[0]
    if (firstPane) {
      return {
        paneId: firstPane.paneId,
        paneName: `${session.sessionName}:${window.windowIndex}`,
      }
    }
  }

  return null
}
