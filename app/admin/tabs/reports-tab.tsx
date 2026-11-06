"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Bell,
  Box,
  Camera,
  Check,
  ChevronRight,
  Copy,
  Flame,
  Loader2,
  MapPin,
  Pencil,
  Radio,
  Trash2,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import {
  reportTypeMeta,
  relativeTime,
  type ReportDTO,
  type ReportStatus,
} from "@/lib/reports"
import AdminFormModal from "../admin-form-modal"
import type { FormData as AdminFormData, NfcTag } from "../types"
import { useTokenMetadata } from "@/lib/token-metadata-context"

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
  textMuted: "#8B949E",
} as const

type FilterId = "open" | "progress" | "resolved" | "all"

export default function ReportsTab() {
  const [reports, setReports] = useState<ReportDTO[]>([])
  const [counts, setCounts] = useState({ open: 0, progress: 0, resolved: 0, all: 0 })
  const [filter, setFilter] = useState<FilterId>("open")
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [editingTag, setEditingTag] = useState<NfcTag | null>(null)
  const [tagModalOpen, setTagModalOpen] = useState(false)
  const [tagFormData, setTagFormData] = useState<AdminFormData>({})
  const [tagSaving, setTagSaving] = useState(false)
  const [tagOpening, setTagOpening] = useState<number | null>(null)
  const { symbol } = useTokenMetadata()

  const fetchReports = useCallback(async (f: FilterId, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      const params = new URLSearchParams()
      if (f !== "all") params.set("status", f)
      const res = await fetch(`/api/admin/reports?${params.toString()}`, { credentials: "include", cache: "no-store" })
      if (!res.ok) return
      const data = await res.json()
      setReports(data.reports || [])
      setCounts(data.counts || { open: 0, progress: 0, resolved: 0, all: 0 })
    } catch (err) {
      console.error("[reports-tab] fetch error", err)
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReports(filter)
  }, [filter, fetchReports])

  // Edit a tag from inside this tab without leaving the page. We pull the
  // full tag row via the admin list endpoint and reuse the same widget the
  // NFC Tags admin tab uses.
  const openTagEditor = async (tagId: number) => {
    setTagOpening(tagId)
    try {
      const res = await fetch("/api/admin/nfc-tags", { credentials: "include", cache: "no-store" })
      if (!res.ok) {
        toast({ description: "Couldn't load tag for editing", variant: "destructive" })
        return
      }
      const data = await res.json()
      const tag = (data.tags as NfcTag[] | undefined)?.find((t) => t.id === tagId)
      if (!tag) {
        toast({ description: "Tag not found", variant: "destructive" })
        return
      }
      setEditingTag(tag)
      setTagFormData({
        name: tag.name || "",
        hint: tag.hint || "",
        token_reward: tag.token_reward || "100",
        status: tag.status,
        location_x: tag.location_x ?? null,
        location_y: tag.location_y ?? null,
        owner_address: tag.owner_address || "",
      })
      setTagModalOpen(true)
    } finally {
      setTagOpening(null)
    }
  }

  const saveTag = async () => {
    if (!editingTag) return
    setTagSaving(true)
    try {
      const res = await fetch("/api/admin/nfc-tags", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingTag.id, ...tagFormData }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        toast({ description: data.error || "Failed to save tag", variant: "destructive" })
        return
      }
      toast({
        description: "NFC tag updated!",
        className: "border-[#9FD356] bg-[#1a1a1a] text-white",
      })
      setTagModalOpen(false)
      setEditingTag(null)
      // Refresh reports — the joined originalPos / tag name on each card
      // tracks the tag, so any change should be reflected immediately.
      fetchReports(filter, { silent: true })
    } catch {
      toast({ description: "Failed to save tag", variant: "destructive" })
    } finally {
      setTagSaving(false)
    }
  }

  const acceptLocation = async (r: ReportDTO) => {
    if (!r.tagId || !r.proposedPos) return
    setActingId(r.numericId)
    try {
      const res = await fetch("/api/admin/nfc-tags", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: r.tagId,
          location_x: r.proposedPos.x,
          location_y: r.proposedPos.y,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({ description: data.error || "Failed to update tag", variant: "destructive" })
        return
      }
      // Auto-resolve the report once the move is applied — there's nothing
      // left for an admin to do on this report afterwards.
      const patch = await fetch(`/api/admin/reports/${r.numericId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      })
      if (!patch.ok) {
        toast({ description: "Tag moved, but failed to resolve report", variant: "destructive" })
      } else {
        toast({
          description: "Tag moved to reporter's location · report resolved",
          className: "border-[#9FD356] bg-[#1a1a1a] text-white",
        })
      }
      await fetchReports(filter, { silent: true })
    } finally {
      setActingId(null)
    }
  }

  const deleteReport = async (r: ReportDTO) => {
    const hasPhoto = !!r.photoUrl
    const msg = hasPhoto
      ? `Delete report ${r.id}? This permanently removes the report and its photo.`
      : `Delete report ${r.id}? This is permanent.`
    if (!window.confirm(msg)) return
    setDeletingId(r.numericId)
    try {
      const res = await fetch(`/api/admin/reports/${r.numericId}`, {
        method: "DELETE",
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ description: data.error || "Failed to delete report", variant: "destructive" })
        return
      }
      if (selectedId === r.numericId) setSelectedId(null)
      toast({
        description: "Report deleted",
        className: "border-[#9FD356] bg-[#1a1a1a] text-white",
      })
      await fetchReports(filter, { silent: true })
    } finally {
      setDeletingId(null)
    }
  }

  const updateReport = async (id: number, body: Record<string, unknown>) => {
    setActingId(id)
    try {
      const res = await fetch(`/api/admin/reports/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({ description: data.error || "Failed to update report", variant: "destructive" })
        return
      }
      toast({
        description:
          body.status === "resolved"
            ? "Report resolved"
            : body.status === "progress"
            ? "Report assigned"
            : "Report updated",
        className: "border-[#9FD356] bg-[#1a1a1a] text-white",
      })
      await fetchReports(filter, { silent: true })
    } finally {
      setActingId(null)
    }
  }

  const statusMeta = (s: ReportStatus) =>
    s === "open"
      ? { label: "OPEN", color: COLORS.pink }
      : s === "progress"
      ? { label: "IN PROGRESS", color: COLORS.orange }
      : { label: "RESOLVED", color: COLORS.green }

  const prioColor = (p: ReportDTO["priority"]) =>
    p === "high" ? COLORS.pink : p === "med" ? COLORS.orange : COLORS.textMuted

  const tiles: Array<{ id: FilterId; n: number; label: string; color: string }> = useMemo(
    () => [
      { id: "open", n: counts.open, label: "Open", color: COLORS.pink },
      { id: "progress", n: counts.progress, label: "WIP", color: COLORS.orange },
      { id: "resolved", n: counts.resolved, label: "Done", color: COLORS.green },
      { id: "all", n: counts.all, label: "Total", color: COLORS.cyan },
    ],
    [counts],
  )

  return (
    <div className="space-y-4">
      {/* Header strip */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="leading-none tracking-wider"
            style={{
              fontFamily: "var(--font-display, 'Bebas Neue'), Impact, sans-serif",
              fontSize: 22,
              color: "#E6EDF3",
              textShadow: `0 0 10px ${COLORS.pink}66, 0 0 20px ${COLORS.pink}33`,
            }}
          >
            REPORTS
          </h2>
          <div className="mt-1 uppercase tracking-wider" style={{ fontSize: 10, color: "#8B949E" }}>
            Admin · {counts.open} open · {counts.progress} in progress
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full uppercase font-semibold"
          style={{
            fontSize: 11,
            color: COLORS.pink,
            background: COLORS.pink + "18",
            border: `1px solid ${COLORS.pink}40`,
            letterSpacing: 0.4,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS.pink, boxShadow: `0 0 6px ${COLORS.pink}` }} />
          LIVE
        </span>
      </div>

      {/* Filter tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {tiles.map((tile) => {
          const active = filter === tile.id
          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => {
                setFilter(tile.id)
                setSelectedId(null)
              }}
              className="text-center cursor-pointer transition-all"
              style={{
                padding: "8px 4px",
                borderRadius: 10,
                background: active ? tile.color + "15" : "#131921",
                border: `1px solid ${active ? tile.color : tile.color + "30"}`,
                boxShadow: active ? `0 0 14px ${tile.color}40` : "none",
                fontFamily: "inherit",
              }}
            >
              <div
                className="leading-none tracking-wider"
                style={{
                  fontFamily: "var(--font-display, 'Bebas Neue'), Impact, sans-serif",
                  fontSize: 22,
                  color: tile.color,
                  textShadow: active ? `0 0 10px ${tile.color}66` : undefined,
                }}
              >
                {tile.n}
              </div>
              <div className="mt-1 uppercase" style={{ fontSize: 8, color: "#8B949E", letterSpacing: 1 }}>
                {tile.label}
              </div>
            </button>
          )
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: COLORS.cyan }} />
        </div>
      ) : reports.length === 0 ? (
        <div className="py-10 text-center" style={{ color: "#484F58", fontSize: 11 }}>
          <Check className="w-6 h-6 mx-auto" style={{ color: COLORS.green }} />
          <div className="mt-2">All clear in this bucket.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {reports.map((r) => {
            const tm = reportTypeMeta(r.type)
            const Icon = ICONS[tm.icon] || Bell
            const c = (COLORS as Record<string, string>)[tm.color] || COLORS.cyan
            const sm = statusMeta(r.status)
            const isOpen = selectedId === r.numericId
            const acting = actingId === r.numericId
            return (
              <div
                key={r.numericId}
                className="overflow-hidden transition-all"
                style={{
                  borderRadius: 12,
                  background: "#131921",
                  border: `1px solid ${isOpen ? c : "rgba(255,255,255,0.05)"}`,
                  boxShadow: isOpen ? `0 0 16px ${c}30` : "none",
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(isOpen ? null : r.numericId)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left cursor-pointer"
                  style={{ background: "transparent", border: "none", fontFamily: "inherit" }}
                >
                  <div
                    className="relative w-9 h-9 rounded-[10px] flex-shrink-0 flex items-center justify-center"
                    style={{ background: c + "18", border: `1px solid ${c}50` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: c }} />
                    {r.priority === "high" && (
                      <span
                        className="absolute"
                        style={{
                          top: -3,
                          right: -3,
                          width: 10,
                          height: 10,
                          borderRadius: 9999,
                          background: COLORS.pink,
                          border: `2px solid #131921`,
                          boxShadow: `0 0 6px ${COLORS.pink}`,
                        }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span style={{ fontSize: 9, color: sm.color, fontWeight: 700, letterSpacing: 1 }}>{sm.label}</span>
                      <span style={{ fontSize: 9, color: "#484F58" }}>·</span>
                      <span
                        style={{ fontSize: 9, color: prioColor(r.priority), fontWeight: 600, letterSpacing: 1 }}
                        className="uppercase"
                      >
                        {r.priority}
                      </span>
                    </div>
                    <div className="font-semibold truncate" style={{ fontSize: 13, color: "#E6EDF3" }}>
                      {tm.label}
                    </div>
                    <div className="mt-0.5 truncate" style={{ fontSize: 10, color: "#484F58" }}>
                      {r.tagName} · {r.reporter} · {relativeTime(r.createdAt)}
                    </div>
                  </div>
                  <div className="hidden sm:block flex-shrink-0" style={{ fontSize: 10, color: "#484F58", fontFamily: "Roboto Mono, monospace" }}>
                    {r.id}
                  </div>
                  <ChevronRight
                    className="w-4 h-4 flex-shrink-0 transition-transform"
                    style={{ color: "#484F58", transform: isOpen ? "rotate(90deg)" : "rotate(0)" }}
                  />
                </button>

                {isOpen && (
                  <div
                    className="flex flex-col gap-2.5 px-3 pb-3"
                    style={{ borderTop: `1px solid ${c}20` }}
                  >
                    {r.description && (
                      <div
                        className="mt-2.5 px-2.5 py-2.5 rounded-lg italic"
                        style={{
                          background: "#0A0E14",
                          border: `1px solid ${c}20`,
                          fontSize: 11,
                          color: "#E6EDF3",
                          lineHeight: 1.5,
                        }}
                      >
                        “{r.description}”
                      </div>
                    )}

                    {(r.photoUrl || r.hasPhoto) && (
                      <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${c}40` }}>
                        {r.photoUrl ? (
                          <a
                            href={r.photoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                            title="Open full size"
                          >
                            <img
                              src={r.photoUrl}
                              alt="report photo"
                              className="w-full object-cover"
                              style={{ maxHeight: 320 }}
                            />
                          </a>
                        ) : (
                          <div
                            className="w-full flex items-center justify-center"
                            style={{
                              height: 90,
                              background: `radial-gradient(circle at 30% 40%, ${c}40 0%, transparent 50%), radial-gradient(circle at 70% 70%, ${COLORS.orange}30 0%, transparent 50%), linear-gradient(135deg, #1a1a24, #0a0a14)`,
                              color: "#fff",
                            }}
                          >
                            <div className="text-center">
                              <Camera className="w-5 h-5 mx-auto" />
                              <div className="mt-1" style={{ fontSize: 9, letterSpacing: 1, opacity: 0.8 }}>
                                PHOTO ATTACHED · UPLOAD MISSING
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {r.type === "wrong_place" && r.proposedPos && (
                      <>
                        <RelocatePreview
                          original={r.originalPos}
                          proposed={r.proposedPos}
                          accent={c}
                        />
                        {r.tagId != null && r.status !== "resolved" && (
                          <button
                            type="button"
                            disabled={acting}
                            onClick={() => acceptLocation(r)}
                            className="w-full uppercase cursor-pointer flex items-center justify-center gap-1.5"
                            style={{
                              padding: "9px 12px",
                              borderRadius: 8,
                              background: `linear-gradient(135deg, ${COLORS.green}25, ${COLORS.cyan}20)`,
                              border: `1px solid ${COLORS.green}70`,
                              color: COLORS.green,
                              fontSize: 11,
                              fontWeight: 700,
                              letterSpacing: 0.5,
                              fontFamily: "inherit",
                              boxShadow: `0 0 14px ${COLORS.green}25`,
                            }}
                          >
                            <Check className="w-3.5 h-3.5" />
                            {acting ? "Applying…" : "Accept new location & resolve"}
                          </button>
                        )}
                      </>
                    )}

                    {r.tagId && (
                      <button
                        type="button"
                        disabled={tagOpening === r.tagId}
                        onClick={() => openTagEditor(r.tagId!)}
                        className="flex items-center justify-center gap-1.5 uppercase cursor-pointer"
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          background: "transparent",
                          border: `1px solid ${COLORS.cyan}40`,
                          color: COLORS.cyan,
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: 0.5,
                          fontFamily: "inherit",
                        }}
                      >
                        {tagOpening === r.tagId ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Pencil className="w-3.5 h-3.5" />
                        )}
                        Edit tag
                      </button>
                    )}

                    {r.status !== "resolved" && (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            disabled={acting}
                            onClick={() => updateReport(r.numericId, { status: "resolved" })}
                            className="flex-1 uppercase cursor-pointer"
                            style={{
                              padding: "8px 10px",
                              borderRadius: 8,
                              background: COLORS.green + "20",
                              border: `1px solid ${COLORS.green}60`,
                              color: COLORS.green,
                              fontSize: 11,
                              fontWeight: 700,
                              letterSpacing: 0.5,
                              fontFamily: "inherit",
                            }}
                          >
                            {acting ? "…" : "Resolve"}
                          </button>
                          {r.status === "open" && (
                            <button
                              type="button"
                              disabled={acting}
                              onClick={() => updateReport(r.numericId, { status: "progress" })}
                              className="flex-1 uppercase cursor-pointer"
                              style={{
                                padding: "8px 10px",
                                borderRadius: 8,
                                background: COLORS.orange + "20",
                                border: `1px solid ${COLORS.orange}60`,
                                color: COLORS.orange,
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: 0.5,
                                fontFamily: "inherit",
                              }}
                            >
                              {acting ? "…" : "Assign"}
                            </button>
                          )}
                        </div>
                        <PrioritySegment
                          current={r.priority}
                          disabled={acting}
                          onChange={(p) => updateReport(r.numericId, { priority: p })}
                        />
                      </div>
                    )}
                    {r.status === "resolved" && r.resolvedAt && (
                      <div style={{ fontSize: 10, color: "#484F58" }}>
                        Resolved {relativeTime(r.resolvedAt)}
                        {r.resolvedBy && ` by ${r.resolvedBy.slice(0, 6)}…${r.resolvedBy.slice(-4)}`}
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={deletingId === r.numericId}
                      onClick={() => deleteReport(r)}
                      className="flex items-center justify-center gap-1.5 uppercase cursor-pointer mt-1"
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "transparent",
                        border: `1px solid ${COLORS.pink}40`,
                        color: COLORS.pink,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: 0.5,
                        fontFamily: "inherit",
                      }}
                    >
                      {deletingId === r.numericId ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      {deletingId === r.numericId ? "Deleting…" : "Delete report"}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tagModalOpen && editingTag && (
        <AdminFormModal
          modalType="nfc"
          editingItem={editingTag}
          formData={tagFormData}
          setFormData={setTagFormData}
          onSave={saveTag}
          onClose={() => { setTagModalOpen(false); setEditingTag(null) }}
          saving={tagSaving}
          symbol={symbol}
        />
      )}
    </div>
  )
}

function RelocatePreview({
  original,
  proposed,
  accent,
}: {
  original: { x: number; y: number } | null
  proposed: { x: number; y: number }
  accent: string
}) {
  const dxDy =
    original != null
      ? {
          dx: proposed.x - original.x,
          dy: proposed.y - original.y,
        }
      : null
  const dist = dxDy ? Math.sqrt(dxDy.dx * dxDy.dx + dxDy.dy * dxDy.dy) : null

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: "#0A0E14", border: `1px solid ${accent}20` }}
    >
      <div
        className="relative"
        style={{
          aspectRatio: "2400 / 1119",
          background: "linear-gradient(135deg, #131921, #0A0E14)",
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
          style={{ filter: `brightness(1.4) saturate(0.5)`, opacity: 0.55 }}
        />

        {original && (
          <div
            className="absolute pointer-events-none"
            style={{ left: `${original.x}%`, top: `${original.y}%`, transform: "translate(-50%,-50%)" }}
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
              style={{
                top: 16,
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: 8,
                color: COLORS.pink,
                letterSpacing: 1,
                whiteSpace: "nowrap",
                fontWeight: 700,
              }}
            >
              ON MAP
            </div>
          </div>
        )}

        <div
          className="absolute pointer-events-none"
          style={{ left: `${proposed.x}%`, top: `${proposed.y}%`, transform: "translate(-50%,-50%)" }}
        >
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
            style={{
              top: 16,
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: 8,
              color: COLORS.green,
              letterSpacing: 1,
              whiteSpace: "nowrap",
              fontWeight: 700,
            }}
          >
            REPORTER
          </div>
        </div>

        {original && (
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            <line
              x1={original.x}
              y1={original.y}
              x2={proposed.x}
              y2={proposed.y}
              stroke={COLORS.green}
              strokeWidth="0.4"
              strokeDasharray="1 1"
              opacity="0.7"
            />
          </svg>
        )}
      </div>
      <div
        className="px-2.5 py-2 grid grid-cols-2 gap-2"
        style={{ fontSize: 10, color: "#8B949E", borderTop: `1px solid ${accent}15` }}
      >
        <div>
          <div className="uppercase" style={{ fontSize: 8, letterSpacing: 1, color: COLORS.pink, fontWeight: 700 }}>
            Old (on map)
          </div>
          <div className="mt-0.5 font-mono" style={{ color: "#E6EDF3" }}>
            {original
              ? `${original.x.toFixed(1)}%, ${original.y.toFixed(1)}%`
              : "— (tag has no map pin)"}
          </div>
        </div>
        <div>
          <div className="uppercase" style={{ fontSize: 8, letterSpacing: 1, color: COLORS.green, fontWeight: 700 }}>
            New (reporter)
          </div>
          <div className="mt-0.5 font-mono" style={{ color: "#E6EDF3" }}>
            {proposed.x.toFixed(1)}%, {proposed.y.toFixed(1)}%
          </div>
        </div>
        {dist != null && (
          <div className="col-span-2 mt-0.5">
            Δ {dxDy!.dx >= 0 ? "+" : ""}{dxDy!.dx.toFixed(1)}%, {dxDy!.dy >= 0 ? "+" : ""}{dxDy!.dy.toFixed(1)}% · {dist.toFixed(1)}% map distance
          </div>
        )}
      </div>
    </div>
  )
}

function PrioritySegment({
  current,
  disabled,
  onChange,
}: {
  current: ReportDTO["priority"]
  disabled?: boolean
  onChange: (p: ReportDTO["priority"]) => void
}) {
  const items: Array<{ id: ReportDTO["priority"]; label: string; color: string }> = [
    { id: "high", label: "High", color: COLORS.pink },
    { id: "med", label: "Med", color: COLORS.orange },
    { id: "low", label: "Low", color: COLORS.textMuted },
  ]
  return (
    <div
      className="flex items-stretch overflow-hidden"
      style={{
        borderRadius: 8,
        background: "#0A0E14",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
      role="group"
      aria-label="Priority"
    >
      <div
        className="px-2.5 flex items-center uppercase"
        style={{
          fontSize: 9,
          letterSpacing: 1,
          color: "#484F58",
          background: "rgba(255,255,255,0.02)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          fontWeight: 700,
        }}
      >
        Priority
      </div>
      {items.map((it, idx) => {
        const active = current === it.id
        return (
          <button
            key={it.id}
            type="button"
            disabled={disabled || active}
            onClick={() => onChange(it.id)}
            className="flex-1 uppercase cursor-pointer transition-colors"
            style={{
              padding: "7px 0",
              background: active ? it.color + "22" : "transparent",
              borderLeft: idx === 0 ? "none" : "1px solid rgba(255,255,255,0.05)",
              color: active ? it.color : "#8B949E",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.5,
              fontFamily: "inherit",
              boxShadow: active ? `inset 0 0 14px ${it.color}25` : "none",
              cursor: active || disabled ? "default" : "pointer",
            }}
            aria-pressed={active}
          >
            {active ? "✓ " : ""}
            {it.label}
          </button>
        )
      })}
    </div>
  )
}

