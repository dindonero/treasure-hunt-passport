import { NextResponse } from "next/server"
import { ethers } from "ethers"
import { createAdminClient } from "@/lib/supabase/admin"
import { getActiveContract } from "@/lib/contracts/active-contract"
import { fetchEventLogs, fetchAllTransferPages, fetchAllHolderPages } from "@/lib/sync/explorer"

const OBJECT_CLAIMED_TOPIC = "0x827ff32347c98d0261a55159a46121ec8614d3e148b8364e59fdcb6ee781ae6b"
const SOCIAL_CLAIMED_TOPIC = "0x53a51b2440c3ab5303c1727113ec44f4284ed58162cbac20723fcccd21372198"

// Re-read this many blocks below `last_block_number` on every run. Combined
// with the idempotent upsert into chain_events (UNIQUE on contract,tx,log),
// this guarantees we never miss an event when Blockscout's indexer lags
// behind the chain head — the missed log is simply re-fetched next minute
// and the second insert is a no-op.
const LOOKBACK_BLOCKS = 50

// Trim this many blocks off the head before persisting the watermark — gives
// the indexer time to catch up between runs. The next run starts inside the
// confirmed range plus the LOOKBACK_BLOCKS safety window.
const CONFIRMATION_BLOCKS = 12

interface SyncResult {
  category: string
  newEvents: number
  cacheRows: number
  error?: string
}

interface ParsedEvent {
  category: string
  contract_address: string
  tx_hash: string
  log_index: number
  block_number: number
  user_address: string
  item_id: string | null
  amount: number | null
}

