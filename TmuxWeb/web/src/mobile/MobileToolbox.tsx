import { useState, useCallback, useRef, RefObject } from 'react'
import { Grid3X3, Clock, Bot, Settings, Upload } from 'lucide-react'
import { VoiceInput, VoiceInputHandle } from '../shared/components/VoiceInput'
import { AiCommandTab } from '../shared/components/AiCommandTab'
import { SnippetsTab } from '../shared/components/SnippetsTab'
import { useTmuxPrefix } from '../hooks/useTmuxPrefix'
import { ConfigViewer } from '../shared/components/ConfigViewer'
import { FileUpload } from '../shared/components/FileUpload'
import '../shared/components/file-upload.css'
import './MobileToolbox.css'

const preventFocus = (e: React.MouseEvent | React.TouchEvent) => {
  e.preventDefault()
}

interface KeyDef {
  label: string
  data?: string
  modifier?: string
}

function createKeyRows(prefixCode: string): [KeyDef[], KeyDef[]] {
  const row1: KeyDef[] = [
    { label: 'esc', data: '\x1b' },
    { label: 'tab', data: '	' },
    { label: '|', data: '|' },
    { label: '/', data: '/' },
    { label: '-', data: '-' },
    { label: '~', data: '~' },
    { label: '^C', data: '\x03' },
    { label: 'clr', data: '\x15' },
  ]

  const row2: KeyDef[] = [
    { label: 'ctrl', modifier: 'ctrl' },
    { label: 'alt', modifier: 'alt' },
    { label: '\u2191', data: '\x1b[A' },
    { label: '\u2193', data: '\x1b[B' },
    { label: '\u2190', data: '\x1b[D' },
    { label: '\u2192', data: '\x1b[C' },
    { label: '\ud83d\udcdc', data: prefixCode + '[' },
    { label: '\u23ce', data: '\r' },
  ]

  return [row1, row2]
}

type TabId = 'snippets' | 'ai' | 'upload' | 'config'

interface MobileToolboxProps {
  onSend: (text: string) => void
  disabled?: boolean
  fontSize: number
  onFontSizeChange: (size: number) => void
  voiceRef?: RefObject<VoiceInputHandle | null>
  keyboardMode?: boolean
  onToggleKeyboard?: () => void
  taskHistoryPaneKey?: string | null
  onStatusChange?: () => void
}

