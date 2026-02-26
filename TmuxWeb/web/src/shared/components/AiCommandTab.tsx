import { useState, useCallback, useEffect } from 'react'
import { Send, Copy, Play, Loader2, ChevronUp, ChevronDown, X, Terminal } from 'lucide-react'
import { RoleManagerModal } from './RoleManagerModal'

const TEMPLATE_ROLE_ID = 'research-publish'

const BUILTIN_ROLES_FALLBACK = [
  { id: 'cli', emoji: '\u{1F5A5}\u{FE0F}', label: '命令行大神', desc: '生成可执行的终端命令' },
  { id: 'ops', emoji: '\u{1F527}', label: '运维专家', desc: '优化 DevOps/运维提示词' },
  { id: 'prompt', emoji: '\u{2728}', label: '提示词优化', desc: '通用 AI 提示词优化' },
  { id: 'frontend', emoji: '\u{1F3A8}', label: '前端优化', desc: '前端开发提示词优化' },
  { id: 'backend', emoji: '\u{2699}\u{FE0F}', label: '后端优化', desc: '后端开发提示词优化' },
  { id: 'ui', emoji: '\u{1F3AD}', label: 'UI优化', desc: 'UI/UX 设计提示词优化' },
  { id: 'api', emoji: '\u{1F504}', label: 'API转换', desc: 'API 架构转换与重构' },
  { id: TEMPLATE_ROLE_ID, emoji: '\u{1F4DD}', label: '研究发表', desc: '研究 GitHub 项目并发表微信公众号文章' },
]

interface Role {
  id: string
  emoji: string
  label: string
  desc: string
  prompt?: string
  suffix?: string
  isCustom?: boolean
}

interface AiCommandTabProps {
  onSend: (text: string) => void
  disabled?: boolean
  initialText?: string
  onTextConsumed?: () => void
}

