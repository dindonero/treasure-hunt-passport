"use client"

import { useEffect, useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useWallet } from "@/lib/wallet-context"
import AppHeader from "@/components/app-header"
import VenueMap from "@/components/venue-map"
import { ArrowLeft, MapPin, HelpCircle, Coins, CheckCircle2, X, Map as MapIcon, List, Eye, EyeOff, ChevronDown, AlertTriangle, Pencil } from "lucide-react"
import Link from "next/link"
import { DashboardSkeleton } from "@/components/skeletons"
import { useTokenMetadata } from "@/lib/token-metadata-context"
import ReportSheet from "@/components/report-sheet"

interface DashboardTag {
  id: number
  name: string | null
  hint: string | null
  token_reward: string
  status: string | null
  location_x: number | null
  location_y: number | null
  find_count: number
  is_own: boolean
  found_by_user: boolean
}

export default function DashboardPage() {
  const { isAuthenticated, address } = useWallet()
  // JWT presence is the right signal for "show personal data" — the API
  // already gates per-user fields (found_by_user / is_own) on the JWT
  // cookie, so we don't need to also check thirdweb wallet readiness.
  const showPersonalState = isAuthenticated
  const [tags, setTags] = useState<DashboardTag[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTag, setSelectedTag] = useState<DashboardTag | null>(null)
  const [view, setView] = useState<"map" | "list">("map")
  const [reporting, setReporting] = useState(false)
  const [userRank, setUserRank] = useState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchDashboard(controller.signal)
    return () => controller.abort()
  }, [isAuthenticated])

  // Fetch user's MVP-leaderboard rank for the bottom Rank stat. Cheap enough
  // to load on dashboard mount; refreshes whenever the wallet changes.
  useEffect(() => {
    if (!address) {
      setUserRank(null)
      return
    }
    let cancelled = false
    fetch("/api/leaderboard?category=mvp", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data?.success) return
        const lc = address.toLowerCase()
        const me = (data.leaderboard || []).find(
          (e: { address: string; rank: number }) => e.address.toLowerCase() === lc,
        )
        setUserRank(me ? me.rank : null)
      })
      .catch(() => {
        /* non-critical */
      })
    return () => {
      cancelled = true
    }
  }, [address])

  const fetchDashboard = async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/nfc-tags/dashboard", {
        credentials: "include",
        signal,
      })
      const data = await res.json()
      if (data.success) {
        setTags(data.tags)
      }
    } catch (error: any) {
      if (error?.name === "AbortError") return
      console.error("Error fetching dashboard:", error)
    } finally {
      setLoading(false)
    }
  }

  const mapPins = useMemo(() => tags
    .filter((t) => t.location_x != null && t.location_y != null)
    .map((t) => ({
      id: t.id,
      x: t.location_x!,
      y: t.location_y!,
      name: t.name || undefined,
      found_by_user: showPersonalState ? t.found_by_user : false,
      is_own: showPersonalState ? t.is_own : false,
    })), [tags, showPersonalState])

  // Own tags are excluded from both numerator and denominator so the ratio
  // is consistent — otherwise an owner who also claimed their own tag on
  // chain would show e.g. "2/4" (own counted as found, but not in total).
  const foundCount = useMemo(() => tags.filter((t) => t.found_by_user && !t.is_own).length, [tags])
  const totalCount = useMemo(() => tags.filter((t) => !t.is_own).length, [tags])

  // Sort tags: unfound first, then found, own tags last
  const sortedTags = useMemo(() => [...tags].sort((a, b) => {
    if (a.is_own !== b.is_own) return a.is_own ? 1 : -1
    if (a.found_by_user !== b.found_by_user) return a.found_by_user ? 1 : -1
    return (a.name || "").localeCompare(b.name || "")
  }), [tags])

  return (
    <main className="min-h-screen hero-gradient flex flex-col relative overflow-hidden">
      <div className="blob-pink top-10 -left-40 opacity-30" />
      <div className="blob-cyan bottom-20 -right-40 opacity-30" />

      <AppHeader />

      <div className="flex-1 max-w-2xl mx-auto px-4 py-6 w-full relative z-10">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/" className="hidden md:inline-flex">
            <Button variant="outline" size="sm" className="border-[var(--neon-cyan)]/30 text-[var(--neon-cyan)]">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-3xl font-bold gradient-text" style={{ fontFamily: "var(--font-display)" }}>
            TREASURE MAP
          </h1>
        </div>

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* Map header strip — title left, found Pill + view toggle right */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="min-w-0">
                <p className="uppercase tracking-wider truncate" style={{ fontSize: 10, color: "#484F58", letterSpacing: 1 }}>
                  Cadaval
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {showPersonalState ? (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full uppercase font-semibold"
                    style={{
                      fontSize: 11,
                      color: "#56D364",
                      background: "rgba(86,211,100,0.15)",
                      border: "1px solid rgba(86,211,100,0.4)",
                      letterSpacing: 0.4,
                    }}
                  >
                    {foundCount} / {totalCount} found
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full uppercase font-semibold"
                    style={{
                      fontSize: 11,
                      color: "#F0605D",
                      background: "rgba(240,96,93,0.15)",
                      border: "1px solid rgba(240,96,93,0.4)",
                      letterSpacing: 0.4,
                    }}
                  >
                    {tags.length} hidden
                  </span>
                )}
                <div className="flex gap-1 bg-[var(--bg-secondary)] rounded-lg p-0.5">
                  <button
                    onClick={() => setView("map")}
                    className={`flex items-center justify-center w-8 h-8 rounded-md transition-all ${
                      view === "map"
                        ? "bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/40 shadow-[0_0_8px_var(--neon-cyan)/30]"
                        : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    }`}
                    aria-label="Map view"
                  >
                    <MapIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setView("list")}
                    className={`flex items-center justify-center w-8 h-8 rounded-md transition-all ${
                      view === "list"
                        ? "bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/40 shadow-[0_0_8px_var(--neon-cyan)/30]"
                        : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    }`}
                    aria-label="List view"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            {showPersonalState && totalCount > 0 && (
              <div className="mb-3 h-1 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${(foundCount / totalCount) * 100}%`,
                    background: "linear-gradient(90deg, var(--neon-yellow), var(--neon-cyan))",
                    boxShadow: "0 0 8px var(--neon-yellow)",
                  }}
                />
              </div>
            )}

            {view === "map" ? (
              <>
                {/* Map View */}
                <VenueMap
                  pins={mapPins}
                  onPinClick={(pin) => {
                    const tag = tags.find((t) => t.id === pin.id)
                    setSelectedTag(tag || null)
                  }}
                  selectedPinId={selectedTag?.id}
                  showPinsToggle
                  allowExpand
                />

                {/* Compact Tag Selection Card / Empty hint */}
                <div className="mt-3">
                  {selectedTag ? (
                    <CompactTagCard
                      tag={selectedTag}
                      onClose={() => setSelectedTag(null)}
                      onReport={() => setReporting(true)}
                    />
                  ) : tags.length > 0 ? (
                    <div className="text-center px-3 py-2.5 rounded-[10px]"
                      style={{
                        background: "var(--bg-card, #131921)",
                        border: "1px solid rgba(72,79,88,0.4)",
                        fontSize: 11,
                        color: "var(--text-muted, #484F58)",
                      }}
                    >
                      Tap a pin to see details · Pinch to zoom
                    </div>
                  ) : null}
                </div>

                {/* Venue legend (Cadaval Festival da Juventude) */}
                {tags.length > 0 && (
                  <div
                    className="mt-3 rounded-[12px] overflow-hidden"
                    style={{
                      background: "#FCE9D4",
                      border: "1px solid rgba(72,79,88,0.4)",
                    }}
                  >
                    <img
                      src="/fil_map_legend.png"
                      alt="Festival da Juventude — venue legend"
                      className="block w-full h-auto select-none"
                      draggable={false}
                    />
                  </div>
                )}

                {selectedTag && reporting && (
                  <ReportSheet
                    tag={{
                      id: selectedTag.id,
                      name: selectedTag.name || "Hidden Tag",
                      x: selectedTag.location_x,
                      y: selectedTag.location_y,
                    }}
                    onClose={() => setReporting(false)}
                  />
                )}


                {/* Bottom stats tiles — Found / Hidden / Rank */}
                {tags.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <StatTile
                      value={showPersonalState ? foundCount : 0}
                      label="Found"
                      color="#56D364"
                    />
                    <StatTile
                      value={showPersonalState ? totalCount - foundCount : tags.length}
                      label="Hidden"
                      color="#F0605D"
                    />
                    <StatTile
                      value={
                        showPersonalState && userRank != null ? `#${userRank}` : "—"
                      }
                      label="Rank"
                      color="#58A6FF"
                    />
                  </div>
                )}

                {tags.length === 0 && (
                  <Card className="glass-card p-6 mt-4 text-center">
                    <p className="text-[var(--text-secondary)] mb-1">No hidden tags yet</p>
                    <p className="text-[var(--text-muted)] text-sm">
                      Tags will appear here once owners hide them around the venue.
                    </p>
                  </Card>
                )}
              </>
            ) : tags.length === 0 ? (
              <Card className="glass-card p-8 text-center">
                <MapPin className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)]" />
                <p className="text-[var(--text-secondary)] mb-2">No hidden tags yet</p>
                <p className="text-[var(--text-muted)] text-sm">
                  Tags will appear here once owners hide them around the venue.
                </p>
              </Card>
            ) : (
              /* List View */
              <div className="space-y-3 stagger-children">
                {sortedTags.map((tag, index) => (
                  <Card
                    key={tag.id}
                    style={{
                      animationDelay: `${Math.min(index, 10) * 0.05}s`,
                      borderLeftColor: tag.found_by_user
                        ? "var(--neon-yellow)"
                        : tag.is_own
                        ? "var(--neon-purple)"
                        : "var(--neon-pink)",
                      borderLeftWidth: "3px",
                    }}
                    className={`glass-card p-4 border border-white/5 transition-all cursor-pointer ${
                      tag.is_own ? "opacity-60" : ""
                    }`}
                    onClick={() => setSelectedTag(selectedTag?.id === tag.id ? null : tag)}
                  >
                    <TagDetailCard tag={tag} compact={selectedTag?.id !== tag.id} />
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>

    </main>
  )
}

function StatTile({
  value,
  label,
  color,
}: {
  value: number | string
  label: string
  color: string
}) {
  return (
    <div
      className="text-center"
      style={{
        padding: "10px 8px",
        borderRadius: 10,
        background: "#131921",
        border: `1px solid ${color}30`,
      }}
    >
      <div
        className="leading-none tracking-wider"
        style={{
          fontFamily: "var(--font-display, 'Bebas Neue'), Impact, sans-serif",
          fontSize: 22,
          color,
          textShadow: `0 0 10px ${color}66, 0 0 20px ${color}33`,
        }}
      >
        {value}
      </div>
      <div
        className="uppercase mt-1"
        style={{ fontSize: 9, color: "#484F58", letterSpacing: 1 }}
      >
        {label}
      </div>
    </div>
  )
}

function CompactTagCard({
  tag,
  onClose,
  onReport,
}: {
  tag: DashboardTag
  onClose: () => void
  onReport: () => void
}) {
  const { symbol } = useTokenMetadata()
  const [hintRevealed, setHintRevealed] = useState(false)
  useEffect(() => {
    setHintRevealed(false)
  }, [tag.id])
  const statusColor = tag.is_own
    ? "#58A6FF"
    : tag.found_by_user
    ? "#56D364"
    : "#F0605D"
  const blurHint = !hintRevealed && !tag.found_by_user && !tag.is_own

  return (
    <div
      className="relative animate-fade-slide-up"
      style={{
        background: "linear-gradient(135deg, rgba(28,36,49,0.6), rgba(19,25,33,0.8))",
        border: "1px solid rgba(240,246,252,0.06)",
        borderRadius: 16,
        boxShadow: `0 0 24px ${statusColor}30`,
        padding: 12,
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-[10px] flex-shrink-0 flex items-center justify-center"
          style={{ background: statusColor + "20", border: `1px solid ${statusColor}60` }}
        >
          <MapPin className="w-[18px] h-[18px]" style={{ color: statusColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate" style={{ fontSize: 13, color: "#E6EDF3" }}>
            {tag.name || "Hidden Tag"}
          </div>
          <div className="mt-0.5" style={{ fontSize: 10, color: "#484F58" }}>
            <span style={{ color: "#56D364", fontWeight: 700 }}>+{tag.token_reward} {symbol}</span>
            <span className="mx-1.5" style={{ color: "#484F58" }}>·</span>
            <span><b style={{ color: "#58A6FF" }}>{tag.find_count}</b> finders</span>
          </div>
        </div>
        {(
          <button
            onClick={onReport}
            type="button"
            title="Report"
            className="cursor-pointer flex items-center gap-1 leading-none uppercase"
            style={{
              padding: "5px 7px",
              borderRadius: 7,
              background: "transparent",
              border: `1px solid #F0605D60`,
              color: "#F0605D",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 0.5,
              fontFamily: "inherit",
            }}
          >
            <AlertTriangle className="w-[11px] h-[11px]" />
            Report
          </button>
        )}
        <button
          onClick={onClose}
          type="button"
          aria-label="Close"
          className="ml-1 text-[var(--text-muted)] hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {tag.hint && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setHintRevealed((v) => !v)
          }}
          className="mt-2.5 w-full text-left rounded-lg cursor-pointer transition-colors"
          style={{
            background: "rgba(88,166,255,0.05)",
            border: "1px solid rgba(88,166,255,0.18)",
            padding: "8px 10px",
          }}
          aria-pressed={hintRevealed}
          aria-label={blurHint ? "Reveal hint" : "Hide hint"}
        >
          <div className="flex items-center justify-between mb-1">
            <span
              className="flex items-center gap-1.5 uppercase"
              style={{ color: "#58A6FF", fontSize: 9, fontWeight: 700, letterSpacing: 1 }}
            >
              <HelpCircle className="w-3 h-3" />
              Hint
            </span>
            <span style={{ color: "#58A6FF" }}>
              {blurHint ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </span>
          </div>
          <p
            className="select-none transition-all duration-200"
            style={{
              fontSize: 12,
              color: "#E6EDF3",
              lineHeight: 1.45,
              filter: blurHint ? "blur(6px)" : "blur(0)",
              opacity: blurHint ? 0.75 : 1,
            }}
          >
            {tag.hint}
          </p>
        </button>
      )}
    </div>
  )
}

function TagDetailCard({ tag, compact = false }: { tag: DashboardTag; compact?: boolean }) {
  const { symbol } = useTokenMetadata()
  const [hintRevealed, setHintRevealed] = useState(false)

  const statusColor = tag.found_by_user
    ? "var(--neon-yellow)"
    : tag.is_own
    ? "var(--neon-purple)"
    : "var(--neon-pink)"

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center gap-3">
        {/* Status icon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border"
          style={{
            backgroundColor: tag.found_by_user
              ? "rgba(255, 215, 0, 0.15)"
              : tag.is_own
              ? "rgba(160, 100, 255, 0.15)"
              : "rgba(255, 50, 150, 0.15)",
            borderColor: tag.found_by_user
              ? "rgba(255, 215, 0, 0.3)"
              : tag.is_own
              ? "rgba(160, 100, 255, 0.3)"
              : "rgba(255, 50, 150, 0.3)",
          }}
        >
          {tag.found_by_user ? (
            <CheckCircle2 className="w-5 h-5 text-[var(--neon-yellow)]" />
          ) : (
            <MapPin
              className="w-5 h-5"
              style={{ color: tag.is_own ? "var(--neon-purple)" : "var(--neon-pink)" }}
            />
          )}
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white text-sm truncate">{tag.name || "Hidden Tag"}</h3>
        </div>

        {/* Right side: reward + status badge */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className="flex items-center gap-1 bg-[var(--neon-yellow)]/15 px-2 py-0.5 rounded-full border border-[var(--neon-yellow)]/20">
            <Coins className="w-3 h-3 text-[var(--neon-yellow)]" />
            <span className="text-[var(--neon-yellow)] font-bold text-xs">{tag.token_reward} {symbol}</span>
          </div>
          {(tag.found_by_user || tag.is_own) && (
            <span
              className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{
                color: statusColor,
                backgroundColor: tag.found_by_user ? "rgba(255, 215, 0, 0.1)" : "rgba(160, 100, 255, 0.1)",
              }}
            >
              {tag.found_by_user ? "Found" : "Yours"}
            </span>
          )}
        </div>

        {/* Expand indicator for compact list items */}
        {compact && tag.hint && (
          <ChevronDown className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
        )}
      </div>

      {/* Expanded content: hint */}
      {!compact && (
        <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
          {tag.hint && (
            <div
              className="bg-[var(--neon-cyan)]/5 rounded-lg p-3 border border-[var(--neon-cyan)]/15 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setHintRevealed(!hintRevealed) }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-[var(--neon-cyan)] font-semibold flex items-center gap-1.5 uppercase tracking-wider">
                  <HelpCircle className="w-3.5 h-3.5" />
                  Hint
                </p>
                <span className="text-[var(--neon-cyan)] p-1 rounded-md hover:bg-[var(--neon-cyan)]/10 transition-colors">
                  {hintRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </span>
              </div>
              <p
                className="text-[var(--text-secondary)] text-sm leading-relaxed transition-all duration-300 select-none"
                style={{
                  filter: hintRevealed ? "blur(0px)" : "blur(6px)",
                  opacity: hintRevealed ? 1 : 0.7,
                }}
              >
                {tag.hint}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
