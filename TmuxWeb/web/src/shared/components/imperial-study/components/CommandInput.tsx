// CommandInput.tsx — 下指令 (Give Orders to Butler)
import { useState, useCallback, useRef, useMemo } from "react";
import { Send, Loader2 } from "lucide-react";
import { VoiceInput } from "../../VoiceInput";
import { BUTLER_API_BASE } from "../constants";
import type { RoutingInfo } from "../types";

function extractGithubUrl(text: string): string | null {
    const match = text.match(/https?:\/\/github\.com\/[\w.-]+\/[\w.-]+|git@github\.com:[\w.-]+\/[\w.-]+/);
    return match ? match[0].replace(/\.git$/, '') : null;
}

const ASSISTANT_TAGS = [
    { id: 'translator', label: '翻译', color: '#8b5cf6' },
    { id: 'cli', label: '命令行', color: '#06b6d4' },
    { id: 'market', label: '行情', color: '#f59e0b' },
    { id: 'chat', label: '闲聊', color: '#ec4899' },
] as const;

interface CommandInputProps {
    onDispatched?: (result: { run_id: string; task_id: string; routing?: RoutingInfo; intent: string }) => void;
    paneTarget?: string | null;
    activeTag: string | null;
    onTagChange: (tag: string | null) => void;
    onAssistantSend?: (content: string, assistantType: string) => void;
}

