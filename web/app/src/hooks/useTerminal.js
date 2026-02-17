import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import rlog from '../utils/rlog';

/**
 * React hook for managing an xterm.js terminal + WebSocket connection.
 * Includes auto-reconnect with exponential backoff.
 *
 * @param {Object} options
 * @param {HTMLElement} options.containerRef - Ref to the DOM container
 * @param {string} options.paneTarget - Target pane identifier (e.g. session:window.pane) 
 * @param {boolean} options.active - Whether this terminal is the active/visible one
 * @param {number} options.fontSize - Font size for the terminal (default 9)
 */
export function useTerminal({ containerRef, paneTarget, active, fontSize = 9 }) {
    const termRef = useRef(null);
    const fitRef = useRef(null);
    const wsRef = useRef(null);
    const resizeTimerRef = useRef(null);
    const reconnectTimerRef = useRef(null);
    const reconnectAttemptRef = useRef(0);
    const intentionalCloseRef = useRef(false);

    // Safe fit — ignores errors when container is hidden/zero-dimension
    const safeFit = useCallback(() => {
        try {
            if (fitRef.current) fitRef.current.fit();
        } catch {
            // Container may be hidden or zero-size, ignore
        }
    }, []);

    // Create terminal + WebSocket on mount
    useEffect(() => {
        const container = containerRef.current;
        if (!container || !paneTarget) return;

        intentionalCloseRef.current = false;

        // Create Terminal
        const term = new Terminal({
            cursorBlink: true,
            cursorStyle: 'bar',
            fontFamily: "'Menlo', 'Courier New', monospace",
            fontSize: fontSize,
            lineHeight: 1.2,
            theme: {
                background: '#0f1115',
                foreground: '#abb2bf',
                cursor: '#4d78cc',
                selectionBackground: 'rgba(77, 120, 204, 0.3)',
                black: '#1e2127',
                red: '#e06c75',
                green: '#98c379',
                yellow: '#d19a66',
                blue: '#61afef',
                magenta: '#c678dd',
                cyan: '#56b6c2',
                white: '#abb2bf',
            },
            allowProposedApi: true,
            scrollback: 5000,
            drawBoldTextInBrightColors: true,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(container);

        termRef.current = term;
        fitRef.current = fitAddon;

        // Initial fit — may fail if container is hidden, will retry on activation
        try { fitAddon.fit(); } catch { }

        // --- WebSocket with auto-reconnect (2s, one try then prompt reload) ---
        let manualReconnectDisposable = null;

        function connectWs() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws?target=${encodeURIComponent(paneTarget)}`;
            rlog.info('WS connecting', { wsUrl });

            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
            if (manualReconnectDisposable) {
                manualReconnectDisposable.dispose();
                manualReconnectDisposable = null;
            }

            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                rlog.info('WS connected', { paneTarget });
                if (reconnectAttemptRef.current > 0) {
                    term.write('\r\n\x1b[32m[已重连 ✓]\x1b[0m\r\n');
                }
                reconnectAttemptRef.current = 0;
                ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'output') {
                        term.write(msg.data);
                    }
                } catch {
                    term.write(event.data);
                }
            };

            ws.onclose = (e) => {
                rlog.warn('WS closed', { paneTarget, code: e.code });
                if (intentionalCloseRef.current) return;

                reconnectAttemptRef.current += 1;

                if (reconnectAttemptRef.current <= 1) {
                    // First disconnect: auto-retry once after 2s
                    term.write('\r\n\x1b[33m[连接断开，2秒后重连...]\x1b[0m\r\n');
                    reconnectTimerRef.current = setTimeout(() => {
                        if (!intentionalCloseRef.current) connectWs();
                    }, 2000);
                } else {
                    // Second failure: prompt manual reload
                    term.write('\r\n\x1b[31m[重连失败]\x1b[0m \x1b[33m按任意键刷新页面\x1b[0m\r\n');
                    manualReconnectDisposable = term.onData(() => {
                        window.location.reload();
                    });
                }
            };

            ws.onerror = (e) => {
                rlog.error('WS error', { paneTarget, type: e.type });
            };
        }

        // Input: xterm -> WebSocket
        term.onData((data) => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'input', data }));
            }
        });

        // Resize handling
        const resizeObserver = new ResizeObserver(() => {
            clearTimeout(resizeTimerRef.current);
            resizeTimerRef.current = setTimeout(() => {
                const oldCols = term.cols;
                const oldRows = term.rows;
                try { fitAddon.fit(); } catch { }
                if (term.cols !== oldCols || term.rows !== oldRows) {
                    if (wsRef.current?.readyState === WebSocket.OPEN) {
                        wsRef.current.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
                    }
                }
            }, 100);
        });
        resizeObserver.observe(container);

        // --- Touch swipe → tmux scroll (mobile) ---
        let touchStartY = null;
        let touchAccum = 0;
        const SCROLL_THRESHOLD = 20; // px per scroll line

        const onTouchStart = (e) => {
            if (e.touches.length === 1) {
                touchStartY = e.touches[0].clientY;
                touchAccum = 0;
            }
        };
        const onTouchMove = (e) => {
            if (touchStartY === null || e.touches.length !== 1) return;
            e.preventDefault(); // prevent page scroll
            const deltaY = touchStartY - e.touches[0].clientY;
            touchAccum += deltaY;
            touchStartY = e.touches[0].clientY;

            // Send scroll lines proportional to swipe distance
            const lines = Math.trunc(touchAccum / SCROLL_THRESHOLD);
            if (lines !== 0 && wsRef.current?.readyState === WebSocket.OPEN) {
                touchAccum -= lines * SCROLL_THRESHOLD;
                // Send mouse wheel: up (button 64) or down (button 65) in SGR mode
                const button = lines > 0 ? 64 : 65;
                const count = Math.abs(lines);
                for (let i = 0; i < Math.min(count, 10); i++) {
                    wsRef.current.send(JSON.stringify({
                        type: 'input',
                        data: `\x1b[<${button};1;1M`
                    }));
                }
            }
        };
        const onTouchEnd = () => { touchStartY = null; touchAccum = 0; };

        container.addEventListener('touchstart', onTouchStart, { passive: true });
        container.addEventListener('touchmove', onTouchMove, { passive: false });
        container.addEventListener('touchend', onTouchEnd, { passive: true });

        // Start initial connection
        connectWs();

        // Cleanup
        return () => {
            intentionalCloseRef.current = true;
            clearTimeout(resizeTimerRef.current);
            clearTimeout(reconnectTimerRef.current);
            resizeObserver.disconnect();
            container.removeEventListener('touchstart', onTouchStart);
            container.removeEventListener('touchmove', onTouchMove);
            container.removeEventListener('touchend', onTouchEnd);
            if (wsRef.current) wsRef.current.close();
            term.dispose();
            termRef.current = null;
            fitRef.current = null;
            wsRef.current = null;
        };
    }, [paneTarget]);

    useEffect(() => {
        if (termRef.current && fitRef.current) {
            termRef.current.options.fontSize = fontSize;
            try { fitRef.current.fit(); } catch {}
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'resize', cols: termRef.current.cols, rows: termRef.current.rows }));
            }
        }
    }, [fontSize]);

    // Re-fit when becoming active — with retries for iOS layout settling
    useEffect(() => {
        if (!active) return;

        if (fitRef.current) {
            // Immediate fit
            try { fitRef.current.fit(); } catch { }
            // Retry after delays for iOS layout settling
            const t1 = setTimeout(() => { try { fitRef.current?.fit(); } catch { } }, 100);
            const t2 = setTimeout(() => { try { fitRef.current?.fit(); } catch { } }, 300);
            return () => { clearTimeout(t1); clearTimeout(t2); };
        }
        if (termRef.current) {
            termRef.current.focus();
        }
    }, [active]);

    return { term: termRef, ws: wsRef };
}
