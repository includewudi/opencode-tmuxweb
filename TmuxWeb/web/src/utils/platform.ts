/**
 * Platform detection and keyboard metrics utilities
 * Pure functions with no side effects for iOS/Android/PWA detection
 */

/**
 * Detect iOS devices including iPadOS
 * iPadOS 13+ reports as "MacIntel" but has touch support
 */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  
  const ua = navigator.userAgent
  
  // Standard iOS detection
  if (/iPhone|iPad|iPod/.test(ua)) {
    return true
  }
  
  // iPadOS 13+ detection: reports as Mac but has touch
  if (
    navigator.platform === 'MacIntel' &&
    navigator.maxTouchPoints > 1
  ) {
    return true
  }
  
  return false
}

/**
 * Detect Android devices
 */
export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android/i.test(navigator.userAgent)
}

/**
 * Detect if running as installed PWA (standalone mode)
 * Checks both iOS-specific navigator.standalone and standard display-mode media query
 */
export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false
  
  // iOS Safari standalone mode
  if ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone) {
    return true
  }
  
  // Standard PWA display-mode check
  if (window.matchMedia?.('(display-mode: standalone)').matches) {
    return true
  }
  
  // Also check fullscreen mode (some PWAs use this)
  if (window.matchMedia?.('(display-mode: fullscreen)').matches) {
    return true
  }
  
  return false
}

/**
 * Keyboard metrics from VisualViewport API
 */
export interface KeyboardMetrics {
  /** Estimated keyboard height in pixels (0 if not visible or unavailable) */
  keyboardHeight: number
  /** Current viewport height (visual) */
  viewportHeight: number
  /** Layout viewport height (full window) */
  layoutHeight: number
  /** Whether keyboard appears to be visible */
  isKeyboardVisible: boolean
}

/**
 * Get keyboard metrics using VisualViewport API
 * Returns estimated keyboard height and visibility state
 * 
 * Note: This is an estimation - the VisualViewport API doesn't directly
 * report keyboard height, but we can infer it from viewport changes
 */
export function getKeyboardMetrics(): KeyboardMetrics {
  const defaultMetrics: KeyboardMetrics = {
    keyboardHeight: 0,
    viewportHeight: window.innerHeight,
    layoutHeight: window.innerHeight,
    isKeyboardVisible: false,
  }
  
  if (typeof window === 'undefined') return defaultMetrics
  
  // Check for VisualViewport API support
  if (!window.visualViewport) {
    return defaultMetrics
  }
  
  const visualViewport = window.visualViewport
  const layoutHeight = window.innerHeight
  const viewportHeight = visualViewport.height
  
  // Keyboard height is the difference between layout and visual viewport
  // Add offset to account for viewport position (scrolled content)
  const keyboardHeight = Math.max(0, layoutHeight - viewportHeight - visualViewport.offsetTop)
  
  // Consider keyboard visible if height difference is significant (> 100px)
  // This threshold avoids false positives from browser UI changes
  const isKeyboardVisible = keyboardHeight > 100
  
  return {
    keyboardHeight: isKeyboardVisible ? keyboardHeight : 0,
    viewportHeight,
    layoutHeight,
    isKeyboardVisible,
  }
}

/**
 * Check if device is mobile (iOS or Android)
 */
export function isMobile(): boolean {
  return isIOS() || isAndroid()
}
