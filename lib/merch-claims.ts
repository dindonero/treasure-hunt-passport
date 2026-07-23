import { ethers } from "ethers"
import { getActiveContract } from "@/lib/contracts/active-contract"

const EXPLORER_URL = (process.env.NEXT_PUBLIC_EXPLORER_URL || "").replace(/\/+$/, "")

// keccak256("MerchPurchased(address,uint256,uint256,uint256)")
const MERCH_PURCHASED_TOPIC = "0xe2ca4754cc6f1c18ae81a6dddac35d716a517b92c3f8a0d1100aca8e24d8fcd9"

let cache: { at: number; counts: Map<string, number> } | null = null
const TTL_MS = 30_000

/**
 * Per-merchId claim count derived from on-chain MerchPurchased events.
 * Source of truth for "claimed" / "sold out" UI states. 30s in-memory cache.
 *
 * Display callers (public list, admin list) tolerate partial data — they
 * pass `{ throwOnFailure: false }` (default) and get an empty Map back when
 * Blockscout is flaky. The buy-merch stock guard MUST pass
 * `{ throwOnFailure: true }`: otherwise an explorer outage degrades to
 * "claimed=0" and we'd happily oversell a sold-out item.
 */
export async function getClaimedCounts(
  opts: { throwOnFailure?: boolean } = {},
): Promise<Map<string, number>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.counts
  const counts = new Map<string, number>()
  if (!EXPLORER_URL) {
    if (opts.throwOnFailure) throw new Error("NEXT_PUBLIC_EXPLORER_URL not configured")
    return counts
  }
  try {
    const { address, deployBlock } = await getActiveContract()
    if (!address) {
      if (opts.throwOnFailure) throw new Error("No active contract")
      return counts
    }
    const apiUrl =
      `${EXPLORER_URL}/api?module=logs&action=getLogs` +
      `&address=${address}&topic0=${MERCH_PURCHASED_TOPIC}` +
      `&fromBlock=${deployBlock}&toBlock=latest`
    const res = await fetch(apiUrl, { headers: { accept: "application/json" }, cache: "no-store" })
    if (!res.ok) throw new Error(`Blockscout HTTP ${res.status}`)
    const data = await res.json()
    const logs = data.result || []
    const decoder = ethers.AbiCoder.defaultAbiCoder()
    for (const log of logs) {
      try {
        const decoded = decoder.decode(["uint256", "uint256", "uint256"], log.data)
        const merchId = decoded[0].toString()
        counts.set(merchId, (counts.get(merchId) || 0) + 1)
      } catch {
        /* skip malformed log */
      }
    }
    cache = { at: Date.now(), counts }
    return counts
  } catch (err) {
    console.error("merch-claims: failed to fetch counts:", err)
    if (opts.throwOnFailure) throw err
    return counts
  }
}

export function invalidateClaimedCountsCache() {
  cache = null
}
