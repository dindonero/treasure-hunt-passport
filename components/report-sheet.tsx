"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronLeft, X, ChevronRight, Camera, Check, Radio, Box, MapPin, Flame, Copy, Bell, AlertTriangle } from "lucide-react"
import { ISSUE_TYPES, type ReportType, type ReportTypeId } from "@/lib/reports"
import { uploadImage, UnsupportedImageError } from "@/lib/image-compress"

const ICONS = {
  nfc: Radio,
  box: Box,
  loc: MapPin,
  flame: Flame,
  copy: Copy,
  bell: Bell,
} as const

const COLORS = {
  pink: "#F0605D",
  cyan: "#58A6FF",
  orange: "#FF9A76",
  green: "#56D364",
} as const

const PALETTE = {
  bgPrimary: "#06080F",
  bgSecondary: "#0A0E14",
  bgCard: "#131921",
  bgElevated: "#1C2431",
  textPrimary: "#E6EDF3",
  textSecondary: "#8B949E",
  textMuted: "#484F58",
} as const

export interface ReportTag {
  id: number
  name: string
  x: number | null
  y: number | null
}

interface ReportSheetProps {
  tag: ReportTag
  onClose: () => void
  onSubmitted?: () => void
}

type Step = "pick" | "form" | "done"

/**
 * Modal bottom-sheet "Report an issue" flow. Matches the design handoff
 * (high-fidelity). Submits to POST /api/reports.
 */
