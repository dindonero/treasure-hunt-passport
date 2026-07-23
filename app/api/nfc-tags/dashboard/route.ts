import { type NextRequest, NextResponse } from "next/server"
import { getAuthPayload } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { hasClaimedObjectReward } from "@/lib/onchain"
import { getActiveContract } from "@/lib/contracts/active-contract"

// GET: Get all hidden tags for the dashboard, with per-user find status
export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload(request)
    const userAddress = payload?.sub.toLowerCase() || null

    const supabase = await createClient()

    // Dashboard surfaces all tags currently in play (status='hidden') PLUS
    // the caller's own paused tags ('registered'), so owners keep a way
    // to find and re-enable a tag from the map (the dedicated owner page
    // was removed in the Edit-own-tag refactor).
    let query = supabase
      .from("nfc_tags")
      .select("id, chain_id, name, hint, token_reward, status, location_x, location_y, owner_address, find_count")
      .order("name", { ascending: true })
    query = userAddress
      ? query.or(`status.eq.hidden,and(status.eq.registered,owner_address.eq.${userAddress})`)
      : query.eq("status", "hidden")
    const { data, error } = await query

    if (error) {
      console.error("Error fetching dashboard tags:", error)
      return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 })
    }

    const tags = data || []

    if (tags.length === 0) {
      return NextResponse.json({ success: true, tags: [] })
    }

    const foundSet = new Set<number>()

    if (userAddress) {
      const { address: contractAddress } = await getActiveContract()
      const checks = await Promise.all(
        tags.map(async (tag: any) => {
          const used = await hasClaimedObjectReward(userAddress, tag.chain_id, contractAddress)
          return { tagId: tag.id, used }
        })
      )
      for (const check of checks) {
        if (check.used) foundSet.add(check.tagId)
      }
    }

    const dashboardTags = tags.map((tag: any) => ({
      id: tag.id,
      name: tag.name,
      hint: tag.hint,
      token_reward: tag.token_reward,
      status: tag.status,
      location_x: tag.location_x,
      location_y: tag.location_y,
      find_count: tag.find_count || 0,
      is_own: userAddress ? tag.owner_address === userAddress : false,
      found_by_user: foundSet.has(tag.id),
    }))

    return NextResponse.json({ success: true, tags: dashboardTags }, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.error("Error in nfc-tags dashboard:", error)
    return NextResponse.json({ error: "Failed to fetch dashboard" }, { status: 500 })
  }
}
