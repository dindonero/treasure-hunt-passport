"use client"

import { useState, useRef, useCallback, useEffect } from "react"

export const MIN_ZOOM = 1
export const MAX_ZOOM = 4
export const ZOOM_STEP = 0.5

interface UseMapZoomPanOptions {
  interactive: boolean
}

export interface UseMapZoomPanReturn {
  containerRef: React.RefObject<HTMLDivElement | null>
  contentRef: React.RefObject<HTMLDivElement | null>
  zoom: number
  pan: { x: number; y: number }
  isPanning: boolean
  handleZoomIn: () => void
  handleZoomOut: () => void
  handleResetZoom: () => void
  handleMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void
  handleMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void
  handleMouseUp: () => void
  handleMouseLeave: () => void
  handleTouchStart: (e: React.TouchEvent<HTMLDivElement>) => void
  handleTouchMove: (e: React.TouchEvent<HTMLDivElement>) => void
  handleTouchEnd: () => void
  setPreviewPin: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>
  previewPin: { x: number; y: number } | null
}

export function useMapZoomPan({ interactive }: UseMapZoomPanOptions): UseMapZoomPanReturn {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [previewPin, setPreviewPin] = useState<{ x: number; y: number } | null>(null)

  // Zoom & pan state
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0 })
  const panOrigin = useRef({ x: 0, y: 0 })

  // Pinch zoom state
  const lastPinchDist = useRef<number | null>(null)
  const lastPinchZoom = useRef(1)

  const clampPan = useCallback((panX: number, panY: number, currentZoom: number) => {
    if (currentZoom <= 1) return { x: 0, y: 0 }
    const container = containerRef.current
    if (!container) return { x: panX, y: panY }
    const rect = container.getBoundingClientRect()
    const maxPanX = (rect.width * (currentZoom - 1)) / 2
    const maxPanY = (rect.height * (currentZoom - 1)) / 2
    return {
      x: Math.max(-maxPanX, Math.min(maxPanX, panX)),
      y: Math.max(-maxPanY, Math.min(maxPanY, panY)),
    }
  }, [])

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => {
      const next = Math.min(MAX_ZOOM, prev + ZOOM_STEP)
      setPan((p) => clampPan(p.x, p.y, next))
      return next
    })
  }, [clampPan])

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => {
      const next = Math.max(MIN_ZOOM, prev - ZOOM_STEP)
      setPan((p) => clampPan(p.x, p.y, next))
      return next
    })
  }, [clampPan])

  const handleResetZoom = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  // Wheel zoom (desktop)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
      setZoom((prev) => {
        const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta))
        setPan((p) => clampPan(p.x, p.y, next))
        return next
      })
    }

    container.addEventListener("wheel", handleWheel, { passive: false })
    return () => container.removeEventListener("wheel", handleWheel)
  }, [clampPan])

  // Mouse pan (desktop)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (zoom <= 1) return
      if (e.button === 1 || (zoom > 1 && !interactive)) {
        setIsPanning(true)
        panStart.current = { x: e.clientX, y: e.clientY }
        panOrigin.current = { ...pan }
        e.preventDefault()
      }
    },
    [zoom, pan, interactive]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isPanning) {
        const dx = e.clientX - panStart.current.x
        const dy = e.clientY - panStart.current.y
        setPan(clampPan(panOrigin.current.x + dx, panOrigin.current.y + dy, zoom))
        return
      }
      if (!interactive) return
      const content = contentRef.current
      if (!content) return
      const contentRect = content.getBoundingClientRect()
      const x = ((e.clientX - contentRect.left) / contentRect.width) * 100
      const y = ((e.clientY - contentRect.top) / contentRect.height) * 100
      if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
        const rx = Math.round(x * 100) / 100
        const ry = Math.round(y * 100) / 100
        setPreviewPin({ x: rx, y: ry })
      }
    },
    [isPanning, interactive, clampPan, zoom]
  )

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setPreviewPin(null)
    setIsPanning(false)
  }, [])

  // Touch: pinch zoom + pan
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        lastPinchDist.current = Math.hypot(dx, dy)
        lastPinchZoom.current = zoom
      } else if (e.touches.length === 1 && zoom > 1) {
        setIsPanning(true)
        panStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        panOrigin.current = { ...pan }
      }
    },
    [zoom, pan]
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length === 2 && lastPinchDist.current !== null) {
        e.preventDefault()
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.hypot(dx, dy)
        const scale = dist / lastPinchDist.current
        const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, lastPinchZoom.current * scale))
        setZoom(next)
        setPan((p) => clampPan(p.x, p.y, next))
      } else if (e.touches.length === 1 && isPanning) {
        const dx = e.touches[0].clientX - panStart.current.x
        const dy = e.touches[0].clientY - panStart.current.y
        setPan(clampPan(panOrigin.current.x + dx, panOrigin.current.y + dy, zoom))
      }
    },
    [isPanning, clampPan, zoom]
  )

  const handleTouchEnd = useCallback(() => {
    lastPinchDist.current = null
    setIsPanning(false)
  }, [])

  return {
    containerRef,
    contentRef,
    zoom,
    pan,
    isPanning,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    setPreviewPin,
    previewPin,
  }
}
