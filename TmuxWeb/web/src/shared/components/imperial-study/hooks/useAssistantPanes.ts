import { useState, useCallback, useRef } from 'react';
import { BUTLER_API_BASE } from '../constants';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    reasoning?: string;
    assistantType: string;
    timestamp: number;
    streaming?: boolean;
    error?: string;
}

function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function useAssistantPanes() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [streaming, setStreaming] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    const clearMessages = useCallback(() => {
        abortRef.current?.abort();
        setMessages([]);
        setStreaming(false);
    }, []);

    const sendMessage = useCallback((content: string, assistantType: string) => {
        // Abort any in-flight request
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const userMsg: ChatMessage = {
            id: generateId(),
            role: 'user',
            content,
            assistantType,
            timestamp: Date.now(),
        };

        const assistantId = generateId();
        const assistantMsg: ChatMessage = {
            id: assistantId,
            role: 'assistant',
            content: '',
            assistantType,
            timestamp: Date.now(),
            streaming: true,
        };

        setMessages(prev => [...prev, userMsg, assistantMsg]);
        setStreaming(true);

        (async () => {
            try {
                const res = await fetch(`${BUTLER_API_BASE}/assistant-panes/quick`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'text/event-stream',
                    },
                    body: JSON.stringify({ assistant_type: assistantType, content }),
                    signal: controller.signal,
                });

                if (!res.ok) {
                    setMessages(prev => prev.map(m =>
                        m.id === assistantId
                            ? { ...m, streaming: false, error: `HTTP ${res.status}` }
                            : m
                    ));
                    setStreaming(false);
                    return;
                }

                const reader = res.body!.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    let currentEvent = '';
                    for (const line of lines) {
                        if (line.startsWith('event: ')) {
                            currentEvent = line.slice(7).trim();
                        } else if (line.startsWith('data: ') && currentEvent) {
                            try {
                                const data = JSON.parse(line.slice(6));
                                switch (currentEvent) {
                                    case 'chunk':
                                        setMessages(prev => prev.map(m =>
                                            m.id === assistantId
                                                ? { ...m, content: m.content + (data.content ?? '') }
                                                : m
                                        ));
                                        break;
                                    case 'reasoning':
                                        setMessages(prev => prev.map(m =>
                                            m.id === assistantId
                                                ? { ...m, reasoning: (m.reasoning ?? '') + (data.content ?? '') }
                                                : m
                                        ));
                                        break;
                                    case 'done':
                                        setMessages(prev => prev.map(m =>
                                            m.id === assistantId
                                                ? {
                                                    ...m,
                                                    streaming: false,
                                                    content: data.content ?? m.content,
                                                }
                                                : m
                                        ));
                                        setStreaming(false);
                                        break;
                                    case 'error':
                                        setMessages(prev => prev.map(m =>
                                            m.id === assistantId
                                                ? {
                                                    ...m,
                                                    streaming: false,
                                                    error: data.message ?? data.content ?? 'Unknown error',
                                                }
                                                : m
                                        ));
                                        setStreaming(false);
                                        break;
                                }
                            } catch {
                                // Skip malformed JSON lines
                            }
                            currentEvent = '';
                        }
                    }
                }

                // Stream ended without done event
                setMessages(prev => {
                    const msg = prev.find(m => m.id === assistantId);
                    if (msg?.streaming) {
                        return prev.map(m =>
                            m.id === assistantId ? { ...m, streaming: false } : m
                        );
                    }
                    return prev;
                });
                setStreaming(false);
            } catch (err: unknown) {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                const msg = err instanceof Error ? err.message : 'Network error';
                setMessages(prev => prev.map(m =>
                    m.id === assistantId
                        ? { ...m, streaming: false, error: msg }
                        : m
                ));
                setStreaming(false);
            }
        })();
    }, []);

    return { messages, streaming, sendMessage, clearMessages };
}
