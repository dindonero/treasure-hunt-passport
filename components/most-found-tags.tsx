"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Search, Coins, Trophy, Medal } from "lucide-react"
import { MostFoundSkeleton } from "@/components/skeletons"

interface TagEntry {
  rank: number
  tag_id: number
  name: string
  token_reward: string | null
  owner_address: string | null
  owner_handle: string | null
  find_count: number
}

export default function MostFoundTags() {
  const [tags, setTags] = useState<TagEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchTags = useCallback(async (background: boolean) => {
    try {
      if (!background) setError(null)
      const response = await fetch("/api/most-found-tags")
      const data = await response.json()

      if (!data.success) {
        if (!background) setError("Failed to load data")
      } else {
        setTags(data.tags || [])
        setError(null)
      }
    } catch (err) {
      console.error("Error fetching most found tags:", err)
      if (!background) setError("Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [])

  const clearPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const startPolling = useCallback(() => {
    clearPolling()
    intervalRef.current = setInterval(() => fetchTags(true), 30000)
  }, [clearPolling, fetchTags])

  useEffect(() => {
    fetchTags(false)
    startPolling()
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchTags(true)
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
  }, [fetchTags, startPolling, clearPolling])

  const getOwnerDisplay = (tag: TagEntry) => {
    if (tag.owner_handle) return tag.owner_handle
    if (!tag.owner_address) return "Unknown"
    return `${tag.owner_address.slice(0, 6)}...${tag.owner_address.slice(-4)}`
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-400" />
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" />
    if (rank === 3) return <Medal className="w-5 h-5 text-orange-400" />
    return <span className="text-sm font-bold text-[var(--text-muted)]">#{rank}</span>
  }

  if (loading) return <MostFoundSkeleton />

  if (error) {
    return <div className="text-red-400 text-center py-8">{error}</div>
  }

  if (tags.length === 0) {
    return (
      <div className="text-center py-12">
        <Search className="w-12 h-12 mx-auto mb-3 text-[var(--text-muted)]" />
        <p className="text-[var(--text-secondary)]">No tags found yet</p>
        <p className="text-[var(--text-muted)] text-sm mt-1">Start the treasure hunt!</p>
      </div>
    )
  }

  const top3 = tags.slice(0, 3)
  const rest = tags.slice(3)

  return (
    <div className="space-y-4">
      {/* Featured Top 3 */}
      {top3.map((tag) => (
        <Card
          key={tag.tag_id}
          className="glass-card p-4 border border-[var(--bg-elevated)] hover:border-[var(--neon-cyan)]/30 transition-colors"
        >
          <div className="flex items-start gap-4">
            {/* Rank */}
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center">
              {getRankIcon(tag.rank)}
            </div>

            <div className="w-14 h-14 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center flex-shrink-0">
              <Search className="w-6 h-6 text-[var(--text-muted)]" />
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold truncate">{tag.name}</h3>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-[var(--text-secondary)]">
                <span className={tag.owner_handle ? "" : "font-mono"}>
                  Owner: {getOwnerDisplay(tag)}
                </span>
                {tag.token_reward && (
                  <span className="flex items-center gap-1">
                    <Coins className="w-3 h-3" />
                    {tag.token_reward} tokens
                  </span>
                )}
              </div>
            </div>

            {/* Find count badge */}
            <div className="flex-shrink-0 text-center">
              <div className="px-3 py-1.5 rounded-lg bg-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/30">
                <span className="text-lg font-bold text-[var(--neon-cyan)]">{tag.find_count}</span>
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">finds</p>
              </div>
            </div>
          </div>
        </Card>
      ))}

      {/* Remaining tags */}
      {rest.length > 0 && (
        <div className="rounded-lg border border-[var(--bg-elevated)] overflow-hidden">
          {rest.map((tag, idx) => (
            <div
              key={tag.tag_id}
              className={`flex items-center gap-3 px-4 py-3 ${
                idx > 0 ? "border-t border-[var(--bg-elevated)]" : ""
              } hover:bg-[var(--bg-card)]/50 transition-colors`}
            >
              {/* Rank */}
              <span className="text-sm font-bold text-[var(--text-muted)] w-8 text-center">
                #{tag.rank}
              </span>

              <div className="w-10 h-10 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center flex-shrink-0">
                <Search className="w-4 h-4 text-[var(--text-muted)]" />
              </div>

              {/* Name + location */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">{tag.name}</p>
              </div>

              {/* Find count */}
              <span className="text-sm font-bold text-[var(--neon-cyan)]">
                {tag.find_count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
