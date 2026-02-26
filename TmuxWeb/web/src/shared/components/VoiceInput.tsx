import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Mic, MicOff, Loader2 } from 'lucide-react'
import { getToken } from '../../utils/auth'
import './VoiceInput.css'

interface Props {
  onText: (text: string) => void
  onPartial?: (text: string) => void
  disabled?: boolean
}

export interface VoiceInputHandle {
  toggle: () => void
  status: Status
}

type Status = 'idle' | 'connecting' | 'recording' | 'processing'

const CONNECT_TIMEOUT_MS = 10000

export const VoiceInput = forwardRef<VoiceInputHandle | null, Props>(function VoiceInput({ onText, onPartial, disabled }, ref) {
  const [status, setStatus] = useState<Status>('idle')
  const [partialText, setPartialText] = useState('')
  const wsRef = useRef<WebSocket | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const resultsRef = useRef<Map<number, string>>(new Map())
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cleanup = useCallback(() => {
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current)
      connectTimeoutRef.current = null
    }
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const startAudioCapture = useCallback(async (stream: MediaStream) => {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const audioContext = new AudioContextClass()
    audioContextRef.current = audioContext

    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    const source = audioContext.createMediaStreamSource(stream)
    const processor = audioContext.createScriptProcessor(4096, 1, 1)
    processorRef.current = processor

    const nativeSampleRate = audioContext.sampleRate
    const targetSampleRate = 16000

    processor.onaudioprocess = (e) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) return

      const inputData = e.inputBuffer.getChannelData(0)

      let outputData: Float32Array
      if (nativeSampleRate !== targetSampleRate) {
        const ratio = nativeSampleRate / targetSampleRate
        const newLength = Math.round(inputData.length / ratio)
        outputData = new Float32Array(newLength)
        for (let i = 0; i < newLength; i++) {
          outputData[i] = inputData[Math.round(i * ratio)]
        }
      } else {
        outputData = inputData
      }

      const pcmData = new Int16Array(outputData.length)
      for (let i = 0; i < outputData.length; i++) {
        const s = Math.max(-1, Math.min(1, outputData[i]))
        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
      }

      const bytes = new Uint8Array(pcmData.buffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      const base64 = btoa(binary)
      wsRef.current.send(JSON.stringify({ type: 'audio', audio: base64 }))
    }

    source.connect(processor)
    processor.connect(audioContext.destination)
  }, [])

  const startRecording = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const isHTTP = window.location.protocol === 'http:'
        if (isHTTP) {
          alert('麦克风需要 HTTPS 才能使用。\n\n当前是 HTTP 连接，iOS/浏览器会阻止麦克风权限。\n\n解决方法：使用 localhost 或 HTTPS 地址访问。')
        } else {
          alert('当前浏览器不支持麦克风功能。')
        }
        return
      }

      setStatus('connecting')
      resultsRef.current.clear()
      setPartialText('')

      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true
          }
        })
      } catch (permErr) {
        console.error('[Voice] Permission error:', permErr)
        if (permErr instanceof Error) {
          if (permErr.name === 'NotAllowedError') {
            alert('麦克风权限被拒绝。\n\n请在浏览器设置中允许麦克风权限，然后重试。')
          } else if (permErr.name === 'NotFoundError') {
            alert('未检测到麦克风设备。')
          } else {
            const isHTTP = window.location.protocol === 'http:'
            alert(isHTTP
              ? '无法访问麦克风。\n\nHTTP 连接下麦克风被阻止，请使用 HTTPS 或 localhost 访问。'
              : '无法访问麦克风: ' + permErr.message)
          }
        }
        setStatus('idle')
        return
      }
      mediaStreamRef.current = stream

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const token = getToken()
      const wsUrl = `${protocol}//${window.location.host}/ws/speech?token=${encodeURIComponent(token || '')}`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'start' }))
        connectTimeoutRef.current = setTimeout(() => {
          console.warn('[Voice] Connection timeout — no ready message')
          cleanup()
          setStatus('idle')
          setPartialText('')
        }, CONNECT_TIMEOUT_MS)
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)

        if (data.type === 'ready') {
          if (connectTimeoutRef.current) {
            clearTimeout(connectTimeoutRef.current)
            connectTimeoutRef.current = null
          }
          setStatus('recording')
          startAudioCapture(stream).catch((err) => {
            console.error('[VoiceInput] Audio capture failed:', err)
            cleanup()
            setStatus('idle')
          })
        } else if (data.type === 'partial') {
          if (data.pgs === 'rpl' && Array.isArray(data.rg) && data.rg.length === 2) {
            for (let sn = data.rg[0]; sn <= data.rg[1]; sn++) {
              resultsRef.current.delete(sn)
            }
          }
          resultsRef.current.set(data.sn, data.text)
          const fullText = Array.from(resultsRef.current.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([, text]) => text)
            .join('')
          setPartialText(fullText)
          onPartial?.(fullText)
        } else if (data.type === 'end') {
          const finalText = Array.from(resultsRef.current.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([, text]) => text)
            .join('')
          if (finalText.trim()) {
            onText(finalText.trim())
          }
          cleanup()
          setStatus('idle')
          setPartialText('')
        } else if (data.type === 'error') {
          console.error('Speech error:', data.message)
          cleanup()
          setStatus('idle')
          setPartialText('')
        }
      }

      ws.onerror = () => {
        cleanup()
        setStatus('idle')
      }

      ws.onclose = () => {
        cleanup()
        setStatus('idle')
      }

    } catch (err) {
      console.error('[Voice] Failed:', err)
      if (err instanceof Error) {
        alert('语音功能出错: ' + err.message)
      }
      setStatus('idle')
    }
  }, [onText, onPartial, startAudioCapture, cleanup])

  const stopRecording = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }))
      setStatus('processing')
    }
  }, [])

  const handleClick = useCallback(() => {
    const active = document.activeElement as HTMLElement | null
    if (active && active.tagName === 'TEXTAREA') {
      active.blur()
    }
    if (status === 'idle') startRecording()
    else if (status === 'recording') stopRecording()
  }, [status, startRecording, stopRecording])

  useImperativeHandle(ref, () => ({
    toggle: handleClick,
    status,
  }), [status, handleClick])

  const isWorking = status === 'connecting' || status === 'processing'

  return (
    <div className="voice-input">
      <button
        className={`voice-btn ${status}`}
        onMouseDown={(e) => e.preventDefault()}
        onTouchStart={(e) => e.preventDefault()}
        onTouchEnd={(e) => { e.preventDefault(); if (!(disabled || isWorking)) handleClick() }}
        onClick={(e) => { e.preventDefault(); handleClick() }}
        disabled={disabled || isWorking}
        title={status === 'idle' ? '语音输入' : status === 'recording' ? '停止录音' : '处理中...'}
        style={{ touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none' } as React.CSSProperties}
        tabIndex={-1}
      >
        {isWorking ? (
          <Loader2 size={24} className="spin" />
        ) : status === 'recording' ? (
          <MicOff size={24} />
        ) : (
          <Mic size={24} />
        )}
      </button>
      {partialText && (
        <div className="voice-preview">{partialText}</div>
      )}
    </div>
  )
})
