"use client"

import React, { useState, useCallback } from "react"
import { ZoomIn, ZoomOut, LocateFixed, Eye, EyeOff, Maximize2, Minimize2, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useMapZoomPan, MIN_ZOOM, MAX_ZOOM } from "@/hooks/use-map-zoom-pan"
import { useFullscreen } from "@/hooks/use-fullscreen"

interface Pin {
  id: number
  x: number
  y: number
  name?: string
  found_by_user?: boolean
  is_own?: boolean
}

interface VenueMapProps {
  /** If true, user can click to place a pin */
  interactive?: boolean
  /** Current pin position (for single-pin edit mode) */
  pinX?: number | null
  pinY?: number | null
  /** Called when pin is placed in interactive mode */
  onPinPlace?: (x: number, y: number) => void
  /** Pins to display on the map (for dashboard view) */
  pins?: Pin[]
  /** Called when a pin is clicked (for dashboard view) */
  onPinClick?: (pin: Pin) => void
  /** Selected pin ID */
  selectedPinId?: number | null
  /** Show toggle button to hide/show pins */
  showPinsToggle?: boolean
  /** Allow fullscreen/expand mode */
  allowExpand?: boolean
  /** Optional className */
  className?: string
}

/* ------------------------------------------------------------------ */
/*  Pin marker visual (shared between dashboard pins and picker)       */
/* ------------------------------------------------------------------ */

function PinMarker({ color, selected }: { color: string; selected: boolean }) {
  // Selected pin is now a static, slightly-larger dot — no pulsing ring,
  // matching the design handoff (the "live ping" was misleading at venue).
  if (selected) {
    return (
      <span
        className="block w-[18px] h-[18px] rounded-full border-2 border-white"
        style={{
          backgroundColor: color,
          boxShadow: `0 0 12px ${color}, 0 0 24px ${color}80`,
        }}
      />
    )
  }
  return (
    <span
      className="block w-[11px] h-[11px] rounded-full"
      style={{
        backgroundColor: color,
        border: "1.5px solid rgba(0,0,0,0.5)",
        boxShadow: `0 0 6px ${color}99`,
      }}
    />
  )
}

/* ------------------------------------------------------------------ */
/*  Memoized individual map pin                                        */
/* ------------------------------------------------------------------ */

interface MapPinItemProps {
  pin: Pin
  isSelected: boolean
  color: string
  zoom: number
  onPinClick?: (pin: Pin) => void
}

const MapPinItem = React.memo(function MapPinItem({ pin, isSelected, color, zoom, onPinClick }: MapPinItemProps) {
  return (
    <button
      className={`absolute transition-all duration-200 ${
        isSelected ? "z-30" : "z-20 hover:scale-150"
      }`}
      style={{
        left: `${pin.x}%`,
        top: `${pin.y}%`,
        transform: `translate(-50%, -50%) scale(${1 / zoom})`,
      }}
      onClick={(e) => {
        e.stopPropagation()
        onPinClick?.(pin)
      }}
    >
      <span className="relative inline-block">
        <PinMarker color={color} selected={isSelected} />
      </span>
    </button>
  )
})

/* ------------------------------------------------------------------ */
/*  VenueMap component                                                 */
/* ------------------------------------------------------------------ */

