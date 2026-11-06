"use client"

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import Image from "next/image"
import { MapPin } from "lucide-react"

interface HeatmapTag {
  id: number
  name: string | null
  x: number
  y: number
  find_count: number
}

type Mode = "heat" | "dots" | "dead"

const COLD_THRESHOLD = 10

const PALETTE = {
  bgPrimary: "#06080F",
  bgSecondary: "#0A0E14",
  bgCard: "#131921",
  bgElevated: "#1C2431",
  pink: "#F0605D",
  cyan: "#58A6FF",
  orange: "#FF9A76",
  green: "#56D364",
  textPrimary: "#E6EDF3",
  textSecondary: "#8B949E",
  textMuted: "#484F58",
}

function heatColor(t: number, alpha = 1): string {
  if (t < 0.001) return `rgba(80, 90, 110, ${alpha})`
  if (t < 0.2) return `rgba(88, 166, 255, ${alpha})`
  if (t < 0.45) return `rgba(86, 211, 100, ${alpha})`
  if (t < 0.75) return `rgba(255, 154, 118, ${alpha})`
  return `rgba(240, 96, 93, ${alpha})`
}

function tagLabel(t: HeatmapTag): string {
  return t.name?.trim() || `Tag #${t.id}`
}

export default function TagHeatmap() {
  const [tags, setTags] = useState<HeatmapTag[]>([])
  const [hunters, setHunters] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>("heat")
  const [selected, setSelected] = useState<HeatmapTag | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async (background: boolean) => {
    try {
      if (!background) setError(null)
      const res = await fetch("/api/tag-heatmap")
      const data = await res.json()
      if (!data.success) {
        if (!background) setError("Failed to load heatmap data")
      } else {
        setTags(data.tags || [])
        setHunters(data.hunters || 0)
        setError(null)
      }
    } catch (err) {
      console.error("Error fetching heatmap:", err)
      if (!background) setError("Failed to load heatmap data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(false)
    const start = () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(() => fetchData(true), 30000)
    }
    const stop = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    start()
    const onVis = () => {
      if (document.visibilityState === "visible") {
        fetchData(true)
        start()
      } else {
        stop()
      }
    }
    document.addEventListener("visibilitychange", onVis)
    return () => {
      stop()
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [fetchData])

  const { totalScans, maxFinds, avgFinds, coldTags, hotTags } = useMemo(() => {
    const totalScans = tags.reduce((a, t) => a + t.find_count, 0)
    const maxFinds = tags.length ? Math.max(...tags.map((t) => t.find_count)) : 0
    const avgFinds = tags.length ? Math.round(totalScans / tags.length) : 0
    const coldTags = tags.filter((t) => t.find_count <= COLD_THRESHOLD)
    const hotTags = [...tags].sort((a, b) => b.find_count - a.find_count).slice(0, 3)
    return { totalScans, maxFinds, avgFinds, coldTags, hotTags }
  }, [tags])

  const intensity = useCallback(
    (f: number) => (maxFinds > 0 ? Math.sqrt(f / maxFinds) : 0),
    [maxFinds]
  )

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 rounded bg-[var(--bg-card)] animate-pulse" />
        <div className="aspect-[1.55/1] w-full rounded-xl bg-[var(--bg-card)] animate-pulse" />
        <div className="h-20 rounded bg-[var(--bg-card)] animate-pulse" />
      </div>
    )
  }

  if (error) {
    return <div className="text-red-400 text-center py-8">{error}</div>
  }

  if (tags.length === 0) {
    return (
      <div className="text-center py-12">
        <MapPin className="w-12 h-12 mx-auto mb-3 text-[var(--text-muted)]" />
        <p className="text-[var(--text-secondary)]">No placed tags yet</p>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Owners need to place their tags on the map
        </p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Title strip */}
      <div className="flex items-start justify-between px-1 pb-2">
        <div>
          <h3
            className="text-2xl"
            style={{
              fontFamily: "var(--font-display)",
              letterSpacing: "0.05em",
              color: PALETTE.textPrimary,
              textShadow: `0 0 10px ${PALETTE.pink}55`,
              lineHeight: 1,
            }}
          >
            HEAT MAP
          </h3>
          <div
            className="text-[10px] mt-1 uppercase tracking-widest"
            style={{ color: PALETTE.textMuted }}
          >
            {totalScans.toLocaleString()} scans · {hunters.toLocaleString()} hunters
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
          style={{
            color: PALETTE.pink,
            background: `${PALETTE.pink}15`,
            border: `1px solid ${PALETTE.pink}40`,
          }}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full animate-pink-pulse"
            style={{ background: PALETTE.pink }}
          />
          Live
        </span>
      </div>

      {/* Mode segmented control */}
      <div className="px-1 pb-3">
        <div
          className="flex rounded-full p-[3px]"
          style={{
            background: PALETTE.bgCard,
            border: `1px solid ${PALETTE.cyan}25`,
          }}
        >
          {(
            [
              { id: "heat", label: "Heat" },
              { id: "dots", label: "Per-tag" },
              { id: "dead", label: "Dead zones" },
            ] as { id: Mode; label: string }[]
          ).map((m) => {
            const active = mode === m.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setMode(m.id)
                  setSelected(null)
                }}
                className="flex-1 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors"
                style={{
                  background: active ? `${PALETTE.cyan}25` : "transparent",
                  color: active ? PALETTE.cyan : PALETTE.textMuted,
                }}
              >
                {m.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Map canvas */}
      <div
        className="relative mx-1 overflow-hidden rounded-2xl"
        style={{
          aspectRatio: "2400 / 1119",
          background: `linear-gradient(135deg, ${PALETTE.bgCard}, ${PALETTE.bgSecondary})`,
          border: `1px solid ${PALETTE.cyan}25`,
        }}
        onClick={() => setSelected(null)}
      >
        {/* Grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(88,166,255,0.06) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(88,166,255,0.06) 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />

        {/* Floor plan */}
        <div className="absolute inset-0 pointer-events-none">
          <Image
            src="/jwcc-L3.jpeg"
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 700px"
            style={{
              objectFit: "contain",
              filter: `brightness(1.4) saturate(0.4) drop-shadow(0 0 8px ${PALETTE.cyan}30)`,
              opacity: mode === "heat" ? 0.32 : 0.5,
            }}
            priority={false}
          />
        </div>

        {/* Heat mode — soft radial blobs */}
        {mode === "heat" &&
          tags.map((t) => {
            const i = intensity(t.find_count)
            const r = 30 + i * 70
            return (
              <div
                key={t.id}
                className="absolute pointer-events-none rounded-full"
                style={{
                  left: `${t.x}%`,
                  top: `${t.y}%`,
                  width: r * 2,
                  height: r * 2,
                  transform: "translate(-50%, -50%)",
                  background: `radial-gradient(circle, ${heatColor(i, 0.85)} 0%, ${heatColor(i, 0.4)} 35%, transparent 70%)`,
                  mixBlendMode: "screen",
                  filter: "blur(6px)",
                }}
              />
            )
          })}

        {/* Per-tag dots */}
        {mode === "dots" &&
          tags.map((t) => {
            const i = intensity(t.find_count)
            const size = 8 + i * 22
            const c = heatColor(i, 1)
            return (
              <button
                key={t.id}
                type="button"
                aria-label={`${tagLabel(t)} — ${t.find_count} finds`}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelected(selected?.id === t.id ? null : t)
                }}
                className="absolute p-0 border-0 bg-transparent cursor-pointer"
                style={{
                  left: `${t.x}%`,
                  top: `${t.y}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <span
                  className="block rounded-full"
                  style={{
                    width: size,
                    height: size,
                    background: c,
                    border: "1.5px solid rgba(255,255,255,0.6)",
                    boxShadow: `0 0 ${4 + i * 14}px ${c}`,
                  }}
                />
              </button>
            )
          })}

        {/* Dead zones — only cold/never tags */}
        {mode === "dead" &&
          tags
            .filter((t) => t.find_count <= COLD_THRESHOLD)
            .map((t) => {
              const pulse = t.find_count === 0
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-label={`${tagLabel(t)} — ${t.find_count} finds`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelected(selected?.id === t.id ? null : t)
                  }}
                  className="absolute p-0 border-0 bg-transparent cursor-pointer"
                  style={{
                    left: `${t.x}%`,
                    top: `${t.y}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <span className="relative flex items-center justify-center">
                    {pulse && (
                      <span
                        className="absolute rounded-full animate-th-ping"
                        style={{
                          width: 30,
                          height: 30,
                          background: PALETTE.pink,
                          opacity: 0.35,
                        }}
                      />
                    )}
                    <span
                      className="rounded-full"
                      style={{
                        width: 14,
                        height: 14,
                        background: PALETTE.pink,
                        border: "2px dashed rgba(255,255,255,0.6)",
                        boxShadow: `0 0 10px ${PALETTE.pink}`,
                      }}
                    />
                    <span
                      className="absolute font-mono whitespace-nowrap font-bold"
                      style={{
                        top: 16,
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: 8,
                        color: PALETTE.pink,
                      }}
                    >
                      {t.find_count}
                    </span>
                  </span>
                </button>
              )
            })}

        {/* Callout */}
        {selected && (mode === "dots" || mode === "dead") && (
          <div
            className="absolute pointer-events-none rounded-lg z-10"
            style={{
              left: `${selected.x}%`,
              top: `${selected.y}%`,
              transform: "translate(-50%, calc(-100% - 22px))",
              background: "rgba(0,0,0,0.92)",
              border: `1px solid ${heatColor(intensity(selected.find_count), 1)}`,
              padding: "6px 8px",
              minWidth: 110,
              boxShadow: "0 6px 18px rgba(0,0,0,0.5)",
            }}
          >
            <div
              className="text-[10px] uppercase tracking-widest truncate max-w-[160px]"
              style={{ color: PALETTE.textMuted }}
            >
              {tagLabel(selected)}
            </div>
            <div
              className="font-mono font-bold"
              style={{ fontSize: 16, color: PALETTE.textPrimary }}
            >
              {selected.find_count}{" "}
              <span
                className="font-normal"
                style={{ fontSize: 9, color: PALETTE.textMuted }}
              >
                finds
              </span>
            </div>
            <div
              className="tracking-wide"
              style={{
                fontSize: 9,
                color: heatColor(intensity(selected.find_count), 1),
              }}
            >
              {selected.find_count === 0
                ? "NEVER FOUND"
                : selected.find_count <= COLD_THRESHOLD
                  ? "COLD"
                  : selected.find_count < avgFinds
                    ? "BELOW AVG"
                    : selected.find_count < maxFinds * 0.75
                      ? "ABOVE AVG"
                      : "HOTSPOT"}
            </div>
          </div>
        )}

        {/* Legend */}
        <div
          className="absolute rounded-lg"
          style={{
            bottom: 8,
            left: 8,
            padding: "6px 8px",
            background: "rgba(0,0,0,0.78)",
            color: PALETTE.textSecondary,
          }}
        >
          <div
            className="uppercase tracking-widest mb-1"
            style={{ fontSize: 8, color: PALETTE.textMuted }}
          >
            Finds
          </div>
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 8 }}>0</span>
            <span
              className="block rounded"
              style={{
                width: 90,
                height: 6,
                background:
                  "linear-gradient(90deg, rgba(80,90,110,1), rgba(88,166,255,1) 20%, rgba(86,211,100,1) 45%, rgba(255,154,118,1) 75%, rgba(240,96,93,1) 100%)",
              }}
            />
            <span style={{ fontSize: 8 }}>{maxFinds}</span>
          </div>
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-4 gap-1.5 mt-3 px-1">
        {(
          [
            [tags.length, "Tags", PALETTE.cyan],
            [maxFinds, "Top", PALETTE.pink],
            [avgFinds, "Avg", PALETTE.green],
            [coldTags.length, "Cold", PALETTE.orange],
          ] as [number, string, string][]
        ).map(([v, l, c]) => (
          <div
            key={l}
            className="text-center rounded-xl"
            style={{
              padding: "8px 4px",
              background: PALETTE.bgCard,
              border: `1px solid ${c}30`,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 20,
                lineHeight: 1,
                color: c,
                textShadow: `0 0 10px ${c}80`,
                letterSpacing: "0.05em",
              }}
            >
              {v}
            </div>
            <div
              className="uppercase tracking-widest"
              style={{ fontSize: 8, marginTop: 2, color: PALETTE.textMuted }}
            >
              {l}
            </div>
          </div>
        ))}
      </div>

      {/* Hotspots */}
      <div className="mt-4 px-1">
        <div className="flex items-center justify-between mb-2">
          <h4
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 14,
              letterSpacing: "0.05em",
              color: PALETTE.textPrimary,
            }}
          >
            HOTSPOTS
          </h4>
          <span
            className="uppercase tracking-widest"
            style={{ fontSize: 9, color: PALETTE.textMuted }}
          >
            Most found
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          {hotTags.map((t, idx) => {
            const pct =
              maxFinds > 0 ? Math.round((t.find_count / maxFinds) * 100) : 0
            const i = intensity(t.find_count)
            const c = heatColor(i, 1)
            return (
              <div
                key={t.id}
                className="flex items-center gap-2.5 rounded-xl"
                style={{
                  padding: "8px 10px",
                  background: PALETTE.bgCard,
                  border: `1px solid ${heatColor(i, 0.3)}`,
                }}
              >
                <div
                  className="text-center"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 18,
                    color: c,
                    width: 18,
                    letterSpacing: "0.05em",
                    textShadow: `0 0 8px ${heatColor(i, 0.4)}`,
                  }}
                >
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="truncate font-semibold"
                    style={{ fontSize: 12, color: PALETTE.textPrimary }}
                  >
                    {tagLabel(t)}
                  </div>
                  <div
                    className="mt-1 overflow-hidden"
                    style={{
                      height: 4,
                      borderRadius: 2,
                      background: "rgba(255,255,255,0.06)",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${c}, ${heatColor(i, 0.66)})`,
                        boxShadow: `0 0 8px ${heatColor(i, 0.5)}`,
                      }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className="font-mono font-bold"
                    style={{ fontSize: 13, color: c }}
                  >
                    {t.find_count}
                  </div>
                  <div
                    className="uppercase tracking-widest"
                    style={{ fontSize: 9, color: PALETTE.textMuted }}
                  >
                    finds
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Needs attention */}
      {coldTags.length > 0 && (
        <div className="mt-4 px-1">
          <div className="flex items-center justify-between mb-2">
            <h4
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 14,
                letterSpacing: "0.05em",
                color: PALETTE.textPrimary,
              }}
            >
              NEEDS ATTENTION
            </h4>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
              style={{
                color: PALETTE.pink,
                background: `${PALETTE.pink}15`,
                border: `1px solid ${PALETTE.pink}40`,
              }}
            >
              {coldTags.length} cold
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {[...coldTags]
              .sort((a, b) => a.find_count - b.find_count)
              .map((t) => {
                const dead = t.find_count === 0
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-2.5 rounded-xl"
                    style={{
                      padding: "8px 10px",
                      background: PALETTE.bgCard,
                      border: `1px ${dead ? "dashed" : "solid"} ${(dead ? PALETTE.pink : PALETTE.orange)}${dead ? "80" : "40"}`,
                    }}
                  >
                    <div
                      className="flex items-center justify-center flex-shrink-0 rounded-lg"
                      style={{
                        width: 28,
                        height: 28,
                        background: `${dead ? PALETTE.pink : PALETTE.orange}20`,
                        border: `1px solid ${dead ? PALETTE.pink : PALETTE.orange}60`,
                      }}
                    >
                      <MapPin
                        size={14}
                        style={{ color: dead ? PALETTE.pink : PALETTE.orange }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className="truncate font-semibold"
                        style={{ fontSize: 12, color: PALETTE.textPrimary }}
                      >
                        {tagLabel(t)}
                      </div>
                      <div
                        style={{
                          fontSize: 9,
                          color: PALETTE.textMuted,
                          letterSpacing: 0.5,
                          marginTop: 1,
                        }}
                      >
                        {dead
                          ? "No one has scanned this tag yet — check signage"
                          : "Low traffic — consider relocating or boosting reward"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className="font-mono font-bold"
                        style={{
                          fontSize: 13,
                          color: dead ? PALETTE.pink : PALETTE.orange,
                        }}
                      >
                        {t.find_count}
                      </div>
                      <div
                        className="uppercase tracking-widest"
                        style={{ fontSize: 8, color: PALETTE.textMuted }}
                      >
                        {dead ? "never" : "finds"}
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
