import { useEffect, useCallback } from 'react';

/**
 * Hook that tracks the visual viewport height (accounts for iOS keyboard).
 * Sets CSS custom property --vvh on <html> so components can use it.
 * 
 * Usage: useVisualViewport();
 * CSS:   height: calc(var(--vvh, 100vh) - <header>);
 */
export default function useVisualViewport() {
    const update = useCallback(() => {
        const vv = window.visualViewport;
        if (vv) {
            // Set --vvh to the actual visible height (excludes keyboard)
            document.documentElement.style.setProperty('--vvh', `${vv.height}px`);
            // Also set --vv-offset for keyboard offset from bottom
            const fullH = window.innerHeight;
            const offset = fullH - vv.height;
            document.documentElement.style.setProperty('--vv-offset', `${offset}px`);
        } else {
            document.documentElement.style.setProperty('--vvh', '100vh');
            document.documentElement.style.setProperty('--vv-offset', '0px');
        }
    }, []);

    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return;

        update(); // Initial set

        vv.addEventListener('resize', update);
        vv.addEventListener('scroll', update);

        return () => {
            vv.removeEventListener('resize', update);
            vv.removeEventListener('scroll', update);
        };
    }, [update]);
}