export function AiCommandTab({ onSend, disabled, initialText, onTextConsumed }: AiCommandTabProps) {
  const [input, setInput] = useState('')
  const [selectedRole] = useState('cli')
  const [roles, setRoles] = useState<Role[]>(BUILTIN_ROLES_FALLBACK)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ command: string; explanation: string } | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [showPrompt, _setShowPrompt] = useState(false)
  const [showRoleModal, setShowRoleModal] = useState(false)

  useEffect(() => {
    if (initialText) {
      setInput(initialText)
      onTextConsumed?.()
    }
  }, [initialText, onTextConsumed])

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch('/api/roles', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        if (data.roles?.length) setRoles(data.roles)
      }
    } catch {
      // fallback to built-in
    }
  }, [])

  useEffect(() => { fetchRoles() }, [fetchRoles])

  const handleDirectSend = useCallback(() => {
    if (!input.trim() || disabled) return
    onSend(input.trim() + '\n')
    setInput('')
  }, [input, onSend, disabled])

  const handleClear = useCallback(() => {
    setInput('')
    setResult(null)
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!input.trim() || loading) return
    // Template role: construct command and put in input box, no API call
    if (selectedRole === TEMPLATE_ROLE_ID) {
      const url = input.trim()
      setInput(`用 github-project-researcher 研究 ${url}，然后用 md2wechat 发微信公众号`)
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/ai/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ prompt: input.trim(), role: selectedRole })
      })
      const data = await res.json()
      setResult({ command: data.command || '', explanation: data.explanation || '' })
    } catch (err) {
      setResult({ command: '', explanation: '请求失败: ' + (err instanceof Error ? err.message : String(err)) })
    } finally {
      setLoading(false)
    }
  }, [input, selectedRole, loading])

  const handleCopy = useCallback(async () => {
    if (result?.command) {
      try {
        await navigator.clipboard.writeText(result.command)
      } catch { /* ignore */ }
    }
  }, [result])

  const handleExecute = useCallback(() => {
    if (result?.command) {
      onSend(result.command + '\n')
    }
  }, [result, onSend])

  const selectedRoleDef = roles.find(r => r.id === selectedRole)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px', gap: '8px', overflow: 'auto' }}>
      {/* Role: show cli (命令行大神) as a selected chip — no other roles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{
          padding: '3px 10px',
          borderRadius: '12px',
          border: '1px solid #4d78cc',
          background: '#4d78cc22',
          color: '#4d78cc',
          fontSize: '12px',
          whiteSpace: 'nowrap',
        }}>
          {roles.find(r => r.id === 'cli')?.emoji ?? '⚡'} {roles.find(r => r.id === 'cli')?.label ?? '命令行大神'}
        </span>
      </div>

      {/* Prompt viewer */}
      {showPrompt && selectedRoleDef?.prompt && (
        <div style={{
          background: '#1a1c20',
          border: '1px solid #2c313a',
          borderRadius: '6px',
          padding: '8px',
          fontSize: '11px',
          color: '#7a818c',
          maxHeight: '120px',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
        }}>
          <div style={{ color: '#9da5b4', marginBottom: '4px', fontWeight: 600 }}>{selectedRoleDef.emoji} {selectedRoleDef.label}</div>
          {selectedRoleDef.prompt}
          {selectedRoleDef.suffix && (
            <div style={{ marginTop: '8px', color: '#555a66', borderTop: '1px solid #2c313a', paddingTop: '4px' }}>
              {selectedRoleDef.suffix}
            </div>
          )}
        </div>
      )}

      {/* Input area */}
      <div style={{ position: 'relative' }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleGenerate()
            }
          }}
          placeholder="描述你想执行的操作..."
          rows={2}
          style={{
            width: '100%',
            background: '#13151a',
            border: '1px solid #2c313a',
            borderRadius: '6px',
            padding: '8px',
            paddingRight: '28px',
            color: '#abb2bf',
            fontSize: '13px',
            outline: 'none',
            resize: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
        {input && (
          <button
            onClick={handleClear}
            style={{
              position: 'absolute',
              top: '6px',
              right: '6px',
              background: 'none',
              border: 'none',
              color: '#555a66',
              cursor: 'pointer',
              padding: '2px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
            type="button"
            title="清空"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={handleGenerate}
          disabled={!input.trim() || loading || disabled}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: loading ? '#2c313a' : '#4d78cc',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'default' : 'pointer',
            opacity: (!input.trim() || disabled) ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            fontSize: '12px',
            whiteSpace: 'nowrap',
          }}
          type="button"
        >
          {loading ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
          AI 生成
        </button>
        <button
          onClick={handleClear}
          disabled={!input && !result}
          style={{
            padding: '8px 10px',
            background: '#2c313a',
            color: '#9da5b4',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            opacity: (!input && !result) ? 0.3 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
          }}
          type="button"
          title="清空"
        >
          <X size={14} />
        </button>
        <button
          onClick={handleDirectSend}
          disabled={!input.trim() || disabled}
          style={{
            padding: '8px 12px',
            background: '#2c313a',
            color: '#9da5b4',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            opacity: (!input.trim() || disabled) ? 0.3 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            fontSize: '12px',
            whiteSpace: 'nowrap',
          }}
          type="button"
          title="直接发送到终端"
        >
          <Terminal size={14} /> 发送终端
        </button>
      </div>

      {/* Result card */}
      {result && (
        <div style={{
          background: '#1a1c20',
          border: '1px solid #2c313a',
          borderRadius: '6px',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#7a818c', fontSize: '11px' }}>{result.explanation}</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => setExpanded(!expanded)}
                style={{ background: 'none', border: 'none', color: '#7a818c', cursor: 'pointer', padding: '2px' }}
                type="button"
              >
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </div>
          {result.command && (
            <>
              <pre style={{
                background: '#13151a',
                borderRadius: '4px',
                padding: '8px',
                color: '#98c379',
                fontSize: '12px',
                fontFamily: 'Menlo, Monaco, monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                margin: 0,
                maxHeight: expanded ? 'none' : '80px',
                overflow: expanded ? 'auto' : 'hidden',
              }}>
                {result.command}
              </pre>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={handleCopy}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '6px',
                    background: '#2c313a',
                    color: '#abb2bf',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                  type="button"
                >
                  <Copy size={12} /> 复制
                </button>
                <button
                  onClick={handleExecute}
                  disabled={disabled}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '6px',
                    background: '#4d78cc',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    opacity: disabled ? 0.5 : 1,
                  }}
                  type="button"
                >
                  <Play size={12} /> 执行
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <RoleManagerModal
        open={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        roles={roles}
        onRolesChanged={fetchRoles}
      />
    </div>
  )
}
