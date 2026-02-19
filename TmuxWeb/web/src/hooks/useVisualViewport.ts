import { useEffect, useRef } from 'react'

/**
 * Set --app-height to visualViewport.height. On keyboard open (height drops
 * significantly), freeze --app-height so the layout doesn't shrink. Small
 * fluctuations (address bar show/hide) are tracked normally.
 */
export default function useVisualViewport() {
  const appHeightRef = useRef<number>(0)
  const KEYBOARD_THRESHOLD = 150

  useEffect(() => {
    const root = document.documentElement
    const vv = window.visualViewport
    if (!vv) return

    const setAppHeight = (h: number) => {
      appHeightRef.current = h
      root.style.setProperty('--app-height', `${h}px`)
    }

    setAppHeight(vv.height)

    const update = () => {
      const currentH = vv.height
      const diff = appHeightRef.current - currentH

      if (diff > KEYBOARD_THRESHOLD) {
        root.style.setProperty('--vvh', `${currentH}px`)
        root.style.setProperty('--vv-offset', `${diff}px`)
        return
      }

      setAppHeight(currentH)
      root.style.setProperty('--vvh', `${currentH}px`)
      root.style.setProperty('--vv-offset', '0px')
    }

    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)

    const handleOrientationChange = () => {
      setTimeout(() => {
        setAppHeight(vv.height)
        update()
      }, 300)
    }
    window.addEventListener('orientationchange', handleOrientationChange)

    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      window.removeEventListener('orientationchange', handleOrientationChange)
    }
  }, [])
}
