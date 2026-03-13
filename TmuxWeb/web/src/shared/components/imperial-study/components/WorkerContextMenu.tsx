// WorkerContextMenu.tsx — Right-click context menu for WorkerCard (Spec §5.2)
import { useEffect, useRef } from 'react';
import { Terminal, Copy, Pause, Power } from 'lucide-react';

interface WorkerContextMenuProps {
    /** Screen X coordinate where menu should appear */
    x: number;
    /** Screen Y coordinate where menu should appear */
    y: number;
    workerId: string;
    paneTarget: string;
    onClose: () => void;
}

export function WorkerContextMenu({
    x, y,
    workerId,
    paneTarget,
    onClose,
}: WorkerContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    // Close on outside click or Escape
    useEffect(() => {
        const onClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const onEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        // Small delay so the right-click that opened menu doesn't immediately close it
        const t = setTimeout(() => {
            document.addEventListener('click', onClickOutside);
            document.addEventListener('keydown', onEscape);
        }, 10);
        return () => {
            clearTimeout(t);
            document.removeEventListener('click', onClickOutside);
            document.removeEventListener('keydown', onEscape);
        };
    }, [onClose]);

    const handle = (action: 'open' | 'copy' | 'pause' | 'kill') => {
        switch (action) {
            case 'open':
                window.dispatchEvent(
                    new CustomEvent('imperial:focus-pane', { detail: { paneTarget } })
                );
                break;
            case 'copy':
                navigator.clipboard.writeText(paneTarget).catch(console.error);
                break;
            case 'pause':
                fetch(`/api/butler/worker_sessions/${workerId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ state: 'paused' }),
                }).catch(err => console.error('[imperial] pause failed', err));
                break;
            case 'kill':
                if (!confirm('确定要终止该 worker 吗？')) return;
                fetch(`/api/butler/worker_sessions/${workerId}`, {
                    method: 'DELETE',
                }).catch(err => console.error('[imperial] kill failed', err));
                break;
        }
        onClose();
    };

    return (
        <div
            ref={menuRef}
            className="is-ctx-menu"
            style={{ left: x, top: y }}
        >
            <div className="is-ctx-menu__item" onClick={() => handle('open')}>
                <Terminal size={14} />
                <span>Open Terminal</span>
            </div>
            <div className="is-ctx-menu__item" onClick={() => handle('copy')}>
                <Copy size={14} />
                <span>Copy pane target</span>
            </div>
            <div className="is-ctx-menu__item" onClick={() => handle('pause')}>
                <Pause size={14} />
                <span>Pause worker</span>
            </div>
            <div className="is-ctx-menu__item danger" onClick={() => handle('kill')}>
                <Power size={14} />
                <span>Kill worker</span>
            </div>
        </div>
    );
}
