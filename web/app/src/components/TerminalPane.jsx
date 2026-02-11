import { useRef, useEffect } from 'react';
import { useTerminal } from '../hooks/useTerminal';

/**
 * Terminal pane component - renders an xterm.js terminal connected to a specific tmux pane.
 * 
 * Props:
 *   paneTarget - tmux pane target (e.g. "session:0.0")
 *   active     - whether this pane is currently visible
 *   onSendRef  - callback receiving a sendInput(text) function for external input (e.g. voice)
 */
export default function TerminalPane({ paneTarget, active, onSendRef }) {
    const containerRef = useRef(null);
    const { ws } = useTerminal({ containerRef, paneTarget, active });

    // Register send function for external callers (voice input, etc.)
    useEffect(() => {
        if (onSendRef) {
            onSendRef((text) => {
                if (ws.current?.readyState === WebSocket.OPEN) {
                    ws.current.send(JSON.stringify({ type: 'input', data: text }));
                }
            });
        }
    }, [onSendRef, ws]);

    return (
        <div
            ref={containerRef}
            className={`xterm-container w-full h-full ${active ? '' : 'hidden'}`}
        />
    );
}
