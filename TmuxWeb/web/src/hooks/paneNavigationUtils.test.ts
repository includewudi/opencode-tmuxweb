import { describe, expect, it } from 'vitest'
import type { TmuxSession } from '../types'
import { resolvePaneTarget } from './paneNavigationUtils'

const sessions: TmuxSession[] = [
  {
    sessionName: 'alpha',
    sessionId: '$1',
    windows: [
      {
        windowIndex: 0,
        windowName: 'editor',
        windowId: '@1',
        panes: [
          { paneId: '%1', paneTitle: 'vim', paneCommand: 'vim' },
          { paneId: '%2', paneTitle: 'server', paneCommand: 'npm run dev' },
        ],
      },
      {
        windowIndex: 1,
        windowName: 'shell',
        windowId: '@2',
        panes: [
          { paneId: '%3', paneTitle: 'zsh', paneCommand: 'zsh' },
        ],
      },
    ],
  },
]

describe('resolvePaneTarget', () => {
  it('resolves a full session/window/pane key to the exact pane', () => {
    const target = resolvePaneTarget(sessions, 'alpha/0/%2')

    expect(target).toEqual({
      paneId: '%2',
      paneName: 'alpha:0',
    })
  })

  it('falls back to the first pane when given only a session name', () => {
    const target = resolvePaneTarget(sessions, 'alpha')

    expect(target).toEqual({
      paneId: '%1',
      paneName: 'alpha:0',
    })
  })

  it('returns null when the referenced pane does not exist', () => {
    expect(resolvePaneTarget(sessions, 'alpha/9/%99')).toBeNull()
  })
})
