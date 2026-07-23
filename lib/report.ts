// Types for the public post-event report snapshot for the Cadaval edition.
// Runtime payload lives in `data/cadaval2026/report-snapshot.json` and is
// served by `app/api/report/snapshot/route.ts`.
//
// This is the trimmed Cadaval shape: no stages, no polls, no QR. The festival
// (Festival da Juventude) had no exhibitor booths, so the "exhibitors" concept
// from PSCS is replaced by player-owned **tags** plus top hiders & finders.

export type ReportKpis = {
  totalPlayers: number
  pctClaimedReward: number          // 0–100
  totalFinds: number
  tokensDistributed: number
  merchPurchases: number
  totalSocialClaims: number
  tokenHolders: number
  tokenSymbol: string
  tokenName: string
  // Festival-specific: how many distinct event-local days a player was active.
  // returnerCounts[k] = number of players active on exactly k distinct days.
  daysActive: number                // total distinct event days (== EVENT_DAYS.length)
  returnerCounts: Record<string, number>
  // Paymaster sponsorship — every player-facing tx hits EntryPoint via
  // handleOps. We verify each reward/merch/social tx individually.
  paymasterSponsoredTxs: number
  paymasterTotalTxs: number
  paymasterSponsoredPct: number     // 0..100
}

// One row per in-play tag, sorted by find count desc.
export type ReportTag = {
  rank: number
  id: number
  name: string
  hiddenBy: string | null           // player handle who hid the tag
  hiddenByAddress: string | null    // wallet (may be NULL for admin-created tags)
  finds: number
  uniqueFinders: number
  pct: number                       // 0..100, % of all players who found this tag
  ttf: number | null                // seconds, time-to-first-find from gate-open
  reward: number                    // CW reward per tag (whole tokens)
  x: number                         // pct of map width (0..100)
  y: number                         // pct of map height (0..100)
}

export type ReportHistogramBin = { label: string; count: number }

export type ReportHourBucket = {
  h: number                         // 0..(daysActive*24 - 1)
  day: number                       // 0-based event day
  localHour: number                 // 0..23
  finds: number
  merch: number
  social: number
  total: number
}

export type ReportSkuCurvePoint = { t: number; n: number }

export type ReportSku = {
  sku: string
  name: string
  category: string
  minutesToSellout: number | null
  units: number
  stock: number | null
  stockEfficiency: number | null
  unitsPerHour: number | null
  /**
   * Current/last-known unit price (whole tokens). Prices may have changed
   * mid-event; `tokensExchanged` is the authoritative spend per SKU.
   */
  price: number | null
  /**
   * Total tokens (whole, not wei) exchanged across every on-chain
   * `MerchPurchased` event for this SKU. Sum of per-purchase `price`.
   */
  tokensExchanged: number
  soldOut: boolean
  curve: ReportSkuCurvePoint[]
}

export type ReportRankScatterPoint = { rank: number; purchases: number }

export type ReportTopBuyer = { user: string; buys: number }

export type ReportTopHider = {
  rank: number
  owner: string                     // username or short address
  ownerAddress: string
  tags: number                      // # tags this player hid that got >=1 find
  finds: number                     // total finds across their tags
}

export type ReportTopFinder = {
  rank: number
  user: string                      // username or short address
  userAddress: string
  finds: number                     // distinct tags found by this player
  tokens: number                    // CW earned across all reward types
}

export type ReportSocial = { platform: string; claims: number }

export type ReportHotspot = { x: number; y: number; w: number }

export type ReportChain = {
  network: string
  contract: string
  tokenAddress: string
  explorer: string
  snapshotISO: string
  blockHeight: number
  // ERC-4337 paymaster sponsorship proof — every reward/merch/social tx
  // hits this EntryPoint via handleOps, meaning players paid zero gas.
  entryPoint: string
  bundler: string
}

export type Snapshot = {
  kpis: ReportKpis
  tags: ReportTag[]
  findsHistogram: ReportHistogramBin[]
  hourBuckets: ReportHourBucket[]   // length = daysActive * 24
  skus: ReportSku[]
  rankScatter: ReportRankScatterPoint[]
  topMerchBuyers: ReportTopBuyer[]
  topHiders: ReportTopHider[]
  topFinders: ReportTopFinder[]
  socials: ReportSocial[]
  hotspots: { points: ReportHotspot[] }
  hourGrid: number[][]              // daysActive × 24, 0..1 intensity
  hourGridAbs: number[][]           // daysActive × 24, raw tx counts
  eventDays: string[]               // ['YYYY-MM-DD', ...] in Lisbon local
  reportsFiled: number
  chain: ReportChain
}

// ---- formatters shared across the report subtree ----

export const fmtInt = (n: number): string => n.toLocaleString("en-US")

export const fmtPct = (n: number, d = 0): string => `${n.toFixed(d)}%`

/** Format a duration in seconds: <60 -> "47s", <3600 -> "2m 14s", else "1h 23m". */
export function fmtSeconds(s: number | null | undefined): string {
  if (s == null || !Number.isFinite(s)) return "—"
  if (s < 60) return `${Math.round(s)}s`
  if (s < 3600) {
    const m = Math.floor(s / 60)
    const r = Math.round(s % 60)
    return `${m}m ${r.toString().padStart(2, "0")}s`
  }
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return `${h}h ${m.toString().padStart(2, "0")}m`
}

export function fmtHour(decimalHour: number): string {
  const hh = Math.floor(decimalHour)
  const mm = Math.round((decimalHour - hh) * 60)
  return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`
}

export function fmtShortAddress(addr: string): string {
  if (addr.length < 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

/** Format minutes for the SKU bar right-column label. */
export function fmtMinutes(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min)) return "—"
  if (min < 60) return `${Math.round(min)}m`
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${h}h ${m}m`
}

/**
 * Read the snapshot JSON server-side. Cached by Next.js because the only
 * caller is the API route — which sets `Cache-Control: s-maxage=86400`.
 */
export async function readSnapshot(): Promise<Snapshot> {
  const fs = await import("node:fs/promises")
  const path = await import("node:path")
  const file = path.join(process.cwd(), "data", "cadaval2026", "report-snapshot.json")
  const raw = await fs.readFile(file, "utf-8")
  return JSON.parse(raw) as Snapshot
}
