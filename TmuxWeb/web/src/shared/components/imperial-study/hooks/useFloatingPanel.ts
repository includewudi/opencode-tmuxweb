import { useState, useEffect, useCallback, useRef } from 'react';

interface FloatingPosition {
    x: number;
    y: number;
}

interface FloatingSize {
    width: number;
    height: number;
}

interface UseFloatingPanelOptions {
    storageKey?: string;
    defaultPosition?: FloatingPosition;
    defaultSize?: FloatingSize;
    minWidth?: number;
    minHeight?: number;
}

const DEFAULTS = {
    position: { x: -1, y: -1 }, // -1 = auto (bottom-center)
    size: { width: 860, height: 280 },
    minWidth: 500,
    minHeight: 180,
};

function loadFromStorage<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function saveToStorage(key: string, value: unknown) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch { /* quota exceeded — ignore */ }
}

export function useFloatingPanel(options?: UseFloatingPanelOptions) {
    const storageKey = options?.storageKey ?? 'imperial-floating';
    const minW = options?.minWidth ?? DEFAULTS.minWidth;
    const minH = options?.minHeight ?? DEFAULTS.minHeight;

    const [collapsed, setCollapsed] = useState(() =>
        loadFromStorage(`${storageKey}-collapsed`, false)
    );
    const [position, setPosition] = useState<FloatingPosition>(() =>
        loadFromStorage(`${storageKey}-pos`, options?.defaultPosition ?? DEFAULTS.position)
    );
    const [size, setSize] = useState<FloatingSize>(() =>
        loadFromStorage(`${storageKey}-size`, options?.defaultSize ?? DEFAULTS.size)
    );
    const [opacity, setOpacity] = useState(() =>
        loadFromStorage(`${storageKey}-opacity`, 0.15)
    );

    // Persist state
    useEffect(() => { saveToStorage(`${storageKey}-collapsed`, collapsed); }, [collapsed, storageKey]);
    useEffect(() => { saveToStorage(`${storageKey}-pos`, position); }, [position, storageKey]);
    useEffect(() => { saveToStorage(`${storageKey}-size`, size); }, [size, storageKey]);
    useEffect(() => { saveToStorage(`${storageKey}-opacity`, opacity); }, [opacity, storageKey]);

    // Resolve auto position (bottom-center with 16px margin)
    const resolvedPosition = useCallback((): FloatingPosition => {
        if (position.x === -1 || position.y === -1) {
            return {
                x: Math.max(16, (window.innerWidth - size.width) / 2),
                y: window.innerHeight - size.height - 16,
            };
        }
        return position;
    }, [position, size]);

    // ── Drag logic ──
    const dragRef = useRef<{
        startX: number;
        startY: number;
        startPosX: number;
        startPosY: number;
    } | null>(null);

    const onDragStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const pos = resolvedPosition();
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startPosX: pos.x,
            startPosY: pos.y,
        };

        const onMove = (ev: MouseEvent) => {
            if (!dragRef.current) return;
            const dx = ev.clientX - dragRef.current.startX;
            const dy = ev.clientY - dragRef.current.startY;
            const newX = Math.max(0, Math.min(window.innerWidth - 60, dragRef.current.startPosX + dx));
            const newY = Math.max(0, Math.min(window.innerHeight - 40, dragRef.current.startPosY + dy));
            setPosition({ x: newX, y: newY });
        };

        const onUp = () => {
            dragRef.current = null;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, [resolvedPosition]);

    // ── Resize logic ──
    const resizeRef = useRef<{
        startX: number;
        startY: number;
        startW: number;
        startH: number;
    } | null>(null);

    const onResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        resizeRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startW: size.width,
            startH: size.height,
        };

        const onMove = (ev: MouseEvent) => {
            if (!resizeRef.current) return;
            const dw = ev.clientX - resizeRef.current.startX;
            const dh = ev.clientY - resizeRef.current.startY;
            setSize({
                width: Math.max(minW, resizeRef.current.startW + dw),
                height: Math.max(minH, resizeRef.current.startH + dh),
            });
        };

        const onUp = () => {
            resizeRef.current = null;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, [size, minW, minH]);

    const toggleCollapse = useCallback(() => {
        setCollapsed(prev => !prev);
    }, []);

    return {
        collapsed,
        position: resolvedPosition(),
        size,
        opacity,
        onDragStart,
        onResizeStart,
        toggleCollapse,
        setCollapsed,
        setOpacity,
    };
}
