"use client"

import { useState, useRef, useCallback, useEffect } from "react"

export interface UseFullscreenReturn {
  isExpanded: boolean
  isNativeFullscreen: boolean
  isPortrait: boolean
  handleExpand: () => void
  handleCollapse: () => void
}

export function useFullscreen(): UseFullscreenReturn {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false)
  const [isPortrait, setIsPortrait] = useState(false)
  const scrollYRef = useRef(0)

  // Portrait detection (for CSS rotation fallback on iOS)
  useEffect(() => {
    const check = () => setIsPortrait(window.innerHeight > window.innerWidth)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  // Expand handler — try native fullscreen + orientation lock, fall back silently
  const handleExpand = useCallback(async () => {
    setIsExpanded(true)
    try {
      await document.documentElement.requestFullscreen()
      await (screen.orientation as any).lock("landscape")
      setIsNativeFullscreen(true)
    } catch {
      // iOS or unsupported — CSS rotation fallback handles it
    }
  }, [])

  // Collapse handler — clean up native fullscreen if used
  const handleCollapse = useCallback(async () => {
    setIsExpanded(false)
    setIsNativeFullscreen(false)
    try {
      screen.orientation.unlock()
    } catch {}
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
    } catch {}
  }, [])

  // Lock body scroll & hide header when expanded
  useEffect(() => {
    if (isExpanded) {
      scrollYRef.current = window.scrollY
      document.body.style.position = "fixed"
      document.body.style.top = `-${scrollYRef.current}px`
      document.body.style.left = "0"
      document.body.style.right = "0"
      document.body.style.overflow = "hidden"
      const header = document.querySelector("header")
      if (header) (header as HTMLElement).style.display = "none"
      return () => {
        document.body.style.position = ""
        document.body.style.top = ""
        document.body.style.left = ""
        document.body.style.right = ""
        document.body.style.overflow = ""
        if (header) (header as HTMLElement).style.display = ""
        window.scrollTo(0, scrollYRef.current)
      }
    }
  }, [isExpanded])

  // Listen for native fullscreen exit (user swipes down on Android)
  useEffect(() => {
    if (!isExpanded) return
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsExpanded(false)
        setIsNativeFullscreen(false)
      }
    }
    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange)
  }, [isExpanded])

  // Escape key to close expanded mode
  useEffect(() => {
    if (!isExpanded) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCollapse()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isExpanded, handleCollapse])

  return {
    isExpanded,
    isNativeFullscreen,
    isPortrait,
    handleExpand,
    handleCollapse,
  }
}