export function CommandInput({ onDispatched, paneTarget, activeTag, onTagChange, onAssistantSend }: CommandInputProps) {
    const [intent, setIntent] = useState('');
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const clearFeedback = useCallback(() => {
        setFeedback(null);
    }, []);

    const activeTagLabel = useMemo(() => {
        if (!activeTag) return null;
        return ASSISTANT_TAGS.find(t => t.id === activeTag)?.label ?? null;
    }, [activeTag]);

    const resetHeight = useCallback(() => {
        const el = textareaRef.current;
        if (el) el.style.height = 'auto';
    }, []);

    const handleSubmit = useCallback(async () => {
        const trimmed = intent.trim();
        if (!trimmed || loading) return;

        // If a tag is selected, route to assistant pane
        if (activeTag) {
            onAssistantSend?.(trimmed, activeTag);
            setIntent('');
            resetHeight();
            return;
        }

        setLoading(true);
        setFeedback(null);

        try {
            const payload: Record<string, unknown> = { intent: trimmed };
            if (paneTarget) {
                payload.params = { pane_target: paneTarget };
            }
            const githubUrl = extractGithubUrl(trimmed);
            if (githubUrl) {
                if (!payload.params) payload.params = {};
                (payload.params as Record<string, unknown>).github_url = githubUrl;
            }
            const res = await fetch(`${BUTLER_API_BASE}/orchestrate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            console.log('[CommandInput] orchestrate RES', data);
            if (data.success) {
                // Chat fallback: auto-switch to 闲聊 mode
                if (data.data?.chat_fallback) {
                    setFeedback({ type: "ok", msg: "闲聊模式" });
                    onAssistantSend?.(trimmed, "chat");
                    onTagChange("chat");
                    setIntent("");
                    resetHeight();
                    setTimeout(clearFeedback, 3000);
                    return;
                }

                // Auto-dispatch when selection is required: use recommended assistant
                if (data.data?.selection_required && data.data?.recommended) {
                    setFeedback({ type: "ok", msg: `派发中 · ${data.data.recommended}...` });
                    try {
                        const dispatchRes = await fetch(`${BUTLER_API_BASE}/orchestrate`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ...payload, assistant: data.data.recommended }),
                        });
                        if (!dispatchRes.ok) throw new Error(`HTTP ${dispatchRes.status}`);
                        const dispatchData = await dispatchRes.json();
                        if (dispatchData.success && dispatchData.data?.run_id) {
                            setFeedback({ type: "ok", msg: `已下旨 · ${data.data.recommended} · run ${dispatchData.data.run_id.slice(0, 8)}` });
                            setIntent("");
                            resetHeight();
                            onDispatched?.({ ...dispatchData.data, intent: trimmed });
                            setTimeout(clearFeedback, 4000);
                        } else {
                            setFeedback({ type: "err", msg: dispatchData.error?.message || "二次派发失败" });
                        }
                    } catch (dispatchErr: unknown) {
                        const msg = dispatchErr instanceof Error ? dispatchErr.message : "Network error";
                        setFeedback({ type: "err", msg });
                    }
                    return;
                }

                if (data.data?.escalation_required || !data.data?.run_id) {
                    const urlMatch = trimmed.match(/https?:\/\/\S+/);
                    if (urlMatch && /待阅读|阅读|read|收藏|bookmark|save/i.test(trimmed)) {
                        try {
                            const readingRes = await fetch(`${BUTLER_API_BASE}/readings`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ url: urlMatch[0], title: trimmed.replace(/https?:\/\/\S+/, '').replace(/^[,，\s]+|[,，\s]+$/g, '').trim() || trimmed }),
                            });
                            if (readingRes.ok) {
                                setFeedback({ type: "ok", msg: "📚 已加入待阅读" });
                                setIntent('');
                                resetHeight();
                                setTimeout(clearFeedback, 3000);
                                return;
                            }
                        } catch {
                        }
                    }
                    setFeedback({ type: "ok", msg: "🤖 转交 AI 分析..." });
                    onAssistantSend?.(trimmed, "chat");
                    onTagChange("chat");
                    setIntent("");
                    resetHeight();
                    setTimeout(clearFeedback, 3000);
                    return;
                }

                setFeedback({ type: "ok", msg: `已下旨 · run ${data.data.run_id.slice(0, 8)}` });
                setIntent("");
                resetHeight();
                onDispatched?.({ ...data.data, intent: trimmed });
                // Auto-clear feedback
                setTimeout(clearFeedback, 4000);
            } else {
                const errMsg = data.error?.message || data.detail || "Dispatch failed";
                setFeedback({ type: "err", msg: errMsg });
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Network error";
            setFeedback({ type: "err", msg });
        } finally {
            setLoading(false);
        }
    }, [intent, loading, onDispatched, clearFeedback, paneTarget, activeTag, onAssistantSend, onTagChange, resetHeight]);

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

    // Auto-resize textarea to fit content
    const autoResize = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }, []);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setIntent(e.target.value);
        // defer resize to next tick so value is committed
        requestAnimationFrame(autoResize);
    }, [autoResize]);

    return (
        <div className="is-command">
            <div className="is-command__box">
                <textarea
                    ref={textareaRef}
                    className="is-command__input"
                    value={intent}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    placeholder={activeTagLabel ? `${activeTagLabel}... (\u2318+Enter)` : "\u4e0b\u65e8\u2026 (\u2318+Enter \u53d1\u9001)"}
                    disabled={loading}
                    rows={1}
                />
                <VoiceInput
                    onText={(text) => setIntent((prev) => {
                        const base = prev.replace(/\s*\[.*\]\s*$/, "").trim();
                        return base ? base + " " + text : text;
                    })}
                    onPartial={(text) => setIntent((prev) => {
                        const base = prev.replace(/\s*\[.*\]\s*$/, "").trim();
                        return base ? base + " [" + text + "]" : "[" + text + "]";
                    })}
                    disabled={loading}
                />
                <button
                    className={`is-command__send ${loading ? "loading" : ""}`}
                    onClick={handleSubmit}
                    disabled={!intent.trim() || loading}
                    title="Send"
                >
                    {loading ? <Loader2 size={16} /> : <Send size={16} />}
                </button>
            </div>
            <div className="is-command__tags">
                {ASSISTANT_TAGS.map(tag => (
                    <button
                        key={tag.id}
                        className={`is-command__tag ${activeTag === tag.id ? 'active' : ''}`}
                        style={{ '--tag-color': tag.color } as React.CSSProperties}
                        onClick={() => onTagChange(activeTag === tag.id ? null : tag.id)}
                    >
                        {tag.label}
                    </button>
                ))}
            </div>
            {feedback && (
                <div className={`is-command__feedback ${feedback.type}`}>
                    {feedback.msg}
                </div>
            )}
        </div>
    );
}
