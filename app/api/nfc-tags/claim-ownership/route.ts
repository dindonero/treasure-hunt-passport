import { type NextRequest, NextResponse } from "next/server"
import { ethers } from "ethers"
import { getAuthPayload } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { generateRewardSignature, isSignerConfigured } from "@/lib/signature"
import { hasClaimedObjectReward } from "@/lib/onchain"
import { getActiveContract } from "@/lib/contracts/active-contract"

const OWNERSHIP_REWARD_AMOUNT = "500"

// POST: Claim ownership of a blank NFC tag (first user to access becomes owner)
export async function POST(request: NextRequest) {
  try {
    if (!isSignerConfigured()) {
      return NextResponse.json({ error: "Signer not configured" }, { status: 500 })
    }

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

    // Check if user already owns a tag
    const { data: existingTag } = await supabase
      .from("nfc_tags")
      .select("id")
      .eq("owner_address", walletAddress)
      .limit(1)
      .maybeSingle()

    if (existingTag) {
      return NextResponse.json(
        { error: "You already own a tag. Each player can only claim one tag." },
        { status: 409 }
      )
    }

    // Fetch the tag
    const { data: tag, error: findError } = await supabase
      .from("nfc_tags")
      .select("*")
      .eq("claim_code", claimCode)
      .single()

    if (findError || !tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 })
    }

    // Only blank tags can be claimed for ownership
    if (tag.status !== "blank") {
      return NextResponse.json({ error: "This tag already has an owner" }, { status: 400 })
    }

    // Assign ownership
    const { data, error: updateError } = await supabase
      .from("nfc_tags")
      .update({
        owner_address: walletAddress,
        status: "registered",
      })
      .eq("id", tag.id)
      .eq("status", "blank") // optimistic lock - prevent race condition
      .select()
      .single()

    if (updateError || !data) {
      console.error("Error claiming tag ownership:", updateError)
      return NextResponse.json({ error: "Failed to claim ownership. Someone may have claimed it first." }, { status: 409 })
    }

    // Generate reward signature for ownership claim
    const { address: contractAddress } = await getActiveContract()
    const tokenAmount = ethers.parseEther(OWNERSHIP_REWARD_AMOUNT)
    const alreadyRewarded = await hasClaimedObjectReward(walletAddress, tag.chain_id, contractAddress)

    if (alreadyRewarded) {
      // Ownership claimed but already rewarded — return tag without signature
      return NextResponse.json({ success: true, tag: data })
    }

    const signature = generateRewardSignature({
      contractAddress,
      address: walletAddress,
      rewardType: "object",
      rewardId: tag.chain_id,
      amount: tokenAmount,
    })

    return NextResponse.json({
      success: true,
      tag: data,
      ownershipReward: true,
      signature,
      amount: tokenAmount.toString(),
      objectId: tag.chain_id,
    })
  } catch (error) {
    console.error("Error in nfc-tags claim-ownership:", error)
    return NextResponse.json({ error: "Failed to claim ownership" }, { status: 500 })
  }
}
