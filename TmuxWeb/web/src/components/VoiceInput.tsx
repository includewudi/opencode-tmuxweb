import { useState, useRef, useCallback } from 'react'
import { Mic, MicOff, Loader2 } from 'lucide-react'
import { getToken } from '../utils/auth'
import './VoiceInput.css'

interface Props {
  onText: (text: string) => void
  onPartial?: (text: string) => void
}

type Status = 'idle' | 'connecting' | 'recording' | 'processing'

export function VoiceInput({ onText, onPartial }: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [partialText, setPartialText] = useState('')
  const wsRef = useRef<WebSocket | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const resultsRef = useRef<Map<number, string>>(new Map())

  const startRecording = useCallback(async () => {
    try {
      setStatus('connecting')
      resultsRef.current.clear()
      setPartialText('')

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      })
      mediaStreamRef.current = stream

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const backendPort = window.location.port === '5215' ? '8215' : window.location.port
      const host = window.location.hostname
      const wsHost = backendPort ? `${host}:${backendPort}` : host
      const wsUrl = `${protocol}//${wsHost}/ws/speech?token=${getToken()}`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'start' }))
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        
        if (data.type === 'ready') {
          setStatus('recording')
          startAudioCapture(stream)
        } else if (data.type === 'partial') {
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

      ws.onerror = (event) => {
        console.error('[VoiceInput] WebSocket error:', event)
        cleanup()
        setStatus('idle')
      }

      ws.onclose = (event) => {
        console.log('[VoiceInput] WebSocket closed, code:', event.code, 'reason:', event.reason)
        cleanup()
        setStatus('idle')
      }

    } catch (err) {
      console.error('[VoiceInput] Failed to start recording:', err)
      if (err instanceof Error) {
        console.error('[VoiceInput] Error name:', err.name, 'message:', err.message)
      }
      setStatus('idle')
    }
  }, [onText, onPartial])

  const startAudioCapture = (stream: MediaStream) => {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const audioContext = new AudioContextClass()
    audioContextRef.current = audioContext
    
    console.log('[VoiceInput] AudioContext created, sampleRate:', audioContext.sampleRate)
    
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
      
      const base64 = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)))
      wsRef.current.send(JSON.stringify({ type: 'audio', audio: base64 }))
    }

    source.connect(processor)
    processor.connect(audioContext.destination)
  }

  const stopRecording = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }))
      setStatus('processing')
    }
  }, [])

  const cleanup = () => {
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
  }

  const handleClick = () => {
    if (status === 'idle') {
      startRecording()
    } else if (status === 'recording') {
      stopRecording()
    }
  }

  return (
    <div className="voice-input">
      <button
        className={`voice-btn ${status}`}
        onClick={handleClick}
        disabled={status === 'connecting' || status === 'processing'}
        title={status === 'idle' ? 'Start voice input' : status === 'recording' ? 'Stop recording' : 'Processing...'}
      >
        {status === 'connecting' || status === 'processing' ? (
          <Loader2 size={18} className="spin" />
        ) : status === 'recording' ? (
          <MicOff size={18} />
        ) : (
          <Mic size={18} />
        )}
      </button>
      {partialText && (
        <div className="voice-preview">{partialText}</div>
      )}
    </div>
  )
}
