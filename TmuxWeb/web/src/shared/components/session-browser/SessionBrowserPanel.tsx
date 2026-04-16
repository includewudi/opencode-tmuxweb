import { useState, useEffect, useCallback } from 'react'
import {
  Search, X, ChevronRight, Terminal, Bot, User, Wrench,
  CheckCircle2, XCircle, Loader2, RefreshCw, ArrowLeft, Hash, Repeat,
} from 'lucide-react'
import './SessionBrowser.css'

interface SessionSummary {
  id: string
  title: string
  directory: string
  projectName: string
  projectPath: string
  agent: string | null
  messageCount: number
  timeCreated: number
  timeUpdated: number
}

interface MessagePart {
  id: string
  type: string
  text?: string
  tool?: string
  callID?: string
  status?: string
  input?: unknown
  output?: string
  duration?: number | null
}

interface Message {
  id: string
  role: string
  agent: string | null
  modelID: string | null
  providerID: string | null
  tokens: { total: number; input: number; output: number; reasoning: number; cache?: { write: number; read: number } } | null
  timeCreated: number
  timeUpdated: number
  parts: MessagePart[]
}

interface SessionDetail {
  id: string
  title: string
  directory: string
  projectName: string
  agent: string | null
  messageCount: number
  timeCreated: number
  timeUpdated: number
  messages: Message[]
}

interface ToolCall {
  id: string
  tool: string
  callID: string
  status: string
  input?: unknown
  output?: string
  duration: number | null
  timeCreated: number
}

type DetailTab = 'messages' | 'tools'

const AGENT_COLORS: Record<string, string> = {
  explore: '#60a5fa',
  oracle: '#c084fc',
  build: '#34d399',
  Sisyphus: '#f59e0b',
  librarian: '#2dd4bf',
  plan: '#a78bfa',
}
const DEFAULT_AGENT_COLOR = '#a1a1aa'

function agentColor(name: string | null): string {
  if (!name) return DEFAULT_AGENT_COLOR
  const key = Object.keys(AGENT_COLORS).find(k => name.includes(k))
  return key ? AGENT_COLORS[key] : DEFAULT_AGENT_COLOR
}

function relativeTime(tsSec: number): string {
  const diff = Date.now() - tsSec * 1000
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  return new Date(tsSec * 1000).toLocaleDateString('zh-CN')
}

