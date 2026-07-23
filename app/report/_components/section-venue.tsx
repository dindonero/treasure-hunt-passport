"use client"

import type { Snapshot } from "@/lib/report"
import { fmtInt } from "@/lib/report"
import { Anchor } from "./atoms"
import { VenueMap } from "./venue-map"

const HEAT_RAMP = [
  { color: "#FFE066", label: "low" },
  { color: "#FFD24A", label: "" },
  { color: "#FFB94A", label: "" },
  { color: "#FFA055", label: "" },
  { color: "#FF8A5C", label: "" },
  { color: "#FF6F5C", label: "" },
  { color: "#F25A55", label: "" },
  { color: "#E84247", label: "" },
  { color: "#D22F3B", label: "" },
  { color: "#A8202E", label: "" },
  { color: "#7A1024", label: "high" },
]

export function SectionVenue({ snapshot }: { snapshot: Snapshot }) {
  const { hotspots, kpis } = snapshot
  return (
    <section className="report-section" id="venue">
      <div className="report-container">
        <Anchor
          num="02"
          title="VENUE"
          lede="Kernel-density of every NFC find, overlaid on the real Cadaval Festival da Juventude floor plan."
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <span
            className="report-chip"
            style={{
              borderColor: "rgba(240, 96, 93, 0.4)",
              color: "var(--neon-pink)",
              boxShadow: "var(--glow-coral)",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--neon-pink)",
              }}
            />
            Tag finds · {fmtInt(kpis.totalFinds)}
          </span>
          <div
            className="font-mono"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 11,
              color: "var(--text-muted)",
            }}
          >
            <span>{HEAT_RAMP[0].label}</span>
            <span
              aria-hidden
              style={{
                width: 110,
                height: 8,
                borderRadius: 2,
                background: `linear-gradient(to right, ${HEAT_RAMP.map((s) => s.color).join(", ")})`,
              }}
            />
            <span>{HEAT_RAMP[HEAT_RAMP.length - 1].label}</span>
            <span style={{ marginLeft: 4 }}>find density</span>
          </div>
        </div>
      </div>

      {/* Full-bleed map */}
      <div
        className="report-bleed"
        style={{
          position: "relative",
          background: "var(--bg-secondary)",
          padding: "8px 0",
          borderBlock: "1px solid var(--report-border)",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          <VenueMap hotspots={hotspots.points} />
        </div>
      </div>

      <div className="report-container" style={{ marginTop: 24 }}>
        <p
          className="font-mono"
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            lineHeight: 1.55,
            margin: 0,
            textAlign: "center",
          }}
        >
          Each blob is the kernel-density bloom of every successful NFC tap
          at a tag. Cadaval has no fixed booth sectors — players hid their
          own tags across the festival grounds, so the heatmap traces the
          paths players actually walked.
        </p>
      </div>
    </section>
  )
}
