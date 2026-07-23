"use client"

import { useState } from "react"
import type {
  ReportHistogramBin,
  ReportRankScatterPoint,
  ReportSku,
  ReportSkuCurvePoint,
} from "@/lib/report"
import { fmtInt, fmtMinutes } from "@/lib/report"

// Fixed-assignment chart palette (matches globals.css --chart-N).
export const CHART = {
  c1: "var(--chart-1)",
  c2: "var(--chart-2)",
  c3: "var(--chart-3)",
  c4: "var(--chart-4)",
  c5: "var(--chart-5)",
  grid: "rgba(255,255,255,0.04)",
  gridStrong: "rgba(255,255,255,0.08)",
  axis: "var(--text-muted)",
  text: "var(--text-secondary)",
}

// Raw hex for SVG attributes that don't accept CSS vars (Safari + some SVG props).
const HEX = {
  c1: "#F0605D",
  c2: "#58A6FF",
  c3: "#FF9A76",
  c4: "#56D364",
  c5: "#BC8CFF",
  axis: "#484F58",
  text: "#8B949E",
}

// ---------------- horizontal bar row ----------------
export function BarRow({
  label,
  value,
  max,
  color = HEX.c1,
  formatter = fmtInt,
  width = 320,
}: {
  label: string
  value: number
  max: number
  color?: string
  formatter?: (n: number) => string
  width?: number
}) {
  const pct = max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "center",
        gap: 12,
        paddingBlock: 6,
      }}
    >
      <div>
        <div style={{ fontSize: 12.5, marginBottom: 6, color: "var(--text-primary)" }}>{label}</div>
        <div
          style={{
            height: 6,
            background: "rgba(255,255,255,0.04)",
            borderRadius: 3,
            overflow: "hidden",
            maxWidth: width,
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: color,
              transition: "width 800ms cubic-bezier(0.2, 0.8, 0.2, 1)",
            }}
          />
        </div>
      </div>
      <div
        className="font-mono"
        style={{
          fontSize: 12.5,
          color: "var(--text-primary)",
          minWidth: 60,
          textAlign: "right",
        }}
      >
        {formatter(value)}
      </div>
    </div>
  )
}

