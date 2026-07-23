"use client"

import type { Snapshot } from "@/lib/report"
import { fmtInt } from "@/lib/report"
import { Anchor, ChartFrame } from "./atoms"
import { BarRow, CHART, HourLineChart } from "./charts"

const PLATFORM_COLOR: Record<string, string> = {
  linkedin: CHART.c2,
  instagram: CHART.c1,
  x: CHART.c3,
  twitter: CHART.c3,
  bluesky: CHART.c2,
  tiktok: CHART.c5,
  mastodon: CHART.c5,
  facebook: CHART.c2,
}

function titleCase(s: string) {
  return s.replace(/(^|\s)\w/g, (m) => m.toUpperCase())
}

export function SectionEngagement({ snapshot }: { snapshot: Snapshot }) {
  const { socials, hourGridAbs, eventDays, kpis } = snapshot
  const socialMax = Math.max(1, ...socials.map((s) => s.claims))
  const totalSocial = socials.reduce((a, s) => a + s.claims, 0)
  const daysActive = kpis.daysActive || eventDays.length

  return (
    <section className="report-section" id="engagement">
      <div className="report-container">
        <Anchor
          num="05"
          title="ENGAGEMENT & COMMUNITY"
          lede="Where players posted across the festival, and how their attention rose and fell hour by hour."
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 18,
            marginBottom: 24,
          }}
        >
          {/* Socials */}
          <div className="report-card">
            <h3
              className="font-display"
              style={{
                fontSize: 18,
                margin: "0 0 4px",
                letterSpacing: "0.12em",
              }}
            >
              SOCIAL CLAIMS
            </h3>
            <p
              style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                margin: "0 0 16px",
              }}
            >
              Reward claims by platform.
            </p>
            {socials.length === 0 ? (
              <p
                style={{
                  fontSize: 13,
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                No social rewards were claimed during the event.
              </p>
            ) : (
              socials.map((s, i) => (
                <BarRow
                  key={s.platform + i}
                  label={titleCase(s.platform)}
                  value={s.claims}
                  max={socialMax}
                  color={PLATFORM_COLOR[s.platform.toLowerCase()] ?? CHART.c1}
                />
              ))
            )}
            <div className="report-dotted" style={{ margin: "20px 0" }} />
            <div
              className="font-mono"
              style={{ fontSize: 11, color: "var(--text-secondary)" }}
            >
              Total social claims:{" "}
              <span style={{ color: "var(--text-primary)" }}>
                {fmtInt(totalSocial)}
              </span>
            </div>
          </div>
        </div>

        {/* Hour chart — full-width, taller so the lines are legible on
            desktop and don't compress to an illegible sliver on mobile. */}
        <div className="report-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 8,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <h3
              className="font-display"
              style={{
                fontSize: 18,
                margin: 0,
                letterSpacing: "0.12em",
              }}
            >
              HOUR-OF-DAY ACTIVITY
            </h3>
            <span
              className="font-mono"
              style={{ fontSize: 10.5, color: "var(--text-muted)" }}
            >
              {daysActive} {daysActive === 1 ? "day" : "days"} × 24 hours
            </span>
          </div>
          <ChartFrame
            title="Hour-of-day activity line chart"
            summary="One line per event day plotting transactions per hour across the 24-hour clock, with peak markers."
          >
            <HourLineChart
              absCounts={hourGridAbs}
              eventDays={eventDays}
              height={460}
            />
          </ChartFrame>
        </div>
      </div>
    </section>
  )
}