export default function VenueMap({
  interactive = false,
  pinX,
  pinY,
  onPinPlace,
  pins = [],
  onPinClick,
  selectedPinId,
  showPinsToggle = false,
  allowExpand = false,
  className = "",
}: VenueMapProps) {
  const {
    containerRef,
    contentRef,
    zoom,
    pan,
    isPanning,
    previewPin,
    setPreviewPin,
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
  } = useMapZoomPan({ interactive })

  const { isExpanded, isNativeFullscreen, isPortrait, handleExpand, handleCollapse } = useFullscreen()

  const [pinsVisible, setPinsVisible] = useState(true)
  const [legendOpen, setLegendOpen] = useState(false)

  const getPinColor = useCallback((pin: Pin) => {
    if (pin.is_own) return "#58A6FF"       // blue — Your Tag
    if (pin.found_by_user) return "#56D364" // green — Found by you
    return "#F0605D"                        // red-coral — Not Found
  }, [])

  // Click to place pin (accounts for zoom/pan)
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!interactive || !onPinPlace || isPanning) return
      const content = contentRef.current
      if (!content) return
      const contentRect = content.getBoundingClientRect()
      const x = ((e.clientX - contentRect.left) / contentRect.width) * 100
      const y = ((e.clientY - contentRect.top) / contentRect.height) * 100
      if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
        const rx = Math.round(x * 100) / 100
        const ry = Math.round(y * 100) / 100
        onPinPlace(rx, ry)
        setPreviewPin(null)
      }
    },
    [interactive, onPinPlace, isPanning, contentRef, setPreviewPin]
  )

  const mapContent = (
    <>
      {/* Toolbar controls (top-right) — expand / eye / zoomIn / zoomOut */}
      <div className={`absolute top-2 right-2 z-30 flex flex-col gap-1 ${isExpanded ? "top-4 right-4" : ""}`}>
        {/* Expand/collapse toggle */}
        {allowExpand && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="w-8 h-8 bg-black/70 border-[var(--neon-cyan)]/30 text-[var(--neon-cyan)] hover:bg-black/90"
            onClick={isExpanded ? handleCollapse : handleExpand}
            title={isExpanded ? "Exit fullscreen" : "Expand map"}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        )}
        {/* Toggle pins visibility */}
        {showPinsToggle && pins.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={`w-8 h-8 bg-black/70 border-[var(--neon-cyan)]/30 hover:bg-black/90 ${pinsVisible ? "text-[var(--neon-cyan)]" : "text-[var(--text-muted)]"}`}
            onClick={() => setPinsVisible((v) => !v)}
            title={pinsVisible ? "Hide pins" : "Show pins"}
          >
            {pinsVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </Button>
        )}
        {/* Zoom controls */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="w-8 h-8 bg-black/70 border-[var(--neon-cyan)]/30 text-[var(--neon-cyan)] hover:bg-black/90"
          onClick={handleZoomIn}
          disabled={zoom >= MAX_ZOOM}
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="w-8 h-8 bg-black/70 border-[var(--neon-cyan)]/30 text-[var(--neon-cyan)] hover:bg-black/90"
          onClick={handleZoomOut}
          disabled={zoom <= MIN_ZOOM}
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        {zoom > 1 && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="w-8 h-8 bg-black/70 border-[var(--neon-cyan)]/30 text-[var(--neon-cyan)] hover:bg-black/90"
            onClick={handleResetZoom}
          >
            <LocateFixed className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Zoom level indicator */}
      {zoom > 1 && (
        <div className="absolute top-2 left-2 z-30 bg-black/70 text-[var(--neon-cyan)] text-xs px-2 py-1 rounded">
          {zoom.toFixed(1)}x
        </div>
      )}

      {/* Map container with overflow hidden for zoom */}
      <div
        ref={containerRef}
        className={`${isExpanded ? "flex items-center justify-center" : "relative"} w-full overflow-hidden ${isExpanded ? "" : "rounded-lg border border-[var(--neon-cyan)]/20"} transition-all duration-300 ${interactive ? "cursor-crosshair" : zoom > 1 ? "cursor-grab" : ""} ${isPanning ? "cursor-grabbing" : ""}`}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: zoom > 1 ? "none" : "pan-y", ...(isExpanded ? { height: "100%" } : {}) }}
      >
        {/* Zoomable/pannable content */}
        <div
          ref={contentRef}
          className={`relative transition-transform duration-100 origin-center ${
            isExpanded ? "shrink-0 grow-0 min-w-0 min-h-0" : "w-full"
          }`}
          style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            ...(isExpanded ? {
              aspectRatio: "1278 / 863",
              width: "auto",
              height: "auto",
              maxWidth: "100%",
              maxHeight: "100%",
            } : {}),
          }}
        >
          {/* Map Image */}
          <img
            src="/fil_map.jpeg"
            alt="Venue Map"
            className={`block select-none pointer-events-none ${
              isExpanded ? "w-full h-full" : "w-full h-auto"
            }`}
            draggable={false}
          />

          {/* Interactive mode: current pin */}
          {pinX != null && pinY != null && (
            <div
              className="absolute z-20"
              style={{ left: `${pinX}%`, top: `${pinY}%`, transform: `translate(-50%, -50%) scale(${1 / zoom})` }}
            >
              <PinMarker color="#F0605D" selected />
            </div>
          )}

          {/* Interactive mode: preview pin (follows mouse) */}
          {interactive && previewPin && !isPanning && (
            <div
              className="absolute z-10 opacity-50 pointer-events-none"
              style={{ left: `${previewPin.x}%`, top: `${previewPin.y}%`, transform: `translate(-50%, -50%) scale(${1 / zoom})` }}
            >
              <PinMarker color="#F0605D" selected={false} />
            </div>
          )}

          {/* Dashboard mode: all pins */}
          <div className={`transition-opacity duration-300 ${pinsVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
            {pins.map((pin) => (
              <MapPinItem
                key={pin.id}
                pin={pin}
                isSelected={selectedPinId === pin.id}
                color={getPinColor(pin)}
                zoom={zoom}
                onPinClick={onPinClick}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Collapsible Legend (dashboard mode only, respects pin visibility) */}
      {pins.length > 0 && pinsVisible && (
        <div
          className={`absolute bottom-2 left-2 z-30 ${isExpanded ? "bottom-4 left-4" : ""}`}
          onMouseEnter={() => setLegendOpen(true)}
          onMouseLeave={() => setLegendOpen(false)}
        >
          {legendOpen ? (
            /* Expanded legend */
            <div
              className="bg-black/80 rounded-lg p-2 text-xs space-y-1 cursor-pointer"
              onClick={() => setLegendOpen(false)}
            >
              <div className="flex items-center gap-2">
                <span className="block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#F0605D" }} />
                <span className="text-[var(--text-secondary)]">Not found</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#56D364" }} />
                <span className="text-[var(--text-secondary)]">Found by you</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#58A6FF" }} />
                <span className="text-[var(--text-secondary)]">Your tag</span>
              </div>
            </div>
          ) : (
            /* Collapsed legend: small icon button */
            <button
              className="bg-black/70 rounded-lg p-1.5 flex items-center gap-1 border border-[var(--neon-cyan)]/20 hover:bg-black/90 transition-colors"
              onClick={() => setLegendOpen(true)}
              title="Show legend"
            >
              <span className="flex gap-0.5">
                <span className="block w-2 h-2 rounded-full" style={{ backgroundColor: "#F0605D" }} />
                <span className="block w-2 h-2 rounded-full" style={{ backgroundColor: "#56D364" }} />
                <span className="block w-2 h-2 rounded-full" style={{ backgroundColor: "#58A6FF" }} />
              </span>
              <Info className="w-3 h-3 text-[var(--text-muted)]" />
            </button>
          )}
        </div>
      )}
    </>
  )

  // Expanded: fullscreen overlay with landscape rotation support
  const needsRotation = isExpanded && isPortrait && !isNativeFullscreen

  if (isExpanded) {
    return (
      <div style={needsRotation ? {
        position: "fixed",
        top: "100dvh",
        left: 0,
        width: "100dvh",
        height: "100dvw",
        transformOrigin: "top left",
        transform: "rotate(-90deg)",
        zIndex: 9999,
        background: "black",
      } : {
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "black",
      }}>
        <div className="relative w-full h-full overflow-hidden">
          {mapContent}
        </div>
      </div>
    )
  }

  // Normal: inline map
  return (
    <div className={`relative ${className}`}>
      {mapContent}
    </div>
  )
}