// ---------------- ranked find-curve with reference markers ----------------
// Each tag's find count, sorted descending, drawn as a single decay curve
// with horizontal reference lines at median, p75, and p90. Easier to read
// than a binned histogram because every tag is its own point and the
// spread reads as a slope.
export function FindRankCurve({
  values,
  height = 220,
}: {
  values: number[]
  height?: number
}) {
  const w = 600
  const padL = 44
  const padR = 24
  const padT = 16
  const padB = 38
  const sorted = [...values].sort((a, b) => b - a)
  const n = sorted.length
  const innerW = w - padL - padR
  const innerH = height - padT - padB
  const maxV = Math.max(1, ...sorted)
  const xs = (i: number) =>
    padL + (n <= 1 ? 0 : (i / (n - 1)) * innerW)
  const ys = (v: number) => padT + (1 - v / maxV) * innerH

  // Percentile helpers (sorted is desc; "median" = item at index floor(n/2)).
  const pAt = (q: number) => {
    if (!n) return 0
    const asc = [...sorted].reverse()
    const idx = Math.min(asc.length - 1, Math.floor(q * (asc.length - 1)))
    return asc[idx]
  }
  const median = pAt(0.5)
  const p75 = pAt(0.75)
  const p90 = pAt(0.9)

  let path = `M ${xs(0)} ${ys(sorted[0] ?? 0)}`
  for (let i = 1; i < n; i++) path += ` L ${xs(i)} ${ys(sorted[i])}`
  const fillPath = `${path} L ${xs(Math.max(0, n - 1))} ${ys(0)} L ${xs(0)} ${ys(0)} Z`

  const refs: Array<{ v: number; label: string; color: string; dash: string }> = [
    { v: p90, label: "Top 10% threshold", color: HEX.c5, dash: "5 5" },
    { v: p75, label: "Top 25%", color: HEX.c3, dash: "4 4" },
    { v: median, label: "Median", color: HEX.c2, dash: "3 5" },
  ]

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      role="img"
      aria-label={`Ranked find-count curve over ${n} tags. Median ${median}, top quartile ${p75}, top decile ${p90}, peak ${sorted[0] ?? 0}.`}
    >
      {/* y-axis baseline */}
      <line
        x1={padL}
        x2={w - padR}
        y1={ys(0)}
        y2={ys(0)}
        stroke={HEX.axis}
        strokeOpacity={0.4}
      />
      {/* y-axis ticks at 0, ½ max, max */}
      {[0, maxV / 2, maxV].map((t) => (
        <g key={t}>
          <line
            x1={padL}
            x2={w - padR}
            y1={ys(t)}
            y2={ys(t)}
            stroke={HEX.axis}
            strokeOpacity={t === 0 ? 0.4 : 0.08}
          />
          <text
            x={padL - 6}
            y={ys(t) + 4}
            fontSize="10"
            textAnchor="end"
            fontFamily="Roboto Mono"
            fill={HEX.text}
          >
            {Math.round(t)}
          </text>
        </g>
      ))}
      {/* the decay curve */}
      <path d={fillPath} fill={HEX.c1} fillOpacity={0.1} />
      <path d={path} fill="none" stroke={HEX.c1} strokeWidth="2" />
      {/* dot on rank-1 + label */}
      {n > 0 && (
        <g>
          <circle cx={xs(0)} cy={ys(sorted[0])} r="4" fill={HEX.c1} />
          <text
            x={xs(0) + 8}
            y={ys(sorted[0]) - 6}
            fontSize="11"
            fontFamily="Roboto Mono"
            fill="var(--text-primary)"
          >
            #1 · {sorted[0]} finds
          </text>
        </g>
      )}
      {/* reference lines */}
      {refs.map((r) => (
        <g key={r.label}>
          <line
            x1={padL}
            x2={w - padR}
            y1={ys(r.v)}
            y2={ys(r.v)}
            stroke={r.color}
            strokeWidth="1.5"
            strokeDasharray={r.dash}
            opacity={0.7}
          />
          <text
            x={w - padR - 4}
            y={ys(r.v) - 4}
            fontSize="10.5"
            textAnchor="end"
            fontFamily="Roboto Mono"
            fill={r.color}
          >
            {r.label} · {Math.round(r.v)}
          </text>
        </g>
      ))}
      {/* x-axis labels */}
      <text
        x={padL}
        y={height - 18}
        fontSize="10"
        fontFamily="Roboto Mono"
        fill={HEX.text}
      >
        rank #1
      </text>
      <text
        x={w - padR}
        y={height - 18}
        fontSize="10"
        fontFamily="Roboto Mono"
        textAnchor="end"
        fill={HEX.text}
      >
        rank #{n}
      </text>
      <text
        x={padL + innerW / 2}
        y={height - 4}
        fontSize="10"
        fontFamily="Roboto Mono"
        textAnchor="middle"
        fill={HEX.axis}
      >
        every tag, sorted by find count →
      </text>
    </svg>
  )
}

