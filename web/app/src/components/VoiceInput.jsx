import React, { useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { getToken } from '../utils/auth';

/**
 * VoiceInput — Xunfei speech-to-text button
 * 
 * Captures microphone audio, resamples to 16kHz 16-bit PCM mono,
 * streams via WebSocket to /ws/speech backend proxy → Xunfei API.
 * 
 * Props:
 *   onText(text)     — called with final recognized text
 *   onPartial(text)  — called with partial (live) recognized text
 *   disabled         — disables the button
 */
const VoiceInput = forwardRef(function VoiceInput({ onText, onPartial, disabled }, ref) {
    const [status, setStatus] = useState('idle'); // idle | connecting | recording | processing
    const [partialText, setPartialText] = useState('');
    const wsRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const processorRef = useRef(null);
    const audioContextRef = useRef(null);
    const resultsRef = useRef(new Map());
    const connectTimeoutRef = useRef(null);

    const cleanup = useCallback(() => {
        if (connectTimeoutRef.current) {
            clearTimeout(connectTimeoutRef.current);
            connectTimeoutRef.current = null;
        }
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(t => t.stop());
            mediaStreamRef.current = null;
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
    }, []);

    const startAudioCapture = useCallback((stream) => {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioCtx();
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        const nativeSR = audioContext.sampleRate;
        const targetSR = 16000;

        processor.onaudioprocess = (e) => {
            if (wsRef.current?.readyState !== WebSocket.OPEN) return;

            const inputData = e.inputBuffer.getChannelData(0);

            // Resample to 16kHz if needed
            let outputData;
            if (nativeSR !== targetSR) {
                const ratio = nativeSR / targetSR;
                const newLen = Math.round(inputData.length / ratio);
                outputData = new Float32Array(newLen);
                for (let i = 0; i < newLen; i++) {
                    outputData[i] = inputData[Math.round(i * ratio)];
                }
            } else {
                outputData = inputData;
            }

            // Convert to 16-bit PCM
            const pcm = new Int16Array(outputData.length);
            for (let i = 0; i < outputData.length; i++) {
                const s = Math.max(-1, Math.min(1, outputData[i]));
                pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }

            // Send as base64
            const bytes = new Uint8Array(pcm.buffer);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);
            wsRef.current.send(JSON.stringify({ type: 'audio', audio: base64 }));
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
    }, []);

    const startRecording = useCallback(async () => {
        try {
            // Check if getUserMedia is available (requires HTTPS on iOS)
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                const isHTTP = window.location.protocol === 'http:';
                if (isHTTP) {
                    alert('麦克风需要 HTTPS 才能使用。\n\n当前是 HTTP 连接，iOS/浏览器会阻止麦克风权限。\n\n解决方法：使用 localhost 或 HTTPS 地址访问。');
                } else {
                    alert('当前浏览器不支持麦克风功能。');
                }
                return;
            }

            setStatus('connecting');
            resultsRef.current.clear();
            setPartialText('');

            // Get microphone — explicitly request permission
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
                });
            } catch (permErr) {
                console.error('[Voice] Permission error:', permErr);
                if (permErr.name === 'NotAllowedError') {
                    alert('麦克风权限被拒绝。\n\n请在浏览器设置中允许麦克风权限，然后重试。');
                } else if (permErr.name === 'NotFoundError') {
                    alert('未检测到麦克风设备。');
                } else {
                    const isHTTP = window.location.protocol === 'http:';
                    alert(isHTTP
                        ? '无法访问麦克风。\n\nHTTP 连接下麦克风被阻止，请使用 HTTPS 或 localhost 访问。'
                        : '无法访问麦克风: ' + permErr.message);
                }
                setStatus('idle');
                return;
            }
            mediaStreamRef.current = stream;

            // Connect to speech WebSocket (via Vite proxy → backend)
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const token = getToken();
            const wsUrl = `${protocol}//${window.location.host}/ws/speech?token=${encodeURIComponent(token)}`;
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                ws.send(JSON.stringify({ type: 'start' }));
                // Timeout: if Xunfei doesn't send 'ready' within 10s, abort
                connectTimeoutRef.current = setTimeout(() => {
                    console.warn('[Voice] Connection timeout — no ready message');
                    cleanup();
                    setStatus('idle');
                    setPartialText('');
                }, 10000);
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);

                if (data.type === 'ready') {
                    if (connectTimeoutRef.current) {
                        clearTimeout(connectTimeoutRef.current);
                        connectTimeoutRef.current = null;
                    }
                    setStatus('recording');
                    startAudioCapture(stream);
                } else if (data.type === 'partial') {
                    // Handle wpgs dynamic correction:
                    // pgs='apd' means append new sentence
                    // pgs='rpl' means replace sentences in range rg=[start,end]
                    if (data.pgs === 'rpl' && data.rg) {
                        // Delete old sentences that this correction replaces
                        for (let i = data.rg[0]; i <= data.rg[1]; i++) {
                            resultsRef.current.delete(i);
                        }
                    }
                    resultsRef.current.set(data.sn, data.text);
                    const fullText = Array.from(resultsRef.current.entries())
                        .sort((a, b) => a[0] - b[0])
                        .map(([, t]) => t)
                        .join('');
                    setPartialText(fullText);
                    onPartial?.(fullText);
                } else if (data.type === 'end') {
                    const finalText = Array.from(resultsRef.current.entries())
                        .sort((a, b) => a[0] - b[0])
                        .map(([, t]) => t)
                        .join('');
                    if (finalText.trim()) {
                        onText(finalText.trim());
                    }
                    cleanup();
                    setStatus('idle');
                    setPartialText('');
                } else if (data.type === 'error') {
                    console.error('[Voice] Error:', data.message);
                    cleanup();
                    setStatus('idle');
                    setPartialText('');
                }
            };

            ws.onerror = () => { cleanup(); setStatus('idle'); };
            ws.onclose = () => { cleanup(); setStatus('idle'); };

        } catch (err) {
            console.error('[Voice] Failed:', err);
            alert('语音功能出错: ' + err.message);
            setStatus('idle');
        }
    }, [onText, onPartial, startAudioCapture, cleanup]);

    const stopRecording = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'stop' }));
            setStatus('processing');
        }
    }, []);

    const handleClick = () => {
        if (status === 'idle') startRecording();
        else if (status === 'recording') stopRecording();
    };

    // Expose toggle for external callers (shake gesture, etc.)
    useImperativeHandle(ref, () => ({
        toggle: handleClick,
        status,
    }), [status, startRecording, stopRecording]);

    const isWorking = status === 'connecting' || status === 'processing';

    return (
        <div className="relative flex items-center">
            <button
                onClick={handleClick}
                disabled={disabled || isWorking}
                className={`
          w-11 h-11 rounded-full flex items-center justify-center transition-all
          disabled:opacity-50 disabled:cursor-not-allowed select-none
          ${status === 'recording'
                        ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30'
                        : isWorking
                            ? 'bg-blue-600 text-white'
                            : 'bg-[#3e4451] text-[#9da5b4] hover:bg-[#4d78cc] hover:text-white active:scale-95'
                    }
        `}
                title={
                    status === 'idle' ? '语音输入' :
                        status === 'recording' ? '停止录音' : '处理中...'
                }
                style={{ touchAction: 'manipulation', WebkitUserSelect: 'none' }}
            >
                {isWorking ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : status === 'recording' ? (
                    <MicOff className="w-5 h-5" />
                ) : (
                    <Mic className="w-5 h-5" />
                )}
            </button>

            {/* Partial text preview bubble */}
            {partialText && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#1e2028] border border-[#3e4451] rounded-lg text-xs text-[#abb2bf] max-w-[260px] whitespace-pre-wrap shadow-xl z-50">
                    {partialText}
                </div>
            )}
        </div>
    );
});

export default VoiceInput;
