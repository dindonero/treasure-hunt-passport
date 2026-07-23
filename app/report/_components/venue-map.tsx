"use client"

import type { ReportHotspot } from "@/lib/report"

// Cadaval venue map is the cropped FIL/Festival floor plan, landscape.
// Source: public/fil_map.jpeg @ 1278 × 863. Heat-blob math reads point
// coords as 0..1 fractions of the image, so they keep anchoring correctly
// at any output size.
const VW = 1278
const VH = 863

// Fully-warm ramp: every blob blooms in the yellow → red spectrum.
const WEATHER_STOPS: Array<[number, string]> = [
  [0.00, "#FFE066"],
  [0.10, "#FFD24A"],
  [0.22, "#FFB94A"],
  [0.34, "#FFA055"],
  [0.46, "#FF8A5C"],
  [0.58, "#FF6F5C"],
  [0.68, "#F25A55"],
  [0.78, "#E84247"],
  [0.86, "#D22F3B"],
  [0.94, "#A8202E"],
  [1.00, "#7A1024"],
]

function HeatLayer({ points }: { points: ReportHotspot[] }) {
  // Drop unplaced / off-canvas tags — seed rows without coords arrive as
  // (0,0).
  const placed = points.filter(
    (p) =>
      Number.isFinite(p.x) &&
      Number.isFinite(p.y) &&
      p.x > 0.02 &&
      p.x < 0.98 &&
      p.y > 0.02 &&
      p.y < 0.98 &&
      p.w > 0,
  )
  const maxW = Math.max(1, ...placed.map((p) => p.w))
  return (
    <g aria-hidden>
      <defs>
        {WEATHER_STOPS.map(([, color], i) => (
          <radialGradient
            key={`heat-stop-${i}`}
            id={`report-heat-${i}`}
            cx="50%"
            cy="50%"
            r="50%"
          >
            <stop offset="0%" stopColor={color} stopOpacity="1" />
            <stop offset="40%" stopColor={color} stopOpacity="0.85" />
            <stop offset="75%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
        ))}
        <filter id="report-heat-blur" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      <g filter="url(#report-heat-blur)">
        {placed.map((p, i) => {
          const w01 = p.w / maxW
          const lifted = 0.18 + w01 * 0.82
          let stopIdx = WEATHER_STOPS.length - 1
          for (let k = 0; k < WEATHER_STOPS.length; k++) {
            if (lifted <= WEATHER_STOPS[k][0]) {
              stopIdx = k
              break
            }
          }
          // Scale radius to the landscape aspect — smaller absolute pixels
          // than the PSCS portrait map because the canvas is shorter.
          const r = 36 + Math.pow(w01, 0.55) * 92
          return (
            <circle
              key={i}
              cx={p.x * VW}
              cy={p.y * VH}
              r={r}
              fill={`url(#report-heat-${stopIdx})`}
              fillOpacity={Math.max(0.7, 0.6 + w01 * 0.4)}
            />
          )
        })}
      </g>
    </g>
  )
}

export function VenueMap({ hotspots }: { hotspots: ReportHotspot[] }) {
  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      style={{
        width: "100%",
        height: "auto",
        display: "block",
        background: "var(--bg-secondary)",
        aspectRatio: `${VW} / ${VH}`,
      }}
      role="img"
      aria-label="Cadaval Festival da Juventude venue map with a weather-map style kernel-density heatmap of treasure-hunt finds."
    >
      <image
        href="/fil_map.jpeg"
        x={0}
        y={0}
        width={VW}
        height={VH}
        preserveAspectRatio="xMidYMid slice"
        opacity={0.6}
      />
      <rect x={0} y={0} width={VW} height={VH} fill="#06080F" opacity={0.18} />
      <HeatLayer points={hotspots} />
    </svg>
  )
}
