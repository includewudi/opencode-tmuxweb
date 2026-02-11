import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, Keyboard, Bot, Plus, Trash2, LayoutGrid, X, Mic } from 'lucide-react';
import VoiceInput from './VoiceInput';
import AiCommandTab from './AiCommandTab';

/**
 * BottomToolbox — Termius-style tabbed panel occupying bottom half.
 *
 * Quick keys in 2 rows, grid (⊞) toggle to switch between toolbox & iOS keyboard,
 * Snippets panel for saved custom commands, AI placeholder.
 */

// Quick-key definitions — 2 rows
const KEY_ROW_1 = [
    { label: 'esc', data: '\x1b' },
    { label: 'tab', data: '\t' },
    { label: '|', data: '|' },
    { label: '/', data: '/' },
    { label: '-', data: '-' },
    { label: '~', data: '~' },
    { label: '?', data: '?' },
    { label: 'clr', data: '\x15' },  // Ctrl+U = clear input line
];

const KEY_ROW_2 = [
    { label: 'ctrl', modifier: 'ctrl' },
    { label: 'alt', modifier: 'alt' },
    { label: '↑', data: '\x1b[A' },
    { label: '↓', data: '\x1b[B' },
    { label: '←', data: '\x1b[D' },
    { label: '→', data: '\x1b[C' },
    { label: '^C', data: '\x03' },
    { label: '^S', data: '\x13' },
];

const TABS = [
    { id: 'snippets', icon: Clock, label: '命令' },
    { id: 'ai', icon: Bot, label: 'AI' },
];

const preventFocus = (e) => e.preventDefault();