export default function ReportSheet({ tag, onClose, onSubmitted }: ReportSheetProps) {
  const [step, setStep] = useState<Step>("pick")
  const [type, setType] = useState<ReportType | null>(null)
  const [desc, setDesc] = useState("")
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [newPos, setNewPos] = useState<{ x: number; y: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Lock body scroll while the sheet is open
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = original
    }
  }, [])

  const pickType = (t: ReportType) => {
    setType(t)
    setStep("form")
    if (t.id === "wrong_place" && tag.x != null && tag.y != null) {
      setNewPos({ x: tag.x, y: tag.y })
    }
  }

  const handlePhoto = async (file: File) => {
    setUploading(true)
    setError(null)
    const previewUrl = URL.createObjectURL(file)
    setPhotoFile(file)
    setPhotoPreview(previewUrl)
    try {
      const url = await uploadImage(file)
      setPhotoUrl(url)
    } catch (err) {
      console.error("[report-sheet] upload error", err)
      const msg =
        err instanceof UnsupportedImageError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Photo upload failed"
      setError(msg)
      setPhotoFile(null)
      setPhotoPreview(null)
      URL.revokeObjectURL(previewUrl)
    } finally {
      setUploading(false)
    }
  }

  const clearPhoto = () => {
    setPhotoFile(null)
    setPhotoPreview(null)
    setPhotoUrl(null)
  }

  const submit = async () => {
    if (!type) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tagId: tag.id,
          type: type.id,
          description: desc,
          hasPhoto: !!photoUrl,
          photoUrl,
          proposedPos: newPos,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "Failed to submit")
        setSubmitting(false)
        return
      }
      setStep("done")
      setTimeout(() => {
        onSubmitted?.()
        onClose()
      }, 1800)
    } catch {
      setError("Failed to submit")
      setSubmitting(false)
    }
  }

  const colorOf = (key: ReportType["color"]) => COLORS[key]

  return (
    <div
      onClick={onClose}
      className="sheet-overlay fixed inset-x-0 top-0 z-[200] flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="sheet-content relative w-full mx-auto max-w-2xl flex flex-col animate-fade-slide-up"
        style={{
          background: PALETTE.bgSecondary,
          borderTop: `1px solid ${COLORS.pink}40`,
          borderRadius: "18px 18px 0 0",
          boxShadow: `0 -10px 40px rgba(0,0,0,0.6), 0 0 30px ${COLORS.pink}20`,
        }}
      >
        {/* Grabber */}
        <div className="mx-auto mt-2 mb-1" style={{ width: 38, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.18)" }} />

        {/* Header */}
        <div
          className="flex items-center gap-2.5 px-3.5 pt-2 pb-3 border-b"
          style={{ borderColor: "rgba(255,255,255,0.05)" }}
        >
          {step === "form" && (
            <button
              onClick={() => setStep("pick")}
              className="p-1 cursor-pointer"
              style={{ color: PALETTE.textPrimary }}
              type="button"
              aria-label="Back"
            >
              <ChevronLeft className="w-[18px] h-[18px]" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <div
              className="leading-none tracking-wider"
              style={{
                fontFamily: "var(--font-display, 'Bebas Neue'), Impact, sans-serif",
                fontSize: 16,
                color: PALETTE.textPrimary,
              }}
            >
              {step === "done" ? "REPORT SENT" : "REPORT AN ISSUE"}
            </div>
            <div className="mt-0.5 truncate" style={{ fontSize: 10, color: PALETTE.textMuted, letterSpacing: 0.5 }}>
              {tag.name}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer"
            style={{ background: PALETTE.bgCard, color: PALETTE.textPrimary, fontSize: 16, lineHeight: 1 }}
            type="button"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — flex-1 + min-h-0 are required for the inner overflow-auto
            to actually scroll inside the flex column; otherwise the body
            grows past the sheet's max-height cap (see .sheet-content in
            globals.css — 85dvh with vh fallback) and the last item is
            clipped offscreen. Bottom padding includes the iOS safe-area
            inset so the submit button / last picker item clears the home
            indicator. */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3.5 py-3"
          style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
        >
          {step === "pick" && (
            <div>
              <p className="mb-2.5" style={{ fontSize: 11, color: PALETTE.textSecondary, lineHeight: 1.5 }}>
                Help us keep the hunt fair. What’s wrong with this tag?
              </p>
              <div className="flex flex-col gap-1.5">
                {ISSUE_TYPES.map((t) => {
                  const Icon = ICONS[t.icon] || Bell
                  const c = colorOf(t.color)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => pickType(t)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left cursor-pointer transition-colors"
                      style={{
                        background: PALETTE.bgCard,
                        border: `1px solid ${c}30`,
                        color: PALETTE.textPrimary,
                      }}
                    >
                      <span
                        className="w-[34px] h-[34px] rounded-[10px] flex-shrink-0 flex items-center justify-center"
                        style={{ background: c + "20", border: `1px solid ${c}50` }}
                      >
                        <Icon className="w-4 h-4" style={{ color: c }} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-semibold" style={{ fontSize: 13 }}>{t.label}</span>
                        <span className="block mt-0.5" style={{ fontSize: 10, color: PALETTE.textMuted }}>{t.sub}</span>
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: PALETTE.textMuted }} />
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {step === "form" && type && (
            <ReportForm
              tag={tag}
              type={type}
              desc={desc}
              setDesc={setDesc}
              photoPreview={photoPreview}
              photoFile={photoFile}
              uploading={uploading}
              onPhotoChange={(f) => f && handlePhoto(f)}
              clearPhoto={clearPhoto}
              fileInputRef={fileInputRef}
              newPos={newPos}
              setNewPos={setNewPos}
              submitting={submitting}
              onSubmit={submit}
              error={error}
              colorOf={colorOf}
            />
          )}

          {step === "done" && (
            <div className="px-2 pt-5 pb-2 text-center">
              <div
                className="w-16 h-16 mx-auto mb-3.5 rounded-full flex items-center justify-center animate-fade-slide-up"
                style={{
                  background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.cyan})`,
                  boxShadow: `0 0 28px ${COLORS.green}80`,
                }}
              >
                <Check className="w-7 h-7" style={{ color: "#fff" }} strokeWidth={3} />
              </div>
              <div
                className="leading-none tracking-wider"
                style={{
                  fontFamily: "var(--font-display, 'Bebas Neue'), Impact, sans-serif",
                  fontSize: 20,
                  color: PALETTE.textPrimary,
                  textShadow: `0 0 10px ${COLORS.green}66, 0 0 20px ${COLORS.green}33`,
                }}
              >
                THANKS!
              </div>
              <div className="mt-2" style={{ fontSize: 11, color: PALETTE.textSecondary, lineHeight: 1.5 }}>
                Our crew will look at this within 30 min.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface ReportFormProps {
  tag: ReportTag
  type: ReportType
  desc: string
  setDesc: (s: string) => void
  photoPreview: string | null
  photoFile: File | null
  uploading: boolean
  onPhotoChange: (file: File | null) => void
  clearPhoto: () => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  newPos: { x: number; y: number } | null
  setNewPos: (p: { x: number; y: number } | null) => void
  submitting: boolean
  onSubmit: () => void
  error: string | null
  colorOf: (k: ReportType["color"]) => string
}

function ReportForm({
  tag,
  type,
  desc,
  setDesc,
  photoPreview,
  photoFile,
  uploading,
  onPhotoChange,
  clearPhoto,
  fileInputRef,
  newPos,
  setNewPos,
  submitting,
  onSubmit,
  error,
  colorOf,
}: ReportFormProps) {
  const c = colorOf(type.color)
  const Icon = ICONS[type.icon] || Bell
  const needsDesc = type.needs.includes("desc")
  const needsPhoto = type.needs.includes("photo")
  const needsRelocate = type.needs.includes("relocate")
  // Photo is allowed (and surfaced) for every report type — admins benefit
  // from a picture even on "missing" / "wrong place" / "other". Required only
  // when the type's `needs` says so.
  const showPhotoField = true
  // Description is allowed on every type — required when the type's `needs`
  // says so, optional otherwise (so a "wrong place" report can include
  // "tag is on the back wall, not the front" context).
  const showDescField = true

  // Optional desc is "valid" when empty OR ≥8 chars (mirroring the
  // server-side floor in /api/reports). Required desc enforces ≥8.
  const descValid = needsDesc
    ? desc.trim().length >= 8
    : desc.trim().length === 0 || desc.trim().length >= 8

  const canSubmit =
    !submitting &&
    !uploading &&
    descValid &&
    (!needsPhoto || !!photoPreview) &&
    (!needsRelocate || (!!newPos && (newPos.x !== tag.x || newPos.y !== tag.y)))

  return (
    <div>
      {/* Issue chip */}
      <div
        className="flex items-center gap-2.5 px-2.5 py-2 mb-3.5 rounded-[10px]"
        style={{ background: c + "15", border: `1px solid ${c}40` }}
      >
        <span
          className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center"
          style={{ background: c + "25", border: `1px solid ${c}60` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: c }} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold" style={{ fontSize: 12, color: PALETTE.textPrimary }}>{type.label}</div>
          <div style={{ fontSize: 9, color: PALETTE.textMuted, letterSpacing: 0.5 }}>{tag.name}</div>
        </div>
      </div>

      {showPhotoField && (
        <div className="mb-3.5">
          <FieldLabel required={needsPhoto}>
            {needsPhoto ? "Photo evidence" : "Photo (optional)"}
          </FieldLabel>
          {!photoPreview ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center gap-1.5 cursor-pointer"
              style={{
                padding: "14px 8px",
                borderRadius: 12,
                background: PALETTE.bgCard,
                border: `1px dashed ${c}60`,
                color: PALETTE.textPrimary,
              }}
            >
              <Camera className="w-5 h-5" style={{ color: c }} />
              <div style={{ fontSize: 11, fontWeight: 600 }}>{uploading ? "Uploading…" : "Take photo"}</div>
              <div style={{ fontSize: 9, color: PALETTE.textMuted }}>Or attach from library</div>
            </button>
          ) : (
            <div
              className="relative h-[120px] rounded-xl overflow-hidden flex items-center justify-center"
              style={{ border: `1px solid ${c}40` }}
            >
              <img src={photoPreview} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/30" />
              <div className="relative text-center text-white">
                <Camera className="w-6 h-6 mx-auto" />
                <div className="mt-1 truncate max-w-[180px] mx-auto" style={{ fontSize: 10, letterSpacing: 1, opacity: 0.8 }}>
                  {photoFile?.name || "PHOTO"}
                </div>
              </div>
              <button
                type="button"
                onClick={clearPhoto}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-white cursor-pointer"
                style={{ background: "rgba(0,0,0,0.7)" }}
                aria-label="Remove photo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onPhotoChange(e.target.files?.[0] || null)}
          />
        </div>
      )}

      {needsRelocate && (
        <div className="mb-3.5">
          <FieldLabel required>Tap where the tag actually is</FieldLabel>
          <RelocateMap tag={tag} newPos={newPos} setNewPos={setNewPos} />
          <div className="flex gap-1.5 mt-2" style={{ fontSize: 10, color: PALETTE.textSecondary }}>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: COLORS.pink }} />
              On map
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: COLORS.green, boxShadow: `0 0 6px ${COLORS.green}` }} />
              Actual place
            </span>
          </div>
        </div>
      )}

      {showDescField && (
        <div className="mb-3.5">
          <FieldLabel required={needsDesc}>
            {needsDesc ? "Description" : "Description (optional)"}
          </FieldLabel>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value.slice(0, 280))}
            placeholder={
              type.id === "not_scanning"
                ? "e.g. Phone vibrates but app shows “Read error”."
                : type.id === "missing"
                ? "e.g. Booth B7 has the marker but no tag on it."
                : type.id === "damaged"
                ? "e.g. Sticker is peeling off, NFC chip exposed."
                : type.id === "duplicate"
                ? "e.g. Found a tag with id THX-922 not on the map."
                : "Tell us what happened."
            }
            rows={4}
            className="w-full p-2.5 outline-none"
            style={{
              borderRadius: 10,
              background: PALETTE.bgCard,
              border: `1px solid ${desc.length >= 8 ? c + "60" : "rgba(255,255,255,0.08)"}`,
              color: PALETTE.textPrimary,
              fontSize: 12,
              fontFamily: "inherit",
              resize: "vertical",
            }}
          />
          <div className="mt-1 text-right" style={{ fontSize: 9, color: PALETTE.textMuted }}>
            {desc.length} / 280 · min 8 chars
          </div>
        </div>
      )}

      {error && (
        <div className="mb-3 px-3 py-2 rounded-md" style={{ fontSize: 11, background: COLORS.pink + "15", border: `1px solid ${COLORS.pink}40`, color: COLORS.pink }}>
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={onSubmit}
        className="w-full uppercase tracking-wider"
        style={{
          padding: "12px 16px",
          borderRadius: 12,
          background: canSubmit ? `linear-gradient(135deg, ${COLORS.pink}, ${COLORS.orange})` : PALETTE.bgCard,
          color: canSubmit ? "#fff" : PALETTE.textMuted,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 1,
          cursor: canSubmit ? "pointer" : "not-allowed",
          boxShadow: canSubmit ? `0 0 20px ${COLORS.pink}66` : "none",
          fontFamily: "inherit",
          border: "none",
        }}
      >
        {submitting ? "Sending…" : "Send report"}
      </button>
    </div>
  )
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div
      className="uppercase font-semibold mb-1.5"
      style={{ fontSize: 10, color: PALETTE.textSecondary, letterSpacing: 1 }}
    >
      {children}
      {required && <span style={{ color: COLORS.pink, marginLeft: 4 }}>*</span>}
    </div>
  )
}

interface RelocateMapProps {
  tag: ReportTag
  newPos: { x: number; y: number } | null
  setNewPos: (p: { x: number; y: number } | null) => void
}

function RelocateMap({ tag, newPos, setNewPos }: RelocateMapProps) {
  const ref = useRef<HTMLDivElement>(null)
  const onTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * 100
    const y = ((e.clientY - r.top) / r.height) * 100
    setNewPos({
      x: Math.round(Math.max(2, Math.min(98, x)) * 100) / 100,
      y: Math.round(Math.max(2, Math.min(98, y)) * 100) / 100,
    })
  }

  const showOriginal = tag.x != null && tag.y != null
  const showNew = newPos != null && (newPos.x !== tag.x || newPos.y !== tag.y)

  return (
    <div
      ref={ref}
      onClick={onTap}
      className="relative overflow-hidden rounded-xl cursor-crosshair"
      style={{
        aspectRatio: "2400 / 1119",
        background: `linear-gradient(135deg, ${PALETTE.bgCard}, ${PALETTE.bgSecondary})`,
        border: `1px solid ${COLORS.cyan}25`,
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(88,166,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(88,166,255,0.06) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      />
      <img
        src="/jwcc-L3.jpeg"
        alt=""
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        style={{ filter: `brightness(1.4) saturate(0.5) drop-shadow(0 0 6px ${COLORS.cyan}40)`, opacity: 0.55 }}
      />

      {showOriginal && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${tag.x}%`,
            top: `${tag.y}%`,
            transform: "translate(-50%,-50%)",
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 9999,
              background: COLORS.pink + "40",
              border: `1.5px dashed ${COLORS.pink}`,
            }}
          />
          <div
            className="absolute"
            style={{ top: 16, left: "50%", transform: "translateX(-50%)", fontSize: 8, color: COLORS.pink, letterSpacing: 1, whiteSpace: "nowrap", fontWeight: 700 }}
          >
            ON MAP
          </div>
        </div>
      )}

      {showNew && (
        <div
          className="absolute pointer-events-none"
          style={{ left: `${newPos!.x}%`, top: `${newPos!.y}%`, transform: "translate(-50%,-50%)" }}
        >
          <div
            className="absolute animate-ping"
            style={{
              width: 28,
              height: 28,
              borderRadius: 9999,
              top: -14,
              left: -14,
              background: COLORS.green + "30",
            }}
          />
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 9999,
              background: COLORS.green,
              border: "2px solid #fff",
              boxShadow: `0 0 10px ${COLORS.green}`,
            }}
          />
          <div
            className="absolute"
            style={{ top: 16, left: "50%", transform: "translateX(-50%)", fontSize: 8, color: COLORS.green, letterSpacing: 1, whiteSpace: "nowrap", fontWeight: 700 }}
          >
            ACTUAL
          </div>
        </div>
      )}

      {showOriginal && showNew && (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
          <line x1={tag.x!} y1={tag.y!} x2={newPos!.x} y2={newPos!.y} stroke={COLORS.green} strokeWidth="0.4" strokeDasharray="1 1" opacity="0.7" />
        </svg>
      )}

      <div
        className="absolute bottom-1.5 left-1.5 right-1.5 px-2 py-1 rounded-md text-center"
        style={{ fontSize: 9, background: "rgba(0,0,0,0.7)", color: PALETTE.textSecondary, letterSpacing: 0.5 }}
      >
        Tap the map to drop a pin where the tag really is
      </div>
    </div>
  )
}

// Re-export AlertTriangle as the canonical "Report" icon used by callers.
export { AlertTriangle as ReportIcon }
