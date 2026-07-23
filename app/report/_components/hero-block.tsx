import type { Snapshot } from "@/lib/report"
import { fmtInt } from "@/lib/report"

function formatDateRange(days: string[]): string {
  if (!days || days.length === 0) return ""
  const months = [
    "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
    "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
  ]
  const parse = (iso: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
    if (!m) return null
    return {
      y: parseInt(m[1], 10),
      mo: parseInt(m[2], 10),
      d: parseInt(m[3], 10),
    }
  }
  const first = parse(days[0])
  const last = parse(days[days.length - 1])
  if (!first) return ""
  if (!last || days.length === 1) {
    return `${first.d} ${months[first.mo - 1]} ${first.y}`
  }
  if (first.mo === last.mo && first.y === last.y) {
    return `${first.d}–${last.d} ${months[first.mo - 1]} ${first.y}`
  }
  return `${first.d} ${months[first.mo - 1]} – ${last.d} ${months[last.mo - 1]} ${last.y}`
}

export function HeroBlock({ snapshot }: { snapshot: Snapshot }) {
  const { chain, kpis } = snapshot
  const tsDate = new Date(chain.snapshotISO)
  const ts = tsDate.toUTCString()
  const dateRange = formatDateRange(snapshot.eventDays)
  const daysActive = kpis.daysActive || snapshot.eventDays.length
  const dayWord = daysActive === 1 ? "day" : "days"
  return (
    <div
      className="report-container report-hero"
      style={{ paddingTop: 88, paddingBottom: 8, position: "relative" }}
    >
      {/* editorial colophon — masthead strip */}
      <div className="report-hero__colophon" aria-hidden>
        <span className="report-hero__colophon-mark">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" fill="currentColor" />
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
            <line x1="12" y1="1" x2="12" y2="4" stroke="currentColor" strokeWidth="1.5" />
            <line x1="12" y1="20" x2="12" y2="23" stroke="currentColor" strokeWidth="1.5" />
            <line x1="1" y1="12" x2="4" y2="12" stroke="currentColor" strokeWidth="1.5" />
            <line x1="20" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <span>FESTIVAL DA JUVENTUDE</span>
        </span>
        <span className="report-hero__colophon-sep" />
        <span className="report-hero__colophon-coords">CADAVAL · 2026</span>
        <span className="report-hero__colophon-sep" />
        <span className="report-hero__colophon-edition">edition · I / I</span>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 28,
          flexWrap: "wrap",
        }}
      >
        <span
          className="report-chip"
          style={{
            borderColor: "rgba(240,96,93,0.4)",
            color: "var(--neon-pink)",
            boxShadow: "0 0 24px rgba(240,96,93,0.18)",
          }}
        >
          POST-EVENT REPORT · v1
        </span>
        <span className="report-chip">PUBLIC SHARE</span>
        <span className="report-chip" style={{ borderColor: "rgba(86,211,100,0.35)", color: "var(--neon-yellow)" }}>
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--neon-yellow)",
              boxShadow: "0 0 8px rgba(86,211,100,0.6)",
            }}
          />
          VERIFIED ON-CHAIN
        </span>
      </div>

      <h1 className="report-hero__title">
        <span className="report-hero__line">
          {daysActive} {dayWord}.
        </span>
        <span className="report-hero__line report-hero__line--accent">
          {fmtInt(kpis.totalFinds)} finds.
        </span>
        <span className="report-hero__line">One festival.</span>
      </h1>

      {/* hairline + dateline */}
      <div className="report-hero__rule" aria-hidden />
      <p
        className="font-display"
        style={{
          fontSize: 13.5,
          color: "var(--text-secondary)",
          margin: 0,
          letterSpacing: "0.22em",
        }}
      >
        FESTIVAL DA JUVENTUDE{dateRange ? ` · ${dateRange}` : ""} · CADAVAL
      </p>
      <p
        className="font-mono report-hero__stamp"
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          marginTop: 10,
          letterSpacing: "0.05em",
        }}
      >
        <span style={{ color: "var(--text-secondary)" }}>snapshot</span>
        {" · "}
        {ts}
        {" · "}
        <span style={{ color: "var(--text-secondary)" }}>block</span>
        {" #"}
        {chain.blockHeight.toLocaleString("en-US")}
      </p>
    </div>
  )
}