export async function GET(request: Request) {
  // Verify cron secret (skip in dev)
  const authHeader = request.headers.get("authorization")
  if (process.env.NODE_ENV === "production") {
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  // Resolve the currently active contract
  const { address: contractAddress, deployBlock } = await getActiveContract()
  if (!contractAddress) {
    return NextResponse.json({ error: "No active contract configured" }, { status: 500 })
  }

  const supabase = createAdminClient()
  const results: SyncResult[] = []

  // Fetch the chain head once so all event categories use a consistent
  // upper bound and confirmation watermark.
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL
  let chainHead: number | null = null
  if (rpcUrl) {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl)
      chainHead = await provider.getBlockNumber()
    } catch (err) {
      console.warn("[sync] failed to read chain head, falling back to event-derived watermark:", err)
    }
  }

  // --- Found ---
  try {
    const result = await syncEventCategory(supabase, "found", OBJECT_CLAIMED_TOPIC, true, contractAddress, deployBlock, chainHead)
    results.push(result)
  } catch (err) {
    console.error("[sync] found error:", err)
    results.push({ category: "found", newEvents: 0, cacheRows: 0, error: String(err) })
  }

  // --- Social ---
  try {
    const result = await syncEventCategory(supabase, "social", SOCIAL_CLAIMED_TOPIC, false, contractAddress, deployBlock, chainHead)
    results.push(result)
  } catch (err) {
    console.error("[sync] social error:", err)
    results.push({ category: "social", newEvents: 0, cacheRows: 0, error: String(err) })
  }

  // --- MVP (transfers) ---
  try {
    const result = await syncMVP(supabase, contractAddress)
    results.push(result)
  } catch (err) {
    console.error("[sync] mvp error:", err)
    results.push({ category: "mvp", newEvents: 0, cacheRows: 0, error: String(err) })
  }

  // --- Tokens (holders snapshot) ---
  try {
    const result = await syncTokens(supabase, contractAddress)
    results.push(result)
  } catch (err) {
    console.error("[sync] tokens error:", err)
    results.push({ category: "tokens", newEvents: 0, cacheRows: 0, error: String(err) })
  }

  // Guard: check if contract changed mid-sync
  const { address: currentAddress } = await getActiveContract()
  if (currentAddress !== contractAddress) {
    console.warn("[sync] Active contract changed during sync — stale data will self-heal on next cycle")
  }

  return NextResponse.json({ success: true, contractAddress, results, synced_at: new Date().toISOString() })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncEventCategory(
  supabase: any,
  category: string,
  topic0: string,
  hasItemId: boolean,
  contractAddress: string,
  deployBlock: number,
  chainHead: number | null,
): Promise<SyncResult> {
  // Read last synced block
  const { data: stateRow } = await supabase
    .from("sync_state")
    .select("last_block_number")
    .eq("category", category)
    .single()

  const lastBlock = stateRow?.last_block_number ?? deployBlock

  // Delta read with lookback window. The chain_events upsert below is keyed
  // on (contract,tx,log) so re-reading the lookback range is a no-op.
  const fromBlock = Math.max(deployBlock, lastBlock - LOOKBACK_BLOCKS)
  const logs = await fetchEventLogs(contractAddress, topic0, fromBlock)

  // Parse new logs into chain_events rows
  const decoder = ethers.AbiCoder.defaultAbiCoder()
  const parsed: ParsedEvent[] = []
  let maxBlockSeen = lastBlock
  for (const log of logs) {
    const user = ethers.getAddress("0x" + log.topics[1].slice(26)).toLowerCase()
    const blockNum = parseInt(log.blockNumber, 16)
    const logIndex = parseInt(log.logIndex, 16)
    let itemId: string | null = null
    let amount: number | null = null

    if (hasItemId) {
      const decoded = decoder.decode(["string", "uint256"], log.data)
      itemId = decoded[0]
      amount = Number(decoded[1]) / 1e18
    }

    parsed.push({
      category,
      contract_address: contractAddress,
      tx_hash: log.transactionHash,
      log_index: logIndex,
      block_number: blockNum,
      user_address: user,
      item_id: itemId,
      amount,
    })

    if (blockNum > maxBlockSeen) maxBlockSeen = blockNum
  }

  // Idempotent persist. Duplicate (contract,tx,log) rows are silently dropped.
  for (let i = 0; i < parsed.length; i += 500) {
    const batch = parsed.slice(i, i + 500)
    const { error } = await supabase
      .from("chain_events")
      .upsert(batch, {
        onConflict: "contract_address,tx_hash,log_index",
        ignoreDuplicates: true,
      })
    if (error) {
      // No silent fallback — the operator either runs the chain_events
      // migration or the cron loudly fails. See migrations/2026_05_08_chain_events.sql.
      throw new Error(`chain_events upsert failed (did you run the chain_events migration?): ${error.message}`)
    }
  }

  // Recompute the leaderboard for this category from chain_events (the single
  // source of truth). Aggregating-from-truth is idempotent — a duplicate
  // event in the parsed batch can never inflate a score because we read the
  // unique-rowed table, not the in-memory delta.
  const scores = await computeScoresFromEvents(supabase, category, hasItemId, contractAddress)

  const now = new Date().toISOString()
  const cacheRows = Array.from(scores.entries()).map(([address, score]) => ({
    category,
    address,
    score,
    updated_at: now,
  }))

  for (let i = 0; i < cacheRows.length; i += 500) {
    const batch = cacheRows.slice(i, i + 500)
    await supabase.from("leaderboard_cache").upsert(batch, { onConflict: "category,address" })
  }

  // Prune stale entries (full recompute so safe to prune)
  await supabase.from("leaderboard_cache").delete().eq("category", category).lt("updated_at", now)

  // Inline nfc_tag_finds backfill + find_count update for "found" category.
  // Driven from the rows we just ingested so we don't re-touch tags every run.
  if (category === "found" && parsed.length > 0) {
    await backfillNfcTagFinds(supabase, parsed)
  }

  // Watermark: prefer chain head minus a confirmation buffer so the next run
  // re-reads the unconfirmed tail. If we couldn't read the head (RPC down),
  // fall back to max-block-seen so we still make progress.
  const watermark = chainHead != null
    ? Math.max(deployBlock, chainHead - CONFIRMATION_BLOCKS)
    : Math.max(deployBlock, maxBlockSeen)

  await supabase
    .from("sync_state")
    .upsert(
      { category, last_block_number: watermark, last_synced_at: new Date().toISOString() },
      { onConflict: "category" },
    )

  return { category, newEvents: parsed.length, cacheRows: cacheRows.length }
}

