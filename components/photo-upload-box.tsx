"use client"

import { useRef, useState } from "react"
import { Box, Loader2, RotateCcw, Upload } from "lucide-react"
import { uploadImage, UnsupportedImageError } from "@/lib/image-compress"

interface PhotoUploadBoxProps {
  value: string
  focal: string
  fit: boolean
  onChange: (next: { value: string; focal: string; fit: boolean }) => void
}

const MAX_INPUT_BYTES = 25 * 1024 * 1024
const PALETTE = {
  bgPrimary: "#06080F",
  bgCard: "#131921",
  bgElevated: "#1C2431",
  cyan: "#58A6FF",
  green: "#56D364",
  orange: "#FF9A76",
  textPrimary: "#E6EDF3",
  textSecondary: "#8B949E",
  textMuted: "#484F58",
}

function parseFocal(focal: string): { x: number; y: number } {
  const parts = focal.split(/\s+/)
  const x = Math.max(0, Math.min(100, parseFloat(parts[0]) || 50))
  const y = Math.max(0, Math.min(100, parseFloat(parts[1]) || 50))
  return { x, y }
}

function formatFocal(x: number, y: number): string {
  const cx = Math.max(0, Math.min(100, Math.round(x)))
  const cy = Math.max(0, Math.min(100, Math.round(y)))
  return `${cx}% ${cy}%`
}

