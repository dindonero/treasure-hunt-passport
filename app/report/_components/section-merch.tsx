"use client"

import { useMemo, useState } from "react"
import type { Snapshot } from "@/lib/report"
import { fmtInt } from "@/lib/report"
import { Anchor, ChartFrame, Username } from "./atoms"
import { CHART, RankScatter, SkuBars, SkuCurve, type SkuSortMode } from "./charts"

// Distinct chart colors cycle in source order so the same category is the
// same color across the legend / left-border / bar.
const CATEGORY_PALETTE = [
  CHART.c1,
  CHART.c2,
  CHART.c3,
  CHART.c4,
  CHART.c5,
  "#FFB454",
  "#9EE0D1",
  "#E0A0DA",
  "#F4D35E",
  "#82AAFF",
  "#D7C9AA",
  "#7AC74F",
]

export function SectionMerch({ snapshot }: { snapshot: Snapshot }) {
  const { skus, rankScatter, topMerchBuyers, kpis } = snapshot

  const [sortMode, setSortMode] = useState<SkuSortMode>("units")

  const sortedSkus = useMemo(() => {
    const arr = [...skus]
    arr.sort((a, b) => {
      if (sortMode === "units") return b.units - a.units
      if (sortMode === "velocity") {
        return (b.unitsPerHour ?? -1) - (a.unitsPerHour ?? -1)
      }
      if (sortMode === "tokens") {
        return b.tokensExchanged - a.tokensExchanged
      }
      const av = a.minutesToSellout ?? Number.MAX_SAFE_INTEGER
      const bv = b.minutesToSellout ?? Number.MAX_SAFE_INTEGER
      return av - bv
    })
    return arr
  }, [skus, sortMode])

  const [pickedSku, setPickedSku] = useState(sortedSkus[0] ?? null)

  const categories = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const s of sortedSkus) {
      if (!seen.has(s.category)) {
        seen.add(s.category)
        out.push(s.category)
      }
    }
    return out
  }, [sortedSkus])

  const categoryColor = useMemo(() => {
    const map = new Map<string, string>()
    categories.forEach((c, i) =>
      map.set(c, CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]),
    )
    return (c: string) => map.get(c) ?? CHART.c1
  }, [categories])

  const top10MerchShare = useMemo(() => {
    if (!rankScatter.length) return 0
    const total = rankScatter.reduce((a, p) => a + p.purchases, 0)
    if (!total) return 0
    const top = rankScatter
      .filter((p) => p.rank <= 10)
      .reduce((a, p) => a + p.purchases, 0)
    return Math.round((top / total) * 100)
  }, [rankScatter])

  return (
    <section className="report-section" id="merch">
      <div className="report-container">
        <Anchor
          num="04"
          title="MERCH FAIRNESS"
          lede="Did the leaderboard winners take everything? Per-SKU velocity on one side, and a rank–claims scatter on the other, triangulate the answer."
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 18,
          }}
        >
          {/* Per-SKU bars */}
          <div
            className="report-card"
            style={{ position: "relative", minWidth: 0 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <h3
                className="font-display"
                style={{
                  fontSize: 16,
                  margin: 0,
                  letterSpacing: "0.12em",
                }}
              >
                MERCH VELOCITY
              </h3>
              <div className="report-toggle-group" role="tablist" aria-label="Sort merch by">
                {(
                  [
                    ["units", "Volume"],
                    ["tokens", "Tokens"],
                    ["velocity", "Speed"],
                    ["sellout", "Sellout"],
                  ] as Array<[SkuSortMode, string]>
                ).map(([k, label]) => (
                  <button
                    key={k}
                    role="tab"
                    aria-selected={sortMode === k}
                    onClick={() => setSortMode(k)}
                    className={sortMode === k ? "active" : ""}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p
              style={{
                fontSize: 12.5,
                color: "var(--text-secondary)",
                margin: "8px 0 14px",
                lineHeight: 1.55,
              }}
            >
              {sortMode === "units" && (
                <>
                  Sorted by <strong style={{ color: "var(--text-primary)" }}>volume</strong> —{" "}
                  total units claimed by players. This is the fairest single number: an item with
                  200 units claimed beats one with 5, regardless of how fast the 5 went.
                </>
              )}
              {sortMode === "tokens" && (
                <>
                  Total <strong style={{ color: "var(--text-primary)" }}>tokens exchanged</strong>{" "}
                  per item.
                </>
              )}
              {sortMode === "velocity" && (
                <>
                  Sorted by <strong style={{ color: "var(--text-primary)" }}>units / hour</strong>{" "}
                  — claim rate over the active window. Pair it with Volume to get the full picture.
                </>
              )}
              {sortMode === "sellout" && (
                <>
                  Sorted by <strong style={{ color: "var(--text-primary)" }}>time to sell-out</strong>{" "}
                  — first claim to last claim. Skews toward items that ran out in minutes; use
                  Volume for a fairer read.
                </>
              )}
              {" "}
              <span style={{ color: "var(--text-muted)" }}>Click any row for its claim curve.</span>
            </p>
            <div style={{ maxHeight: 420, overflow: "auto" }}>
              <SkuBars
                skus={sortedSkus}
                onPick={setPickedSku}
                activeSku={pickedSku?.sku}
                categoryColor={categoryColor}
                mode={sortMode}
              />
            </div>
            <div style={{ marginTop: 16 }}>
              <SkuCurve sku={pickedSku} />
            </div>
          </div>

          {/* Scatter */}
          <div className="report-card">
            <h3
              className="font-display"
              style={{
                fontSize: 16,
                margin: 0,
                letterSpacing: "0.12em",
              }}
            >
              DID THE WINNERS BUY THE MERCH?
            </h3>
            <p
              style={{
                fontSize: 12.5,
                color: "var(--text-secondary)",
                margin: "4px 0 14px",
                lineHeight: 1.55,
              }}
            >
              Each dot is one player who bought ≥1 merch item.{" "}
              <span style={{ color: "var(--neon-cyan)" }}>X-axis:</span> their rank on the find leaderboard
              (1 = top, log scale).{" "}
              <span style={{ color: "var(--neon-pink)" }}>Y-axis:</span> how many merch items they bought.
              A steep down-slope would mean leaderboard winners hoarded the merch; a flat cloud means
              everyone got a fair shot.
            </p>
            <ChartFrame
              title="Leaderboard rank versus merch claims"
              summary={`Scatter of leaderboard rank against merch claims for ${rankScatter.length} buyers.`}
            >
              <RankScatter data={rankScatter} totalPlayers={kpis.totalPlayers} />
            </ChartFrame>
            <p
              style={{
                fontSize: 12.5,
                color: "var(--text-secondary)",
                marginTop: 12,
                lineHeight: 1.55,
              }}
            >
              Trend is weak — high-ranked players bought slightly more, but the bulk of merch was
              claimed by mid-rank players.{" "}
              <span style={{ color: "var(--text-primary)" }}>
                The merch race isn&apos;t the leaderboard race.
              </span>
            </p>
            <div
              style={{
                marginTop: 18,
                padding: "18px 20px",
                border: "1px solid rgba(86, 211, 100, 0.45)",
                borderRadius: "var(--radius)",
                background:
                  "linear-gradient(135deg, rgba(86,211,100,0.10), rgba(86,211,100,0.02))",
                boxShadow: "0 0 32px rgba(86,211,100,0.10)",
              }}
            >
              <div
                className="font-display"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.18em",
                  color: "rgba(86,211,100,0.85)",
                  marginBottom: 8,
                }}
              >
                THE VERDICT
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 14,
                  flexWrap: "wrap",
                }}
              >
                <span
                  className="font-display"
                  style={{
                    fontSize: 76,
                    lineHeight: 1,
                    color: "#56D364",
                    letterSpacing: "0.02em",
                    textShadow: "0 0 28px rgba(86,211,100,0.35)",
                  }}
                >
                  {100 - top10MerchShare}%
                </span>
                <span
                  style={{
                    fontSize: 14,
                    color: "var(--text-primary)",
                    lineHeight: 1.45,
                    maxWidth: 280,
                  }}
                >
                  of merch went to{" "}
                  <strong style={{ color: "#56D364" }}>
                    mid-rank and casual players
                  </strong>{" "}
                  — not the top of the leaderboard.
                </span>
              </div>
              <p
                style={{
                  marginTop: 14,
                  fontSize: 13,
                  color: "var(--text-primary)",
                  lineHeight: 1.55,
                }}
              >
                <strong style={{ color: "#56D364" }}>
                  Merch distribution at Festival da Juventude was fair.
                </strong>{" "}
                The on-chain claim rate-limit prevented the leaderboard winners from sweeping
                inventory; the top-10 hunters captured only{" "}
                <span style={{ color: "var(--text-secondary)" }}>{top10MerchShare}%</span>{" "}
                of all merch claims.
              </p>
            </div>
          </div>
        </div>

        {/* Hall of fame */}
        <div
          style={{
            marginTop: 28,
            padding: 18,
            background: "var(--bg-secondary)",
            border: "1px solid var(--report-border)",
            borderRadius: "var(--radius)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 14,
            }}
          >
            <div
              className="font-display"
              style={{
                fontSize: 14,
                letterSpacing: "0.18em",
                color: "var(--text-secondary)",
              }}
            >
              MERCH HALL OF FAME · TOP 5 BUYERS
            </div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {topMerchBuyers.map((b, i) => (
                <div
                  key={b.user + i}
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  <span
                    className="font-display"
                    style={{
                      fontSize: 22,
                      color: i === 0 ? "var(--neon-pink)" : "var(--text-primary)",
                      lineHeight: 1,
                    }}
                  >
                    {fmtInt(b.buys)}
                  </span>
                  <div>
                    <Username name={b.user} />
                    <div
                      className="font-mono"
                      style={{ fontSize: 10, color: "var(--text-muted)" }}
                    >
                      0{i + 1}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
