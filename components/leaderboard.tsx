"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useWallet } from "@/lib/wallet-context"
import { Coins, Search, Users, Trophy, Medal, Flame } from "lucide-react"
import { LeaderboardSkeleton } from "@/components/skeletons"
import { useTokenMetadata } from "@/lib/token-metadata-context"

interface LeaderboardEntry {
  address: string
  handle: string | null
  points: number
  rank: number
}

type Category = "mvp" | "tokens" | "found" | "social"

const categoryConfig: Record<Category, { label: string; icon: typeof Coins; unit?: string; color: string }> = {
  mvp: { label: "MVP", icon: Flame, color: "var(--neon-orange, #ff6b35)" },
  tokens: { label: "Tokens", icon: Coins, color: "var(--neon-yellow)" },
  found: { label: "Found", icon: Search, unit: "objects", color: "var(--neon-cyan)" },
  social: { label: "Social", icon: Users, unit: "follows", color: "var(--neon-pink)" },
}

export default function Leaderboard() {
  const { address, displayName } = useWallet()
  const { symbol } = useTokenMetadata()
  const [category, setCategory] = useState<Category>("mvp")
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userRowVisible, setUserRowVisible] = useState(true)
  const userRowRef = useRef<HTMLTableRowElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchLeaderboard = useCallback(async (background: boolean) => {
    try {
      if (!background) setError(null)
      const response = await fetch(`/api/leaderboard?category=${category}`)
      const data = await response.json()

      if (data.error) {
        if (!background) setError(data.error)
      } else {
        setLeaderboard(data.leaderboard || [])
        setError(null)
      }
    } catch (err) {
      console.error("Error fetching leaderboard:", err)
      if (!background) setError("Failed to load leaderboard")
    } finally {
      setLoading(false)
    }
  }, [category])

  const clearPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const startPolling = useCallback(() => {
    clearPolling()
    intervalRef.current = setInterval(() => fetchLeaderboard(true), 10000)
  }, [clearPolling, fetchLeaderboard])

  useEffect(() => {
    setLoading(true)
    fetchLeaderboard(false)
    startPolling()
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchLeaderboard(true)
        startPolling()
      } else {
        clearPolling()
      }
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      clearPolling()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [category, fetchLeaderboard, startPolling, clearPolling])

  useEffect(() => {
    const row = userRowRef.current
    if (!row) {
      setUserRowVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => setUserRowVisible(entry.isIntersecting),
      { threshold: 0.5 }
    )
    observer.observe(row)
    return () => observer.disconnect()
  }, [leaderboard, category])

  const scrollToUserRow = useCallback(() => {
    userRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [])

  const normalizedAddress = useMemo(() => address?.toLowerCase(), [address])
  const userEntry = useMemo(() => leaderboard.find((entry) => entry.address.toLowerCase() === normalizedAddress), [leaderboard, normalizedAddress])
  const config = categoryConfig[category]
  const unit = config.unit || symbol
  const CategoryIcon = config.icon

  const formatPoints = (points: number) => {
    if (category === "tokens" || category === "mvp") {
      return points.toFixed(2)
    }
    return points.toString()
  }

  const getDisplayName = (entry: LeaderboardEntry) => {
    if (entry.handle) return entry.handle
    if (entry.address.toLowerCase() === normalizedAddress && displayName) return displayName
    return `${entry.address.slice(0, 6)}...${entry.address.slice(-4)}`
  }

  const isHandleOrName = (entry: LeaderboardEntry) => {
    return !!entry.handle || (entry.address.toLowerCase() === normalizedAddress && !!displayName)
  }

  const top3 = useMemo(() => leaderboard.slice(0, 3), [leaderboard])

  return (
    <Card className="glass-card p-6 relative">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-[var(--neon-yellow)]/20 flex items-center justify-center">
          <Trophy className="w-5 h-5 text-[var(--neon-yellow)]" />
        </div>
        <h2 className="text-2xl font-bold gradient-text" style={{ fontFamily: "var(--font-display)" }}>
          LEADERBOARD
        </h2>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {(Object.keys(categoryConfig) as Category[]).map((cat) => {
          const catConfig = categoryConfig[cat]
          const Icon = catConfig.icon
          const isActive = category === cat
          return (
            <Button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
                isActive
                  ? "bg-gradient-to-r from-[var(--neon-pink)]/30 to-[var(--neon-cyan)]/30 border border-[var(--neon-pink)]"
                  : "bg-[var(--bg-card)] border border-[var(--bg-elevated)] hover:border-[var(--text-muted)]"
              }`}
              style={isActive ? { color: catConfig.color } : { color: "var(--text-secondary)" }}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{catConfig.label}</span>
            </Button>
          )
        })}
      </div>

      {loading ? (
        <LeaderboardSkeleton />
      ) : error ? (
        <div className="text-red-400 text-center py-8">{error}</div>
      ) : leaderboard.length === 0 ? (
        <div className="text-center py-12">
          <CategoryIcon className="w-12 h-12 mx-auto mb-3 text-[var(--text-muted)]" />
          <p className="text-[var(--text-secondary)]">No entries yet</p>
          <p className="text-[var(--text-muted)] text-sm mt-1">Be the first on the leaderboard!</p>
        </div>
      ) : (
        <>
          {/* Podium for Top 3 */}
          {top3.length > 0 && (
            <div className="flex items-end justify-center gap-3 mb-8 px-4">
              {/* 2nd Place */}
              {top3[1] && (
                <div className="flex flex-col items-center w-24">
                  <div className="w-10 h-10 rounded-full bg-gray-400/20 flex items-center justify-center mb-2 border-2 border-gray-400">
                    <Medal className="w-5 h-5 text-gray-300" />
                  </div>
                  <div
                    className="w-full h-20 rounded-t-lg flex flex-col items-center justify-end pb-2"
                    style={{ background: "linear-gradient(180deg, rgba(192,192,192,0.3) 0%, rgba(192,192,192,0.1) 100%)" }}
                  >
                    <span className="text-white font-bold text-lg">2nd</span>
                  </div>
                  <p className={`text-xs text-[var(--text-muted)] mt-2 truncate w-full text-center ${isHandleOrName(top3[1]) ? '' : 'font-mono'}`}>
                    {getDisplayName(top3[1])}
                  </p>
                  <p className="text-sm font-bold" style={{ color: config.color }}>
                    {formatPoints(top3[1].points)} {unit}
                  </p>
                </div>
              )}

              {/* 1st Place */}
              {top3[0] && (
                <div className="flex flex-col items-center w-28">
                  <div className="w-12 h-12 rounded-full bg-yellow-400/20 flex items-center justify-center mb-2 border-2 border-yellow-400 animate-pulse">
                    <Trophy className="w-6 h-6 text-yellow-400" />
                  </div>
                  <div
                    className="w-full h-28 rounded-t-lg flex flex-col items-center justify-end pb-3"
                    style={{ background: "linear-gradient(180deg, rgba(255,215,0,0.3) 0%, rgba(255,215,0,0.1) 100%)" }}
                  >
                    <span className="text-yellow-400 font-bold text-xl">1st</span>
                  </div>
                  <p className={`text-xs text-[var(--text-muted)] mt-2 truncate w-full text-center ${isHandleOrName(top3[0]) ? '' : 'font-mono'}`}>
                    {getDisplayName(top3[0])}
                  </p>
                  <p className="text-sm font-bold" style={{ color: config.color }}>
                    {formatPoints(top3[0].points)} {unit}
                  </p>
                </div>
              )}

              {/* 3rd Place */}
              {top3[2] && (
                <div className="flex flex-col items-center w-24">
                  <div className="w-10 h-10 rounded-full bg-orange-400/20 flex items-center justify-center mb-2 border-2 border-orange-400">
                    <Medal className="w-5 h-5 text-orange-400" />
                  </div>
                  <div
                    className="w-full h-16 rounded-t-lg flex flex-col items-center justify-end pb-2"
                    style={{ background: "linear-gradient(180deg, rgba(205,127,50,0.3) 0%, rgba(205,127,50,0.1) 100%)" }}
                  >
                    <span className="text-orange-400 font-bold text-lg">3rd</span>
                  </div>
                  <p className={`text-xs text-[var(--text-muted)] mt-2 truncate w-full text-center ${isHandleOrName(top3[2]) ? '' : 'font-mono'}`}>
                    {getDisplayName(top3[2])}
                  </p>
                  <p className="text-sm font-bold" style={{ color: config.color }}>
                    {formatPoints(top3[2].points)} {unit}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* All Players Table */}
          {leaderboard.length > 0 && (
            <div className="rounded-lg border border-[var(--bg-elevated)] overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--bg-elevated)]/50 text-left">
                    <th className="px-2 sm:px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider w-12">#</th>
                    <th className="px-2 sm:px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Player</th>
                    <th className="px-2 sm:px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider text-right w-20 sm:w-24">{unit}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--bg-elevated)]">
                  {leaderboard.map((entry) => {
                    const isCurrentUser = entry.address.toLowerCase() === normalizedAddress
                    return (
                      <tr
                        key={entry.address}
                        ref={isCurrentUser ? userRowRef : undefined}
                        className={`transition-colors ${
                          isCurrentUser
                            ? "bg-[var(--neon-yellow)]/5"
                            : "hover:bg-[var(--bg-card)]/50"
                        }`}
                      >
                        <td className="px-2 sm:px-4 py-3">
                          <span className={`text-sm font-bold ${
                            entry.rank === 1 ? "text-yellow-400" :
                            entry.rank === 2 ? "text-gray-300" :
                            entry.rank === 3 ? "text-orange-400" :
                            isCurrentUser ? "text-[var(--neon-yellow)]" : "text-[var(--text-muted)]"
                          }`}>
                            {entry.rank}
                          </span>
                        </td>
                        <td className="px-2 sm:px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm max-w-[120px] sm:max-w-none truncate ${isHandleOrName(entry) ? '' : 'font-mono'} ${isCurrentUser ? "text-white font-bold" : "text-[var(--text-secondary)]"}`}>
                              {getDisplayName(entry)}
                            </span>
                            {isCurrentUser && <span className="text-xs text-[var(--neon-yellow)] font-medium">(You)</span>}
                          </div>
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-right">
                          <span className="text-sm font-bold" style={{ color: config.color }}>
                            {formatPoints(entry.points)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* User Stats Footer */}
          {userEntry && (
            <div className="mt-6 pt-4 border-t border-[var(--bg-elevated)]">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">Your Rank</span>
                <div className="flex items-center gap-3">
                  <span className="text-[var(--neon-yellow)] font-bold">#{userEntry.rank}</span>
                  <span className="text-white font-mono">
                    {formatPoints(userEntry.points)} {unit}
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {/* Floating "My Rank" pill */}
      {userEntry && !userRowVisible && !loading && (
        <button
          onClick={scrollToUserRow}
          className="sticky bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--neon-yellow)] text-black font-bold text-sm shadow-lg shadow-[var(--neon-yellow)]/30 hover:scale-105 transition-transform w-fit mx-auto"
        >
          You: #{userEntry.rank} — {formatPoints(userEntry.points)} {unit}
        </button>
      )}
    </Card>
  )
}