export default function PhotoUploadBox({ value, focal, fit, onChange }: PhotoUploadBoxProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const masterRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef(false)

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file")
      return
    }
    if (file.size > MAX_INPUT_BYTES) {
      setError("File too large (max 25MB before compression)")
      return
    }
    setUploading(true)
    setError("")
    try {
      const url = await uploadImage(file)
      // Replace resets focal & fit per the design spec.
      onChange({ value: url, focal: "50% 50%", fit: false })
    } catch (err) {
      console.error("Upload error:", err)
      setError(
        err instanceof UnsupportedImageError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Upload failed. Please try again.",
      )
    } finally {
      setUploading(false)
    }
  }

  const setFocalAt = (clientX: number, clientY: number) => {
    const el = masterRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) return
    const x = ((clientX - r.left) / r.width) * 100
    const y = ((clientY - r.top) / r.height) * 100
    onChange({ value, focal: formatFocal(x, y), fit })
  }

  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current = true
    setFocalAt(e.clientX, e.clientY)
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return
    setFocalAt(e.clientX, e.clientY)
  }
  const onMouseUp = () => { dragRef.current = false }

  const onTouchStart = (e: React.TouchEvent) => {
    dragRef.current = true
    const t = e.touches[0]
    if (t) setFocalAt(t.clientX, t.clientY)
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragRef.current) return
    const t = e.touches[0]
    if (t) setFocalAt(t.clientX, t.clientY)
  }
  const onTouchEnd = () => { dragRef.current = false }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const { x: fx, y: fy } = parseFocal(focal)

  if (!value) {
    return (
      <>
        <button
          type="button"
          onClick={() => !uploading && fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className="w-full"
          style={{
            padding: "32px 14px",
            borderRadius: 12,
            border: `1.5px dashed ${dragging ? PALETTE.cyan : PALETTE.cyan + "50"}`,
            background: dragging ? PALETTE.cyan + "10" : PALETTE.bgCard,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            cursor: uploading ? "default" : "pointer",
            opacity: uploading ? 0.6 : 1,
          }}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: PALETTE.cyan }} />
          ) : (
            <Box className="w-7 h-7" style={{ color: PALETTE.cyan }} />
          )}
          <div style={{ fontSize: 13, fontWeight: 700, color: PALETTE.textPrimary }}>
            {uploading ? "Uploading…" : "Upload product photo"}
          </div>
          <div style={{ fontSize: 11, color: PALETTE.textMuted }}>
            Portrait or landscape · max 8 MB · JPG / PNG
          </div>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
          }}
        />
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </>
    )
  }

  return (
    <div
      style={{
        borderRadius: 14,
        border: `1px solid ${PALETTE.bgElevated}`,
        background: PALETTE.bgCard,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Box className="w-3.5 h-3.5" style={{ color: PALETTE.cyan }} />
        <div
          style={{
            flex: 1,
            fontSize: 12,
            fontWeight: 700,
            color: PALETTE.textPrimary,
            letterSpacing: 0.4,
          }}
        >
          PRODUCT PHOTO
        </div>
        <button
          type="button"
          onClick={() => !uploading && fileRef.current?.click()}
          disabled={uploading}
          style={{
            border: "none",
            background: "transparent",
            color: PALETTE.textSecondary,
            fontSize: 11,
            fontWeight: 600,
            cursor: uploading ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          {uploading ? "Uploading…" : "Replace"}
        </button>
      </div>

      {/* Master photo + focal-point picker, with live previews on the right */}
      <div className="flex gap-3">
        <div style={{ width: 120, flexShrink: 0 }}>
          <div
            ref={masterRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            style={{
              position: "relative",
              cursor: "crosshair",
              borderRadius: 10,
              overflow: "hidden",
              border: `1px solid ${PALETTE.bgElevated}`,
              userSelect: "none",
              touchAction: "none",
              aspectRatio: "3 / 4",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Master"
              draggable={false}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "50% 50%",
                pointerEvents: "none",
              }}
            />
            <CropOverlays fy={fy} />
            {/* Focal target */}
            <div
              style={{
                position: "absolute",
                left: `${fx}%`,
                top: `${fy}%`,
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
                width: 28,
                height: 28,
                borderRadius: 999,
                border: `2px solid ${PALETTE.cyan}`,
                boxShadow: `0 0 0 2px rgba(0,0,0,0.4), 0 0 12px ${PALETTE.cyan}`,
                background: "rgba(0,0,0,0.15)",
                transition: "left 90ms linear, top 90ms linear",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  inset: "40%",
                  borderRadius: 999,
                  background: PALETTE.cyan,
                  boxShadow: `0 0 6px ${PALETTE.cyan}`,
                }}
              />
            </div>
            {/* Portrait label */}
            <span
              style={{
                position: "absolute",
                bottom: 3,
                left: 4,
                fontSize: 8,
                color: PALETTE.cyan,
                fontFamily: "var(--font-mono, monospace)",
                fontWeight: 700,
                letterSpacing: 0.4,
                textShadow: "0 0 4px rgba(0,0,0,0.8)",
              }}
            >
              3:4 STORE
            </span>
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 9,
              color: PALETTE.textMuted,
              fontFamily: "var(--font-mono, monospace)",
              textAlign: "center",
              letterSpacing: 0.4,
            }}
          >
            ORIGINAL · {focal}
          </div>
          <button
            type="button"
            onClick={() => onChange({ value, focal: "50% 50%", fit })}
            style={{
              marginTop: 4,
              fontSize: 9,
              color: PALETTE.cyan,
              textAlign: "center",
              letterSpacing: 0.3,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              width: "100%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
            }}
          >
            <RotateCcw className="w-2.5 h-2.5" /> Reset focus
          </button>
        </div>

        {/* Live previews — three target surfaces */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <PreviewTile label="STORE CARD" sub="Customer browse · 3:4" aspect="3 / 4" src={value} focal={focal} fit={fit} />
          <PreviewTile label="THUMBNAIL"  sub="Cart · admin list · 1:1" aspect="1 / 1" src={value} focal={focal} fit={fit} />
          <PreviewTile label="BANNER"     sub="Header · receipt · 16:9" aspect="16 / 9" src={value} focal={focal} fit={fit} />
        </div>
      </div>

      {/* Footer controls — explanation + FILL/FIT toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 10px",
          borderRadius: 8,
          background: PALETTE.bgPrimary,
          border: `1px solid ${PALETTE.bgElevated}`,
        }}
      >
        <div style={{ flex: 1, fontSize: 11, color: PALETTE.textSecondary, lineHeight: 1.4 }}>
          {fit ? (
            <>Photo will be <b style={{ color: PALETTE.textPrimary }}>fit (letterboxed)</b> in non-portrait surfaces — no cropping at all.</>
          ) : (
            <>Photo will be <b style={{ color: PALETTE.textPrimary }}>cropped to focus</b> outside the portrait card. Move the dot to choose the kept area.</>
          )}
        </div>
        <div
          style={{
            display: "flex",
            gap: 4,
            padding: 3,
            borderRadius: 999,
            border: `1px solid ${PALETTE.bgElevated}`,
            background: PALETTE.bgPrimary,
          }}
        >
          {(["FILL", "FIT"] as const).map((lbl) => {
            const on = (lbl === "FIT") === fit
            return (
              <button
                key={lbl}
                type="button"
                onClick={() => onChange({ value, focal, fit: lbl === "FIT" })}
                style={{
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 10px",
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 0.5,
                  background: on ? PALETTE.cyan : "transparent",
                  color: on ? "#0a0a0a" : PALETTE.textSecondary,
                }}
              >
                {lbl}
              </button>
            )
          })}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
        }}
      />

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}

/**
 * Dashed-rect overlays showing where each non-3:4 surface will crop the
 * master photo, centred on the focal Y. Heights expressed as % of the
 * master's height (master is 3:4):
 *   1:1 (square)  → 75% (square_h / master_h = (W) / (4/3·W) = 0.75)
 *   16:9 (banner) → ≈42.2% ((9/16) / (4/3) ≈ 0.422)
 */
function CropOverlays({ fy }: { fy: number }) {
  const rects = [
    { id: "square", label: "1:1", height: 75, color: PALETTE.green },
    { id: "banner", label: "16:9", height: 42.2, color: PALETTE.orange },
  ]
  return (
    <>
      {rects.map((r) => {
        const top = Math.max(0, Math.min(100 - r.height, fy - r.height / 2))
        return (
          <div
            key={r.id}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${top}%`,
              height: `${r.height}%`,
              border: `1px dashed ${r.color}`,
              borderRadius: 4,
              pointerEvents: "none",
              boxShadow: `inset 0 0 0 1px ${r.color}25`,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                right: 4,
                fontSize: 8,
                color: r.color,
                fontFamily: "var(--font-mono, monospace)",
                fontWeight: 700,
                letterSpacing: 0.4,
                textShadow: "0 0 4px rgba(0,0,0,0.8)",
              }}
            >
              {r.label}
            </span>
          </div>
        )
      })}
    </>
  )
}

function PreviewTile({
  label,
  sub,
  aspect,
  src,
  focal,
  fit,
}: {
  label: string
  sub: string
  aspect: string
  src: string
  focal: string
  fit: boolean
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 min-w-0">
        <div
          style={{
            width: "100%",
            aspectRatio: aspect,
            borderRadius: 8,
            overflow: "hidden",
            border: `1px solid ${PALETTE.bgElevated}`,
            background: fit ? "#000" : "transparent",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={label}
            style={{
              width: "100%",
              height: "100%",
              objectFit: fit ? "contain" : "cover",
              objectPosition: focal,
            }}
          />
        </div>
      </div>
      <div style={{ width: 100, flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: PALETTE.textPrimary, letterSpacing: 0.5 }}>
          {label}
        </div>
        <div style={{ fontSize: 9, color: PALETTE.textMuted, marginTop: 1 }}>{sub}</div>
      </div>
    </div>
  )
}
