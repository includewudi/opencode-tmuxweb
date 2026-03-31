import { useState, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { getToken } from '../../../utils/auth'

interface CommitEntry {
  sha: string
  date: string
  message: string
  author: string
}

interface Props {
  filePath: string
  onRestore: (sha: string) => void
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export function FileHistory({ filePath, onRestore }: Props) {
  const [commits, setCommits] = useState<CommitEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [diffMap, setDiffMap] = useState<Record<string, string>>({})
  const [diffLoading, setDiffLoading] = useState<string | null>(null)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const token = getToken()
      const res = await fetch(`/api/files/history?path=${encodeURIComponent(filePath)}&count=20&token=${token}`)
      if (res.ok) {
        const data = await res.json()
        setCommits(Array.isArray(data) ? data : (data.commits || []))
      }
    } catch {}
    setLoading(false)
  }, [filePath])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const toggleCommit = async (sha: string) => {
    if (expanded === sha) { setExpanded(null); return }
    setExpanded(sha)
    if (diffMap[sha]) return
    setDiffLoading(sha)
    try {
      const token = getToken()
      const res = await fetch(`/api/files/diff?path=${encodeURIComponent(filePath)}&ref=${encodeURIComponent(sha + '^')}&token=${token}`)
      if (res.ok) {
        const data = await res.json()
        setDiffMap(prev => ({ ...prev, [sha]: data.diff || '' }))
      }
    } catch {}
    setDiffLoading(null)
  }

  if (loading) return <div className="wfb-loading"><Loader2 size={20} className="wfb-spin" /></div>
  if (!commits.length) return <div className="wfb-empty">No commit history</div>

  return (
    <div className="wfb-history-list">
      {commits.map(c => (
        <div key={c.sha}
          className={`wfb-history-item${expanded === c.sha ? ' wfb-history-item--expanded' : ''}`}
          onClick={() => toggleCommit(c.sha)}
        >
          <div className="wfb-history-item__message">{c.message.length > 60 ? c.message.slice(0, 60) + '...' : c.message}</div>
          <div className="wfb-history-item__meta">
            <span>{relativeTime(c.date)}</span>
            <span>{c.author}</span>
          </div>
          {expanded === c.sha && (
            <div className="wfb-history-diff">
              {diffLoading === c.sha ? (
                <div className="wfb-loading"><Loader2 size={16} className="wfb-spin" /></div>
              ) : (
                <pre className="wfb-diff-content">{diffMap[c.sha] || '(no diff available)'}</pre>
              )}
              <button className="wfb-icon-btn" onClick={e => { e.stopPropagation(); onRestore(c.sha) }}
                title="Restore this version" style={{ marginLeft: 'auto', marginTop: 4 }}>
                ↩
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
