import { type NextRequest, NextResponse } from "next/server"
import { ethers } from "ethers"
import { requireAdmin } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { getActiveContract } from "@/lib/contracts/active-contract"
import contractArtifact from "@/lib/contracts/TreasureHuntRewards.artifact.json"

const RPC_URL = (process.env.NEXT_PUBLIC_RPC_URL || "").trim()
const BUNDLER_URL = (process.env.NEXT_PUBLIC_BUNDLER_URL || "").trim()
const ENTRYPOINT = (process.env.NEXT_PUBLIC_ENTRYPOINT_ADDRESS || "").trim()
const EXPLORER_URL = (process.env.NEXT_PUBLIC_EXPLORER_URL || "").trim()
const BACKEND_PRIVATE_KEY = (process.env.BACKEND_PRIVATE_KEY || "").trim()
const SIGNER_PRIVATE_KEY = (process.env.SIGNER_PRIVATE_KEY || "").trim()

const RPC_TIMEOUT_MS = 5000
const HTTP_TIMEOUT_MS = 6000
const RECENT_TX_WINDOW_MS = 60 * 60 * 1000 // 1h

interface RpcCallResult {
  ok: boolean
  ms: number
  error?: string
  result?: unknown
}

async function rpcCall(url: string, method: string, params: unknown[] = []): Promise<RpcCallResult> {
  const start = Date.now()
  try {
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), RPC_TIMEOUT_MS)
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: ctrl.signal,
      cache: "no-store",
    })
    clearTimeout(timeout)
    const ms = Date.now() - start
    if (!res.ok) return { ok: false, ms, error: `HTTP ${res.status}` }
    const json = await res.json()
    if (json.error) return { ok: false, ms, error: json.error?.message || "RPC error" }
    return { ok: true, ms, result: json.result }
  } catch (e: unknown) {
    return { ok: false, ms: Date.now() - start, error: (e as Error).message }
  }
}

async function timedFetch(url: string): Promise<{ ok: boolean; ms: number; status?: number; error?: string; json?: unknown }> {
  const start = Date.now()
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT_MS)
    const res = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store", signal: ctrl.signal })
    clearTimeout(t)
    const ms = Date.now() - start
    if (!res.ok) return { ok: false, ms, status: res.status, error: `HTTP ${res.status}` }
    const json = await res.json()
    return { ok: true, ms, status: res.status, json }
  } catch (e) {
    return { ok: false, ms: Date.now() - start, error: (e as Error).message }
  }
}

