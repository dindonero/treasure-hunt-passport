"use client"

import { useCallback } from "react"

export function useHaptic() {
  const vibrate = useCallback((pattern: number | number[] = 50) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(pattern)
    }
  }, [])

  const light = useCallback(() => vibrate(10), [vibrate])
  const medium = useCallback(() => vibrate(50), [vibrate])
  const heavy = useCallback(() => vibrate(100), [vibrate])
  const success = useCallback(() => vibrate([50, 30, 80]), [vibrate])
  const error = useCallback(() => vibrate([100, 50, 100, 50, 100]), [vibrate])

  return { vibrate, light, medium, heavy, success, error }
}
