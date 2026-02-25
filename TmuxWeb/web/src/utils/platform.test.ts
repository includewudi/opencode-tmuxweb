import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isIOS, isAndroid, isMobile, isStandalonePWA } from './platform'

describe('platform detection', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('isIOS', () => {
    it('returns true for iPhone user agent', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        platform: 'iPhone',
        maxTouchPoints: 5,
      })
      expect(isIOS()).toBe(true)
    })

    it('returns true for iPad user agent', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)',
        platform: 'iPad',
        maxTouchPoints: 5,
      })
      expect(isIOS()).toBe(true)
    })

    it('returns true for iPadOS (MacIntel with touch)', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        platform: 'MacIntel',
        maxTouchPoints: 5,
      })
      expect(isIOS()).toBe(true)
    })

    it('returns false for Mac desktop', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        platform: 'MacIntel',
        maxTouchPoints: 0,
      })
      expect(isIOS()).toBe(false)
    })

    it('returns false for Android', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Linux; Android 14)',
        platform: 'Linux',
        maxTouchPoints: 5,
      })
      expect(isIOS()).toBe(false)
    })
  })

  describe('isAndroid', () => {
    it('returns true for Android user agent', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)',
        platform: 'Linux',
        maxTouchPoints: 5,
      })
      expect(isAndroid()).toBe(true)
    })

    it('returns false for desktop', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        platform: 'Win32',
        maxTouchPoints: 0,
      })
      expect(isAndroid()).toBe(false)
    })
  })

  describe('isMobile', () => {
    it('returns true for iPhone', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        platform: 'iPhone',
        maxTouchPoints: 5,
      })
      expect(isMobile()).toBe(true)
    })

    it('returns true for Android', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Linux; Android 14)',
        platform: 'Linux',
        maxTouchPoints: 5,
      })
      expect(isMobile()).toBe(true)
    })

    it('returns false for desktop', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        platform: 'MacIntel',
        maxTouchPoints: 0,
      })
      expect(isMobile()).toBe(false)
    })
  })

  describe('isStandalonePWA', () => {
    it('returns false when not standalone', () => {
      vi.stubGlobal('navigator', { userAgent: 'test' })
      vi.stubGlobal('window', {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
      })
      expect(isStandalonePWA()).toBe(false)
    })
  })
})
