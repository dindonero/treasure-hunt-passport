import { type NextRequest, NextResponse } from "next/server"
import { getAuthPayload } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { hasClaimedObjectReward } from "@/lib/onchain"

// POST: Revert ownership of a tag back to blank (called when on-chain reward tx fails)
export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload(request)
    if (!payload) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const walletAddress = payload.sub.toLowerCase()
    const { claimCode } = await request.json()

    if (!claimCode) {
      return NextResponse.json({ error: "Claim code is required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Fetch the tag to get chain_id for digest check
    const { data: tag } = await supabase
      .from("nfc_tags")
      .select("id, chain_id, owner_address, status")
      .eq("claim_code", claimCode)
      .eq("owner_address", walletAddress)
      .eq("status", "registered")
      .single()

    if (!tag) {
      return NextResponse.json({ error: "Tag not found or not owned by you" }, { status: 404 })
    }

    // Block revert if the reward was already claimed on-chain
    const alreadyClaimed = await hasClaimedObjectReward(walletAddress, tag.chain_id)

    if (alreadyClaimed) {
      return NextResponse.json(
        { error: "Cannot revert — ownership reward was already claimed on-chain" },
        { status: 403 },
      )
    }

    // Safe to revert
    const { error: updateError } = await supabase
      .from("nfc_tags")
      .update({
        owner_address: null,
        status: "blank",
      })
      .eq("id", tag.id)
      .eq("owner_address", walletAddress)
      .eq("status", "registered")

    if (updateError) {
      console.error("Error reverting tag ownership:", updateError)
      return NextResponse.json({ error: "Failed to revert ownership" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in nfc-tags unclaim-ownership:", error)
    return NextResponse.json({ error: "Failed to revert ownership" }, { status: 500 })
  }
}
