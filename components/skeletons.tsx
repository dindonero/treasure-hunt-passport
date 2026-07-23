"use client"

import { Card } from "@/components/ui/card"

function Shimmer({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-[var(--bg-elevated)] ${className}`}
    />
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      {/* Stats card */}
      <Card className="glass-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="text-center space-y-2">
                <Shimmer className="h-8 w-10 mx-auto" />
                <Shimmer className="h-3 w-14" />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Shimmer className="h-8 w-8 rounded-md" />
            <Shimmer className="h-8 w-8 rounded-md" />
          </div>
        </div>
      </Card>
      {/* Map placeholder */}
      <Shimmer className="w-full aspect-[4/3] rounded-lg" />
    </div>
  )
}

export function LeaderboardSkeleton() {
  return (
    <Card className="glass-card p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shimmer className="w-10 h-10 rounded-lg" />
        <Shimmer className="h-7 w-40" />
      </div>
      {/* Category tabs */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Shimmer key={i} className="h-9 w-20 rounded-lg" />
        ))}
      </div>
      {/* Podium */}
      <div className="flex items-end justify-center gap-3 px-4 pt-4">
        <Shimmer className="w-24 h-28 rounded-t-lg" />
        <Shimmer className="w-28 h-36 rounded-t-lg" />
        <Shimmer className="w-24 h-24 rounded-t-lg" />
      </div>
      {/* Rows */}
      {[1, 2, 3, 4].map((i) => (
        <Shimmer key={i} className="h-14 w-full rounded-lg" />
      ))}
    </Card>
  )
}

export function MerchSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="glass-card overflow-hidden">
          <Shimmer className="aspect-square w-full" />
          <div className="p-4 space-y-3">
            <Shimmer className="h-5 w-3/4" />
            <Shimmer className="h-4 w-full" />
            <div className="flex justify-between items-end">
              <Shimmer className="h-7 w-20" />
              <Shimmer className="h-9 w-24 rounded-lg" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

export function MerchHistorySkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <Card key={i} className="glass-card p-4">
          <div className="flex items-center gap-3">
            <Shimmer className="w-12 h-12 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Shimmer className="h-4 w-32" />
              <Shimmer className="h-3 w-24" />
              <Shimmer className="h-3 w-20" />
            </div>
            <div className="flex flex-col items-end gap-1">
              <Shimmer className="h-5 w-16" />
              <Shimmer className="h-3 w-12" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

export function MostFoundSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="glass-card p-4">
          <div className="flex items-start gap-4">
            <Shimmer className="w-10 h-10 rounded-lg flex-shrink-0" />
            <Shimmer className="w-14 h-14 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Shimmer className="h-4 w-32" />
              <Shimmer className="h-3 w-24" />
              <Shimmer className="h-3 w-40" />
            </div>
            <Shimmer className="w-14 h-12 rounded-lg flex-shrink-0" />
          </div>
        </Card>
      ))}
    </div>
  )
}

export function TagListSkeleton() {
  return (
    <div className="space-y-4">
      {/* HUD Stats Panel skeleton */}
      <div className="glass-card rounded-2xl p-5">
        <Shimmer className="h-3 w-24 mb-4" />
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <Shimmer className="w-14 h-14 sm:w-16 sm:h-16 rounded-full" />
              <Shimmer className="h-2 w-12" />
            </div>
          ))}
        </div>
      </div>
      {/* Tag card skeletons */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl overflow-hidden" style={{ background: "rgba(19, 25, 33, 0.6)" }}>
          {/* Classification strip */}
          <div className="px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shimmer className="w-1.5 h-1.5 rounded-full" />
              <Shimmer className="h-2.5 w-16" />
            </div>
            <Shimmer className="h-2.5 w-10" />
          </div>
          {/* Card body */}
          <div className="p-4">
            <div className="flex items-start gap-4">
              <Shimmer className="w-12 h-12 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Shimmer className="h-4 w-32" />
                <Shimmer className="h-3 w-48" />
                <div className="flex gap-2">
                  <Shimmer className="h-5 w-16 rounded-full" />
                  <Shimmer className="h-5 w-20 rounded-full" />
                </div>
              </div>
              <Shimmer className="h-8 w-16 rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