interface BlockscoutTx {
  hash: string
  status: string | null // "ok" | "error" | null
  result: string | null // "success" | "Reverted" | error message
  timestamp: string | null
  method: string | null
  from: { hash: string } | null
  to: { hash: string } | null
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.success) return auth.response

  // ---------- RPC + bundler probes (in parallel) ----------
  // `eth_getBlockByNumber("latest")` returns block number + timestamp in one
  // round-trip, so we don't need a separate `eth_blockNumber` call.
  const [
    chainId,
    latestBlockCall,
    gasPrice,
    bundlerEntryPoints,
    bundlerChainId,
  ] = await Promise.all([
    rpcCall(RPC_URL, "eth_chainId"),
    rpcCall(RPC_URL, "eth_getBlockByNumber", ["latest", false]),
    rpcCall(RPC_URL, "eth_gasPrice"),
    rpcCall(BUNDLER_URL, "eth_supportedEntryPoints"),
    rpcCall(BUNDLER_URL, "eth_chainId"),
  ])

  let latestBlock: { number: number; timestamp: number; ageSec: number } | null = null
  let blockNumberValue: number | null = null
  if (latestBlockCall.ok && latestBlockCall.result && typeof latestBlockCall.result === "object") {
    const b = latestBlockCall.result as { number: string; timestamp: string }
    const num = Number.parseInt(b.number, 16)
    const ts = Number.parseInt(b.timestamp, 16)
    latestBlock = { number: num, timestamp: ts, ageSec: Math.floor(Date.now() / 1000) - ts }
    blockNumberValue = num
  }
  // Preserve the original `blockNumber` shape for the response payload below.
  const blockNumber = {
    ok: latestBlockCall.ok && blockNumberValue !== null,
    ms: latestBlockCall.ms,
    error: latestBlockCall.error,
    result: blockNumberValue !== null ? `0x${blockNumberValue.toString(16)}` : undefined,
  }

  // ---------- Wallets derived from env ----------
  let backendWallet: { address: string; balanceEth: string; balanceWei: string } | null = null
  if (BACKEND_PRIVATE_KEY && RPC_URL) {
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL)
      const wallet = new ethers.Wallet(BACKEND_PRIVATE_KEY, provider)
      const bal = await provider.getBalance(wallet.address)
      backendWallet = {
        address: wallet.address,
        balanceWei: bal.toString(),
        balanceEth: ethers.formatEther(bal),
      }
    } catch (e) {
      backendWallet = { address: "error", balanceEth: "0", balanceWei: (e as Error).message }
    }
  }

  const signerAddress = SIGNER_PRIVATE_KEY
    ? new ethers.Wallet(SIGNER_PRIVATE_KEY).address
    : null

  const entryPointMatches =
    bundlerEntryPoints.ok &&
    Array.isArray(bundlerEntryPoints.result) &&
    (bundlerEntryPoints.result as string[])
      .map((s) => s.toLowerCase())
      .includes(ENTRYPOINT.toLowerCase())

  // ---------- Active contract + on-chain reads ----------
  let activeContract: { address: string; deployBlock: number } | null = null
  try {
    activeContract = await getActiveContract()
  } catch {
    activeContract = null
  }

  type ContractInfo = {
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
  }
  let contract: ContractInfo | null = null
  if (activeContract?.address && RPC_URL) {
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL)
      const c = new ethers.Contract(activeContract.address, contractArtifact.abi, provider)
      const [name, symbol, totalSupply, onchainSigner, onchainOwner] = await Promise.all([
        c.name().catch(() => null),
        c.symbol().catch(() => null),
        c.totalSupply().catch(() => null),
        c.signer().catch(() => null),
        c.owner().catch(() => null),
      ])
      contract = {
        address: activeContract.address,
        deployBlock: activeContract.deployBlock,
        name: name as string | null,
        symbol: symbol as string | null,
        totalSupply: totalSupply != null ? (totalSupply as bigint).toString() : null,
        onchainSigner: onchainSigner as string | null,
        onchainOwner: onchainOwner as string | null,
        signerMatchesEnv:
          onchainSigner && signerAddress
            ? (onchainSigner as string).toLowerCase() === signerAddress.toLowerCase()
            : null,
        ownerMatchesBackend:
          onchainOwner && backendWallet?.address && backendWallet.address !== "error"
            ? (onchainOwner as string).toLowerCase() === backendWallet.address.toLowerCase()
            : null,
        error: null,
      }
    } catch (e) {
      contract = {
        address: activeContract.address,
        deployBlock: activeContract.deployBlock,
        name: null,
        symbol: null,
        totalSupply: null,
        onchainSigner: null,
        onchainOwner: null,
        signerMatchesEnv: null,
        ownerMatchesBackend: null,
        error: (e as Error).message,
      }
    }
  }

  // ---------- Supabase reachability + counts ----------
  type DbInfo = {
    ok: boolean
    latencyMs: number
    error: string | null
    projectRef: string | null   // e.g. "abcdxxxxxxxx" from <projectRef>.supabase.co
    host: string | null
    counts: {
      playersTotal: number | null    // treasure_hunt_users — wallets that picked a username (optional, so a subset of participants)
      playersUnique: number | null   // distinct wallets with at least one claimed reward — the true participant count
      tagsTotal: number | null
      tagsHidden: number | null
      tagFindsLastHour: number | null
    }
    cron: {
      lastSyncedAt: string | null
      ageSec: number | null
      lastBlockNumber: number | null
    } | null
  }
  let db: DbInfo
  {
    const start = Date.now()
    const supabase = createAdminClient()
    let supabaseHost: string | null = process.env.PGHOST || null
    let supabaseProjectRef: string | null = process.env.NEON_PROJECT_ID || null
    try {
      // Neon (Postgres) connection — derive the DB host for display.
      const u = new URL(process.env.DATABASE_URL || process.env.POSTGRES_URL || "")
      if (u.host) supabaseHost = u.host
      // Neon hosts look like ep-xxxx-pooler.<region>.aws.neon.tech — the
      // leftmost label is the endpoint id.
      if (u.host.endsWith(".neon.tech")) {
        supabaseProjectRef = process.env.NEON_PROJECT_ID || u.host.split(".")[0]
      }
    } catch { /* DATABASE_URL not set */ }
    const sinceIso = new Date(Date.now() - RECENT_TX_WINDOW_MS).toISOString()
    try {
      // A wallet only lands in treasure_hunt_users once it picks a username,
      // which is optional, so this count UNDERcounts participants. The truest
      // "ever played" figure is the distinct "claimed at least one reward"
      // sub-count we derive from leaderboard_cache below.
      const [
        playersTotal,
        cacheClaimers,
        tagsTotal,
        tagsHidden,
        tagFindsRecent,
        cron,
      ] = await Promise.all([
        supabase.from("treasure_hunt_users").select("*", { count: "exact", head: true }),
        supabase
          .from("leaderboard_cache")
          .select("address")
          .in("category", ["found", "social"])
          .limit(20000),
        supabase.from("nfc_tags").select("*", { count: "exact", head: true }),
        supabase.from("nfc_tags").select("*", { count: "exact", head: true }).eq("status", "hidden"),
        supabase.from("nfc_tag_finds").select("*", { count: "exact", head: true }).gte("found_at", sinceIso),
        supabase
          .from("sync_state")
          .select("category,last_block_number,last_synced_at")
          .order("last_synced_at", { ascending: false })
          .limit(1),
      ])

      const claimerSet = new Set<string>()
      ;((cacheClaimers.data as { address: string }[] | null) || []).forEach((r) => {
        if (r.address) claimerSet.add(r.address.toLowerCase())
      })

      const latest = cron.data?.[0] as { last_synced_at: string; last_block_number: number } | undefined
      db = {
        ok: true,
        latencyMs: Date.now() - start,
        error: null,
        projectRef: supabaseProjectRef,
        host: supabaseHost,
        counts: {
          playersTotal: playersTotal.count ?? null,
          playersUnique: claimerSet.size,
          tagsTotal: tagsTotal.count ?? null,
          tagsHidden: tagsHidden.count ?? null,
          tagFindsLastHour: tagFindsRecent.count ?? null,
        },
        cron: latest
          ? {
              lastSyncedAt: latest.last_synced_at,
              ageSec: Math.floor((Date.now() - new Date(latest.last_synced_at).getTime()) / 1000),
              lastBlockNumber: latest.last_block_number,
            }
          : null,
      }
    } catch (e) {
      db = {
        ok: false,
        latencyMs: Date.now() - start,
        error: (e as Error).message,
        projectRef: supabaseProjectRef,
        host: supabaseHost,
        counts: {
          playersTotal: null,
          playersUnique: null,
          tagsTotal: null,
          tagsHidden: null,
          tagFindsLastHour: null,
        },
        cron: null,
      }
    }
  }

  // ---------- Tag health: spot missing / under-performing NFC tags ----------
  // We compare each in-play tag to the current cohort. Cold-start safe:
  // requires a minimum sample of finds before flagging anything, and uses
  // peer activity (not absolute time) so an idle hour isn't treated as a
  // problem when nobody is playing yet.
  type TagAlert = {
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
  }
  type TagHealth = {
    ok: boolean
    error: string | null
    inPlay: number
    medianFinds: number
    totalFinds: number
    findsLastHour: number
    peerCoverageLastHour: number  // % of in-play tags that got at least one find in last hour
    flaggedCount: number
    flagged: TagAlert[]
    quietPeriod: boolean          // true when cohort signal is too thin to draw conclusions
  }
  let tagHealth: TagHealth = {
    ok: false,
    error: null,
    inPlay: 0,
    medianFinds: 0,
    totalFinds: 0,
    findsLastHour: 0,
    peerCoverageLastHour: 0,
    flaggedCount: 0,
    flagged: [],
    quietPeriod: true,
  }
  try {
    const supabase = createAdminClient()
    const [tagsRes, findsRes] = await Promise.all([
      // In-play tags only — blank/registered tags aren't yet supposed to be findable.
      supabase
        .from("nfc_tags")
        .select("id, name, claim_code, status, find_count, location_x, location_y, created_at")
        .eq("status", "hidden")
        .limit(2000),
      // Bring back enough finds to derive recency + counts. 20k = ~6500 players
      // each finding 3 tags, more than enough for a 3-day summit.
      supabase
        .from("nfc_tag_finds")
        .select("tag_id, found_at")
        .order("found_at", { ascending: false })
        .limit(20000),
    ])

    if (tagsRes.error) throw tagsRes.error
    if (findsRes.error) throw findsRes.error

    type RawTag = {
      id: number
      name: string | null
      claim_code: string
      status: string
      find_count: number | null
      location_x: number | null
      location_y: number | null
      created_at: string | null
    }
    type RawFind = { tag_id: number; found_at: string }

    const tags = (tagsRes.data as RawTag[] | null) || []
    const finds = (findsRes.data as RawFind[] | null) || []
    const nowMs = Date.now()
    const HOUR = 60 * 60 * 1000

    // Bucket finds per tag — track most recent + count in last hour.
    const lastFoundByTag = new Map<number, number>()  // tag_id → latest found_at ms
    const findsLastHourByTag = new Map<number, number>()
    let findsLastHourTotal = 0
    for (const f of finds) {
      if (!f?.tag_id || !f.found_at) continue
      const ts = Date.parse(f.found_at)
      if (!Number.isFinite(ts)) continue
      const prev = lastFoundByTag.get(f.tag_id) ?? 0
      if (ts > prev) lastFoundByTag.set(f.tag_id, ts)
      if (nowMs - ts <= HOUR) {
        findsLastHourByTag.set(f.tag_id, (findsLastHourByTag.get(f.tag_id) ?? 0) + 1)
        findsLastHourTotal += 1
      }
    }

    const findCounts = tags.map((t) => t.find_count ?? 0).sort((a, b) => a - b)
    const median = findCounts.length === 0 ? 0
      : findCounts.length % 2
        ? findCounts[(findCounts.length - 1) / 2]
        : Math.floor((findCounts[findCounts.length / 2 - 1] + findCounts[findCounts.length / 2]) / 2)

    const totalFinds = tags.reduce((sum, t) => sum + (t.find_count ?? 0), 0)
    const tagsFoundLastHour = Array.from(findsLastHourByTag.keys()).length
    const peerCoverageLastHour = tags.length === 0 ? 0 : Math.round((tagsFoundLastHour / tags.length) * 100)

    // Cold start: don't flag noise before the event has real activity.
    // Require either: median ≥ 3 finds across the cohort, OR ≥30% of tags
    // have got a find in the last hour (event-just-started but lively).
    const cohortHot = median >= 3 || peerCoverageLastHour >= 30

    const flagged: TagAlert[] = []
    if (cohortHot) {
      // Threshold: < 30% of median, but always allow a tag with 1 find when
      // the median is small. Min effective threshold is 2.
      const underThreshold = Math.max(2, Math.floor(median * 0.3))

      for (const t of tags) {
        const finds = t.find_count ?? 0
        const lastFoundMs = lastFoundByTag.get(t.id) ?? null
        const lastFoundAgoSec = lastFoundMs ? Math.floor((nowMs - lastFoundMs) / 1000) : null
        const reasons: TagAlert["reasons"] = []

        // Never-found while the cohort is moving.
        const tagAgeMs = t.created_at ? nowMs - Date.parse(t.created_at) : Infinity
        if (finds === 0 && tagAgeMs > HOUR) reasons.push("never_found")

        // Under-performing relative to cohort median.
        else if (finds < underThreshold) reasons.push("under_performing")

        // Stale: cohort had a flurry but this tag missed it.
        // Trigger when ≥30% of in-play tags got a find in the last hour AND
        // this tag has no find in the last hour AND its newest find (if any)
        // is older than 4h (or it has never been found).
        const FOUR_HOURS = 4 * HOUR
        const noRecentFind = !lastFoundMs || nowMs - lastFoundMs > FOUR_HOURS
        if (peerCoverageLastHour >= 30 && noRecentFind && finds > 0) {
          reasons.push("stale")
        }

        if (reasons.length === 0) continue

        const detail =
          reasons.includes("never_found")
            ? `0 finds — peers averaging ${median}+`
            : reasons.includes("under_performing")
              ? `${finds} finds vs cohort median ${median}`
              : `last find ${lastFoundAgoSec ? Math.floor(lastFoundAgoSec / 3600) + "h ago" : "never"} while ${peerCoverageLastHour}% of tags found in past hour`

        flagged.push({
          id: t.id,
          name: t.name,
          claimCode: t.claim_code,
          findCount: finds,
          lastFoundAt: lastFoundMs ? new Date(lastFoundMs).toISOString() : null,
          lastFoundAgoSec,
          locationX: t.location_x != null ? Number(t.location_x) : null,
          locationY: t.location_y != null ? Number(t.location_y) : null,
          reasons,
          detail,
        })
      }

      // Sort so most-suspicious appear first: never-found > stale > under-performing,
      // then by lowest find count.
      const reasonRank = (r: TagAlert) =>
        r.reasons.includes("never_found") ? 0 : r.reasons.includes("stale") ? 1 : 2
      flagged.sort((a, b) => reasonRank(a) - reasonRank(b) || a.findCount - b.findCount)
    }

    tagHealth = {
      ok: true,
      error: null,
      inPlay: tags.length,
      medianFinds: median,
      totalFinds,
      findsLastHour: findsLastHourTotal,
      peerCoverageLastHour,
      flaggedCount: flagged.length,
      flagged: flagged.slice(0, 20),
      quietPeriod: !cohortHot,
    }
  } catch (e) {
    tagHealth.error = (e as Error).message
  }

  // ---------- Blockscout: token info + recent transactions to contract ----------
  type ExplorerInfo = {
    ok: boolean
    error: string | null
    holders: number | null
    transfers: number | null
    recentTxTotal: number
    recentTxFailed: number
    recentTxFailedSamples: { hash: string; method: string | null; from: string | null; result: string | null }[]
    sampleWindowSec: number
  }
  let explorer: ExplorerInfo = {
    ok: false,
    error: null,
    holders: null,
    transfers: null,
    recentTxTotal: 0,
    recentTxFailed: 0,
    recentTxFailedSamples: [],
    sampleWindowSec: RECENT_TX_WINDOW_MS / 1000,
  }
  if (EXPLORER_URL && contract?.address) {
    const tokenUrl = `${EXPLORER_URL}/api/v2/tokens/${contract.address}`
    const txUrl = `${EXPLORER_URL}/api/v2/addresses/${contract.address}/transactions?filter=to`
    try {
      const [tokenRes, txRes] = await Promise.all([timedFetch(tokenUrl), timedFetch(txUrl)])
      if (tokenRes.ok && tokenRes.json && typeof tokenRes.json === "object") {
        const t = tokenRes.json as { holders?: string; circulating_market_cap?: string; total_supply?: string }
        explorer.holders = t.holders != null ? Number(t.holders) : null
      }
      if (txRes.ok && txRes.json && typeof txRes.json === "object") {
        const arr = (txRes.json as { items?: BlockscoutTx[] }).items ?? []
        const sinceMs = Date.now() - RECENT_TX_WINDOW_MS
        const recent = arr.filter((tx) => {
          if (!tx.timestamp) return false
          const ts = Date.parse(tx.timestamp)
          return Number.isFinite(ts) && ts >= sinceMs
        })
        explorer.recentTxTotal = recent.length
        const failed = recent.filter((tx) => tx.status === "error" || (tx.result && tx.result !== "success"))
        explorer.recentTxFailed = failed.length
        explorer.recentTxFailedSamples = failed.slice(0, 5).map((tx) => ({
          hash: tx.hash,
          method: tx.method,
          from: tx.from?.hash ?? null,
          result: tx.result,
        }))
        explorer.ok = true
      } else if (!txRes.ok) {
        explorer.error = txRes.error || `tx HTTP ${txRes.status}`
      }
    } catch (e) {
      explorer.error = (e as Error).message
    }
  } else if (!EXPLORER_URL) {
    explorer.error = "NEXT_PUBLIC_EXPLORER_URL not set"
  } else {
    explorer.error = "no active contract"
  }

  // ---------- Env var presence (no values exposed) ----------
  const REQUIRED_VARS = [
    "NEXT_PUBLIC_RPC_URL",
    "NEXT_PUBLIC_CHAIN_ID",
    "NEXT_PUBLIC_CHAIN_NAME",
    "NEXT_PUBLIC_EXPLORER_URL",
    "NEXT_PUBLIC_CONTRACT_ADDRESS",
    "NEXT_PUBLIC_BUNDLER_URL",
    "NEXT_PUBLIC_ENTRYPOINT_ADDRESS",
    "NEXT_PUBLIC_THIRDWEB_FACTORY_ADDRESS",
    "NEXT_PUBLIC_THIRDWEB_CLIENT_ID",
    "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID",
    "BACKEND_PRIVATE_KEY",
    "SIGNER_PRIVATE_KEY",
    "JWT_SECRET",
    "THIRDWEB_SECRET_KEY",
    "DATABASE_URL",
  ]
  const OPTIONAL_VARS = ["CRON_SECRET", "NEXT_PUBLIC_SITE_URL", "VERCEL_TOKEN", "VERCEL_PROJECT_ID", "VERCEL_TEAM_ID"]
  const env = {
    required: REQUIRED_VARS.map((k) => ({ key: k, set: !!(process.env[k] || "").trim() })),
    optional: OPTIONAL_VARS.map((k) => ({ key: k, set: !!(process.env[k] || "").trim() })),
  }

  // ---------- Deploy / Vercel context ----------
  // Vercel runtime logs are NOT available via REST API — only the Logs UI and
  // push-based Log Drains expose them. The actionable signal we *can* pull is
  // the latest production deployment state (READY / ERROR / BUILDING) via the
  // /v6/deployments endpoint, which surfaces "deploy failed" without anyone
  // having to open the dashboard. Requires VERCEL_TOKEN.
  type DeployStatus = {
    state: string | null
    target: string | null
    url: string | null
    createdAt: number | null
    ageSec: number | null
    errorMessage: string | null
    inspectorUrl: string | null
  } | null

  const vercelToken = (process.env.VERCEL_TOKEN || "").trim()
  const vercelProjectId = (process.env.VERCEL_PROJECT_ID || "").trim()
  const vercelTeamId = (process.env.VERCEL_TEAM_ID || "").trim()
  const repoSlug = process.env.VERCEL_GIT_REPO_SLUG || ""

  let lastProductionDeploy: DeployStatus = null
  let deployFetchError: string | null = null
  if (vercelToken && (vercelProjectId || repoSlug)) {
    const params = new URLSearchParams()
    params.set("limit", "1")
    params.set("target", "production")
    if (vercelProjectId) params.set("projectId", vercelProjectId)
    else if (repoSlug) params.set("app", repoSlug)
    if (vercelTeamId) params.set("teamId", vercelTeamId)
    const url = `https://api.vercel.com/v6/deployments?${params.toString()}`
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT_MS)
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${vercelToken}`, accept: "application/json" },
        cache: "no-store",
        signal: ctrl.signal,
      })
      clearTimeout(t)
      if (res.ok) {
        const json = (await res.json()) as {
          deployments?: { uid: string; url: string; state?: string; readyState?: string; target?: string; created?: number; createdAt?: number; meta?: Record<string, string>; inspectorUrl?: string; errorMessage?: string }[]
        }
        const d = json.deployments?.[0]
        if (d) {
          const created = d.createdAt ?? d.created ?? null
          lastProductionDeploy = {
            state: d.state || d.readyState || null,
            target: d.target || null,
            url: d.url || null,
            createdAt: created,
            ageSec: created ? Math.floor((Date.now() - created) / 1000) : null,
            errorMessage: d.errorMessage || null,
            inspectorUrl: d.inspectorUrl || null,
          }
        }
      } else {
        deployFetchError = `Vercel API HTTP ${res.status}`
      }
    } catch (e) {
      deployFetchError = (e as Error).message
    }
  }

  const vercel = {
    env: process.env.VERCEL_ENV || null,
    productionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL || null,
    deploymentUrl: process.env.VERCEL_URL || null,
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    commitRef: process.env.VERCEL_GIT_COMMIT_REF || null,
    commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE || null,
    repoOwner: process.env.VERCEL_GIT_REPO_OWNER || null,
    repoSlug: process.env.VERCEL_GIT_REPO_SLUG || null,
    apiConfigured: !!vercelToken && !!(vercelProjectId || repoSlug),
    lastProductionDeploy,
    deployFetchError,
    runtimeLogsNote:
      "Vercel runtime logs are dashboard-only (no REST API). Use Log Drains to push them out, or open the Logs tab.",
  }

  return NextResponse.json({
    timestamp: Date.now(),
    rpc: {
      url: RPC_URL,
      chainId: chainId.ok ? Number.parseInt(chainId.result as string, 16) : null,
      chainIdLatencyMs: chainId.ms,
      chainIdError: chainId.error || null,
      blockNumber: blockNumber.ok ? Number.parseInt(blockNumber.result as string, 16) : null,
      blockNumberLatencyMs: blockNumber.ms,
      blockNumberError: blockNumber.error || null,
      gasPriceWei: gasPrice.ok ? gasPrice.result : null,
      gasPriceLatencyMs: gasPrice.ms,
      latestBlock,
    },
    bundler: {
      url: BUNDLER_URL,
      chainId: bundlerChainId.ok ? Number.parseInt(bundlerChainId.result as string, 16) : null,
      chainIdLatencyMs: bundlerChainId.ms,
      chainIdError: bundlerChainId.error || null,
      supportedEntryPoints: bundlerEntryPoints.ok ? bundlerEntryPoints.result : null,
      entryPointsLatencyMs: bundlerEntryPoints.ms,
      entryPointsError: bundlerEntryPoints.error || null,
      configuredEntryPoint: ENTRYPOINT,
      entryPointMatches,
    },
    wallets: {
      backend: backendWallet,
      signer: signerAddress ? { address: signerAddress, note: "Off-chain signer (no on-chain balance required)" } : null,
    },
    contract,
    db,
    explorer,
    tagHealth,
    env,
    vercel,
  })
}
