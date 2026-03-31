import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { ChatMessage } from '../hooks/useAssistantPanes';

interface AssistantChatPanelProps {
    messages: ChatMessage[];
    streaming: boolean;
    onClear: () => void;
    filterType?: string | null;
}

export function AssistantChatPanel({ messages, streaming, onClear, filterType }: AssistantChatPanelProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    const filtered = filterType
        ? messages.filter(m => m.assistantType === filterType)
        : messages;

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [filtered]);

    return (
        <div className="is-chat-panel">
            <div className="is-chat-panel__header">
                <button
                    className="is-chat-panel__clear is-icon-btn"
                    onClick={onClear}
                    title="Clear chat"
                >
                    <X size={12} />
                </button>
            </div>
            <div className="is-chat-panel__messages">
                {filtered.map(msg => (
                    <div
                        key={msg.id}
                        className={`is-chat-bubble is-chat-bubble--${msg.role}`}
                    >
                        {msg.role === 'assistant' && msg.reasoning && (
                            <div className="is-chat-bubble__reasoning">
                                {msg.reasoning}
                            </div>
                        )}
                        <div className="is-chat-bubble__content">
                            {msg.content}
                            {msg.streaming && <span className="is-chat-bubble__dot" />}
                        </div>
                        {msg.error && (
                            <div className="is-chat-bubble__error">{msg.error}</div>
                        )}
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
        </div>
    );
}
