"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Database,
  Server,
  Cpu,
  Wallet,
  Globe,
  Zap,
  ShieldCheck,
  Users,
  Coins,
  Sparkles,
  ExternalLink,
  ArrowDownToLine,
  Info,
  Clock,
  GitBranch,
  KeyRound,
  Radar,
  MapPinOff,
} from "lucide-react"

interface EnvFlag { key: string; set: boolean }

interface HealthData {
  timestamp: number
  rpc: {
    url: string
    chainId: number | null
    chainIdLatencyMs: number
    chainIdError: string | null
    blockNumber: number | null
    blockNumberLatencyMs: number
    blockNumberError: string | null
    gasPriceWei: string | null
    gasPriceLatencyMs: number
    latestBlock: { number: number; timestamp: number; ageSec: number } | null
  }
  bundler: {
    url: string
    chainId: number | null
    chainIdLatencyMs: number
    chainIdError: string | null
    supportedEntryPoints: string[] | null
    entryPointsLatencyMs: number
    entryPointsError: string | null
    configuredEntryPoint: string
    entryPointMatches: boolean
  }
  wallets: {
    backend: { address: string; balanceEth: string; balanceWei: string } | null
    signer: { address: string; note: string } | null
  }
  contract: {
    address: string
    deployBlock: number
    name: string | null
    symbol: string | null
    totalSupply: string | null
    onchainSigner: string | null
    onchainOwner: string | null
    signerMatchesEnv: boolean | null
    ownerMatchesBackend: boolean | null
    error: string | null
  } | null
  db: {
    ok: boolean
    latencyMs: number
    error: string | null
    projectRef: string | null
    host: string | null
    counts: {
      playersTotal: number | null
      playersUnique: number | null
      tagsTotal: number | null
      tagsHidden: number | null
      tagFindsLastHour: number | null
    }
    cron: { lastSyncedAt: string | null; ageSec: number | null; lastBlockNumber: number | null } | null
  }
  explorer: {
    ok: boolean
    error: string | null
    holders: number | null
    transfers: number | null
    recentTxTotal: number
    recentTxFailed: number
    recentTxFailedSamples: { hash: string; method: string | null; from: string | null; result: string | null }[]
    sampleWindowSec: number
  }
  tagHealth: {
    ok: boolean
    error: string | null
    inPlay: number
    medianFinds: number
    totalFinds: number
    findsLastHour: number
    peerCoverageLastHour: number
    flaggedCount: number
    quietPeriod: boolean
    flagged: {
      id: number
      name: string | null
      claimCode: string
      findCount: number
      lastFoundAt: string | null
      lastFoundAgoSec: number | null
      locationX: number | null
      locationY: number | null
      reasons: ("never_found" | "stale" | "under_performing")[]
      detail: string
    }[]
  }
  env: {
    required: EnvFlag[]
    optional: EnvFlag[]
  }
  vercel: {
    env: string | null
    productionUrl: string | null
    deploymentUrl: string | null
    commitSha: string | null
    commitRef: string | null
    commitMessage: string | null
    repoOwner: string | null
    repoSlug: string | null
    apiConfigured: boolean
    deployFetchError: string | null
    runtimeLogsNote: string
    lastProductionDeploy: {
      state: string | null
      target: string | null
      url: string | null
      createdAt: number | null
      ageSec: number | null
      errorMessage: string | null
      inspectorUrl: string | null
    } | null
  }
}

const BACKEND_LOW_ETH = 0.05
// Block-freshness is informational only — the chain is event-driven and idle for
// long stretches; never feeds into the overall-status hero.
const BLOCK_INFO_WARN_SEC = 30 * 60

const PRIMARY = "#9FD356"

// ---------- Small primitives ----------

function StatusDot({ tone }: { tone: "ok" | "warn" | "bad" | "muted" }) {
  const cls =
    tone === "ok"
      ? "bg-[#9FD356] shadow-[0_0_8px_rgba(159,211,86,0.55)]"
      : tone === "warn"
        ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.45)]"
        : tone === "bad"
          ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
          : "bg-zinc-500"
  return <span className={`inline-block w-2 h-2 rounded-full ${cls}`} aria-hidden />
}

function LatencyBadge({ ms, error }: { ms: number; error?: string | null }) {
  if (error) {
    return (
      <Badge variant="outline" className="border-red-700 text-red-300 bg-red-950/40 font-mono text-[10px] px-1.5 py-0">
        err
      </Badge>
    )
  }
  const tone = ms < 250 ? "text-emerald-300 border-emerald-800/60 bg-emerald-950/30"
    : ms < 1000 ? "text-amber-300 border-amber-800/60 bg-amber-950/30"
      : "text-red-300 border-red-800/60 bg-red-950/30"
  return (
    <Badge variant="outline" className={`font-mono text-[10px] px-1.5 py-0 ${tone}`}>
      {ms}ms
    </Badge>
  )
}

function SectionCard({
  title,
  icon: Icon,
  status,
  badge,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  status: "ok" | "warn" | "bad" | "muted"
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card className="bg-[#1f1f1f]/80 border-[#3a3a3a] p-0 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#3a3a3a] bg-gradient-to-b from-[#262626] to-[#1f1f1f]">
        <div className="flex items-center gap-2.5">
          <Icon className="w-4 h-4 text-zinc-400" />
          <h3 className="text-[13px] font-semibold tracking-wide uppercase text-zinc-200">{title}</h3>
          <StatusDot tone={status} />
        </div>
        {badge}
      </div>
      <div className="px-5 py-4 space-y-2">{children}</div>
    </Card>
  )
}

