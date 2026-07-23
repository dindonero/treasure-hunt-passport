import { createAdminClient } from "@/lib/supabase/admin"

interface ActiveContract {
  address: string
  deployBlock: number
}

let cached: ActiveContract | null = null
let cachedAt = 0
const TTL_MS = 5_000

/**
 * Returns the currently active contract address and deploy block.
 * Uses a 5-second in-memory TTL cache to avoid hitting the DB on every request.
 * Falls back to NEXT_PUBLIC_CONTRACT_ADDRESS if no DB row found.
 */
export async function getActiveContract(): Promise<ActiveContract> {
  const now = Date.now()
  if (cached && now - cachedAt < TTL_MS) return cached

  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from("contract_deployments")
      .select("address, deploy_block")
      .eq("is_active", true)
      .single()

    if (data) {
      cached = { address: data.address, deployBlock: data.deploy_block }
      cachedAt = now
      return cached
    }
  } catch {
    // DB unavailable — fall through to env fallback
  }

  const fallback: ActiveContract = {
    address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "",
    deployBlock: 8581,
  }
  cached = fallback
  cachedAt = now
  return fallback
}

/**
 * Force-clear the cache so the next call re-reads from DB.
 * Call this after activating a different contract.
 */
export function invalidateActiveContractCache() {
  cached = null
  cachedAt = 0
}