// ---------------- vertical histogram ----------------
export function Histogram({
  data,
  height = 170,
  color = HEX.c1,
}: {
  data: ReportHistogramBin[]
  height?: number
  color?: string
}) {
  const w = 600
  const pad = 24
  const max = Math.max(1, ...data.map((d) => d.count))
  const bw = (w - pad * 2) / data.length
  return (
    <svg
      viewBox={`0 0 ${w} ${height + 36}`}
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {data.map((d, i) => {
        const h = (d.count / max) * height
        const x = pad + i * bw + 4
        const y = height - h + 8
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={bw - 8}
              height={h}
              fill={color}
              opacity={0.85}
              rx={2}
            />
            <text
              x={x + (bw - 8) / 2}
              y={height + 24}
              textAnchor="middle"
              fontSize="10"
              fill={HEX.axis}
              fontFamily="Roboto Mono"
            >
              {d.label}
            </text>
            <text
              x={x + (bw - 8) / 2}
              y={y - 4}
              textAnchor="middle"
              fontSize="10"
              fill={HEX.text}
              fontFamily="Roboto Mono"
            >
              {d.count}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ---------------- Sparkline ----------------
export function Sparkline({
  values,
  height = 32,
  width = 300,
  color = HEX.c1,
  fill = true,
}: {
  values: number[]
  height?: number
  width?: number
  color?: string
  fill?: boolean
}) {
  if (!values.length) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
        <line x1={0} x2={width} y1={height / 2} y2={height / 2} stroke={HEX.axis} strokeOpacity="0.3" />
      </svg>
    )
  }
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const xs = (i: number) => (i / Math.max(1, values.length - 1)) * width
  const ys = (v: number) => height - ((v - min) / range) * (height - 4) - 2
  let path = `M ${xs(0)} ${ys(values[0])}`
  values.slice(1).forEach((v, i) => {
    path += ` L ${xs(i + 1)} ${ys(v)}`
  })
  const fillPath = fill ? path + ` L ${width} ${height} L 0 ${height} Z` : null
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      {fill && fillPath && <path d={fillPath} fill={color} fillOpacity={0.08} />}
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  )
}

// ---------------- Rank × Claims scatter ----------------
export function RankScatter({
  data,
  totalPlayers,
}: {
  data: ReportRankScatterPoint[]
  totalPlayers?: number
}) {
  const [hover, setHover] = useState<{
    rank: number
    purchases: number
    x: number
    y: number
  } | null>(null)

  const w = 560
  const height = 340
  const padL = 56
  const padR = 24
  const padT = 28
  const padB = 56
  const innerW = w - padL - padR
  const innerH = height - padT - padB

  const maxRank = Math.max(1, totalPlayers ?? 0, ...data.map((d) => d.rank))
  const maxY = Math.max(1, ...data.map((d) => d.purchases))

  const xs = (r: number) =>
    padL + (Math.log10(r) / Math.log10(maxRank)) * innerW
  const ys = (v: number) => padT + (1 - v / maxY) * innerH

  // Buckets for jitter so overlapping dots don't fully obscure each other.
  // (rank, purchases) → count
  const counts = new Map<string, number>()
  for (const d of data) {
    const k = `${d.rank}-${d.purchases}`
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }

  // Linear regression in log-x space
  const n = data.length || 1
  const xLog = data.map((d) => Math.log10(Math.max(1, d.rank)))
  const meanX = xLog.reduce((a, b) => a + b, 0) / n
  const meanY = data.reduce((a, d) => a + d.purchases, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xLog[i] - meanX) * (data[i].purchases - meanY)
    den += (xLog[i] - meanX) ** 2
  }
  const slope = den === 0 ? 0 : num / den
  const intercept = meanY - slope * meanX
  const ssTot = data.reduce((a, d) => a + (d.purchases - meanY) ** 2, 0) || 1
  const ssRes = data.reduce(
    (a, d, i) => a + (d.purchases - (slope * xLog[i] + intercept)) ** 2,
    0,
  )
  const r2 = Math.max(0, Math.min(1, 1 - ssRes / ssTot))

  // Round X ticks at decade boundaries up to maxRank
  const xTicks: number[] = [1]
  for (let v = 10; v <= maxRank; v *= 10) xTicks.push(v)
  if (xTicks[xTicks.length - 1] !== maxRank) xTicks.push(maxRank)
  // Y axis ticks at integers up to maxY, capped
  const yTicks: number[] = []
  const yStep = maxY <= 6 ? 1 : Math.ceil(maxY / 5)
  for (let v = 0; v <= maxY; v += yStep) yTicks.push(v)
  if (yTicks[yTicks.length - 1] !== maxY) yTicks.push(maxY)

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${w} ${height}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label={`Scatter of leaderboard rank versus merch claims for ${data.length} buyers. R-squared ${r2.toFixed(2)}.`}
      >
        {/* y-axis gridlines + tick labels */}
        {yTicks.map((v) => (
          <g key={`y-${v}`}>
            <line
              x1={padL}
              x2={padL + innerW}
              y1={ys(v)}
              y2={ys(v)}
              stroke={HEX.axis}
              strokeOpacity={v === 0 ? 0.4 : 0.12}
            />
            <text
              x={padL - 8}
              y={ys(v) + 4}
              textAnchor="end"
              fontSize="11"
              fontFamily="Roboto Mono"
              fill={HEX.text}
            >
              {v}
            </text>
          </g>
        ))}
        {/* x-axis tick labels (decade boundaries) */}
        {xTicks.map((r) => (
          <g key={`x-${r}`}>
            <line
              x1={xs(r)}
              x2={xs(r)}
              y1={padT}
              y2={padT + innerH}
              stroke={HEX.axis}
              strokeOpacity={0.08}
            />
            <text
              x={xs(r)}
              y={padT + innerH + 18}
              textAnchor="middle"
              fontSize="11"
              fontFamily="Roboto Mono"
              fill={HEX.text}
            >
              {r === 1 ? "#1" : `#${r}`}
            </text>
          </g>
        ))}

        {/* regression line */}
        {(() => {
          const segs: Array<{ x: number; y: number }> = []
          const N = 40
          for (let i = 0; i <= N; i++) {
            const t = i / N
            const xValLog = Math.log10(1) + t * (Math.log10(maxRank) - Math.log10(1))
            const xR = Math.pow(10, xValLog)
            const yPred = Math.max(0, slope * xValLog + intercept)
            segs.push({ x: xs(xR), y: ys(yPred) })
          }
          const d = segs
            .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
            .join(" ")
          return (
            <path
              d={d}
              fill="none"
              stroke={HEX.c2}
              strokeWidth="2"
              strokeDasharray="6 4"
              opacity={0.85}
            />
          )
        })()}

        {/* dots — radius scales with overlap count */}
        {data.map((d, i) => {
          const k = `${d.rank}-${d.purchases}`
          const c = counts.get(k) ?? 1
          const r = 4 + Math.min(7, Math.sqrt(c - 1) * 2.5)
          const x = xs(Math.max(1, d.rank))
          const y = ys(d.purchases)
          const isHover =
            hover && hover.rank === d.rank && hover.purchases === d.purchases
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={r}
              fill={HEX.c1}
              fillOpacity={isHover ? 1 : 0.55}
              stroke={isHover ? "#FFF" : "none"}
              strokeWidth={isHover ? 1.5 : 0}
              onMouseEnter={() =>
                setHover({
                  rank: d.rank,
                  purchases: d.purchases,
                  x: (x / w) * 100,
                  y: (y / height) * 100,
                })
              }
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "crosshair", transition: "fill-opacity 120ms" }}
            />
          )
        })}

        {/* axis labels */}
        <text
          x={padL + innerW / 2}
          y={height - 16}
          textAnchor="middle"
          fontFamily="Bebas Neue"
          fontSize="14"
          letterSpacing="0.14em"
          fill={HEX.text}
        >
          LEADERBOARD RANK (LOG) →
        </text>
        <text
          transform={`translate(16, ${padT + innerH / 2}) rotate(-90)`}
          textAnchor="middle"
          fontFamily="Bebas Neue"
          fontSize="14"
          letterSpacing="0.14em"
          fill={HEX.text}
        >
          MERCH CLAIMS →
        </text>

        {/* R² readout */}
        <g transform={`translate(${padL + innerW - 110},${padT + 14})`}>
          <rect
            x={-10}
            y={-14}
            width={120}
            height={34}
            fill="rgba(6,8,15,0.85)"
            stroke={HEX.axis}
            strokeOpacity="0.4"
            rx="4"
          />
          <text fontSize="10" fontFamily="Roboto Mono" fill={HEX.text}>
            trend · log-linear
          </text>
          <text y="14" fontSize="12" fontFamily="Roboto Mono" fill={HEX.c2}>
            R² = {r2.toFixed(2)}
          </text>
        </g>
      </svg>
      {/* HTML tooltip layer */}
      {hover && (
        <div
          role="status"
          style={{
            position: "absolute",
            left: `calc(${hover.x}% + 12px)`,
            top: `calc(${hover.y}% - 4px)`,
            transform:
              hover.x > 70 ? "translate(-100%, 0) translate(-24px, 0)" : "none",
            background: "rgba(6, 8, 15, 0.94)",
            border: "1px solid var(--report-border-strong)",
            padding: "8px 10px",
            borderRadius: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            boxShadow: "0 8px 28px rgba(0,0,0,0.4)",
          }}
        >
          <div style={{ color: "var(--neon-cyan)" }}>
            leaderboard rank · #{hover.rank}
          </div>
          <div style={{ color: "var(--neon-pink)" }}>
            merch claims · {hover.purchases}
          </div>
          <div style={{ color: "var(--text-muted)", marginTop: 2 }}>
            {counts.get(`${hover.rank}-${hover.purchases}`)! > 1
              ? `${counts.get(`${hover.rank}-${hover.purchases}`)} players at this point`
              : "1 player"}
          </div>
        </div>
      )}
      <div
        className="font-mono"
        style={{
          marginTop: 8,
          fontSize: 10.5,
          color: "var(--text-muted)",
          letterSpacing: "0.04em",
        }}
      >
        {data.length} buyers plotted · larger dots = more players stacked at the same point
      </div>
    </div>
  )
}

