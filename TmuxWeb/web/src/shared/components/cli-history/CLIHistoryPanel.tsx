import { useState, useEffect, useCallback } from 'react'
import {
  Search, X, ChevronRight, Terminal, Bot, User, Wrench,
  CheckCircle2, XCircle, Loader2, RefreshCw, ArrowLeft, Hash,
} from 'lucide-react'
import './CLIHistoryPanel.css'

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
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(tsSec * 1000).toLocaleDateString()
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
  return <Loader2 size={12} className="cli-h-spin" style={{ color: 'var(--blue-400)' }} />
}

function InputPreview({ input }: { input: unknown }) {
  const str = typeof input === 'string' ? input : JSON.stringify(input)
  return <span>{truncate(str, 200)}</span>
}

interface CLIHistoryPanelProps {
  cwd?: string | null
}

export function CLIHistoryPanel({ cwd }: CLIHistoryPanelProps) {
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
      const params = new URLSearchParams({ provider, limit: '50' })
      if (searchQuery) params.set('search', searchQuery)
      if (cwd) params.set('directory', cwd)
      const res = await fetch(`/api/cli-history/sessions?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch sessions')
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch (err) {
      console.error('[CLIHistoryPanel] fetch error:', err)
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
      console.error('[CLIHistoryPanel] detail error:', err)
      setSessionDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [provider])

  const fetchToolCalls = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(
        `/api/cli-history/sessions/${encodeURIComponent(sessionId)}/tools?provider=${provider}`,
        { credentials: 'include' }
      )
      if (!res.ok) throw new Error('Failed to fetch tools')
      const data = await res.json()
      setToolCalls(data.toolCalls || [])
    } catch (err) {
      console.error('[CLIHistoryPanel] tools error:', err)
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
    <div className="cli-h-panel">
      <div className="cli-h-header">
        <div className="cli-h-header-left">
          <Terminal size={15} />
          <span className="cli-h-title">CLI History</span>
        </div>
        <div className="cli-h-header-right">
          <button className="cli-h-btn" onClick={fetchSessions} disabled={loading} title="Refresh">
            <RefreshCw size={13} className={loading ? 'cli-h-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="cli-h-search">
        <Search size={13} />
        <input
          type="text"
          placeholder="Search sessions..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="cli-h-btn" onClick={() => setSearchQuery('')} title="Clear">
            <X size={12} />
          </button>
        )}
      </div>

      <div className="cli-h-body">
        <div className="cli-h-session-list">
          {loading && sessions.length === 0 ? (
            <div className="cli-h-loading">
              <Loader2 size={20} className="cli-h-spin" />
              <span>Loading...</span>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="cli-h-empty">
              {searchQuery ? 'No matches' : 'No sessions found'}
            </div>
          ) : (
            filteredSessions.map(session => (
              <div
                key={session.id}
                className={`cli-h-session-item${selectedSession === session.id ? ' active' : ''}`}
                onClick={() => selectSession(session.id)}
              >
                <span className="cli-h-session-title">{session.title || 'Untitled'}</span>
                <div className="cli-h-session-meta">
                  <span className="cli-h-session-path" title={session.projectPath}>
                    {truncate(session.projectPath?.split('/').slice(-2).join('/') || session.directory?.split('/').slice(-2).join('/') || '', 24)}
                  </span>
                  {session.agent && (
                    <span className="cli-h-agent-badge" style={{ background: agentColor(session.agent) }}>
                      {session.agent}
                    </span>
                  )}
                  <span className="cli-h-session-time">{relativeTime(session.timeUpdated)}</span>
                  <span className="cli-h-badge">{session.messageCount} msgs</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="cli-h-detail">
          {!selectedSession || !sessionDetail ? (
            <div className="cli-h-empty">
              {selectedSession && detailLoading ? (
                <><Loader2 size={20} className="cli-h-spin" /><span>Loading...</span></>
              ) : (
                'Select a session'
              )}
            </div>
          ) : (
            <>
              <div className="cli-h-detail-header">
                <button className="cli-h-detail-back" onClick={goBack} title="Back">
                  <ArrowLeft size={14} />
                </button>
                <span className="cli-h-detail-title">{sessionDetail.title || 'Untitled'}</span>
                {sessionDetail.agent && (
                  <span className="cli-h-agent-badge" style={{ background: agentColor(sessionDetail.agent) }}>
                    {sessionDetail.agent}
                  </span>
                )}
              </div>

              <div className="cli-h-detail-tabs">
                <button
                  className={`cli-h-tab${detailTab === 'messages' ? ' active' : ''}`}
                  onClick={() => setDetailTab('messages')}
                >
                  Messages
                </button>
                <button
                  className={`cli-h-tab${detailTab === 'tools' ? ' active' : ''}`}
                  onClick={() => setDetailTab('tools')}
                >
                  Tools ({toolCalls.length || inlineTools.length})
                </button>
              </div>

              <div className="cli-h-detail-content">
                {detailTab === 'messages' ? (
                  (sessionDetail.messages || []).map(msg => (
                    <div key={msg.id} className="cli-h-message">
                      <div className={`cli-h-message-role ${msg.role}`}>
                        {msg.role === 'user' ? <User size={13} /> : <Bot size={13} />}
                        {msg.role === 'user' ? 'User' : 'Assistant'}
                        {msg.modelID && (
                          <span className="cli-h-message-model">{msg.modelID}</span>
                        )}
                        {msg.agent && (
                          <span className="cli-h-agent-badge" style={{ background: agentColor(msg.agent), fontSize: '9px', padding: '0 4px' }}>
                            {msg.agent}
                          </span>
                        )}
                        {msg.error && (
                          <span className="cli-h-error-badge" title={`${msg.error.statusCode || ''} ${msg.error.name || 'Error'}: ${msg.error.message || ''}`}>
                            {msg.error.name || 'Error'}: {msg.error.message || 'Unknown error'}
                          </span>
                        )}
                        {msg.error && (
                          <span className="cli-h-error-badge" title={msg.error.message || ''}>
                            ⚠️ {msg.error.name || 'Error'}{msg.error.statusCode ? ` (${msg.error.statusCode})` : ''}: {msg.error.message || 'unknown'}
                          </span>
                        )}
                        {msg.tokens && (
                          <span className="cli-h-message-tokens">
                            {formatTokens(msg.tokens)}
                          </span>
                        )}
                      </div>
                      {msg.parts
                        .filter(p => p.type === 'text')
                        .map((p, idx) => (
                          <div key={idx} className="cli-h-message-content">
                            {p.text || ''}
                          </div>
                        ))}
                      {msg.parts
                        .filter(p => p.type === 'tool')
                        .map((p, idx) => {
                          const key = `${msg.id}-tool-${idx}`
                          const isExpanded = expandedTool === key
                          return (
                            <div key={key} className="cli-h-tool-inline" onClick={() => setExpandedTool(isExpanded ? null : key)}>
                              <Wrench size={12} style={{ color: 'var(--zinc-500)' }} />
                              <span className="cli-h-tool-name">{p.tool || 'unknown'}</span>
                              <span className="cli-h-tool-status">
                                <ToolStatusIcon status={p.status} />
                              </span>
                              {p.duration != null && (
                                <span className="cli-h-tool-duration">{formatDuration(p.duration)}</span>
                              )}
                              <ChevronRight size={12} style={{ color: 'var(--zinc-600)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
                              {isExpanded && (
                                <div style={{ width: '100%' }}>
                                  {p.input != null && (
                                    <><div className="cli-h-tool-input-label">Input</div><pre className="cli-h-tool-output"><InputPreview input={p.input} /></pre></>
                                  )}
                                  {p.output && (
                                    <><div className="cli-h-tool-output-label">Output</div><pre className="cli-h-tool-output">{truncate(p.output, 2000)}</pre></>
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
                    <div className="cli-h-loading"><Loader2 size={20} className="cli-h-spin" /><span>Loading tools...</span></div>
                  ) : (toolCalls.length === 0 && inlineTools.length === 0) ? (
                    <div className="cli-h-empty">No tool calls</div>
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
                        <div key={key} className="cli-h-tool-entry" onClick={() => setExpandedEntry(isExpanded ? null : key)}>
                          <div className="cli-h-tool-entry-top">
                            <Wrench size={12} style={{ color: 'var(--zinc-500)' }} />
                            <span className="cli-h-tool-entry-name" style={{ color: 'var(--amber-500)' }}>
                              {tool}
                            </span>
                            <span className="cli-h-tool-status">
                              <ToolStatusIcon status={status} />
                            </span>
                            {dur != null && dur > 0 && (
                              <span className="cli-h-tool-entry-duration">{formatDuration(dur)}</span>
                            )}
                            <Hash size={11} style={{ color: 'var(--zinc-600)' }} />
                            <ChevronRight size={12} style={{ color: 'var(--zinc-600)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', marginLeft: 'auto' }} />
                          </div>
                          {!isExpanded && (
                            <div className="cli-h-tool-preview">
                              {inputStr ? truncate(inputStr, 80) : output ? truncate(output, 80) : 'No preview'}
                            </div>
                          )}
                          {isExpanded && (
                            <div>
                              {input != null && (
                                <><div className="cli-h-tool-input-label">Input</div><pre className="cli-h-tool-output">{truncate(inputStr, 5000)}</pre></>
                              )}
                              {output && (
                                <><div className="cli-h-tool-output-label">Output</div><pre className="cli-h-tool-output">{truncate(output, 5000)}</pre></>
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
