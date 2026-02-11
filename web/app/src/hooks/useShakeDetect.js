import { useEffect, useRef, useCallback } from 'react';

/**
 * useShakeDetect — detects shake gestures on mobile devices via DeviceMotion API.
 * 
 * On iOS 13+, DeviceMotion requires user permission (triggered on first user tap).
 * 
 * @param {Function} onShake  — callback when shake is detected
 * @param {Object}   opts
 * @param {number}   opts.threshold      — acceleration threshold (default 25)
 * @param {number}   opts.shakeCount     — required shakes within window (default 2)
 * @param {number}   opts.shakeWindow    — time window in ms (default 800)
 * @param {number}   opts.cooldown       — cooldown between triggers in ms (default 2000)
 * @param {boolean}  opts.enabled        — whether detection is active (default true)
 */
export default function useShakeDetect(onShake, opts = {}) {
    const {
        threshold = 25,
        shakeCount = 2,
        shakeWindow = 800,
        cooldown = 2000,
        enabled = true,
    } = opts;

    const shakeTimes = useRef([]);
    const lastTrigger = useRef(0);
    const permissionGranted = useRef(false);
    const onShakeRef = useRef(onShake);
    onShakeRef.current = onShake;

    // Request iOS DeviceMotion permission on first user gesture
    const requestPermission = useCallback(async () => {
        if (permissionGranted.current) return true;

        if (typeof DeviceMotionEvent !== 'undefined' &&
            typeof DeviceMotionEvent.requestPermission === 'function') {
            try {
                const result = await DeviceMotionEvent.requestPermission();
                permissionGranted.current = result === 'granted';
                return permissionGranted.current;
            } catch {
                return false;
            }
        }
        // Non-iOS or older browsers — permission not needed
        permissionGranted.current = true;
        return true;
    }, []);

    useEffect(() => {
        if (!enabled) return;

        // Auto-request permission on first touch (iOS requirement)
        const handleTouch = async () => {
            await requestPermission();
            document.removeEventListener('touchstart', handleTouch, { capture: true });
        };
        document.addEventListener('touchstart', handleTouch, { capture: true, once: true });

        const handleMotion = (e) => {
            const acc = e.accelerationIncludingGravity;
            if (!acc) return;

            const magnitude = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);

            if (magnitude > threshold) {
                const now = Date.now();
                shakeTimes.current.push(now);

                // Remove old shakes outside window
                shakeTimes.current = shakeTimes.current.filter(t => now - t < shakeWindow);

                if (shakeTimes.current.length >= shakeCount) {
                    if (now - lastTrigger.current > cooldown) {
                        lastTrigger.current = now;
                        shakeTimes.current = [];
                        onShakeRef.current?.();
                    }
                }
            }
        };

        window.addEventListener('devicemotion', handleMotion);

        return () => {
            window.removeEventListener('devicemotion', handleMotion);
            document.removeEventListener('touchstart', handleTouch, { capture: true });
        };
    }, [enabled, threshold, shakeCount, shakeWindow, cooldown, requestPermission]);

    return { requestPermission };
}
