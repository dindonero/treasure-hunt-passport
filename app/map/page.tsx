"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import AppHeader from "@/components/app-header"
import VenueMap from "@/components/venue-map"
import { ArrowLeft, MapPin } from "lucide-react"
import Link from "next/link"

interface MapPin {
  id: number
  x: number
  y: number
  name?: string
}

export default function PublicMapPage() {
  const [pins, setPins] = useState<MapPin[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/nfc-tags/map-pins", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setPins(data.pins)
      })
      .catch((err) => {
        if (err?.name !== "AbortError") console.error("Error fetching map pins:", err)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

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
            VENUE MAP
          </h1>
        </div>

        {loading ? (
          <Card className="glass-card p-4 mb-4 animate-pulse">
            <div className="h-6 bg-[var(--bg-secondary)] rounded w-32" />
          </Card>
        ) : (
          <>
            <Card className="glass-card p-4 mb-4">
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-[var(--neon-pink)]" />
                <p className="text-sm text-[var(--text-secondary)]">
                  <span className="text-[var(--neon-pink)] font-bold">{pins.length}</span> tags hidden around the venue
                </p>
              </div>
            </Card>

            <VenueMap pins={pins} showPinsToggle allowExpand />
          </>
        )}
      </div>
    </main>
  )
}