export default function BottomToolbox({ onSend, disabled, voiceRef }) {
    const [activeTab, setActiveTab] = useState('snippets');
    const [activeModifier, setActiveModifier] = useState(null);
    const [snippets, setSnippets] = useState([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newCmd, setNewCmd] = useState('');
    const [keyboardMode, setKeyboardMode] = useState(false); // true = iOS keyboard shown, toolbox hidden
    const [voiceText, setVoiceText] = useState(''); // Voice text → AI tab input

    // Fetch snippets
    const fetchSnippets = useCallback(async () => {
        try {
            const res = await fetch('/api/snippets');
            setSnippets(await res.json());
        } catch { setSnippets([]); }
    }, []);

    useEffect(() => { fetchSnippets(); }, [fetchSnippets]);

    // Handle quick-key press
    const handleKey = (key) => {
        if (!onSend || disabled) return;
        if (key.modifier) {
            setActiveModifier(prev => prev === key.modifier ? null : key.modifier);
            return;
        }
        let data = key.data;
        if (activeModifier === 'ctrl' && data.length === 1) {
            const code = data.toUpperCase().charCodeAt(0) - 64;
            if (code > 0 && code < 32) data = String.fromCharCode(code);
        } else if (activeModifier === 'alt' && data.length === 1) {
            data = '\x1b' + data;
        }
        onSend(data);
        setActiveModifier(null);
    };

    // Add snippet
    const addSnippet = async () => {
        if (!newCmd.trim()) return;
        await fetch('/api/snippets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName.trim(), command: newCmd.trim() }),
        });
        setNewName(''); setNewCmd(''); setShowAddForm(false);
        fetchSnippets();
    };

    // Delete snippet
    const deleteSnippet = async (idx) => {
        await fetch(`/api/snippets?index=${idx}`, { method: 'DELETE' });
        fetchSnippets();
    };

    // Send snippet to terminal
    const sendSnippet = (cmd) => {
        if (!onSend || disabled) return;
        onSend(cmd + '\n');
    };

    // Toggle keyboard mode
    const toggleKeyboard = () => {
        if (!keyboardMode) {
            // Switch to keyboard: focus terminal textarea
            const ta = document.querySelector('.xterm-helper-textarea');
            if (ta) ta.focus();
        } else {
            // Switch back to toolbox: blur to dismiss keyboard
            document.activeElement?.blur();
        }
        setKeyboardMode(!keyboardMode);
    };

    // Render a key button
    const renderKey = (key, i) => {
        const isActive = key.modifier && activeModifier === key.modifier;
        return (
            <button
                key={i}
                onMouseDown={preventFocus}
                onTouchStart={preventFocus}
                onTouchEnd={(e) => { e.preventDefault(); handleKey(key); }}
                onClick={() => handleKey(key)}
                disabled={disabled}
                className={`
                    flex items-center justify-center flex-1
                    h-[34px] rounded-md text-[11px] font-mono
                    select-none transition-all active:scale-95
                    ${isActive
                        ? 'bg-[#4d78cc] text-white shadow-md shadow-blue-500/30'
                        : 'bg-[#2c313a] text-[#abb2bf] hover:bg-[#3e4451] active:bg-[#4d78cc] active:text-white'
                    }
                    ${disabled ? 'opacity-40 pointer-events-none' : ''}
                `}
                style={{ touchAction: 'manipulation', WebkitUserSelect: 'none' }}
            >
                {key.label}
            </button>
        );
    };

    // If in keyboard mode, show minimal bar with grid button to switch back
    if (keyboardMode) {
        return (
            <div className="flex items-center h-11 bg-[#1a1c20] border-t border-[#2b2d31] px-2 shrink-0">
                <button
                    onClick={toggleKeyboard}
                    className="flex items-center justify-center w-10 h-8 rounded-md bg-[#2c313a] text-[#abb2bf] hover:bg-[#3e4451] active:bg-[#4d78cc] active:text-white transition-all"
                    style={{ touchAction: 'manipulation' }}
                >
                    <LayoutGrid className="w-4 h-4" />
                </button>
                <span className="ml-3 text-xs text-[#6b717d]">工具箱</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col bg-[#13151a] border-t border-[#2b2d31] select-none"
            style={{ height: '50%', minHeight: 0 }}>

            {/* QUICK-KEY ROW 1 + grid toggle */}
            <div className="flex items-center gap-1 px-2 h-10 bg-[#1a1c20] border-b border-[#1e2028] shrink-0">
                <button
                    onClick={toggleKeyboard}
                    onMouseDown={preventFocus}
                    className="flex items-center justify-center w-9 h-[34px] rounded-md bg-[#2c313a] text-[#abb2bf] hover:bg-[#3e4451] active:bg-[#4d78cc] active:text-white transition-all shrink-0"
                    style={{ touchAction: 'manipulation' }}
                >
                    <LayoutGrid className="w-4 h-4" />
                </button>
                {KEY_ROW_1.map((key, i) => renderKey(key, i))}
            </div>

            {/* QUICK-KEY ROW 2 */}
            <div className="flex items-center gap-1 px-2 h-10 bg-[#1a1c20] border-b border-[#2b2d31] shrink-0">
                {KEY_ROW_2.map((key, i) => renderKey(key, i))}
            </div>

            {/* PANEL CONTENT — scrollable */}
            <div className="flex-1 overflow-y-auto min-h-0">
                {activeTab === 'snippets' && (
                    <div className="flex flex-col h-full">
                        {/* Add button + header */}
                        <div className="flex items-center justify-between px-4 py-2 border-b border-[#2b2d31] shrink-0">
                            <span className="text-xs text-[#6b717d] font-medium">常用命令</span>
                            <button
                                onClick={() => setShowAddForm(!showAddForm)}
                                className="flex items-center gap-1 text-xs text-[#4d78cc] hover:text-white transition-colors"
                            >
                                {showAddForm
                                    ? <><X className="w-3.5 h-3.5" /> 取消</>
                                    : <><Plus className="w-3.5 h-3.5" /> 添加</>
                                }
                            </button>
                        </div>

                        {/* Add form */}
                        {showAddForm && (
                            <div className="flex flex-col gap-2 px-4 py-3 border-b border-[#2b2d31] bg-[#1a1c20]">
                                <input
                                    type="text"
                                    placeholder="名称（可选）"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="bg-[#2c313a] text-sm text-[#abb2bf] rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-[#4d78cc] placeholder-[#6b717d]"
                                />
                                <input
                                    type="text"
                                    placeholder="命令"
                                    value={newCmd}
                                    onChange={(e) => setNewCmd(e.target.value)}
                                    className="bg-[#2c313a] text-sm text-[#abb2bf] rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-[#4d78cc] placeholder-[#6b717d] font-mono"
                                />
                                <button
                                    onClick={addSnippet}
                                    disabled={!newCmd.trim()}
                                    className="bg-[#4d78cc] text-white text-sm rounded-md px-4 py-2 hover:bg-[#5a8ae0] disabled:opacity-40 transition-colors"
                                >
                                    保存
                                </button>
                            </div>
                        )}

                        {/* Snippet list */}
                        <div className="flex-1 overflow-y-auto">
                            {snippets.length === 0 && !showAddForm ? (
                                <div className="flex flex-col items-center justify-center h-full text-[#6b717d] gap-2">
                                    <span className="text-sm">暂无保存的命令</span>
                                    <button
                                        onClick={() => setShowAddForm(true)}
                                        className="text-xs text-[#4d78cc] hover:text-white"
                                    >
                                        点击添加
                                    </button>
                                </div>
                            ) : (
                                snippets.map((s, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-2 px-4 py-3 border-b border-[#1e2028] hover:bg-[#1e2028] active:bg-[#2c313a] transition-colors group"
                                    >
                                        <button
                                            onMouseDown={preventFocus}
                                            onTouchStart={preventFocus}
                                            onTouchEnd={(e) => { e.preventDefault(); sendSnippet(s.command); }}
                                            onClick={() => sendSnippet(s.command)}
                                            className="flex-1 text-left min-w-0"
                                        >
                                            <div className="text-[13px] text-[#abb2bf] font-medium truncate">{s.name}</div>
                                            {s.name !== s.command && (
                                                <div className="text-[11px] text-[#6b717d] font-mono truncate mt-0.5">{s.command}</div>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => deleteSnippet(i)}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 text-[#6b717d] hover:text-red-400 transition-all shrink-0"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'ai' && (
                    <AiCommandTab
                        onSend={onSend}
                        disabled={disabled}
                        initialText={voiceText}
                        onTextConsumed={() => setVoiceText('')}
                    />
                )}
            </div>

            {/* BOTTOM TAB BAR — 命令 | 🎤 | AI */}
            <div className="flex items-center justify-around h-14 bg-[#0f1115] border-t border-[#2b2d31] shrink-0 px-4"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>

                {/* 命令 tab */}
                <button
                    onClick={() => setActiveTab('snippets')}
                    className={`flex flex-col items-center justify-center gap-0.5 px-5 py-1 rounded-lg transition-all
                        ${activeTab === 'snippets' ? 'text-[#4d78cc]' : 'text-[#6b717d] hover:text-[#abb2bf]'}`}
                >
                    <Clock className="w-5 h-5" />
                    <span className="text-[10px]">命令</span>
                </button>

                {/* 🎤 Mic button — center */}
                <div className="flex items-center justify-center">
                    <VoiceInput
                        ref={voiceRef}
                        onText={(text) => {
                            setVoiceText(text);
                            setActiveTab('ai');  // Auto-switch to AI tab
                        }}
                        disabled={disabled}
                    />
                </div>

                {/* AI tab */}
                <button
                    onClick={() => setActiveTab('ai')}
                    className={`flex flex-col items-center justify-center gap-0.5 px-5 py-1 rounded-lg transition-all
                        ${activeTab === 'ai' ? 'text-[#4d78cc]' : 'text-[#6b717d] hover:text-[#abb2bf]'}`}
                >
                    <Bot className="w-5 h-5" />
                    <span className="text-[10px]">AI</span>
                </button>
            </div>
        </div>
    );
}
