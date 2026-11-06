import { type NextRequest, NextResponse } from "next/server"
import { getAuthPayload } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { hasClaimedReward } from "@/lib/onchain"
import { issueBadge } from "@/lib/arkiv"
import { playerHandle } from "@/lib/passport-player"

// POST { claimCode, claimTx }: called by the tag page after a find lands on-chain.
// Issues this edition's badge if it is the player's first find here.
export async function POST(request: NextRequest) {
  const payload = await getAuthPayload(request)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const player = payload.sub.toLowerCase()

  const { claimCode, claimTx } = await request.json().catch(() => ({}))
  if (typeof claimCode !== "string" || !claimCode) {
    return NextResponse.json({ error: "Claim code is required" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: tag } = await supabase.from("nfc_tags").select("chain_id, name").eq("claim_code", claimCode).maybeSingle()
  if (!tag) return NextResponse.json({ error: "Tag not found" }, { status: 404 })

  // The contract is the source of truth: no on-chain claim, no badge.
  if (!(await hasClaimedReward(player, "object", String(tag.chain_id)))) {
    return NextResponse.json({ error: "This find is not on-chain" }, { status: 409 })
  }

  try {
    const result = await issueBadge({
      player,
      handle: await playerHandle(player),
      tagId: String(tag.chain_id),
      tagName: String(tag.name ?? ""),
      claimTx: typeof claimTx === "string" && /^0x[0-9a-fA-F]{64}$/.test(claimTx) ? claimTx : "",
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error("badge issue failed:", error)
    return NextResponse.json({ error: "Could not issue the badge" }, { status: 502 })
  }
}
