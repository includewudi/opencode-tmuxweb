import { useMemo } from 'react'

interface Props {
  diff: string
  hasChanges: boolean
  fileStatus?: string
  stats?: { additions: number; deletions: number }
}

function parseHunks(diff: string) {
  const lines = diff.split('\n')
  const hunks: { header: string; lines: { type: string; text: string }[] }[] = []
  let current: typeof hunks[0] | null = null
  for (const line of lines) {
    if (line.startsWith('@@')) {
      current = { header: line, lines: [] }
      hunks.push(current)
    } else if (current) {
      current.lines.push({
        type: line.startsWith('+') ? 'add' : line.startsWith('-') ? 'remove' : 'context',
        text: line
      })
    }
  }
  return hunks
}

export function DiffView({ diff, hasChanges, fileStatus, stats }: Props) {
  const hunks = useMemo(() => parseHunks(diff), [diff])

  if (!hasChanges) return <div className="wfb-empty">No changes</div>
  if (fileStatus === 'untracked') return <div className="wfb-empty">New file (untracked)</div>
  if (fileStatus === 'binary') return <div className="wfb-empty">(binary file)</div>

  return (
    <div className="wfb-diff-container">
      {stats && (
        <div className="wfb-diff-stats">
          <span className="wfb-diff-stats__add">+{stats.additions}</span>
          <span className="wfb-diff-stats__del">-{stats.deletions}</span>
        </div>
      )}
      <pre className="wfb-diff-content">
        {hunks.map((h, i) => (
          <div key={i}>
            <div className="wfb-diff-line wfb-diff-line--hunk">{h.header}</div>
            {h.lines.map((l, j) => (
              <div key={j} className={`wfb-diff-line wfb-diff-line--${l.type}`}>
                {l.text}
              </div>
            ))}
          </div>
        ))}
      </pre>
    </div>
  )
}
