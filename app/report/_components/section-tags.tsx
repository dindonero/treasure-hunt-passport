"use client"

import { useMemo, useState } from "react"
import type { Snapshot, ReportTag } from "@/lib/report"
import { fmtInt, fmtSeconds } from "@/lib/report"
import { Anchor, ChartFrame, Username } from "./atoms"
import { FindRankCurve } from "./charts"

type SortKey = "rank" | "name" | "hiddenBy" | "finds" | "pct" | "ttf" | "reward"
type SortDir = "asc" | "desc"

function Podium({ tags }: { tags: ReportTag[] }) {
  const top3 = tags.slice(0, 3)
  if (top3.length < 3) return null
  const order = [top3[1], top3[0], top3[2]]
  const heights = [120, 160, 96]
  const colors = ["#58A6FF", "#F0605D", "#FF9A76"]
  const labels = ["02", "01", "03"]
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 18,
        alignItems: "end",
      }}
    >
      {order.map((t, i) => (
        <div key={t.name + i} style={{ textAlign: "center", minWidth: 0 }}>
          <div style={{ marginBottom: 12 }}>
            <div
              className="font-display"
              style={{
                fontSize: 14,
                color: colors[i],
                letterSpacing: "0.18em",
              }}
            >
              {labels[i]}
            </div>
            <div
              style={{
                fontSize: 13,
                margin: "6px 0 4px",
                lineHeight: 1.25,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={t.name}
            >
              {t.name}
            </div>
            <div
              className="font-mono"
              style={{ fontSize: 10.5, color: "var(--text-muted)" }}
            >
              <Username name={t.hiddenBy} address={t.hiddenByAddress} />
            </div>
          </div>
          <div
            style={{
              height: heights[i],
              background: colors[i],
              opacity: 0.18,
              border: `1px solid ${colors[i]}`,
              borderRadius: 6,
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: i === 1 ? `0 0 32px ${colors[i]}30` : "none",
            }}
          >
            <div
              className="font-display"
              style={{
                fontSize: i === 1 ? 56 : 40,
                color: colors[i],
                letterSpacing: "0.04em",
                lineHeight: 1,
              }}
            >
              {t.finds}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function TopList({
  title,
  rows,
}: {
  title: string
  rows: Array<{
    rank: number
    label: string
    address: string | null
    primary: number
    primaryLabel: string
    secondary?: number
    secondaryLabel?: string
  }>
}) {
  return (
    <div className="report-card">
      <h3
        className="font-display"
        style={{
          fontSize: 16,
          margin: "0 0 14px",
          letterSpacing: "0.12em",
        }}
      >
        {title}
      </h3>
      {rows.length === 0 ? (
        <p
          style={{
            fontSize: 12.5,
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          No data yet.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 4 }}>
          {rows.slice(0, 5).map((r, i) => (
            <div
              key={`${r.label}-${i}`}
              style={{
                display: "grid",
                gridTemplateColumns: "28px 1fr auto",
                alignItems: "center",
                gap: 12,
                padding: "8px 4px",
                borderBottom:
                  i === Math.min(rows.length, 5) - 1
                    ? "none"
                    : "1px solid var(--report-border)",
                fontSize: 13,
              }}
            >
              <span
                className="font-mono"
                style={{
                  color: i === 0 ? "var(--neon-pink)" : "var(--text-muted)",
                  fontSize: 12,
                }}
              >
                {r.rank.toString().padStart(2, "0")}
              </span>
              <div style={{ minWidth: 0 }}>
                <Username name={r.label} address={r.address} />
                {r.secondary != null && r.secondaryLabel && (
                  <div
                    className="font-mono"
                    style={{ fontSize: 10.5, color: "var(--text-muted)" }}
                  >
                    {fmtInt(r.secondary)} {r.secondaryLabel}
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <span
                  className="font-mono"
                  style={{ fontSize: 14, color: "var(--text-primary)" }}
                >
                  {fmtInt(r.primary)}
                </span>{" "}
                <span
                  className="font-mono"
                  style={{ fontSize: 10, color: "var(--text-muted)" }}
                >
                  {r.primaryLabel}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function SectionTags({ snapshot }: { snapshot: Snapshot }) {
  const { tags: rawTags, topHiders, topFinders, chain } = snapshot

  // Re-rank within the visible subset so the table reads 1..N without
  // skipped numbers. Snapshot is expected to already be sorted by finds
  // desc, but we sort defensively.
  const tagList = useMemo(() => {
    return [...rawTags]
      .sort((a, b) => b.finds - a.finds)
      .map((t, i) => ({ ...t, rank: i + 1 }))
  }, [rawTags])

  const [q, setQ] = useState("")
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "finds",
    dir: "desc",
  })

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    let arr = tagList.filter(
      (t) =>
        !s ||
        t.name.toLowerCase().includes(s) ||
        (t.hiddenBy ?? "").toLowerCase().includes(s),
    )
    arr = [...arr].sort((a, b) => {
      const k = sort.key
      const va = (a as Record<string, unknown>)[k]
      const vb = (b as Record<string, unknown>)[k]
      let cmp: number
      if (typeof va === "number" && typeof vb === "number") cmp = va - vb
      else if (va == null && vb == null) cmp = 0
      else if (va == null) cmp = -1
      else if (vb == null) cmp = 1
      else cmp = String(va).localeCompare(String(vb))
      return sort.dir === "asc" ? cmp : -cmp
    })
    return arr
  }, [tagList, q, sort])

  const setSortKey = (k: SortKey) =>
    setSort((s) => ({
      key: k,
      dir: s.key === k && s.dir === "desc" ? "asc" : "desc",
    }))

  const SortTh = ({
    k,
    children,
    num,
  }: {
    k: SortKey
    children: React.ReactNode
    num?: boolean
  }) => (
    <th
      role="button"
      tabIndex={0}
      onClick={() => setSortKey(k)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          setSortKey(k)
        }
      }}
      className={`sortable ${sort.key === k ? "active" : ""}`}
      style={{ textAlign: num ? "right" : "left" }}
      aria-sort={
        sort.key === k ? (sort.dir === "desc" ? "descending" : "ascending") : "none"
      }
    >
      {children}
      <span aria-hidden style={{ marginLeft: 4, opacity: sort.key === k ? 1 : 0.3 }}>
        {sort.key === k ? (sort.dir === "desc" ? "↓" : "↑") : "↕"}
      </span>
    </th>
  )

  // ---- median / top-10% blurb ----
  const finds = tagList.map((t) => t.finds).sort((a, b) => a - b)
  const median = finds.length
    ? finds[Math.floor(finds.length / 2)]
    : 0
  const totalFinds = tagList.reduce((a, t) => a + t.finds, 0)
  const top10pctCount = Math.max(1, Math.floor(tagList.length * 0.1))
  const top10pctFinds = [...tagList]
    .sort((a, b) => b.finds - a.finds)
    .slice(0, top10pctCount)
    .reduce((a, t) => a + t.finds, 0)
  const top10pctShare = totalFinds ? (top10pctFinds / totalFinds) * 100 : 0
  const findValues = tagList.map((t) => t.finds)

  return (
    <section className="report-section" id="tags">
      <div className="report-container">
        <Anchor
          num="03"
          title="TAGS"
          lede={`One row per in-play tag, ${tagList.length} total. Tags were hidden across Cadaval by players and organisers. Sortable and searchable, with a top-10 podium and ranked find-distribution curve framing the spread.`}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 32,
            marginBottom: 28,
          }}
        >
          {/* Top 10 */}
          <div className="report-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 18,
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
                TOP 10 BY FINDS
              </h3>
              <span
                className="font-mono"
                style={{ fontSize: 10, color: "var(--text-muted)" }}
              >
                positions 1–3 · 4–10
              </span>
            </div>
            <Podium tags={tagList} />
            <div style={{ marginTop: 24, display: "grid", gap: 6 }}>
              {tagList.slice(3, 10).map((t, i) => (
                <div
                  key={t.name + (i + 3)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "32px 1fr auto",
                    alignItems: "center",
                    gap: 12,
                    padding: "8px 4px",
                    borderBottom: "1px solid var(--report-border)",
                    fontSize: 13,
                  }}
                >
                  <span
                    className="font-mono"
                    style={{ color: "var(--text-muted)", fontSize: 12 }}
                  >
                    0{i + 4}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.name}
                    </div>
                    <Username name={t.hiddenBy} address={t.hiddenByAddress} />
                  </div>
                  <span
                    className="font-mono"
                    style={{ fontSize: 13, color: "var(--text-primary)" }}
                  >
                    {t.finds}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Distribution curve + organic badge */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="report-card" style={{ flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 18,
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
                  FIND DISTRIBUTION
                </h3>
                <span
                  className="font-mono"
                  style={{ fontSize: 10, color: "var(--text-muted)" }}
                >
                  {tagList.length} tags
                </span>
              </div>
              <ChartFrame
                title="Find distribution ranked curve"
                summary={`Sorted find counts across ${findValues.length} tags. Median ${median}, top decile accumulated ${top10pctShare.toFixed(0)}% of all finds.`}
              >
                <FindRankCurve values={findValues} height={220} />
              </ChartFrame>
              <p
                style={{
                  fontSize: 12.5,
                  color: "var(--text-secondary)",
                  marginTop: 8,
                  lineHeight: 1.55,
                }}
              >
                Each point on the curve is one tag, sorted by finds. The
                dashed reference lines call out the{" "}
                <span style={{ color: "var(--text-primary)" }}>median ({median})</span>,{" "}
                <span style={{ color: "var(--text-primary)" }}>top-quartile</span>, and{" "}
                <span style={{ color: "var(--text-primary)" }}>top-decile</span> thresholds.
                The top 10% of tags accumulated{" "}
                <span style={{ color: "var(--text-primary)" }}>
                  {top10pctShare.toFixed(0)}%
                </span>{" "}
                of all finds — long-tail but not winner-take-all.
              </p>
            </div>
            <div className="report-organic">
              <span className="report-organic__dot" />
              <span>
                <strong style={{ fontWeight: 500 }}>
                  No reward boosts ran during Festival da Juventude — every
                  find here is organic.
                </strong>
                <br />
                <span style={{ color: "rgba(86,211,100,0.7)", fontSize: 12 }}>
                  verified at block #{chain.blockHeight.toLocaleString("en-US")} · multiplier flag = 1.0× across all tags
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Top Hiders + Top Finders mini-cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 18,
            marginBottom: 32,
          }}
        >
          <TopList
            title="TOP HIDERS · MOST POPULAR TAGS"
            rows={topHiders.map((h) => ({
              rank: h.rank,
              label: h.owner,
              address: h.ownerAddress,
              primary: h.finds,
              primaryLabel: "finds",
              secondary: h.tags,
              secondaryLabel: h.tags === 1 ? "tag hidden" : "tags hidden",
            }))}
          />
          <TopList
            title="TOP FINDERS · MOST TAGS FOUND"
            rows={topFinders.map((f) => ({
              rank: f.rank,
              label: f.user,
              address: f.userAddress,
              primary: f.finds,
              primaryLabel: "tags",
              secondary: f.tokens,
              secondaryLabel: "tokens earned",
            }))}
          />
        </div>

        {/* Searchable table */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <h3
            className="font-display"
            style={{ fontSize: 18, margin: 0, letterSpacing: "0.12em" }}
          >
            ALL TAGS
          </h3>
          <div className="report-input-wrap">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              className="report-input"
              placeholder="search tag, hider…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <div
          className="report-card report-card--flush"
          style={{ maxHeight: 540, overflow: "auto" }}
        >
          <table className="report-table">
            <thead>
              <tr>
                <SortTh k="rank">#</SortTh>
                <SortTh k="name">Tag</SortTh>
                <SortTh k="hiddenBy">Hidden by</SortTh>
                <SortTh k="finds" num>
                  Finds
                </SortTh>
                <SortTh k="pct" num>
                  % players
                </SortTh>
                <SortTh k="ttf" num>
                  TTF
                </SortTh>
                <SortTh k="reward" num>
                  Reward
                </SortTh>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={`${t.rank}-${t.id}`}>
                  <td
                    className="num"
                    style={{ textAlign: "left", color: "var(--text-muted)" }}
                  >
                    {t.rank.toString().padStart(2, "0")}
                  </td>
                  <td>
                    <div
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 280,
                      }}
                      title={t.name}
                    >
                      {t.name}
                    </div>
                  </td>
                  <td>
                    <Username name={t.hiddenBy} address={t.hiddenByAddress} />
                  </td>
                  <td className="num">{fmtInt(t.finds)}</td>
                  <td className="num">{t.pct.toFixed(1)}%</td>
                  <td className="num">{fmtSeconds(t.ttf)}</td>
                  <td className="num">{fmtInt(t.reward)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      textAlign: "center",
                      padding: 40,
                      color: "var(--text-muted)",
                    }}
                  >
                    No tags match &quot;{q}&quot;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p
          className="font-mono"
          style={{
            fontSize: 10.5,
            color: "var(--text-muted)",
            marginTop: 12,
            textAlign: "right",
          }}
        >
          Replay-protected on-chain — each player counts once per tag, so Finds = Unique finders.{" "}
          TTF · time to first find from gate-open · Reward · CW per find.
        </p>
      </div>
    </section>
  )
}
