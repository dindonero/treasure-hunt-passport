"use client"

import { useState } from "react"
import AppHeader from "@/components/app-header"
import MostFoundTags from "@/components/most-found-tags"
import TagHeatmap from "@/components/tag-heatmap"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Search, Flame, List } from "lucide-react"
import Link from "next/link"

type View = "list" | "heatmap"

export default function MostFoundPage() {
  const [view, setView] = useState<View>("list")

  return (
    <main className="min-h-screen hero-gradient flex flex-col relative overflow-hidden">
      <div className="blob-pink top-10 -left-40 opacity-30" />
      <div className="blob-cyan bottom-20 -right-40 opacity-30" />

      <AppHeader />
      <div className="flex-1 p-4 relative z-10">
        <div className="max-w-2xl mx-auto py-6">
          <Link href="/leaderboard" className="hidden md:inline-flex">
            <Button
              variant="outline"
              size="sm"
              className="mb-6 border-[var(--neon-cyan)]/30 text-[var(--neon-cyan)]"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Leaderboard
            </Button>
          </Link>

          {/* Header */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-[var(--neon-cyan)]/20 flex items-center justify-center flex-shrink-0">
                <Search className="w-5 h-5 text-[var(--neon-cyan)]" />
              </div>
              <h2
                className="text-2xl font-bold gradient-text truncate"
                style={{ fontFamily: "var(--font-display)" }}
              >
                MOST FOUND TAGS
              </h2>
            </div>
          </div>

          {/* View toggle */}
          <div className="mb-6 flex rounded-full p-[3px] bg-[var(--bg-card)] border border-[var(--neon-cyan)]/25 w-full max-w-xs">
            {(
              [
                { id: "list", label: "List", Icon: List },
                { id: "heatmap", label: "Heat map", Icon: Flame },
              ] as { id: View; label: string; Icon: typeof List }[]
            ).map(({ id, label, Icon }) => {
              const active = view === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setView(id)}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-colors ${
                    active
                      ? "bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)]"
                      : "text-[var(--text-muted)]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              )
            })}
          </div>

          {view === "list" ? <MostFoundTags /> : <TagHeatmap />}
        </div>
      </div>
    </main>
  )
}