function Field({
  label,
  value,
  tone = "ok",
  hint,
}: {
  label: string
  value: React.ReactNode
  tone?: "ok" | "warn" | "bad" | "muted"
  hint?: string
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 items-start py-1.5 first:pt-0 last:pb-0 border-b border-[#2c2c2c] last:border-0">
      <div className="flex items-center gap-2 text-[12px] text-zinc-400">
        <StatusDot tone={tone} />
        <span>{label}</span>
        {hint ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3 h-3 text-zinc-500 cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{hint}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <div className="text-[12.5px] text-zinc-100 font-mono break-all">{value}</div>
    </div>
  )
}

function KpiTile({
  icon: Icon,
  label,
  value,
  sub,
  tone = "neutral",
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  tone?: "neutral" | "good" | "warn" | "bad"
  loading?: boolean
}) {
  const accent =
    tone === "good"
      ? "from-[#9FD356]/15 to-transparent border-[#9FD356]/40"
      : tone === "warn"
        ? "from-amber-500/15 to-transparent border-amber-500/40"
        : tone === "bad"
          ? "from-red-500/15 to-transparent border-red-500/40"
          : "from-white/5 to-transparent border-[#3a3a3a]"
  const iconTone =
    tone === "good" ? "text-[#9FD356]"
      : tone === "warn" ? "text-amber-400"
        : tone === "bad" ? "text-red-400"
          : "text-zinc-400"
  return (
    <Card className={`relative overflow-hidden border bg-gradient-to-br ${accent} bg-[#1f1f1f]/80 p-4 transition-colors hover:bg-[#242424]/80`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-medium">{label}</span>
        <Icon className={`w-4 h-4 ${iconTone}`} />
      </div>
      {loading ? (
        <Skeleton className="h-7 w-20 bg-zinc-800/70" />
      ) : (
        <div className="text-2xl font-semibold text-white tabular-nums tracking-tight">{value}</div>
      )}
      {sub ? <div className="text-[11px] text-zinc-500 mt-1">{sub}</div> : null}
    </Card>
  )
}

function shortAddr(a: string | null | undefined) {
  if (!a) return "—"
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

function fmtAge(seconds: number | null | undefined) {
  if (seconds == null) return "—"
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—"
  return n.toLocaleString()
}

function fmtTokenSupply(raw: string | null, decimals = 18): string {
  if (!raw) return "—"
  try {
    const big = BigInt(raw)
    let div = BigInt(1)
    for (let i = 0; i < decimals; i++) div *= BigInt(10)
    const whole = big / div
    return whole.toLocaleString()
  } catch {
    return raw
  }
}

// ---------- Main component ----------

export default function HealthTab() {
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)

  const fetchHealth = useCallback(async (background = false) => {
    try {
      if (!background) setRefreshing(true)
      setError(null)
      const res = await fetch("/api/admin/health", { credentials: "include", cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as HealthData
      setData(json)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchHealth() }, [fetchHealth])
  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(() => fetchHealth(true), 30_000)
    return () => clearInterval(id)
  }, [autoRefresh, fetchHealth])

  const status = useMemo(() => {
    if (!data) return null
    const rpcOk = data.rpc.chainId != null && data.rpc.blockNumber != null
    const bundlerOk = data.bundler.chainId != null && data.bundler.entryPointMatches
    const backendBal = data.wallets.backend ? Number.parseFloat(data.wallets.backend.balanceEth) : 0
    const backendOk = data.wallets.backend != null && backendBal >= BACKEND_LOW_ETH
    const dbOk = data.db.ok
    const contractOk =
      data.contract != null &&
      !data.contract.error &&
      (data.contract.signerMatchesEnv ?? true)
    const explorerOk = data.explorer.ok
    const noReverts = data.explorer.recentTxFailed === 0
    const envRequiredOk = data.env.required.every((e) => e.set)

    const checks = { rpcOk, bundlerOk, backendOk, dbOk, contractOk, explorerOk, noReverts, envRequiredOk }
    const allOk = Object.values(checks).every(Boolean)
    return { ...checks, allOk }
  }, [data])

  // ---------- Skeleton state ----------
  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full bg-zinc-800/70 rounded-lg" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 bg-zinc-800/70 rounded-lg" />
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 bg-zinc-800/70 rounded-lg" />
          ))}
        </div>
        <div className="flex items-center gap-2 text-zinc-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading health…
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <Card className="bg-[#2a1a1a] border-red-700 p-6">
        <div className="flex items-center gap-2 text-red-400">
          <AlertTriangle className="w-5 h-5" />
          Failed to load: {error}
        </div>
        <Button onClick={() => fetchHealth()} className="mt-4" variant="outline">Retry</Button>
      </Card>
    )
  }

  if (!data || !status) return null

  const blockAge = data.rpc.latestBlock?.ageSec ?? null
  const blockTone: "ok" | "warn" | "muted" =
    blockAge == null ? "muted" : blockAge < BLOCK_INFO_WARN_SEC ? "ok" : "warn"

  const gasGwei = data.rpc.gasPriceWei
    ? (Number.parseInt(data.rpc.gasPriceWei, 16) / 1e9).toFixed(3)
    : null

  const backendBal = data.wallets.backend ? Number.parseFloat(data.wallets.backend.balanceEth) : 0
  const backendTone = backendBal >= BACKEND_LOW_ETH ? "good" : "warn"

  const failedTone = data.explorer.recentTxFailed === 0 ? "good" : "bad"

  const vercelLogsUrl = (() => {
    const v = data.vercel
    if (v.repoOwner && v.repoSlug) {
      return `https://vercel.com/${v.repoOwner}/${v.repoSlug}/logs`
    }
    return null
  })()

  return (
    <TooltipProvider>
      <div className="space-y-5">
        {/* ===== Hero status ===== */}
        <Card
          className={`relative overflow-hidden border p-5 ${
            status.allOk
              ? "bg-gradient-to-br from-[#162a14] via-[#1a2a18] to-[#1f1f1f] border-[#9FD356]/40"
              : "bg-gradient-to-br from-[#2a1414] via-[#2a1818] to-[#1f1f1f] border-red-800/60"
          }`}
        >
          <div
            className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full blur-3xl opacity-30"
            style={{ background: status.allOk ? PRIMARY : "#ef4444" }}
          />
          <div className="relative flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div
                className={`flex items-center justify-center w-12 h-12 rounded-full ring-1 ${
                  status.allOk ? "bg-[#9FD356]/15 ring-[#9FD356]/40" : "bg-red-500/15 ring-red-500/40"
                }`}
              >
                {status.allOk
                  ? <CheckCircle2 className="w-6 h-6 text-[#9FD356]" />
                  : <AlertTriangle className="w-6 h-6 text-red-400" />}
              </div>
              <div>
                <div className="text-white font-semibold text-base leading-tight">
                  {status.allOk ? "All systems operational" : "Issues detected"}
                </div>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-400">
                  <Clock className="w-3 h-3" />
                  Updated {new Date(data.timestamp).toLocaleTimeString()}
                  <span className="text-zinc-600">·</span>
                  <span className="font-mono">chain {data.rpc.chainId ?? "—"}</span>
                  {data.vercel.env ? (
                    <>
                      <span className="text-zinc-600">·</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-[#3a3a3a] text-zinc-300">
                        {data.vercel.env}
                      </Badge>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh((v) => !v)}
                className={`cursor-pointer transition-colors ${
                  autoRefresh ? "bg-[#9FD356] text-black hover:bg-[#8bc944] border-[#9FD356]" : ""
                }`}
              >
                <Activity className="w-3.5 h-3.5 mr-1.5" />
                {autoRefresh ? "Auto-refresh on" : "Auto-refresh"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchHealth()}
                disabled={refreshing}
                className="cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Summary chips */}
          <div className="relative mt-4 flex flex-wrap gap-2">
            <SummaryChip ok={status.rpcOk} label="RPC" />
            <SummaryChip ok={status.bundlerOk} label="Bundler" />
            <SummaryChip ok={status.contractOk} label="Contract" />
            <SummaryChip ok={status.dbOk} label="Database" />
            <SummaryChip ok={status.explorerOk} label="Explorer" />
            <SummaryChip ok={status.backendOk} label="Backend ETH" />
            <SummaryChip ok={status.noReverts} label="No reverts (1h)" />
            <SummaryChip ok={status.envRequiredOk} label="Env vars" />
          </div>
        </Card>

        {/* ===== KPI Tiles ===== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile
            icon={Users}
            label="Players"
            value={fmtNum(data.db.counts.playersUnique)}
            sub={`${fmtNum(data.db.counts.playersTotal)} picked a name`}
            tone="neutral"
          />
          <KpiTile
            icon={Coins}
            label="Token holders"
            value={fmtNum(data.explorer.holders)}
            sub={data.contract?.symbol ? `${data.contract.symbol} on chain` : "via Blockscout"}
            tone="neutral"
          />
          <KpiTile
            icon={Sparkles}
            label="Tag finds (1h)"
            value={
              <span className="tabular-nums">
                {fmtNum(data.db.counts.tagFindsLastHour ?? 0)}
              </span>
            }
            sub="on-chain finds"
            tone="good"
          />
          <KpiTile
            icon={ArrowDownToLine}
            label="Reverted txs (1h)"
            value={fmtNum(data.explorer.recentTxFailed)}
            sub={`of ${fmtNum(data.explorer.recentTxTotal)} to contract`}
            tone={failedTone}
          />
          <KpiTile
            icon={Wallet}
            label="Backend ETH"
            value={data.wallets.backend ? Number.parseFloat(data.wallets.backend.balanceEth).toFixed(4) : "—"}
            sub={`min ${BACKEND_LOW_ETH} ETH`}
            tone={backendTone}
          />
          <KpiTile
            icon={Zap}
            label="Gas price"
            value={gasGwei != null ? `${gasGwei}` : "—"}
            sub="gwei"
            tone="neutral"
          />
          <KpiTile
            icon={Clock}
            label="Latest block"
            value={data.rpc.blockNumber != null ? `#${data.rpc.blockNumber.toLocaleString()}` : "—"}
            sub={
              <span className="flex items-center gap-1">
                <Info className="w-3 h-3" />
                {fmtAge(blockAge)} <span className="text-zinc-600">(idle ok)</span>
              </span>
            }
            tone={blockTone === "warn" ? "warn" : "neutral"}
          />
          <KpiTile
            icon={Radar}
            label="Tag alerts"
            value={
              data.tagHealth.quietPeriod
                ? <span className="text-zinc-500">—</span>
                : fmtNum(data.tagHealth.flaggedCount)
            }
            sub={
              data.tagHealth.quietPeriod
                ? `cohort too quiet (median ${data.tagHealth.medianFinds})`
                : `${data.tagHealth.inPlay} in play · ${data.tagHealth.peerCoverageLastHour}% found in 1h`
            }
            tone={
              data.tagHealth.quietPeriod ? "neutral"
                : data.tagHealth.flaggedCount === 0 ? "good"
                  : data.tagHealth.flaggedCount > 5 ? "bad"
                    : "warn"
            }
          />
        </div>

        {/* ===== Diagnostic grid ===== */}
        <div className="grid lg:grid-cols-2 gap-3">
          {/* RPC */}
          <SectionCard
            title="RPC"
            icon={Server}
            status={status.rpcOk ? "ok" : "bad"}
            badge={<LatencyBadge ms={data.rpc.chainIdLatencyMs} error={data.rpc.chainIdError} />}
          >
            <Field label="URL" value={<span className="text-zinc-400">{data.rpc.url || "—"}</span>} tone="muted" />
            <Field
              label="Chain ID"
              tone={data.rpc.chainId != null ? "ok" : "bad"}
              value={data.rpc.chainId != null ? data.rpc.chainId : `error: ${data.rpc.chainIdError}`}
            />
            <Field
              label="Block #"
              tone={data.rpc.blockNumber != null ? "ok" : "bad"}
              value={
                data.rpc.blockNumber != null
                  ? <span>#{data.rpc.blockNumber.toLocaleString()} <LatencyBadge ms={data.rpc.blockNumberLatencyMs} /></span>
                  : `error: ${data.rpc.blockNumberError}`
              }
            />
            <Field
              label="Block age"
              tone={blockTone}
              hint="This chain only mines blocks when there's activity. Going several minutes between blocks is expected — never treated as a failure."
              value={
                <span className="flex items-center gap-1.5 text-zinc-300">
                  {fmtAge(blockAge)}
                  <Badge variant="outline" className="border-[#3a3a3a] text-zinc-500 text-[10px] px-1.5 py-0">info</Badge>
                </span>
              }
            />
            <Field
              label="Gas price"
              tone={data.rpc.gasPriceWei != null ? "ok" : "bad"}
              value={
                data.rpc.gasPriceWei
                  ? <span>{gasGwei} gwei <span className="text-zinc-500">({Number.parseInt(data.rpc.gasPriceWei, 16)} wei)</span></span>
                  : "unknown"
              }
            />
          </SectionCard>

          {/* Bundler */}
          <SectionCard
            title="Bundler (ERC-4337)"
            icon={Cpu}
            status={status.bundlerOk ? "ok" : "bad"}
            badge={<LatencyBadge ms={data.bundler.chainIdLatencyMs} error={data.bundler.chainIdError} />}
          >
            <Field label="URL" tone="muted" value={<span className="text-zinc-400">{data.bundler.url || "—"}</span>} />
            <Field
              label="Chain ID"
              tone={data.bundler.chainId != null ? "ok" : "bad"}
              value={data.bundler.chainId ?? `error: ${data.bundler.chainIdError}`}
            />
            <Field
              label="EntryPoint"
              tone={data.bundler.entryPointMatches ? "ok" : "bad"}
              value={
                <span>
                  {shortAddr(data.bundler.configuredEntryPoint)}{" "}
                  {data.bundler.entryPointMatches
                    ? <Badge variant="outline" className="border-emerald-800/60 text-emerald-300 bg-emerald-950/30 text-[10px] px-1.5 py-0">supported</Badge>
                    : <Badge variant="outline" className="border-red-800/60 text-red-300 bg-red-950/30 text-[10px] px-1.5 py-0">unsupported</Badge>}
                </span>
              }
            />
            <Field
              label="Supported"
              tone={(data.bundler.supportedEntryPoints?.length ?? 0) > 0 ? "ok" : "bad"}
              value={
                data.bundler.supportedEntryPoints
                  ? `${data.bundler.supportedEntryPoints.length} entrypoint(s)`
                  : `error: ${data.bundler.entryPointsError}`
              }
            />
          </SectionCard>

          {/* Contract */}
          <SectionCard
            title="Active contract"
            icon={ShieldCheck}
            status={status.contractOk ? "ok" : "bad"}
            badge={
              data.contract?.address && data.vercel ? (
                <a
                  href={`${process.env.NEXT_PUBLIC_EXPLORER_URL || ""}/address/${data.contract.address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-zinc-400 hover:text-[#9FD356] inline-flex items-center gap-1"
                >
                  explorer <ExternalLink className="w-3 h-3" />
                </a>
              ) : null
            }
          >
            {data.contract ? (
              <>
                <Field
                  label="Address"
                  value={
                    <span>
                      {shortAddr(data.contract.address)}{" "}
                      <span className="text-zinc-500">block #{data.contract.deployBlock.toLocaleString()}</span>
                    </span>
                  }
                />
                <Field
                  label="Token"
                  tone={data.contract.name ? "ok" : "warn"}
                  value={data.contract.name ? `${data.contract.name} (${data.contract.symbol})` : "name unavailable"}
                />
                <Field
                  label="Total supply"
                  value={
                    <span>
                      {fmtTokenSupply(data.contract.totalSupply)}{" "}
                      <span className="text-zinc-500">{data.contract.symbol ?? ""}</span>
                    </span>
                  }
                />
                <Field
                  label="On-chain signer"
                  tone={data.contract.signerMatchesEnv === false ? "bad" : data.contract.onchainSigner ? "ok" : "muted"}
                  hint="Must match SIGNER_PRIVATE_KEY-derived address. A mismatch means reward signatures will be rejected on-chain."
                  value={
                    <span>
                      {shortAddr(data.contract.onchainSigner)}{" "}
                      {data.contract.signerMatchesEnv === true
                        ? <Badge variant="outline" className="border-emerald-800/60 text-emerald-300 bg-emerald-950/30 text-[10px] px-1.5 py-0">matches env</Badge>
                        : data.contract.signerMatchesEnv === false
                          ? <Badge variant="outline" className="border-red-800/60 text-red-300 bg-red-950/30 text-[10px] px-1.5 py-0">MISMATCH</Badge>
                          : null}
                    </span>
                  }
                />
                <Field
                  label="On-chain owner"
                  tone={data.contract.ownerMatchesBackend === false ? "warn" : "ok"}
                  hint="Should match BACKEND_PRIVATE_KEY (the deployer). Mismatch is fine if ownership was transferred — just verify intentional."
                  value={
                    <span>
                      {shortAddr(data.contract.onchainOwner)}{" "}
                      {data.contract.ownerMatchesBackend === false
                        ? <Badge variant="outline" className="border-amber-800/60 text-amber-300 bg-amber-950/30 text-[10px] px-1.5 py-0">≠ backend</Badge>
                        : null}
                    </span>
                  }
                />
                {data.contract.error ? (
                  <Field label="Read error" tone="bad" value={<span className="text-red-300">{data.contract.error}</span>} />
                ) : null}
              </>
            ) : (
              <div className="text-sm text-zinc-500">No active contract resolved.</div>
            )}
          </SectionCard>

          {/* Database */}
          <SectionCard
            title="Database (Neon)"
            icon={Database}
            status={status.dbOk ? "ok" : "bad"}
            badge={
              <div className="flex items-center gap-2">
                {data.db.projectRef ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 border-[#3a3a3a] text-zinc-300 cursor-help">
                        {data.db.projectRef}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      Neon endpoint from <span className="font-mono">DATABASE_URL</span>: <span className="font-mono">{data.db.host}</span>. If your row exists in a different database (localhost dev, prior edition), counts here won&apos;t reflect it.
                    </TooltipContent>
                  </Tooltip>
                ) : null}
                <LatencyBadge ms={data.db.latencyMs} error={data.db.error} />
              </div>
            }
          >
            {data.db.ok ? (
              <>
                <Field
                  label="Project"
                  tone="muted"
                  hint="Which Neon database this deployment is talking to. A wallet only lands in this database's treasure_hunt_users once it picks a username, so if you set a username elsewhere (localhost, previous edition), it won't be counted here."
                  value={data.db.host ? <span className="text-zinc-300">{data.db.host}</span> : <span className="text-zinc-500">DATABASE_URL not set</span>}
                />
                <Field
                  label="Players (named)"
                  tone="ok"
                  hint="treasure_hunt_users count = wallets that picked a username. Usernames are optional (required only to view the leaderboard), so this UNDERcounts participants. For the true ever-played figure use '↳ have claimed' below, which counts distinct wallets with at least one on-chain reward."
                  value={
                    <span>
                      <span className="text-zinc-100 text-base font-semibold">{fmtNum(data.db.counts.playersTotal)}</span>{" "}
                      <span className="text-zinc-500">distinct wallets</span>
                    </span>
                  }
                />
                <Field
                  label="↳ have claimed"
                  tone="muted"
                  hint="Distinct addresses with a row in leaderboard_cache (categories found/social) — anyone who actually claimed a reward on-chain."
                  value={
                    <span>
                      <span className="text-zinc-300">{fmtNum(data.db.counts.playersUnique)}</span>{" "}
                      <span className="text-zinc-500">claimed ≥1 reward</span>
                    </span>
                  }
                />
                <Field
                  label="NFC tags"
                  value={
                    <span>
                      {fmtNum(data.db.counts.tagsTotal)}{" "}
                      <span className="text-zinc-500">({fmtNum(data.db.counts.tagsHidden)} live)</span>
                    </span>
                  }
                />
                <Field
                  label="Activity 1h"
                  tone="ok"
                  value={
                    <span>
                      {fmtNum(data.db.counts.tagFindsLastHour)} tag finds
                    </span>
                  }
                />
                <Field
                  label="Cron sync"
                  tone={
                    data.db.cron == null
                      ? "muted"
                      : (data.db.cron.ageSec ?? 0) > 60 * 60 * 26
                        ? "warn"
                        : "ok"
                  }
                  hint="Vercel cron syncs the leaderboard daily; older than ~26h is suspicious."
                  value={
                    data.db.cron
                      ? <span>{fmtAge(data.db.cron.ageSec)} <span className="text-zinc-500">@ block #{data.db.cron.lastBlockNumber?.toLocaleString()}</span></span>
                      : "no record"
                  }
                />
              </>
            ) : (
              <Field label="Connection" tone="bad" value={<span className="text-red-300">{data.db.error}</span>} />
            )}
          </SectionCard>

          {/* Tag health — missing / under-performing tags */}
          <SectionCard
            title="Tag health"
            icon={Radar}
            status={
              !data.tagHealth.ok ? "bad"
                : data.tagHealth.quietPeriod ? "muted"
                  : data.tagHealth.flaggedCount === 0 ? "ok"
                    : data.tagHealth.flaggedCount > 5 ? "bad"
                      : "warn"
            }
            badge={
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-[#3a3a3a] text-zinc-300">
                {data.tagHealth.inPlay} in play
              </Badge>
            }
          >
            {!data.tagHealth.ok ? (
              <Field label="Tag health" tone="bad" value={<span className="text-red-300">{data.tagHealth.error}</span>} />
            ) : data.tagHealth.quietPeriod ? (
              <div className="text-[12px] text-zinc-500 leading-relaxed">
                Cohort signal too thin to draw conclusions yet — median tag has{" "}
                <span className="text-zinc-300">{data.tagHealth.medianFinds}</span> finds and only{" "}
                <span className="text-zinc-300">{data.tagHealth.peerCoverageLastHour}%</span> of tags got found in the last hour.
                Alerts will activate once the median crosses 3 finds or peer coverage exceeds 30%.
              </div>
            ) : (
              <>
                <Field
                  label="Cohort"
                  tone="muted"
                  hint="Median 'find_count' across in-play tags. We compare every tag against this number to spot ones lagging behind."
                  value={
                    <span>
                      median <span className="text-zinc-100">{data.tagHealth.medianFinds}</span> finds ·{" "}
                      <span className="text-zinc-100">{data.tagHealth.totalFinds}</span> total
                    </span>
                  }
                />
                <Field
                  label="Peer coverage 1h"
                  tone={data.tagHealth.peerCoverageLastHour >= 30 ? "ok" : "muted"}
                  hint="Share of in-play tags that got at least one find in the last hour. When this is high but a specific tag is silent, that tag is suspicious."
                  value={
                    <span>
                      <span className="text-zinc-100">{data.tagHealth.peerCoverageLastHour}%</span>{" "}
                      <span className="text-zinc-500">({fmtNum(data.tagHealth.findsLastHour)} finds)</span>
                    </span>
                  }
                />
                <Field
                  label="Flagged"
                  tone={data.tagHealth.flaggedCount === 0 ? "ok" : data.tagHealth.flaggedCount > 5 ? "bad" : "warn"}
                  value={
                    data.tagHealth.flaggedCount === 0
                      ? <span className="text-zinc-300">all tags performing within range</span>
                      : <span><span className="text-zinc-100">{data.tagHealth.flaggedCount}</span> tag(s) need attention</span>
                  }
                />

                {data.tagHealth.flagged.length > 0 ? (
                  <>
                    <Separator className="my-2 bg-[#2c2c2c]" />
                    <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1.5 flex items-center gap-2">
                      <MapPinOff className="w-3 h-3" />
                      Suspect tags
                    </div>
                    <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                      {data.tagHealth.flagged.map((t) => {
                        const reason = t.reasons[0]
                        const tone =
                          reason === "never_found" ? "border-red-800/60 text-red-300 bg-red-950/30"
                            : reason === "stale" ? "border-amber-800/60 text-amber-300 bg-amber-950/30"
                              : "border-zinc-700 text-zinc-300 bg-zinc-900/60"
                        const reasonLabel =
                          reason === "never_found" ? "never found"
                            : reason === "stale" ? "stale"
                              : "low finds"
                        return (
                          <a
                            key={t.id}
                            href={`/tag/${t.claimCode}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-[#1a1a1a] hover:bg-[#222] border border-[#2c2c2c] transition-colors group"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 text-[12px] text-zinc-100 truncate">
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${tone}`}>{reasonLabel}</Badge>
                                <span className="font-medium truncate">{t.name || <span className="text-zinc-500 italic">unnamed</span>}</span>
                                <span className="text-zinc-500 text-[11px] tabular-nums shrink-0">
                                  · {t.findCount} finds
                                </span>
                              </div>
                              <div className="text-[11px] text-zinc-500 mt-0.5 truncate">
                                {t.detail}
                                {t.locationX != null && t.locationY != null
                                  ? <span className="ml-2 text-zinc-600 font-mono">[{t.locationX.toFixed(0)},{t.locationY.toFixed(0)}]</span>
                                  : null}
                              </div>
                            </div>
                            <ExternalLink className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 shrink-0" />
                          </a>
                        )
                      })}
                    </div>
                  </>
                ) : null}
              </>
            )}
          </SectionCard>

          {/* Explorer + reverts */}
          <SectionCard
            title="Explorer & recent activity"
            icon={Globe}
            status={status.explorerOk && status.noReverts ? "ok" : status.explorerOk ? "warn" : "bad"}
          >
            {data.explorer.ok ? (
              <>
                <Field
                  label="Window"
                  tone="muted"
                  value={`last ${Math.round(data.explorer.sampleWindowSec / 60)} min · ${fmtNum(data.explorer.recentTxTotal)} tx to contract`}
                />
                <Field
                  label="Reverted"
                  tone={data.explorer.recentTxFailed === 0 ? "ok" : "bad"}
                  hint="Counts user-initiated transactions to the contract that ended in 'Reverted' status. Spikes here often mean replay or invalid-signature claim attempts."
                  value={
                    <span>
                      {fmtNum(data.explorer.recentTxFailed)}{" "}
                      {data.explorer.recentTxFailed === 0
                        ? <Badge variant="outline" className="border-emerald-800/60 text-emerald-300 bg-emerald-950/30 text-[10px] px-1.5 py-0">clean</Badge>
                        : <Badge variant="outline" className="border-red-800/60 text-red-300 bg-red-950/30 text-[10px] px-1.5 py-0">attention</Badge>}
                    </span>
                  }
                />
                <Field label="Holders" value={fmtNum(data.explorer.holders)} />
                {data.explorer.recentTxFailedSamples.length > 0 ? (
                  <>
                    <Separator className="my-2 bg-[#2c2c2c]" />
                    <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1.5">Recent reverts</div>
                    <div className="space-y-1">
                      {data.explorer.recentTxFailedSamples.map((s) => (
                        <a
                          key={s.hash}
                          href={`${process.env.NEXT_PUBLIC_EXPLORER_URL || ""}/tx/${s.hash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-red-950/20 hover:bg-red-950/40 transition-colors group"
                        >
                          <span className="font-mono text-[11px] text-zinc-300 truncate">
                            {s.method ?? "tx"} · {shortAddr(s.from)}
                          </span>
                          <span className="flex items-center gap-1.5 text-[11px] text-red-300 truncate">
                            <span className="font-mono">{s.hash.slice(0, 10)}…</span>
                            <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                          </span>
                        </a>
                      ))}
                    </div>
                  </>
                ) : null}
              </>
            ) : (
              <Field label="Connection" tone="bad" value={<span className="text-red-300">{data.explorer.error}</span>} />
            )}
          </SectionCard>

          {/* Server wallets */}
          <SectionCard
            title="Server wallets"
            icon={Wallet}
            status={status.backendOk ? "ok" : "warn"}
          >
            {data.wallets.backend ? (
              <>
                <Field label="Backend (deployer)" value={data.wallets.backend.address} />
                <Field
                  label="ETH balance"
                  tone={status.backendOk ? "ok" : "warn"}
                  hint="Backend deployer only needs gas when admin deploys a new contract. Top up before deployment."
                  value={
                    <span className={status.backendOk ? "" : "text-amber-300"}>
                      {Number.parseFloat(data.wallets.backend.balanceEth).toFixed(6)} ETH
                      {!status.backendOk && ` (low — fund above ${BACKEND_LOW_ETH})`}
                    </span>
                  }
                />
              </>
            ) : (
              <Field label="Backend deployer" tone="bad" value="not configured" />
            )}
            {data.wallets.signer ? (
              <>
                <Field label="Reward signer" value={data.wallets.signer.address} />
                <div className="text-[11px] text-zinc-500 leading-relaxed pt-1">
                  Off-chain only — signs EIP-191 attestations validated by the contract.
                </div>
              </>
            ) : (
              <Field label="Reward signer" tone="bad" value="not configured" />
            )}
          </SectionCard>

          {/* Env vars */}
          <SectionCard
            title="Environment"
            icon={KeyRound}
            status={status.envRequiredOk ? "ok" : "bad"}
            badge={
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-[#3a3a3a] text-zinc-300">
                {data.env.required.filter(e => e.set).length}/{data.env.required.length} set
              </Badge>
            }
          >
            <EnvGrid title="Required" items={data.env.required} requireAll />
            <Separator className="my-2 bg-[#2c2c2c]" />
            <EnvGrid title="Optional" items={data.env.optional} />
          </SectionCard>

          {/* Deployment / Vercel */}
          <SectionCard
            title="Deployment"
            icon={GitBranch}
            status={
              data.vercel.lastProductionDeploy?.state === "ERROR"
                ? "bad"
                : data.vercel.lastProductionDeploy?.state === "READY"
                  ? "ok"
                  : data.vercel.commitSha ? "ok" : "muted"
            }
            badge={
              vercelLogsUrl ? (
                <a
                  href={vercelLogsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-zinc-400 hover:text-[#9FD356] inline-flex items-center gap-1"
                >
                  Vercel logs <ExternalLink className="w-3 h-3" />
                </a>
              ) : null
            }
          >
            <Field
              label="Environment"
              tone="muted"
              value={data.vercel.env ? <Badge variant="outline" className="border-[#3a3a3a] text-[10px] px-1.5 py-0">{data.vercel.env}</Badge> : "local / unknown"}
            />
            <Field
              label="Branch"
              value={data.vercel.commitRef || <span className="text-zinc-500">—</span>}
            />
            <Field
              label="Commit"
              value={
                data.vercel.commitSha ? (
                  <span className="text-zinc-300">
                    {data.vercel.commitSha.slice(0, 7)}{" "}
                    {data.vercel.commitMessage ? <span className="text-zinc-500">— {data.vercel.commitMessage.slice(0, 60)}{data.vercel.commitMessage.length > 60 ? "…" : ""}</span> : null}
                  </span>
                ) : (
                  <span className="text-zinc-500">—</span>
                )
              }
            />
            <Field
              label="URL"
              value={
                data.vercel.productionUrl
                  ? <a href={`https://${data.vercel.productionUrl}`} target="_blank" rel="noreferrer" className="text-[#9FD356] hover:underline inline-flex items-center gap-1">{data.vercel.productionUrl} <ExternalLink className="w-3 h-3" /></a>
                  : data.vercel.deploymentUrl
                    ? <a href={`https://${data.vercel.deploymentUrl}`} target="_blank" rel="noreferrer" className="text-[#9FD356] hover:underline inline-flex items-center gap-1">{data.vercel.deploymentUrl} <ExternalLink className="w-3 h-3" /></a>
                    : <span className="text-zinc-500">—</span>
              }
            />

            <Separator className="my-2 bg-[#2c2c2c]" />

            {data.vercel.apiConfigured ? (
              data.vercel.lastProductionDeploy ? (
                <>
                  <Field
                    label="Last prod deploy"
                    tone={
                      data.vercel.lastProductionDeploy.state === "ERROR" ? "bad"
                        : data.vercel.lastProductionDeploy.state === "READY" ? "ok"
                          : "warn"
                    }
                    hint="Live status from Vercel REST API. ERROR means the latest production deploy failed to build — fix or rollback."
                    value={
                      <span className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={
                            data.vercel.lastProductionDeploy.state === "READY"
                              ? "border-emerald-800/60 text-emerald-300 bg-emerald-950/30 text-[10px] px-1.5 py-0"
                              : data.vercel.lastProductionDeploy.state === "ERROR"
                                ? "border-red-800/60 text-red-300 bg-red-950/30 text-[10px] px-1.5 py-0"
                                : "border-amber-800/60 text-amber-300 bg-amber-950/30 text-[10px] px-1.5 py-0"
                          }
                        >
                          {data.vercel.lastProductionDeploy.state || "?"}
                        </Badge>
                        <span className="text-zinc-400">{fmtAge(data.vercel.lastProductionDeploy.ageSec)}</span>
                        {data.vercel.lastProductionDeploy.inspectorUrl ? (
                          <a
                            href={data.vercel.lastProductionDeploy.inspectorUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#9FD356] hover:underline inline-flex items-center gap-1 text-[11px]"
                          >
                            inspect <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : null}
                      </span>
                    }
                  />
                  {data.vercel.lastProductionDeploy.errorMessage ? (
                    <Field
                      label="Build error"
                      tone="bad"
                      value={<span className="text-red-300">{data.vercel.lastProductionDeploy.errorMessage}</span>}
                    />
                  ) : null}
                </>
              ) : data.vercel.deployFetchError ? (
                <Field label="Deploy status" tone="warn" value={<span className="text-amber-300">{data.vercel.deployFetchError}</span>} />
              ) : (
                <Field label="Deploy status" tone="muted" value="no recent deployment" />
              )
            ) : (
              <div className="text-[11px] text-zinc-500 leading-relaxed pt-1">
                Set <span className="font-mono text-zinc-400">VERCEL_TOKEN</span> + <span className="font-mono text-zinc-400">VERCEL_PROJECT_ID</span> to surface the latest production deploy state here.
              </div>
            )}

            <div className="flex items-start gap-2 pt-3 mt-1 border-t border-[#2c2c2c]">
              <Info className="w-3.5 h-3.5 text-zinc-500 mt-0.5 shrink-0" />
              <div className="text-[11px] text-zinc-500 leading-relaxed">
                {data.vercel.runtimeLogsNote} For real-time tailing, open the Logs link above or wire a Log Drain into Supabase / Datadog.
              </div>
            </div>
          </SectionCard>
        </div>

        <Card className="bg-[#1f1f1f]/60 border-[#3a3a3a] p-4">
          <div className="flex items-start gap-3 text-[12px] text-zinc-400">
            <Info className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
            <div className="space-y-1 leading-relaxed">
              <p>The ERC-4337 paymaster is funded by Nova IMS infra (server-side). Ping their ops team if userOps stop being sponsored.</p>
              <p>Block age is intentionally not a failure signal — Nova Cidade only produces blocks when this game has on-chain activity, so 5-10 min idle is normal.</p>
              <p>&ldquo;Reverted txs (1h)&rdquo; counts user transactions to the active contract — sustained non-zero usually means signature replay or expired-claim attempts.</p>
            </div>
          </div>
        </Card>
      </div>
    </TooltipProvider>
  )
}

function SummaryChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] ${
        ok
          ? "border-[#9FD356]/30 bg-[#9FD356]/10 text-[#c8e8a3]"
          : "border-red-700/50 bg-red-950/30 text-red-200"
      }`}
    >
      <StatusDot tone={ok ? "ok" : "bad"} />
      <span>{label}</span>
    </div>
  )
}

function EnvGrid({ title, items, requireAll }: { title: string; items: EnvFlag[]; requireAll?: boolean }) {
  const allSet = items.every((i) => i.set)
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[11px] uppercase tracking-wider text-zinc-500">{title}</span>
        {requireAll ? (
          allSet ? (
            <Badge variant="outline" className="border-emerald-800/60 text-emerald-300 bg-emerald-950/30 text-[10px] px-1.5 py-0">all set</Badge>
          ) : (
            <Badge variant="outline" className="border-red-800/60 text-red-300 bg-red-950/30 text-[10px] px-1.5 py-0">missing</Badge>
          )
        ) : null}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
        {items.map((it) => (
          <div key={it.key} className="flex items-center gap-2 min-w-0">
            <StatusDot tone={it.set ? "ok" : (requireAll ? "bad" : "muted")} />
            <span className="font-mono text-[11px] text-zinc-300 truncate">{it.key}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