function truncate(s: string, max: number): string {
  if (!s) return ''
  return s.length > max ? s.slice(0, max) + '...' : s
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return ''
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

function formatTokens(tokens: { input: number; output: number; cache?: { read: number; write: number } } | null): string {
  if (!tokens) return ''
  const parts: string[] = []
  if (tokens.input) parts.push(`in:${tokens.input}`)
  if (tokens.output) parts.push(`out:${tokens.output}`)
  if (tokens.cache?.read) parts.push(`cache:${tokens.cache.read}`)
  return parts.join(' ')
}

function ToolStatusIcon({ status }: { status: string | null | undefined }) {
  if (status === 'completed') return <CheckCircle2 size={12} style={{ color: 'var(--green-500)' }} />
  if (status === 'failed') return <XCircle size={12} style={{ color: 'var(--red-500)' }} />
  return <Loader2 size={12} className="sb-spin" style={{ color: 'var(--blue-400)' }} />
}

function InputPreview({ input }: { input: unknown }) {
  const str = typeof input === 'string' ? input : JSON.stringify(input)
  return <span>{truncate(str, 200)}</span>
}

interface SessionBrowserPanelProps {
  cwd?: string | null
  onSwitchSession?: (sessionId: string) => void
}

export function SessionBrowserPanel({ cwd, onSwitchSession }: SessionBrowserPanelProps) {
  const [provider] = useState<string>('opencode')
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null)
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailTab, setDetailTab] = useState<DetailTab>('messages')
  const [expandedTool, setExpandedTool] = useState<string | null>(null)
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null)

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ provider, limit: '50', rootOnly: '1' })
      if (searchQuery) params.set('search', searchQuery)
      if (cwd) params.set('directory', cwd)
      const res = await fetch(`/api/cli-history/sessions?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch sessions')
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch (err) {
      console.error('[SessionBrowser] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [provider, searchQuery, cwd])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  const fetchDetail = useCallback(async (sessionId: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(
        `/api/cli-history/sessions/${encodeURIComponent(sessionId)}?provider=${provider}`,
        { credentials: 'include' }
      )
      if (!res.ok) throw new Error('Failed to fetch detail')
      const data = await res.json()
      setSessionDetail(data)
    } catch (err) {
      console.error('[SessionBrowser] detail error:', err)
      setSessionDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [provider])

  const fetchToolCalls = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(
        `/api/cli-history/sessions/${encodeURIComponent(sessionId)}/tools?provider=${provider}&limit=50`,
        { credentials: 'include' }
      )
      if (!res.ok) throw new Error('Failed to fetch tools')
      const data = await res.json()
      setToolCalls(data.toolCalls || [])
    } catch (err) {
      console.error('[SessionBrowser] tools error:', err)
      setToolCalls([])
    }
  }, [provider])

  const selectSession = useCallback((id: string) => {
    setSelectedSession(id)
    setDetailTab('messages')
    setExpandedTool(null)
    setExpandedEntry(null)
    fetchDetail(id)
    fetchToolCalls(id)
  }, [fetchDetail, fetchToolCalls])

  const goBack = useCallback(() => {
    setSelectedSession(null)
    setSessionDetail(null)
    setToolCalls([])
  }, [])

  const filteredSessions = searchQuery
    ? sessions.filter(s =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.projectName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sessions

  const inlineTools = (sessionDetail?.messages || []).flatMap(msg =>
    msg.parts
      .filter(p => p.type === 'tool')
      .map((p, idx) => ({ ...p, _key: `${msg.id}-${idx}` }))
  )

  return (
    <div className="sb-panel">
      <div className="sb-header">
        <div className="sb-header-left">
          <Terminal size={15} />
          <span className="sb-title">Session 目录</span>
        </div>
        <div className="sb-header-right">
          <button className="sb-btn" onClick={fetchSessions} disabled={loading} title="刷新">
            <RefreshCw size={13} className={loading ? 'sb-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="sb-search">
        <Search size={13} />
        <input
          type="text"
          placeholder="搜索会话..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="sb-btn" onClick={() => setSearchQuery('')} title="清除">
            <X size={12} />
          </button>
        )}
      </div>

      <div className="sb-body">
        <div className="sb-session-list">
          {loading && sessions.length === 0 ? (
            <div className="sb-loading">
              <Loader2 size={20} className="sb-spin" />
              <span>加载中...</span>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="sb-empty">
              {searchQuery ? '无匹配结果' : '暂无会话'}
            </div>
          ) : (
            filteredSessions.map(session => (
              <div
                key={session.id}
                className={`sb-session-item${selectedSession === session.id ? ' active' : ''}`}
                onClick={() => selectSession(session.id)}
              >
                <span className="sb-session-title">{session.title || '无标题'}</span>
                <div className="sb-session-meta">
                  <span className="sb-session-path" title={session.projectPath}>
                    {truncate(session.projectPath?.split('/').slice(-2).join('/') || session.directory?.split('/').slice(-2).join('/') || '', 24)}
                  </span>
                  {session.agent && (
                    <span className="sb-agent-badge" style={{ background: agentColor(session.agent) }}>
                      {session.agent}
                    </span>
                  )}
                  <span className="sb-session-time">{relativeTime(session.timeUpdated)}</span>
                  <span className="sb-badge">{session.messageCount} 条消息</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="sb-detail">
          {!selectedSession || !sessionDetail ? (
            <div className="sb-empty">
              {selectedSession && detailLoading ? (
                <><Loader2 size={20} className="sb-spin" /><span>加载中...</span></>
              ) : (
                '选择一个会话'
              )}
            </div>
          ) : (
            <>
              <div className="sb-detail-header">
                <button className="sb-detail-back" onClick={goBack} title="返回">
                  <ArrowLeft size={14} />
                </button>
                <span className="sb-detail-title">{sessionDetail.title || '无标题'}</span>
                {sessionDetail.agent && (
                  <span className="sb-agent-badge" style={{ background: agentColor(sessionDetail.agent) }}>
                    {sessionDetail.agent}
                  </span>
                )}
                {onSwitchSession && (
                  <button
                    className="sb-switch-btn"
                    onClick={() => onSwitchSession(sessionDetail.id)}
                    title="切换到此会话"
                  >
                    <Repeat size={12} />
                    切换
                  </button>
                )}
              </div>

              <div className="sb-detail-tabs">
                <button
                  className={`sb-tab${detailTab === 'messages' ? ' active' : ''}`}
                  onClick={() => setDetailTab('messages')}
                >
                  消息
                </button>
                <button
                  className={`sb-tab${detailTab === 'tools' ? ' active' : ''}`}
                  onClick={() => setDetailTab('tools')}
                >
                  工具调用 ({toolCalls.length || inlineTools.length})
                </button>
              </div>

              <div className="sb-detail-content">
                {detailTab === 'messages' ? (
                  (sessionDetail.messages || []).map(msg => (
                    <div key={msg.id} className="sb-message">
                      <div className={`sb-message-role ${msg.role}`}>
                        {msg.role === 'user' ? <User size={13} /> : <Bot size={13} />}
                        {msg.role === 'user' ? '用户' : '助手'}
                        {msg.modelID && (
                          <span className="sb-message-model">{msg.modelID}</span>
                        )}
                        {msg.agent && (
                          <span className="sb-agent-badge" style={{ background: agentColor(msg.agent), fontSize: '9px', padding: '0 4px' }}>
                            {msg.agent}
                          </span>
                        )}
                        {msg.tokens && (
                          <span className="sb-message-tokens">
                            {formatTokens(msg.tokens)}
                          </span>
                        )}
                      </div>
                      {msg.parts
                        .filter(p => p.type === 'text')
                        .map((p, idx) => (
                          <div key={idx} className="sb-message-content">
                            {p.text || ''}
                          </div>
                        ))}
                      {msg.parts
                        .filter(p => p.type === 'tool')
                        .map((p, idx) => {
                          const key = `${msg.id}-tool-${idx}`
                          const isExpanded = expandedTool === key
                          return (
                            <div key={key} className="sb-tool-inline" onClick={() => setExpandedTool(isExpanded ? null : key)}>
                              <Wrench size={12} style={{ color: 'var(--zinc-500)' }} />
                              <span className="sb-tool-name">{p.tool || 'unknown'}</span>
                              <span className="sb-tool-status">
                                <ToolStatusIcon status={p.status} />
                              </span>
                              {p.duration != null && (
                                <span className="sb-tool-duration">{formatDuration(p.duration)}</span>
                              )}
                              <ChevronRight size={12} style={{ color: 'var(--zinc-600)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
                              {isExpanded && (
                                <div style={{ width: '100%' }}>
                                  {p.input != null && (
                                    <><div className="sb-tool-input-label">Input</div><pre className="sb-tool-output"><InputPreview input={p.input} /></pre></>
                                  )}
                                  {p.output && (
                                    <><div className="sb-tool-output-label">Output</div><pre className="sb-tool-output">{truncate(p.output, 2000)}</pre></>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  ))
                ) : (
                  detailLoading ? (
                    <div className="sb-loading"><Loader2 size={20} className="sb-spin" /><span>加载中...</span></div>
                  ) : (toolCalls.length === 0 && inlineTools.length === 0) ? (
                    <div className="sb-empty">暂无工具调用</div>
                  ) : (
                    (toolCalls.length > 0 ? toolCalls : inlineTools).map((tc, idx) => {
                      const key = 'tool' in tc ? (tc as ToolCall).id : tc._key || `tool-${idx}`
                      const tool = (tc as ToolCall).tool || (tc as MessagePart & { _key: string }).tool || 'unknown'
                      const status = (tc as ToolCall).status || (tc as MessagePart).status
                      const dur = (tc as ToolCall).duration ?? (tc as MessagePart).duration
                      const input = (tc as ToolCall).input ?? (tc as MessagePart).input
                      const output = (tc as ToolCall).output || (tc as MessagePart).output || ''
                      const isExpanded = expandedEntry === key
                      const inputStr = typeof input === 'string' ? input : JSON.stringify(input)
                      return (
                        <div key={key} className="sb-tool-entry" onClick={() => setExpandedEntry(isExpanded ? null : key)}>
                          <div className="sb-tool-entry-top">
                            <Wrench size={12} style={{ color: 'var(--zinc-500)' }} />
                            <span className="sb-tool-entry-name" style={{ color: 'var(--amber-500)' }}>
                              {tool}
                            </span>
                            <span className="sb-tool-status">
                              <ToolStatusIcon status={status} />
                            </span>
                            {dur != null && dur > 0 && (
                              <span className="sb-tool-entry-duration">{formatDuration(dur)}</span>
                            )}
                            <Hash size={11} style={{ color: 'var(--zinc-600)' }} />
                            <ChevronRight size={12} style={{ color: 'var(--zinc-600)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', marginLeft: 'auto' }} />
                          </div>
                          {!isExpanded && (
                            <div className="sb-tool-preview">
                              {inputStr ? truncate(inputStr, 80) : output ? truncate(output, 80) : '无预览'}
                            </div>
                          )}
                          {isExpanded && (
                            <div>
                              {input != null && (
                                <><div className="sb-tool-input-label">Input</div><pre className="sb-tool-output">{truncate(inputStr, 5000)}</pre></>
                              )}
                              {output && (
                                <><div className="sb-tool-output-label">Output</div><pre className="sb-tool-output">{truncate(output, 5000)}</pre></>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
