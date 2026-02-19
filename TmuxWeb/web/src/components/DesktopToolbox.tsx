import { useState, useCallback, useRef, RefObject } from 'react'
import { Bot, FileCode2 } from 'lucide-react'
import { VoiceInput, VoiceInputHandle } from './VoiceInput'
import { AiCommandTab } from './AiCommandTab'
import { SnippetsTab } from './SnippetsTab'
import { useTmuxPrefix } from '../hooks/useTmuxPrefix'
import './DesktopToolbox.css'

type TabId = 'ai' | 'snippets'

interface DesktopToolboxProps {
  onSend: (text: string) => void
  disabled?: boolean
  voiceRef?: RefObject<VoiceInputHandle | null>
}

interface QuickKey {
  label: string
  title: string
  data: string
}

export function DesktopToolbox({ onSend, disabled, voiceRef }: DesktopToolboxProps) {
  const [activeTab, setActiveTab] = useState<TabId>('ai')
  const [voiceText, setVoiceText] = useState<string | undefined>(undefined)
  const localVoiceRef = useRef<VoiceInputHandle>(null)
  const effectiveVoiceRef = voiceRef || localVoiceRef
  const prefix = useTmuxPrefix()

  const quickKeys: QuickKey[] = [
    { label: '📜', title: `滚动模式 (${prefix.label} + [)`, data: prefix.code + '[' },
    { label: '^C', title: 'Ctrl+C 中断', data: '\x03' },
    { label: 'clr', title: '清行 (Ctrl+U)', data: '\x15' },
    { label: 'esc', title: 'Escape', data: '\x1b' },
    { label: 'tab', title: 'Tab', data: '\t' },
  ]

  const handleVoiceText = useCallback((text: string) => {
    setVoiceText(text)
    setActiveTab('ai')
  }, [])

  const handleTextConsumed = useCallback(() => {
    setVoiceText(undefined)
  }, [])

  const tabs: { id: TabId; icon: typeof Bot; label: string }[] = [
    { id: 'ai', icon: Bot, label: 'AI' },
    { id: 'snippets', icon: FileCode2, label: '片段' },
  ]

  return (
    <div className="desktop-toolbox">
      <div className="desktop-toolbox-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`desktop-toolbox-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={14} />
            <span>{tab.label}</span>
          </button>
        ))}
        <div className="desktop-toolbox-tab desktop-toolbox-voice-btn">
          <VoiceInput
            ref={effectiveVoiceRef}
            onText={handleVoiceText}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="desktop-quick-keys">
        {quickKeys.map(k => (
          <button
            key={k.label}
            className="desktop-quick-key"
            title={k.title}
            onClick={() => onSend(k.data)}
            disabled={disabled}
          >
            {k.label}
          </button>
        ))}
        <span className="desktop-prefix-label">{prefix.label}</span>
      </div>

      <div className="desktop-toolbox-content">
        {activeTab === 'ai' && (
          <AiCommandTab
            onSend={onSend}
            disabled={disabled}
            initialText={voiceText}
            onTextConsumed={handleTextConsumed}
          />
        )}

        {activeTab === 'snippets' && (
          <SnippetsTab
            onSend={onSend}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  )
}
