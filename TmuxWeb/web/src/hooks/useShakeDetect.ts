import { useEffect, useRef, useCallback } from 'react'

interface ShakeOptions {
  threshold?: number
  shakeCount?: number
  shakeWindow?: number
  cooldown?: number
  enabled?: boolean
}

interface DeviceMotionEvt extends DeviceMotionEvent {
  requestPermission?: () => Promise<string>
}

export default function useShakeDetect(onShake: () => void, opts: ShakeOptions = {}) {
  const {
    threshold = 25,
    shakeCount = 2,
    shakeWindow = 800,
    cooldown = 2000,
    enabled = true,
  } = opts

  const shakeTimes = useRef<number[]>([])
  const lastTrigger = useRef(0)
  const permissionGranted = useRef(false)
  const onShakeRef = useRef(onShake)
  onShakeRef.current = onShake

  const requestPermission = useCallback(async () => {
    if (permissionGranted.current) return true

    const DME = DeviceMotionEvent as unknown as DeviceMotionEvt
    if (typeof DME !== 'undefined' && typeof (DME as any).requestPermission === 'function') {
      try {
        const result = await (DME as any).requestPermission()
        permissionGranted.current = result === 'granted'
        return permissionGranted.current
      } catch {
        return false
      }
    }
    permissionGranted.current = true
    return true
  }, [])

  useEffect(() => {
    if (!enabled) return

    const handleTouch = async () => {
      await requestPermission()
      document.removeEventListener('touchstart', handleTouch, { capture: true })
    }
    document.addEventListener('touchstart', handleTouch, { capture: true, once: true } as AddEventListenerOptions)

    const handleMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity
      if (!acc || acc.x === null || acc.y === null || acc.z === null) return

      const magnitude = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2)

      if (magnitude > threshold) {
        const now = Date.now()
        shakeTimes.current.push(now)
        shakeTimes.current = shakeTimes.current.filter(t => now - t < shakeWindow)

        if (shakeTimes.current.length >= shakeCount) {
          if (now - lastTrigger.current > cooldown) {
            lastTrigger.current = now
            shakeTimes.current = []
            onShakeRef.current?.()
          }
        }
      }
    }

    window.addEventListener('devicemotion', handleMotion)

    return () => {
      window.removeEventListener('devicemotion', handleMotion)
      document.removeEventListener('touchstart', handleTouch, { capture: true })
    }
  }, [enabled, threshold, shakeCount, shakeWindow, cooldown, requestPermission])

  return { requestPermission }
}