/**
 * Aggregate scores by reading every event row for this category from
 * chain_events. For (found, qr) we count distinct item_id per user; for
 * social we count rows per user.
 *
 * Pages through Supabase's default 1000-row response cap so large event
 * histories aren't silently truncated.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function computeScoresFromEvents(
  supabase: any,
  category: string,
  hasItemId: boolean,
  contractAddress: string,
): Promise<Map<string, number>> {
  const PAGE = 1000
  const userItems: Record<string, Set<string>> = {}
  const userCounts = new Map<string, number>()

  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from("chain_events")
      .select("user_address, item_id")
      .eq("category", category)
      .eq("contract_address", contractAddress)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`chain_events read failed: ${error.message}`)
    if (!data || data.length === 0) break

    for (const row of data as { user_address: string; item_id: string | null }[]) {
      if (hasItemId) {
        if (!row.item_id) continue
        if (!userItems[row.user_address]) userItems[row.user_address] = new Set()
        userItems[row.user_address].add(row.item_id)
      } else {
        userCounts.set(row.user_address, (userCounts.get(row.user_address) || 0) + 1)
      }
    }

    if (data.length < PAGE) break
    from += PAGE
  }

  const out = new Map<string, number>()
  if (hasItemId) {
    for (const [addr, items] of Object.entries(userItems)) out.set(addr, items.size)
  } else {
    for (const [addr, n] of userCounts.entries()) out.set(addr, n)
  }
  return out
}

/**
 * Mirror "found" events into nfc_tag_finds (unique on tag_id+finder_address)
 * and refresh nfc_tags.find_count for any tag whose row set changed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function backfillNfcTagFinds(supabase: any, parsed: ParsedEvent[]) {
  const itemIds = [...new Set(parsed.filter((e) => e.item_id).map((e) => e.item_id!))]
  if (itemIds.length === 0) return

  const { data: tags } = await supabase
    .from("nfc_tags")
    .select("id, chain_id")
    .in("chain_id", itemIds)
  if (!tags || tags.length === 0) return

  const chainIdToTagId = new Map<string, number>()
  for (const tag of tags) chainIdToTagId.set(tag.chain_id, tag.id)

  const findRows: { tag_id: number; finder_address: string }[] = []
  for (const e of parsed) {
    if (!e.item_id) continue
    const tagId = chainIdToTagId.get(e.item_id)
    if (tagId) findRows.push({ tag_id: tagId, finder_address: e.user_address })
  }

  for (let i = 0; i < findRows.length; i += 500) {
    const batch = findRows.slice(i, i + 500)
    await supabase.from("nfc_tag_finds").upsert(batch, {
      onConflict: "tag_id,finder_address",
      ignoreDuplicates: true,
    })
  }

  // Refresh find_count for the touched tags only — authoritative count from
  // nfc_tag_finds, never an increment.
  const tagIds = [...new Set(findRows.map((r) => r.tag_id))]
  for (const tagId of tagIds) {
    const { count } = await supabase
      .from("nfc_tag_finds")
      .select("*", { count: "exact", head: true })
      .eq("tag_id", tagId)
    await supabase.from("nfc_tags").update({ find_count: count ?? 0 }).eq("id", tagId)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncMVP(supabase: any, contractAddress: string): Promise<SyncResult> {
  // Fetch all minting transfers and recompute scores from scratch
  const transfers = await fetchAllTransferPages(contractAddress)
  const mintingEvents = transfers.filter((t) => t.type === "token_minting")

  if (mintingEvents.length === 0) {
    return { category: "mvp", newEvents: 0, cacheRows: 0 }
  }

  // Aggregate: sum amounts per user directly from API response
  const scores = new Map<string, number>()
  for (const t of mintingEvents) {
    const addr = (t.to?.hash || "").toLowerCase()
    if (addr) {
      const amount = Number(BigInt(t.total?.value || "0")) / 1e18
      scores.set(addr, (scores.get(addr) || 0) + amount)
    }
  }

  const now = new Date().toISOString()
  const cacheRows = Array.from(scores.entries()).map(([address, score]) => ({
    category: "mvp",
    address,
    score,
    updated_at: now,
  }))

  for (let i = 0; i < cacheRows.length; i += 500) {
    const batch = cacheRows.slice(i, i + 500)
    await supabase.from("leaderboard_cache").upsert(batch, { onConflict: "category,address" })
  }

  // Prune stale entries (full recompute so safe to prune)
  await supabase.from("leaderboard_cache").delete().eq("category", "mvp").lt("updated_at", now)

  return { category: "mvp", newEvents: mintingEvents.length, cacheRows: cacheRows.length }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncTokens(supabase: any, contractAddress: string): Promise<SyncResult> {
  const holders = await fetchAllHolderPages(contractAddress)

  if (holders.length === 0) {
    return { category: "tokens", newEvents: 0, cacheRows: 0 }
  }

  const now = new Date().toISOString()
  const cacheRows = holders.map((h) => {
    const addr = typeof h.address === "string" ? h.address : h.address?.hash || ""
    return {
      category: "tokens",
      address: addr.toLowerCase(),
      score: Number.parseFloat(h.value || "0") / 1e18,
      updated_at: now,
    }
  })

  for (let i = 0; i < cacheRows.length; i += 500) {
    const batch = cacheRows.slice(i, i + 500)
    await supabase.from("leaderboard_cache").upsert(batch, { onConflict: "category,address" })
  }

  await supabase.from("leaderboard_cache").delete().eq("category", "tokens").lt("updated_at", now)

  return { category: "tokens", newEvents: 0, cacheRows: cacheRows.length }
}