// ---------------- Hour-of-day line chart (daysActive × 24 hours) ----------------
// Day labels are derived from the snapshot's `eventDays` (ISO `YYYY-MM-DD` in
// Lisbon local) so the chart works for any number of festival days.
const DAY_COLORS = [HEX.c1, HEX.c2, HEX.c4, HEX.c3, HEX.c5] as const

function formatDayLabel(iso: string, fallback: string): string {
  // Expect `YYYY-MM-DD`. Render as `MMM DD` (e.g. `MAY 25`). Falls back to
  // the supplied placeholder if parsing fails.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return fallback
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
  const mon = months[parseInt(m[2], 10) - 1] ?? fallback
  return `${mon} ${m[3]}`
}

export function HourLineChart({
  absCounts,
  eventDays,
  height = 440,
}: {
  /** daysActive × 24 grid of absolute transaction counts. */
  absCounts: number[][]
  /** Optional list of `YYYY-MM-DD` strings, same length as absCounts. */
  eventDays?: string[]
  height?: number
}) {
  const [hover, setHover] = useState<{ d: number; h: number; x: number; y: number } | null>(
    null,
  )
  const w = 1100
  const padL = 78
  const padR = 32
  const padT = 32
  const padB = 76
  const cols = 24
  const innerW = w - padL - padR
  const innerH = height - padT - padB
  const maxV = Math.max(1, ...absCounts.flat())
  const xs = (h: number) => padL + (h / (cols - 1)) * innerW
  const ys = (v: number) => padT + (1 - v / maxV) * innerH

  const dayLabels = absCounts.map((_, i) =>
    formatDayLabel(eventDays?.[i] ?? "", `DAY ${i + 1}`),
  )

  // y-axis tick step at a clean round number
  const tickStep = (() => {
    const ideal = maxV / 4
    const mag = Math.pow(10, Math.floor(Math.log10(ideal)))
    for (const m of [1, 2, 5, 10]) {
      if (m * mag >= ideal) return m * mag
    }
    return mag
  })()
  const yTicks: number[] = []
  for (let v = 0; v <= maxV + tickStep; v += tickStep) yTicks.push(v)

  // Peak per day
  const peaks = absCounts.map((row) => {
    let bestH = 0
    let bestV = -1
    row.forEach((v, h) => {
      if (v > bestV) {
        bestV = v
        bestH = h
      }
    })
    return { h: bestH, v: bestV }
  })

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${w} ${height}`}
        style={{ width: "100%", height: "auto", display: "block", cursor: "crosshair" }}
        role="img"
        aria-label={`Hour-of-day activity across ${absCounts.length} event day(s). Peaks: ${peaks
          .map((p, i) => `${dayLabels[i]} at ${p.h.toString().padStart(2, "0")}:00 with ${p.v} transactions`)
          .join("; ")}.`}
      >
        {/* y-axis grid + ticks */}
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={padL}
              x2={padL + innerW}
              y1={ys(t)}
              y2={ys(t)}
              stroke={HEX.axis}
              strokeOpacity={t === 0 ? 0.4 : 0.1}
            />
            <text
              x={padL - 12}
              y={ys(t) + 6}
              textAnchor="end"
              fontSize="15"
              fontFamily="Roboto Mono"
              fill={HEX.text}
            >
              {t.toLocaleString("en-US")}
            </text>
          </g>
        ))}

        {/* hour tick labels every 2h for readability at the larger width */}
        {Array.from({ length: cols }).map((_, h) => {
          if (h % 2 !== 0 && h !== cols - 1) return null
          return (
            <g key={`x-${h}`}>
              <line
                x1={xs(h)}
                x2={xs(h)}
                y1={padT + innerH}
                y2={padT + innerH + 6}
                stroke={HEX.axis}
                strokeOpacity={0.4}
              />
              <text
                x={xs(h)}
                y={padT + innerH + 24}
                fontSize="15"
                textAnchor="middle"
                fontFamily="Roboto Mono"
                fill={HEX.text}
              >
                {h.toString().padStart(2, "0")}h
              </text>
            </g>
          )
        })}

        {/* lines per day */}
        {absCounts.map((row, d) => {
          const color = DAY_COLORS[d % DAY_COLORS.length]
          let path = `M ${xs(0)} ${ys(row[0])}`
          for (let h = 1; h < cols; h++) path += ` L ${xs(h)} ${ys(row[h])}`
          const fillPath = `${path} L ${xs(cols - 1)} ${ys(0)} L ${xs(0)} ${ys(0)} Z`
          return (
            <g key={d}>
              <path d={fillPath} fill={color} fillOpacity={0.08} />
              <path d={path} fill="none" stroke={color} strokeWidth="3" />
              {/* peak marker */}
              <circle
                cx={xs(peaks[d].h)}
                cy={ys(peaks[d].v)}
                r="7"
                fill={color}
                stroke="#06080F"
                strokeWidth="2"
              />
            </g>
          )
        })}

        {/* hover dots (small per-data-point) */}
        {absCounts.map((row, d) =>
          row.map((v, h) => (
            <circle
              key={`hp-${d}-${h}`}
              cx={xs(h)}
              cy={ys(v)}
              r={10}
              fill="transparent"
              onMouseEnter={() =>
                setHover({ d, h, x: (xs(h) / w) * 100, y: (ys(v) / height) * 100 })
              }
              onMouseLeave={() =>
                setHover((cur) => (cur?.d === d && cur?.h === h ? null : cur))
              }
              style={{ cursor: "crosshair" }}
            />
          )),
        )}

        {/* axis label */}
        <text
          x={padL + innerW / 2}
          y={height - 24}
          fontSize="16"
          textAnchor="middle"
          fontFamily="Bebas Neue"
          letterSpacing="0.18em"
          fill={HEX.text}
        >
          HOUR OF DAY (LISBON TIME)
        </text>

        {/* legend */}
        <g transform={`translate(${padL + 14},${padT + 36})`}>
          {absCounts.map((_, d) => (
            <g key={d} transform={`translate(0, ${d * 24})`}>
              <line x1={0} y1={8} x2={28} y2={8} stroke={DAY_COLORS[d % DAY_COLORS.length]} strokeWidth="3.5" />
              <circle cx={14} cy={8} r="5" fill={DAY_COLORS[d % DAY_COLORS.length]} />
              <text
                x={40}
                y={12}
                fontSize="15"
                fontFamily="Bebas Neue"
                letterSpacing="0.14em"
                fill={DAY_COLORS[d % DAY_COLORS.length]}
              >
                {dayLabels[d]} · peak {peaks[d].h.toString().padStart(2, "0")}:00 · {peaks[d].v.toLocaleString("en-US")}
              </text>
            </g>
          ))}
        </g>
      </svg>

      {/* hover tooltip */}
      {hover && (
        <div
          role="status"
          style={{
            position: "absolute",
            left: `calc(${hover.x}% + 12px)`,
            top: `calc(${hover.y}% - 4px)`,
            transform: hover.x > 70 ? "translate(-100%, 0) translate(-24px, 0)" : "none",
            background: "rgba(6,8,15,0.94)",
            border: "1px solid var(--report-border-strong)",
            padding: "8px 10px",
            borderRadius: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            boxShadow: "0 8px 28px rgba(0,0,0,0.4)",
          }}
        >
          <div
            className="font-display"
            style={{
              fontSize: 12,
              letterSpacing: "0.14em",
              color: DAY_COLORS[hover.d % DAY_COLORS.length],
              marginBottom: 2,
            }}
          >
            {dayLabels[hover.d]} · {hover.h.toString().padStart(2, "0")}:00
          </div>
          <div style={{ color: "var(--text-secondary)" }}>
            <span style={{ color: "var(--text-primary)" }}>
              {absCounts[hover.d][hover.h].toLocaleString("en-US")}
            </span>{" "}
            transactions
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------- SKU bars ----------------
export type SkuSortMode = "velocity" | "sellout" | "units" | "tokens"

export function SkuBars({
  skus,
  onPick,
  activeSku,
  categoryColor,
  mode = "velocity",
}: {
  skus: ReportSku[]
  onPick: (s: ReportSku) => void
  activeSku?: string
  categoryColor: (c: string) => string
  mode?: SkuSortMode
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {skus.map((s) => {
        const isActive = activeSku === s.sku
        const color = categoryColor(s.category)
        const tokenSpend = s.tokensExchanged
        let metric: string
        let metricMuted = false
        if (mode === "velocity") {
          metric = s.unitsPerHour != null ? `${s.unitsPerHour.toFixed(1)}/h` : "—"
          metricMuted = s.unitsPerHour == null
        } else if (mode === "sellout") {
          metric = s.minutesToSellout != null ? fmtMinutes(s.minutesToSellout) : "in stock"
          metricMuted = s.minutesToSellout == null
        } else if (mode === "tokens") {
          metric = tokenSpend > 0 ? `${fmtInt(tokenSpend)} tok` : "—"
          metricMuted = tokenSpend === 0
        } else {
          metric = `${s.units}`
        }
        const stockLine = tokenSpend > 0
          ? `${s.units} units claimed · ${fmtInt(tokenSpend)} tokens`
          : `${s.units} units claimed`

        return (
          <button
            key={s.sku}
            onClick={() => onPick(s)}
            title={s.soldOut ? `${s.name} · SOLD OUT` : s.name}
            style={{
              background: isActive ? "rgba(255,255,255,0.04)" : "transparent",
              border: 0,
              padding: "10px 12px",
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 96px",
              alignItems: "center",
              gap: 14,
              cursor: "pointer",
              textAlign: "left",
              color: "var(--text-primary)",
              borderRadius: 6,
              borderLeft: `2px solid ${isActive ? color : (s.soldOut ? `${color}88` : "transparent")}`,
              position: "relative",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  marginBottom: 2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {s.name}
              </div>
              <div
                className="font-mono"
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {s.soldOut && (
                  <span style={{ color: HEX.c1, marginRight: 6 }}>● SOLD OUT</span>
                )}
                {s.category} · {stockLine}
              </div>
            </div>
            <div
              className="font-mono"
              style={{
                fontSize: 12,
                color: metricMuted ? "var(--text-muted)" : "var(--text-secondary)",
                textAlign: "right",
              }}
            >
              {metric}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ---------------- SKU cumulative curve ----------------
export function SkuCurve({ sku }: { sku: ReportSku | null }) {
  if (!sku) return null
  let pts: Array<{ t: number; v: number }>
  if (sku.curve && sku.curve.length > 1) {
    const tMin = sku.curve[0].t
    const tMax = sku.curve[sku.curve.length - 1].t
    const span = Math.max(1, tMax - tMin)
    const maxN = Math.max(1, ...sku.curve.map((p) => p.n))
    pts = sku.curve.map((p) => ({
      t: (p.t - tMin) / span,
      v: p.n / maxN,
    }))
  } else {
    const buckets = 16
    pts = []
    for (let i = 0; i <= buckets; i++) {
      const t = i / buckets
      const v = 1 / (1 + Math.exp(-(t - 0.45) * 7))
      pts.push({ t, v })
    }
  }
  const w = 360
  const h = 120
  const pad = 28
  const xs = (t: number) => pad + t * (w - pad * 2)
  const ys = (v: number) => pad / 2 + (1 - v) * (h - pad)
  let path = `M ${xs(pts[0].t)} ${ys(pts[0].v)}`
  pts.slice(1).forEach((p) => {
    path += ` L ${xs(p.t)} ${ys(p.v)}`
  })
  return (
    <div
      style={{
        padding: 16,
        background: "var(--bg-elevated)",
        border: "1px solid var(--report-border, rgba(240,246,252,0.06))",
        borderRadius: "var(--radius)",
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
        {sku.category} · {sku.units} units
        {sku.soldOut ? " · sold out" : " · in stock"}
      </div>
      <div className="font-display" style={{ fontSize: 18, marginBottom: 12, letterSpacing: "0.04em" }}>
        {sku.name}
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }}>
        <path d={`${path} L ${xs(1)} ${ys(0)} Z`} fill={HEX.c1} fillOpacity={0.08} />
        <path d={path} fill="none" stroke={HEX.c1} strokeWidth="2" />
        <line
          x1={pad}
          x2={w - pad}
          y1={ys(0)}
          y2={ys(0)}
          stroke={HEX.axis}
          strokeOpacity="0.4"
        />
        <text x={pad} y={h - 4} fontSize="9" fontFamily="Roboto Mono" fill={HEX.axis}>
          launch
        </text>
        <text
          x={w - pad}
          y={h - 4}
          textAnchor="end"
          fontSize="9"
          fontFamily="Roboto Mono"
          fill={HEX.axis}
        >
          {sku.minutesToSellout != null
            ? `sellout · ${fmtMinutes(sku.minutesToSellout)}`
            : "still in stock"}
        </text>
      </svg>
    </div>
  )
}

export type { ReportSkuCurvePoint }