export function MobileToolbox({
  onSend,
  disabled,
  fontSize,
  onFontSizeChange,
  voiceRef,
  keyboardMode,
  onToggleKeyboard,
  taskHistoryPaneKey: _taskHistoryPaneKey,
  onStatusChange: _onStatusChange,
}: MobileToolboxProps) {
  const [activeTab, setActiveTab] = useState<TabId>('ai')
  const [ctrlActive, setCtrlActive] = useState(false)
  const [altActive, setAltActive] = useState(false)
  const [voiceText, setVoiceText] = useState<string | undefined>(undefined)
  const localVoiceRef = useRef<VoiceInputHandle | null>(null)
  const effectiveVoiceRef = voiceRef || localVoiceRef

  const prefix = useTmuxPrefix()
  const [keyRow1, keyRow2] = createKeyRows(prefix.code)

  const handleKey = useCallback((key: KeyDef) => {
    if (key.modifier === 'ctrl') {
      setCtrlActive(prev => !prev)
      return
    }
    if (key.modifier === 'alt') {
      setAltActive(prev => !prev)
      return
    }
    if (!key.data) return

    let data = key.data
    if (ctrlActive && data.length === 1) {
      const upper = data.toUpperCase()
      if (upper >= 'A' && upper <= 'Z') {
        data = String.fromCharCode(upper.charCodeAt(0) - 64)
      }
      setCtrlActive(false)
    }
    if (altActive && data.length === 1) {
      data = '\x1b' + data
      setAltActive(false)
    }
    onSend(data)
  }, [ctrlActive, altActive, onSend])

  const handleVoiceText = useCallback((text: string) => {
    setVoiceText(text)
    setActiveTab('ai')
  }, [])

  const handleTextConsumed = useCallback(() => {
    setVoiceText(undefined)
  }, [])

  if (keyboardMode) {
    return (
      <div className="mobile-toolbox keyboard-mode">
        <div className="toolbox-keys">
          <div className="toolbox-key-row">
            {keyRow1.map(k => (
              <button
                key={k.label}
                className="toolbox-key"
                onMouseDown={preventFocus}
                onTouchStart={preventFocus}
                onTouchEnd={(e) => { e.preventDefault(); handleKey(k) }}
                type="button"
                style={{ touchAction: 'manipulation', WebkitUserSelect: 'none' } as React.CSSProperties}
              >
                {k.label}
              </button>
            ))}
          </div>
          <div className="toolbox-key-row">
            {keyRow2.map(k => (
              <button
                key={k.label}
                className={`toolbox-key ${k.modifier === 'ctrl' && ctrlActive ? 'active' : ''} ${k.modifier === 'alt' && altActive ? 'active' : ''}`}
                onMouseDown={preventFocus}
                onTouchStart={preventFocus}
                onTouchEnd={(e) => { e.preventDefault(); handleKey(k) }}
                type="button"
                style={{ touchAction: 'manipulation', WebkitUserSelect: 'none' } as React.CSSProperties}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>
        <div className="keyboard-mode-bar">
          <button
            className="toolbox-grid-btn"
            onMouseDown={preventFocus}
            onTouchStart={preventFocus}
            onTouchEnd={(e) => { e.preventDefault(); onToggleKeyboard?.() }}
            onClick={onToggleKeyboard}
            type="button"
          >
            <Grid3X3 size={18} />
          </button>
          <span className="keyboard-mode-label">收起键盘</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mobile-toolbox">
      {/* Quick keys */}
      <div className="toolbox-keys">
        <div className="toolbox-key-row">
          {keyRow1.map(k => (
            <button
              key={k.label}
              className="toolbox-key"
              onMouseDown={preventFocus}
              onTouchStart={preventFocus}
              onTouchEnd={(e) => { e.preventDefault(); handleKey(k) }}
              type="button"
              style={{ touchAction: 'manipulation', WebkitUserSelect: 'none' } as React.CSSProperties}
            >
              {k.label}
            </button>
          ))}
        </div>
        <div className="toolbox-key-row toolbox-font-row">
          <div className="toolbox-font-slider">
            <span className="font-slider-label">A</span>
            <input
              type="range"
              min="6"
              max="12"
              step="0.5"
              value={fontSize}
              onChange={(e) => onFontSizeChange(parseFloat(e.target.value))}
              onMouseDown={preventFocus}
              className="font-slider-input"
            />
            <span className="font-slider-value">{fontSize}</span>
          </div>
        </div>
        <div className="toolbox-key-row">
          {keyRow2.map(k => (
            <button
              key={k.label}
              className={`toolbox-key ${k.modifier === 'ctrl' && ctrlActive ? 'active' : ''} ${k.modifier === 'alt' && altActive ? 'active' : ''}`}
              onMouseDown={preventFocus}
              onTouchStart={preventFocus}
              onTouchEnd={(e) => { e.preventDefault(); handleKey(k) }}
              type="button"
              style={{ touchAction: 'manipulation', WebkitUserSelect: 'none' } as React.CSSProperties}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="toolbox-content">
        {activeTab === 'snippets' && (
          <SnippetsTab onSend={onSend} disabled={disabled} />
        )}
        {activeTab === 'ai' && (
          <AiCommandTab
            onSend={onSend}
            disabled={disabled}
            initialText={voiceText}
            onTextConsumed={handleTextConsumed}
          />
        )}
        {activeTab === 'config' && (
          <ConfigViewer />
        )}
        {activeTab === 'upload' && (
          <FileUpload compact onSend={onSend} />
        )}
      </div>

      {/* Tab bar */}
      <div className="toolbox-tabbar">
        <button
          className="toolbox-grid-btn"
          onMouseDown={preventFocus}
          onTouchStart={preventFocus}
          onTouchEnd={(e) => { e.preventDefault(); onToggleKeyboard?.() }}
          onClick={onToggleKeyboard}
          type="button"
        >
          <Grid3X3 size={18} />
        </button>
        <button
          className={`toolbox-tab ${activeTab === 'snippets' ? 'active' : ''}`}
          onMouseDown={preventFocus}
          onTouchStart={preventFocus}
          onTouchEnd={(e) => { e.preventDefault(); setActiveTab('snippets') }}
          type="button"
        >
          <Clock size={14} />
          <span>命令</span>
        </button>
        <div className="toolbox-tab-voice"
          onMouseDown={preventFocus}
          onTouchStart={preventFocus}
        >
          <VoiceInput
            ref={effectiveVoiceRef}
            onText={handleVoiceText}
            disabled={disabled}
          />
        </div>
        <button
          className={`toolbox-tab ${activeTab === 'config' ? 'active' : ''}`}
          onMouseDown={preventFocus}
          onTouchStart={preventFocus}
          onTouchEnd={(e) => { e.preventDefault(); setActiveTab('config') }}
          type="button"
        >
          <Settings size={14} />
          <span>配置</span>
        </button>
        <button
          className={`toolbox-tab ${activeTab === 'upload' ? 'active' : ''}`}
          onMouseDown={preventFocus}
          onTouchStart={preventFocus}
          onTouchEnd={(e) => { e.preventDefault(); setActiveTab('upload') }}
          type="button"
        >
          <Upload size={14} />
          <span>上传</span>
        </button>
        <button
          className={`toolbox-tab ${activeTab === 'ai' ? 'active' : ''}`}
          onMouseDown={preventFocus}
          onTouchStart={preventFocus}
          onTouchEnd={(e) => { e.preventDefault(); setActiveTab('ai') }}
          type="button"
        >
          <Bot size={14} />
          <span>AI</span>
        </button>
      </div>
    </div>
  )
}
