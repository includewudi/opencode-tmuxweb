import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronRight, GitBranch, ArrowDownToLine, ArrowUpFromLine, Loader2, Lightbulb, Check, X, FileCode } from 'lucide-react'
import { getToken } from '../../../utils/auth'
import './web-file-browser.css'

interface GitStatus {
  branch: string; ahead: number; behind: number
  staged: string[]; modified: string[]; untracked: string[]
}
interface GitCommit { sha: string; author: string; date: string; message: string }
interface GitPanelProps { dir: string; onRefresh: () => void }

export function GitPanel({ dir, onRefresh }: GitPanelProps) {
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [showStatus, setShowStatus] = useState(true)
  const [showLog, setShowLog] = useState(false)
  const [commitMsg, setCommitMsg] = useState('')
  const [excludedFiles, setExcludedFiles] = useState<Set<string>>(new Set())
  const [committing, setCommitting] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [diffFrom, setDiffFrom] = useState<string | null>(null)
  const [logs, setLogs] = useState<GitCommit[]>([])
  const [loadingLog, setLoadingLog] = useState(false)
  const [operationOutput, setOperationOutput] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const token = getToken()
      const res = await fetch(`/api/files/git/status?dir=${encodeURIComponent(dir)}&token=${token}`)
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
        setExcludedFiles(new Set())
      }
    } catch (e) { console.warn('[GitPanel:fetchStatus]', e) }
  }, [dir])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const fetchLog = useCallback(async () => {
    setLoadingLog(true)
    try {
      const token = getToken()
      const res = await fetch(`/api/files/git/log?dir=${encodeURIComponent(dir)}&count=30&token=${token}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.commits || [])
      }
    } catch (e) { console.warn('[GitPanel:fetchLog]', e) }
    setLoadingLog(false)
  }, [dir])

  const toggleExcluded = (name: string) => {
    setExcludedFiles(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const handleSuggest = async () => {
    setSuggesting(true)
    try {
      const token = getToken()
      const aiRes = await fetch(`/api/files/git/ai-commit-msg?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir })
      })
      if (aiRes.ok) {
        const data = await aiRes.json()
        const raw = (data.command || '').trim()
        if (data.error || !raw) {
          setCommitMsg('')
          setOperationOutput(`⚠️ ${data.error || data.detail || 'AI 未返回有效内容'}`)
          return
        }
        let msg = raw
        const promptPrefixes = ['为以下 git 变更', '生成简洁的中文', '只输出 message', 'commit message', 'Generate a commit']
        for (const p of promptPrefixes) {
          const idx = msg.indexOf(p)
          if (idx > 0) { msg = msg.substring(0, idx).trim(); break }
          if (idx === 0) { msg = ''; break }
        }
        msg = msg.replace(/^```\w*\n?/, '').replace(/\n?```$/, '').trim()
        setCommitMsg(msg)
      }
    } catch (e) { console.warn('[GitPanel:suggest]', e) }
    setSuggesting(false)
  }

  const handleCommit = async () => {
    if (!commitMsg.trim()) return
    setCommitting(true)
    try {
      const token = getToken()
      const res = await fetch(`/api/files/git/commit?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir, message: commitMsg.trim(), excludeFiles: Array.from(excludedFiles) })
      })
      const data = await res.json()
      setOperationOutput(data.ok ? `✅ 提交成功\n${data.output || ''}` : `❌ 提交失败: ${data.error || ''}\n${data.output || ''}`)
      if (data.ok) { setCommitMsg(''); setExcludedFiles(new Set()); fetchStatus(); onRefresh() }
    } catch (e) { setOperationOutput(`❌ 提交失败: ${e}`) }
    setCommitting(false)
  }

  const handlePull = async () => {
    setPulling(true); setOperationOutput(null)
    try {
      const token = getToken()
      const res = await fetch(`/api/files/git/pull?token=${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dir }) })
      const data = await res.json()
      setOperationOutput(data.ok ? `✅ 拉取成功\n${data.output || 'Already up to date.'}` : `❌ 拉取失败: ${data.error || ''}\n${data.output || ''}`)
      if (data.ok) { fetchStatus(); onRefresh() }
    } catch (e) { console.warn('[GitPanel:pull]', e) }
    setPulling(false)
  }

  const handlePush = async () => {
    setPushing(true); setOperationOutput(null)
    try {
      const token = getToken()
      const res = await fetch(`/api/files/git/push?token=${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dir }) })
      const data = await res.json()
      setOperationOutput(data.ok ? `✅ 推送成功\n${data.output || ''}` : `❌ 推送失败: ${data.error || ''}\n${data.output || ''}`)
      if (data.ok) fetchStatus()
    } catch (e) { console.warn('[GitPanel:push]', e) }
    setPushing(false)
  }

  const handleCompare = (sha: string) => {
    if (diffFrom === sha) { setDiffFrom(null); return }
    setDiffFrom(sha)
    window.open(`/api/files/diff-report?dir=${encodeURIComponent(dir)}&from=${encodeURIComponent(sha)}&to=HEAD`, '_blank')
  }

  const allFiles = [
    ...(status?.staged || []).map(f => ({ name: f, status: 'A', type: 'file', section: '已暂存' })),
    ...(status?.modified || []).map(f => ({ name: f, status: 'M', type: 'file', section: '已修改' })),
    ...(status?.untracked || []).map(f => ({ name: f, status: '?', type: 'file', section: '未跟踪' })),
  ]

  return (
    <div className="wfb-git-panel">
      {/* 分支行 */}
      <div className="wfb-git-panel__branch-bar">
        <GitBranch size={12} />
        <span className="wfb-git-panel__branch-name">{status?.branch || '...'}</span>
        {status && (status.ahead > 0 || status.behind > 0) && (
          <span className="wfb-git-panel__ahead-behind">
            {status.ahead > 0 && `↑${status.ahead}`} {status.behind > 0 && `↓${status.behind}`}
          </span>
        )}
        <div className="wfb-git-panel__branch-actions">
          <button className="wfb-git-btn" onClick={handlePull} disabled={pulling} title="拉取">
            {pulling ? <Loader2 size={12} className="wfb-spin" /> : <ArrowDownToLine size={12} />}
            <span>拉取</span>
          </button>
          <button className="wfb-git-btn" onClick={handlePush} disabled={pushing} title="推送">
            {pushing ? <Loader2 size={12} className="wfb-spin" /> : <ArrowUpFromLine size={12} />}
            <span>推送</span>
          </button>
        </div>
      </div>

      {/* 提交行 */}
      <div className="wfb-git-panel__commit-row">
        <button className="wfb-git-btn wfb-git-btn--suggest" onClick={handleSuggest} disabled={suggesting} title="AI 生成提交信息">
          {suggesting ? <Loader2 size={12} className="wfb-spin" /> : <Lightbulb size={12} />}
        </button>
        <input className="wfb-git-panel__commit-input" value={commitMsg} onChange={e => setCommitMsg(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) {} }} placeholder="输入提交信息..." />
        <button className="wfb-git-btn wfb-git-btn--commit" onClick={handleCommit} disabled={committing || !commitMsg.trim()} title="提交">
          {committing ? <Loader2 size={12} className="wfb-spin" /> : <Check size={12} />}
          <span>提交</span>
        </button>
      </div>

      {/* 变更文件 */}
      <div className="wfb-git-panel__section">
        <button className="wfb-git-panel__section-header" onClick={() => setShowStatus(s => !s)}>
          {showStatus ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span>变更文件</span>
          {status && (
            <span className="wfb-git-panel__counts">
              ({(status.staged || []).length} 已暂存, {(status.modified || []).length} 已修改, {(status.untracked || []).length} 未跟踪)
            </span>
          )}
        </button>
        {showStatus && (
          <div className="wfb-git-panel__file-list">
            <div style={{ fontSize: 10, color: 'var(--zinc-500)', padding: '2px 8px' }}>☑ 勾选 = 排除该文件（不提交），默认全部提交</div>
            {allFiles.length === 0 && <div className="wfb-git-panel__empty">无变更</div>}
            {allFiles.map((f, i) => (
              <label key={i} className={`wfb-git-panel__file-item${excludedFiles.has(f.name) ? ' wfb-git-panel__file-item--excluded' : ''}`}>
                <input type="checkbox" checked={excludedFiles.has(f.name)} onChange={() => toggleExcluded(f.name)}
                  title={excludedFiles.has(f.name) ? '排除此文件' : '将提交此文件'} />
                <FileCode size={12} />
                <span className="wfb-git-panel__file-name" title={f.name}>{f.name}</span>
                <span className={`wfb-git-badge wfb-git-badge--${f.status === '?' ? 'untracked' : f.status === 'M' || f.status === 'MM' ? 'modified' : f.status === 'A' ? 'staged' : 'modified'}`}>
                  {f.status}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 提交记录 */}
      <div className="wfb-git-panel__section">
        <button className="wfb-git-panel__section-header" onClick={() => { setShowLog(s => !s); if (!showLog) fetchLog() }}>
          {showLog ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span>提交记录</span>
          {loadingLog && <Loader2 size={12} className="wfb-spin" />}
        </button>
        {showLog && (
          <div className="wfb-git-panel__log-list">
            {logs.length === 0 && !loadingLog && <div className="wfb-git-panel__empty">无提交记录</div>}
            {logs.map(c => (
              <div key={c.sha} className={`wfb-git-panel__log-item${diffFrom === c.sha ? ' wfb-git-panel__log-item--active' : ''}`}>
                <div className="wfb-git-panel__log-info" onClick={() => handleCompare(c.sha)}>
                  <span className="wfb-git-panel__log-sha">{c.sha.slice(0, 7)}</span>
                  <span className="wfb-git-panel__log-msg">{c.message}</span>
                  <span className="wfb-git-panel__log-meta">{c.author} · {new Date(c.date).toLocaleDateString('zh-CN')}</span>
                </div>
                {diffFrom !== c.sha && (
                  <button className="wfb-git-btn wfb-git-btn--small" onClick={() => handleCompare(c.sha)} title="与 HEAD 对比">
                    对比
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 操作输出 */}
      {operationOutput && (
        <div className="wfb-git-panel__output">
          <pre>{operationOutput}</pre>
          <button className="wfb-git-btn wfb-git-btn--small" onClick={() => setOperationOutput(null)} title="关闭">
            <X size={10} />
          </button>
        </div>
      )}
    </div>
  )
}
