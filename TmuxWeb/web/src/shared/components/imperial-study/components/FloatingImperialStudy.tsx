// FloatingImperialStudy.tsx — Transparent floating strip for 御書房
import { ScrollText, Minus, X } from 'lucide-react';
import { ImperialStudyPanel } from './ImperialStudyPanel';
import { useFloatingPanel } from '../hooks/useFloatingPanel';
import { useInboxItems } from '../hooks/useInboxItems';

interface FloatingImperialStudyProps {
    activePaneKey?: string | null;
    onClose: () => void;
}

export function FloatingImperialStudy({ activePaneKey, onClose }: FloatingImperialStudyProps) {
    const {
        collapsed,
        position,
        size,
        opacity,
        onDragStart,
        onResizeStart,
        toggleCollapse,
        setOpacity,
    } = useFloatingPanel();

    const { unreadCount } = useInboxItems();

    // ── Collapsed: mini floating bubble ──
    if (collapsed) {
        return (
            <div
                className="is-floating-bubble"
                style={{ left: position.x, top: position.y }}
                onClick={toggleCollapse}
                title="展开御書房"
            >
                <ScrollText size={20} />
                {unreadCount > 0 && (
                    <span className="is-floating-bubble__badge">{unreadCount}</span>
                )}
            </div>
        );
    }

    // ── Expanded: transparent horizontal strip ──
    return (
        <div
            className="is-floating-panel"
            style={{
                left: position.x,
                top: position.y,
                width: size.width,
                height: size.height,
                '--panel-bg-alpha': opacity,
            } as React.CSSProperties}
        >
            {/* Drag handle (thin title bar) */}
            <div className="is-floating-panel__titlebar" onMouseDown={onDragStart}>
                <ScrollText size={12} className="is-floating-panel__icon" />
                <span className="is-floating-panel__title">御書房</span>
                <span className="is-floating-panel__stats">
                    {unreadCount > 0 && `${unreadCount} unread`}
                </span>
                <div className="is-floating-panel__actions">
                    <input
                        type="range"
                        className="is-floating-panel__opacity-slider"
                        min={0}
                        max={1}
                        step={0.05}
                        value={opacity}
                        onChange={(e) => setOpacity(Number(e.target.value))}
                        onMouseDown={(e) => e.stopPropagation()}
                        title={`透明度 ${Math.round(opacity * 100)}%`}
                    />
                    <button
                        className="is-floating-panel__btn"
                        onClick={(e) => { e.stopPropagation(); toggleCollapse(); }}
                        title="最小化"
                    >
                        <Minus size={12} />
                    </button>
                    <button
                        className="is-floating-panel__btn is-floating-panel__btn--close"
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        title="关闭浮窗"
                    >
                        <X size={12} />
                    </button>
                </div>
            </div>

            {/* Panel content — horizontal layout in float mode */}
            <div className="is-floating-panel__body">
                <ImperialStudyPanel activePaneKey={activePaneKey} floating />
            </div>

            {/* Resize handle */}
            <div className="is-floating-panel__resize" onMouseDown={onResizeStart} />
        </div>
    );
}
