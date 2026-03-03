// CommandInput.tsx — 下指令 (Give Orders to Butler)
import { useState, useCallback, useRef } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { BUTLER_API_BASE } from '../constants';

interface CommandInputProps {
    onDispatched?: (result: { run_id: string; task_id: string }) => void;
}

export function CommandInput({ onDispatched }: CommandInputProps) {
    const [intent, setIntent] = useState('');
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const clearFeedback = useCallback(() => {
        setFeedback(null);
    }, []);

    const handleSubmit = useCallback(async () => {
        const trimmed = intent.trim();
        if (!trimmed || loading) return;

        setLoading(true);
        setFeedback(null);

        try {
            const res = await fetch(`${BUTLER_API_BASE}/orchestrate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ intent: trimmed }),
            });
            const data = await res.json();

            if (data.success) {
                setFeedback({ type: 'ok', msg: `已下旨 · run ${data.data.run_id?.slice(0, 8)}` });
                setIntent('');
                onDispatched?.(data.data);
                // Auto-clear feedback
                setTimeout(clearFeedback, 4000);
            } else {
                const errMsg = data.error?.message || data.detail || 'Dispatch failed';
                setFeedback({ type: 'err', msg: errMsg });
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Network error';
            setFeedback({ type: 'err', msg });
        } finally {
            setLoading(false);
        }
    }, [intent, loading, onDispatched, clearFeedback]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            // Cmd/Ctrl + Enter to send
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit();
            }
        },
        [handleSubmit],
    );

    return (
        <div className="is-command">
            <div className="is-command__box">
                <textarea
                    ref={textareaRef}
                    className="is-command__input"
                    value={intent}
                    onChange={e => setIntent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="下旨… (⌘+Enter 发送)"
                    disabled={loading}
                    rows={2}
                />
                <button
                    className={`is-command__send ${loading ? 'loading' : ''}`}
                    onClick={handleSubmit}
                    disabled={!intent.trim() || loading}
                    title="Send"
                >
                    {loading ? <Loader2 size={16} /> : <Send size={16} />}
                </button>
            </div>
            {feedback && (
                <div className={`is-command__feedback ${feedback.type}`}>
                    {feedback.msg}
                </div>
            )}
        </div>
    );
}
