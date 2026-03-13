/**
 * Keyboard avoidance hook for mobile devices
 * Uses VisualViewport API to detect keyboard and adjust layout
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { isMobile, getKeyboardMetrics, type KeyboardMetrics } from '../utils/platform'
import { isDebugEnabled } from '../utils/telemetry'

export interface KeyboardAvoiderState {
  /** Current keyboard height in pixels (0 when hidden) */
  keyboardHeight: number
  /** Whether keyboard is currently visible */
  isKeyboardVisible: boolean
  /** Inline styles to apply to container for keyboard avoidance */
  containerStyle: React.CSSProperties
  /** Keyboard height in pixels (alias for keyboardHeight) */
  keyboardHeightPx: number
  /** Whether keyboard is currently visible (alias for isKeyboardVisible) */
  keyboardVisible: boolean
  /** Height to reserve for keyboard spacer element (0 when keyboard hidden or on desktop) */
  keyboardSpacerHeightPx: number
}

const DEBOUNCE_MS = 100

/**
 * Hook that provides keyboard avoidance state for mobile devices
 * Returns container styles that adjust padding when keyboard appears
 * 
 * @param enabled - Whether to enable keyboard avoidance (default: true on mobile)
 * @param accessoryHeight - Reserved height for bottom accessory bar (default: 0)
 */
export function useKeyboardAvoider(
  enabled: boolean = true,
  accessoryHeight: number = 0
): KeyboardAvoiderState {
  const [metrics, setMetrics] = useState<KeyboardMetrics>(() => getKeyboardMetrics())
  const debounceRef = useRef<number | null>(null)
  const enabledRef = useRef(enabled && isMobile())

  useEffect(() => {
    enabledRef.current = enabled && isMobile()
  }, [enabled])

  const updateMetrics = useCallback(() => {
    if (!enabledRef.current) return
    
    const newMetrics = getKeyboardMetrics()
    setMetrics(prev => {
      if (
        prev.keyboardHeight === newMetrics.keyboardHeight &&
        prev.isKeyboardVisible === newMetrics.isKeyboardVisible
      ) {
        return prev
      }
      return newMetrics
    })
  }, [])

  const debouncedUpdate = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = window.setTimeout(updateMetrics, DEBOUNCE_MS)
  }, [updateMetrics])

   useEffect(() => {
     if (!enabledRef.current || typeof window === 'undefined') {
       return
     }

     updateMetrics()

     const vv = window.visualViewport
     if (vv) {
       vv.addEventListener('resize', debouncedUpdate)
       vv.addEventListener('scroll', debouncedUpdate)
     }

     window.addEventListener('resize', debouncedUpdate)

     // Expose debug-only window helper for Playwright to read keyboard metrics
     if (isDebugEnabled() && isMobile()) {
       (window as any).__keyboardMetrics = () => ({
         keyboardVisible: metrics.isKeyboardVisible,
         keyboardHeightPx: metrics.keyboardHeight,
         keyboardSpacerHeightPx: metrics.isKeyboardVisible ? metrics.keyboardHeight : 0,
         visualViewportHeight: vv?.height ?? window.innerHeight,
         visualViewportWidth: vv?.width ?? window.innerWidth,
         layoutHeight: window.innerHeight,
         layoutWidth: window.innerWidth,
       })
     }

     return () => {
       if (debounceRef.current) {
         clearTimeout(debounceRef.current)
       }
       if (vv) {
         vv.removeEventListener('resize', debouncedUpdate)
         vv.removeEventListener('scroll', debouncedUpdate)
       }
       window.removeEventListener('resize', debouncedUpdate)
       if (isDebugEnabled() && isMobile()) {
         delete (window as any).__keyboardMetrics
       }
     }
   }, [debouncedUpdate, updateMetrics, metrics])

  const containerStyle: React.CSSProperties = enabledRef.current
    ? {
        paddingBottom: metrics.isKeyboardVisible
          ? `${metrics.keyboardHeight + accessoryHeight}px`
          : accessoryHeight > 0
            ? `${accessoryHeight}px`
            : undefined,
        height: '100dvh',
        transition: 'padding-bottom 0.15s ease-out',
      }
    : {}

  const keyboardSpacerHeightPx = enabledRef.current && metrics.isKeyboardVisible 
    ? metrics.keyboardHeight 
    : 0

  return {
    keyboardHeight: metrics.keyboardHeight,
    isKeyboardVisible: metrics.isKeyboardVisible,
    containerStyle,
    keyboardHeightPx: metrics.keyboardHeight,
    keyboardVisible: metrics.isKeyboardVisible,
    keyboardSpacerHeightPx,
  }
}
