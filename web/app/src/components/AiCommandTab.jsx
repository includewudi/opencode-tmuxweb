import React, { useState, useCallback, useEffect } from 'react';
import { Send, Terminal, Copy, Play, Loader2, ChevronUp, ChevronDown, Info, X, Plus, Pencil, Trash2 } from 'lucide-react';

/**
 * AiCommandTab — AI command generation panel with dynamic roles from API
 */

const BUILTIN_ROLES_FALLBACK = [
    { id: 'cli', emoji: '🖥️', label: '命令行大神', desc: '生成可执行的终端命令' },
    { id: 'ops', emoji: '🔧', label: '运维专家', desc: '优化 DevOps/运维提示词' },
    { id: 'prompt', emoji: '✨', label: '提示词优化', desc: '通用 AI 提示词优化' },
    { id: 'frontend', emoji: '🎨', label: '前端优化', desc: '前端开发提示词优化' },
    { id: 'backend', emoji: '⚙️', label: '后端优化', desc: '后端开发提示词优化' },
    { id: 'ui', emoji: '🎭', label: 'UI优化', desc: 'UI/UX 设计提示词优化' },
    { id: 'api', emoji: '🔄', label: 'API转换', desc: 'API 架构转换与重构' },
];

export default function AiCommandTab({ onSend, disabled, initialText, onTextConsumed }) {
    const [input, setInput] = useState(initialText || '');
    const [selectedRole, setSelectedRole] = useState('cli');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [showPromptViewer, setShowPromptViewer] = useState(false);
    const [showRoleManager, setShowRoleManager] = useState(false);
    const [roles, setRoles] = useState(BUILTIN_ROLES_FALLBACK);
    const [editingRole, setEditingRole] = useState(null); // null or { id, emoji, label, desc, prompt, suffix, isNew }

    // Load roles from API
    const fetchRoles = useCallback(async () => {
        try {
            const res = await fetch('/api/roles');
            const data = await res.json();
            if (data.roles?.length) {
                setRoles(data.roles.map(r => ({
                    id: r.id, emoji: r.emoji || '🤖', label: r.label || r.id,
                    desc: r.desc || '', prompt: r.prompt, suffix: r.suffix, builtin: r.builtin,
                })));
            }
        } catch (e) {
            console.warn('Failed to fetch roles:', e);
        }
    }, []);

    useEffect(() => { fetchRoles(); }, [fetchRoles]);

    React.useEffect(() => {
        if (initialText) {
            setInput(initialText);
            onTextConsumed?.();
        }
    }, [initialText, onTextConsumed]);

    const handleDirectSend = useCallback(() => {
        if (!input.trim() || disabled) return;
        onSend(input.trim() + '\n');
        setInput('');
    }, [input, onSend, disabled]);

    const handleAiGenerate = useCallback(async () => {
        if (!input.trim()) return;
        setLoading(true);
        setResult(null);
        setExpanded(false);
        try {
            const res = await fetch('/api/ai/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: input.trim(), role: selectedRole }),
            });
            const data = await res.json();
            setResult(data);
        } catch (err) {
            setResult({ command: '', explanation: '生成失败: ' + err.message });
        } finally {
            setLoading(false);
        }
    }, [input, selectedRole]);

    const handleCopy = useCallback(async () => {
        if (!result?.command) return;
        try {
            await navigator.clipboard.writeText(result.command);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { }
    }, [result]);

    const handleExecute = useCallback(() => {
        if (!result?.command || disabled) return;
        onSend(result.command + '\n');
    }, [result, onSend, disabled]);

    // --- Role CRUD helpers ---
    const handleSaveRole = useCallback(async (roleData) => {
        try {
            const isNew = roleData.isNew;
            const url = isNew ? '/api/roles' : `/api/roles/${roleData.id}`;
            const method = isNew ? 'POST' : 'PUT';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(roleData),
            });
            const data = await res.json();
            if (data.error) { alert(data.error); return; }
            setEditingRole(null);
            fetchRoles();
        } catch (e) { alert('保存失败: ' + e.message); }
    }, [fetchRoles]);

    const handleDeleteRole = useCallback(async (roleId) => {
        if (!confirm('确定删除此角色？')) return;
        try {
            const res = await fetch(`/api/roles/${roleId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.error) { alert(data.error); return; }
            fetchRoles();
        } catch (e) { alert('删除失败: ' + e.message); }
    }, [fetchRoles]);

    // ========== ROLE EDIT FORM ==========
    if (editingRole) {
        const [form, setForm] = [editingRole, setEditingRole];
        return (
            <div className="flex flex-col h-full">
                <div className="flex items-center justify-between px-3 py-2 border-b border-[#2c313a] shrink-0">
                    <span className="text-sm font-medium text-[#abb2bf]">
                        {form.isNew ? '➕ 新建角色' : `✏️ 编辑 ${form.label}`}
                    </span>
                    <button onClick={() => setEditingRole(null)}
                        className="p-1.5 rounded-md text-[#9da5b4] hover:bg-[#2c313a] hover:text-white transition-all">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2" style={{ WebkitOverflowScrolling: 'touch' }}>
                    <div className="flex gap-2">
                        <input value={form.emoji} onChange={e => setEditingRole({ ...form, emoji: e.target.value })}
                            placeholder="emoji" className="w-14 bg-[#1e2028] border border-[#3e4451] rounded px-2 py-1.5 text-sm text-[#abb2bf] text-center" style={{ fontSize: '16px' }} />
                        <input value={form.id} onChange={e => setEditingRole({ ...form, id: e.target.value })}
                            placeholder="ID (英文)" disabled={!form.isNew}
                            className="flex-1 bg-[#1e2028] border border-[#3e4451] rounded px-2 py-1.5 text-sm text-[#abb2bf] disabled:opacity-50" style={{ fontSize: '16px' }} />
                    </div>
                    <div className="flex gap-2">
                        <input value={form.label} onChange={e => setEditingRole({ ...form, label: e.target.value })}
                            placeholder="显示名称" className="flex-1 bg-[#1e2028] border border-[#3e4451] rounded px-2 py-1.5 text-sm text-[#abb2bf]" style={{ fontSize: '16px' }} />
                        <input value={form.desc} onChange={e => setEditingRole({ ...form, desc: e.target.value })}
                            placeholder="简短描述" className="flex-1 bg-[#1e2028] border border-[#3e4451] rounded px-2 py-1.5 text-sm text-[#abb2bf]" style={{ fontSize: '16px' }} />
                    </div>
                    <textarea value={form.prompt} onChange={e => setEditingRole({ ...form, prompt: e.target.value })}
                        placeholder="系统提示词 (System Prompt)" rows={5}
                        className="w-full bg-[#1e2028] border border-[#3e4451] rounded px-2 py-1.5 text-xs text-[#abb2bf] font-mono resize-none" style={{ fontSize: '14px' }} />
                    <textarea value={form.suffix} onChange={e => setEditingRole({ ...form, suffix: e.target.value })}
                        placeholder="输出后缀 (Suffix)" rows={2}
                        className="w-full bg-[#1e2028] border border-[#3e4451] rounded px-2 py-1.5 text-xs text-[#abb2bf] font-mono resize-none" style={{ fontSize: '14px' }} />
                    <button onClick={() => handleSaveRole(form)}
                        disabled={!form.id || !form.prompt || !form.suffix}
                        className="w-full py-2.5 rounded-lg bg-[#4d78cc] text-white text-sm font-medium hover:bg-[#5a87d9] disabled:opacity-30 transition-all active:scale-[0.97]">
                        💾 保存
                    </button>
                </div>
            </div>
        );
    }

    // ========== ROLE MANAGER PANEL ==========
    if (showRoleManager) {
        const customRoles = roles.filter(r => !r.builtin);
        return (
            <div className="flex flex-col h-full">
                <div className="flex items-center justify-between px-3 py-2 border-b border-[#2c313a] shrink-0">
                    <span className="text-sm font-medium text-[#abb2bf]">⚙️ 管理角色</span>
                    <div className="flex gap-1">
                        <button onClick={() => setEditingRole({ id: '', emoji: '🤖', label: '', desc: '', prompt: '', suffix: '', isNew: true })}
                            className="p-1.5 rounded-md text-[#9da5b4] hover:bg-[#2c313a] hover:text-white transition-all" title="新建角色">
                            <Plus className="w-4 h-4" />
                        </button>
                        <button onClick={() => setShowRoleManager(false)}
                            className="p-1.5 rounded-md text-[#9da5b4] hover:bg-[#2c313a] hover:text-white transition-all">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2" style={{ WebkitOverflowScrolling: 'touch' }}>
                    {/* Built-in roles (read-only) */}
                    <div className="text-xs text-[#555a66] mb-1">内置角色（不可修改）</div>
                    {roles.filter(r => r.builtin).map(role => (
                        <div key={role.id} className="flex items-center gap-2 px-3 py-2 bg-[#1a1c23] rounded-lg border border-[#2c313a]">
                            <span className="text-sm">{role.emoji}</span>
                            <span className="text-xs text-[#7a818c] flex-1">{role.label}</span>
                            <span className="text-xs text-[#555a66]">内置</span>
                        </div>
                    ))}
                    {/* Custom roles */}
                    {customRoles.length > 0 && (
                        <>
                            <div className="text-xs text-[#555a66] mt-3 mb-1">自定义角色</div>
                            {customRoles.map(role => (
                                <div key={role.id} className="flex items-center gap-2 px-3 py-2 bg-[#1a1c23] rounded-lg border border-[#2c313a]">
                                    <span className="text-sm">{role.emoji}</span>
                                    <span className="text-xs text-[#abb2bf] flex-1">{role.label}</span>
                                    <button onClick={() => setEditingRole({ ...role, isNew: false })}
                                        className="p-1 rounded text-[#555a66] hover:text-[#abb2bf] transition-all">
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => handleDeleteRole(role.id)}
                                        className="p-1 rounded text-[#555a66] hover:text-[#e06c75] transition-all">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </>
                    )}
                    {customRoles.length === 0 && (
                        <div className="text-center text-xs text-[#555a66] py-4">
                            暂无自定义角色，点击 ＋ 创建
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ========== PROMPT VIEWER PANEL (selected role only) ==========
    if (showPromptViewer) {
        const currentRole = roles.find(r => r.id === selectedRole) || roles[0];
        return (
            <div className="flex flex-col h-full">
                <div className="flex items-center justify-between px-3 py-2 border-b border-[#2c313a] shrink-0">
                    <span className="text-sm font-medium text-[#abb2bf]">
                        {currentRole.emoji} {currentRole.label} 提示词
                    </span>
                    <button onClick={() => setShowPromptViewer(false)}
                        className="p-1.5 rounded-md text-[#9da5b4] hover:bg-[#2c313a] hover:text-white transition-all">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-3" style={{ WebkitOverflowScrolling: 'touch' }}>
                    <div className="bg-[#1a1c23] rounded-lg border border-[#2c313a] overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 bg-[#1e2028]">
                            <span className="text-xs text-[#9da5b4]">{currentRole.desc}</span>
                            <span className="text-xs text-[#555a66]">{currentRole.id}</span>
                        </div>
                        <pre className="px-3 py-3 text-xs text-[#7a818c] font-mono whitespace-pre-wrap leading-relaxed">
                            {currentRole.prompt}{currentRole.suffix ? '\n\n---\n' + currentRole.suffix : ''}
                        </pre>
                    </div>
                </div>
            </div>
        );
    }

    // ========== EXPANDED VIEW ==========
    if (expanded && result) {
        return (
            <div className="flex flex-col h-full p-3 gap-3">
                <div className="flex items-center justify-between shrink-0">
                    <span className="text-xs text-[#7a818c]">{result.explanation || 'AI 生成'}</span>
                    <button
                        onClick={() => setExpanded(false)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-[#2c313a] text-[#9da5b4] hover:bg-[#3e4451] active:bg-[#4d78cc] active:text-white transition-all"
                    >
                        收起 <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto bg-[#1a1c23] rounded-lg border border-[#2c313a] p-4"
                    style={{ WebkitOverflowScrolling: 'touch' }}>
                    <pre className="text-sm text-[#98c379] font-mono whitespace-pre-wrap break-all leading-relaxed">
                        {result.command}
                    </pre>
                </div>
                <div className="flex gap-2 shrink-0">
                    <button onClick={handleCopy}
                        className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-lg bg-[#2c313a] text-[#abb2bf] text-sm font-medium hover:bg-[#3e4451] active:bg-[#4a5060] transition-all">
                        <Copy className="w-4 h-4" />
                        {copied ? '已复制 ✓' : '📋 复制'}
                    </button>
                    <button onClick={handleExecute} disabled={disabled}
                        className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-lg bg-[#4d78cc] text-white text-sm font-semibold hover:bg-[#5a87d9] active:bg-[#3d68bc] disabled:opacity-30 transition-all">
                        <Play className="w-4 h-4" />
                        ▶ 执行
                    </button>
                </div>
            </div>
        );
    }

    // ========== NORMAL VIEW ==========
    return (
        <div className="flex flex-col gap-3 p-3 min-h-0 overflow-y-auto" style={{ maxHeight: '100%', WebkitOverflowScrolling: 'touch' }}>
            {/* Input area with clear button */}
            <div className="relative shrink-0">
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="输入需求描述..."
                    className="w-full bg-[#1e2028] border border-[#3e4451] rounded-lg px-3 py-2 pr-8 text-sm text-[#abb2bf] placeholder-[#555a66] resize-none focus:outline-none focus:border-[#4d78cc] transition-colors"
                    rows={2}
                    style={{ fontSize: '16px' }}
                />
                {input && (
                    <button
                        onClick={() => { setInput(''); setResult(null); }}
                        className="absolute top-2 right-2 p-0.5 rounded text-[#555a66] hover:text-[#abb2bf] hover:bg-[#2c313a] transition-all"
                        title="清空"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 shrink-0">
                <button onClick={handleAiGenerate} disabled={!input.trim() || loading}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#4d78cc] text-white text-sm font-medium hover:bg-[#5a87d9] disabled:opacity-30 transition-all active:scale-[0.97]">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {loading ? '生成中...' : '✨ AI 生成'}
                </button>
                <button onClick={() => { setInput(''); setResult(null); }} disabled={!input && !result}
                    className="flex items-center justify-center px-3 py-2.5 rounded-lg bg-[#2c313a] text-[#9da5b4] text-sm hover:bg-[#3e4451] hover:text-white disabled:opacity-30 transition-all active:scale-[0.97]">
                    <X className="w-4 h-4" />
                </button>
                <button onClick={handleDirectSend} disabled={!input.trim() || disabled}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#2c313a] text-[#9da5b4] text-sm hover:bg-[#3e4451] hover:text-white disabled:opacity-30 transition-all active:scale-[0.97]">
                    <Terminal className="w-4 h-4" />
                    发送终端
                </button>
            </div>

            {/* Role chips + prompt viewer + role manager buttons */}
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                {roles.map((role) => (
                    <button key={role.id} onClick={() => setSelectedRole(role.id)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all select-none
                            ${selectedRole === role.id
                                ? 'bg-[#4d78cc] text-white shadow-md shadow-blue-500/20'
                                : 'bg-[#2c313a] text-[#9da5b4] hover:bg-[#3e4451]'
                            }`}>
                        {role.emoji} {role.label}
                    </button>
                ))}
                <button onClick={() => setShowPromptViewer(true)}
                    className="p-1 rounded-full bg-[#2c313a] text-[#9da5b4] hover:bg-[#3e4451] hover:text-white transition-all"
                    title="查看角色提示词">
                    <Info className="w-4 h-4" />
                </button>
                <button onClick={() => setShowRoleManager(true)}
                    className="p-1 rounded-full bg-[#2c313a] text-[#9da5b4] hover:bg-[#3e4451] hover:text-white transition-all"
                    title="管理角色">
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            {/* Result card (compact) */}
            {result && (
                <div className="bg-[#1e2028] border border-[#3e4451] rounded-lg overflow-hidden shrink-0">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-[#2c313a]">
                        <span className="text-xs text-[#7a818c]">{result.explanation || 'AI 生成'}</span>
                        <button onClick={() => setExpanded(true)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#2c313a] text-[#9da5b4] hover:bg-[#4d78cc] hover:text-white active:scale-95 transition-all">
                            展开 <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    {result.command && (
                        <>
                            <pre className="px-3 py-2 text-sm text-[#98c379] font-mono whitespace-pre-wrap break-all max-h-24 overflow-hidden">
                                {result.command}
                            </pre>
                            <div className="flex border-t border-[#2c313a]">
                                <button onClick={handleCopy}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 text-sm text-[#9da5b4] hover:bg-[#2c313a] active:bg-[#3e4451] transition-colors">
                                    <Copy className="w-4 h-4" />
                                    {copied ? '已复制 ✓' : '复制'}
                                </button>
                                <div className="w-px bg-[#2c313a]" />
                                <button onClick={handleExecute} disabled={disabled}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 text-sm text-[#4d78cc] hover:bg-[#2c313a] active:bg-[#3e4451] disabled:opacity-30 transition-colors font-semibold">
                                    <Play className="w-4 h-4" />
                                    执行
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {loading && (
                <div className="flex items-center justify-center gap-2 py-4 text-[#6b717d] shrink-0">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">AI 正在生成...</span>
                </div>
            )}
            <div className="shrink-0 h-2" />
        </div>
    );
}
