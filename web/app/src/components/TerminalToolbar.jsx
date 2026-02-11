import React, { useState, useRef } from 'react';

/**
 * Terminal quick-key toolbar — Termius-style floating bar.
 * Floats above the iOS keyboard using --vv-offset CSS variable.
 * Terminal stays full-size underneath.
 *
 * Props:
 *   onSend(data: string) — sends raw key data to the active terminal
 */

const KEYS = [
    { label: 'shift', data: '', modifier: 'shift' },
    { label: '?', data: '?' },
    { label: '/', data: '/' },
    { label: '|', data: '|' },
    { label: 'esc', data: '\x1b' },
    { label: 'tab', data: '\t' },
    { label: 'ctrl', modifier: 'ctrl' },
    { label: 'alt', modifier: 'alt' },
    { label: '^C', data: '\x03' },
    { label: '^\\', data: '\x1c' },
    { label: '^S', data: '\x13' },
    { label: '↑', data: '\x1b[A' },
    { label: '↓', data: '\x1b[B' },
    { label: '←', data: '\x1b[D' },
    { label: '→', data: '\x1b[C' },
    { label: '-', data: '-' },
    { label: '~', data: '~' },
];

export default function TerminalToolbar({ onSend, disabled }) {
    const [activeModifier, setActiveModifier] = useState(null); // 'ctrl' | 'alt' | 'shift' | null
    const scrollRef = useRef(null);

    const preventFocusLoss = (e) => {
        e.preventDefault(); // Keeps terminal focused, keyboard stays open
    };

    const handleKey = (key) => {
        if (!onSend || disabled) return;

        // Toggle modifier
        if (key.modifier) {
            setActiveModifier(prev => prev === key.modifier ? null : key.modifier);
            return;
        }

        let data = key.data;

        if (activeModifier === 'ctrl' && data.length === 1) {
            const code = data.toUpperCase().charCodeAt(0) - 64;
            if (code > 0 && code < 32) {
                data = String.fromCharCode(code);
            }
        } else if (activeModifier === 'alt' && data.length === 1) {
            data = '\x1b' + data; // Alt+key = ESC + key
        } else if (activeModifier === 'shift' && data.length === 1) {
            data = data.toUpperCase();
        }

        onSend(data);
        setActiveModifier(null);
    };

    return (
        <div
            className="fixed left-0 right-0 z-50"
            style={{ bottom: 'var(--vv-offset, 0px)' }}
        >
            <div
                ref={scrollRef}
                className="flex items-center gap-1 px-2 h-11 bg-[#1a1c20]/95 backdrop-blur-sm border-t border-[#2b2d31] overflow-x-auto no-scrollbar"
                style={{ touchAction: 'pan-x' }}
            >
                {KEYS.map((key, i) => {
                    const isActive = key.modifier && activeModifier === key.modifier;
                    return (
                        <button
                            key={i}
                            onMouseDown={preventFocusLoss}
                            onTouchStart={preventFocusLoss}
                            onTouchEnd={(e) => { e.preventDefault(); handleKey(key); }}
                            onClick={() => handleKey(key)}
                            disabled={disabled}
                            className={`
                                flex items-center justify-center shrink-0
                                min-w-[40px] h-[34px] px-2.5 rounded-md text-[11px] font-mono
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
                })}
            </div>
        </div>
    );
}
