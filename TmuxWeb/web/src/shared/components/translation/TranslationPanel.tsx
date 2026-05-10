import { useState, useEffect, useCallback, useMemo } from 'react'
import { Languages, Loader2 } from 'lucide-react'
import './TranslationPanel.css'

interface TranslationPair {
  en: string
  zh: string
}

function parsePairs(text: string): TranslationPair[] {
  const lines = text.split('\n')
  const pairs: TranslationPair[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('[EN] ')) {
      const en = line.slice(5)
      const zh = (i + 1 < lines.length && lines[i + 1].startsWith('[ZH] '))
        ? lines[i + 1].slice(5)
        : ''
      pairs.push({ en, zh })
      i += 2
    } else {
      i++
    }
  }
  return pairs
}

interface TranslationPanelProps {
  paneId?: string | null
}

export function TranslationPanel({ paneId }: TranslationPanelProps) {
  const [original, setOriginal] = useState('')
  const [translated, setTranslated] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'capturing' | 'translating' | 'done' | 'error' | 'empty'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const pairs = useMemo(() => translated ? parsePairs(translated) : [], [translated])

  const captureAndTranslate = useCallback(async (pid: string) => {
    setStatus('capturing')
    setOriginal('')
    setTranslated(null)
    setErrorMsg('')

    const capRes = await fetch('/api/cli-history/capture-pane', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ paneId: pid }),
    })
    if (!capRes.ok) throw new Error(`HTTP ${capRes.status}`)

    const capData = await capRes.json()
    if (capData.status === 'empty') {
      setStatus('empty')
      return
    }

    setOriginal(capData.text)
    setStatus('translating')

    try {
      const trRes = await fetch('/api/cli-history/translate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: capData.text }),
      })
      if (!trRes.ok) throw new Error(`HTTP ${trRes.status}`)

      const trData = await trRes.json()
      if (trData.status === 'error') {
        setStatus('error')
        setErrorMsg(trData.error || '翻译失败')
      } else {
        setTranslated(trData.translated)
        setStatus('done')
      }
    } catch (e) {
      setStatus('error')
      setErrorMsg(e instanceof Error ? e.message : '翻译失败')
    }
  }, [])

  useEffect(() => {
    if (paneId) {
      captureAndTranslate(paneId).catch(() => {
        setStatus('error')
        setErrorMsg('捕获失败')
      })
    } else {
      setStatus('idle')
      setOriginal('')
      setTranslated(null)
    }
  }, [paneId, captureAndTranslate])

  const handleRetranslate = useCallback(() => {
    if (paneId) {
      captureAndTranslate(paneId).catch(() => {
        setStatus('error')
        setErrorMsg('捕获失败')
      })
    }
  }, [paneId, captureAndTranslate])

  if (status === 'idle') {
    return (
      <div className="tp-panel">
        <div className="tp-empty">
          <Languages size={24} />
          <span>无活跃终端</span>
        </div>
      </div>
    )
  }

  if (status === 'empty') {
    return (
      <div className="tp-panel">
        <div className="tp-empty">
          <Languages size={24} />
          <span>当前终端无内容</span>
        </div>
      </div>
    )
  }

  const statusText = (() => {
    switch (status) {
      case 'capturing': return '正在捕获...'
      case 'translating': return '翻译中...'
      case 'done': return '翻译完成'
      case 'error': return '翻译失败'
      default: return ''
    }
  })()

  const statusClass = status === 'done' ? ' done' : status === 'error' ? ' error' : ''

  return (
    <div className="tp-panel">
      <div className="tp-header">
        <div className="tp-header-left">
          <span className="tp-session-info" title={paneId || ''}>
            中英对照 Translation
          </span>
        </div>
        <div className="tp-header-right">
          <span className={`tp-status${statusClass}`}>{statusText}</span>
          <button className="tp-retranslate-btn" onClick={handleRetranslate}>
            <Languages size={12} />
          </button>
        </div>
      </div>

      <div className="tp-body">
        {status === 'done' && pairs.length > 0 ? (
          <div className="tp-pairs">
            {pairs.map((p, i) => (
              <div key={i} className="tp-pair">
                <div className="tp-pair-en">{p.en}</div>
                <div className="tp-pair-zh">{p.zh}</div>
              </div>
            ))}
          </div>
        ) : (
          <pre className="tp-raw">{original}</pre>
        )}

        {status === 'translating' && (
          <div className="tp-translating-bar">
            <Loader2 size={14} className="tp-spin" />
            <span>翻译中...</span>
          </div>
        )}

        {status === 'error' && errorMsg && (
          <div className="tp-error-bar">{errorMsg}</div>
        )}
      </div>
    </div>
  )
}
