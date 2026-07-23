import { type NextRequest, NextResponse } from "next/server"
import { ethers } from "ethers"
import { getAuthPayload } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { generateRewardSignature, isSignerConfigured } from "@/lib/signature"
import { hasClaimedReward } from "@/lib/onchain"
import { getTokenSymbol } from "@/lib/contracts/token-metadata"
import { getActiveContract } from "@/lib/contracts/active-contract"

// POST: Record finding an NFC tag and get reward signature
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    if (!isSignerConfigured()) {
      return NextResponse.json({ error: "Signer not configured" }, { status: 500 })
    }

    const payload = await getAuthPayload(request)
    if (!payload) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const finderAddress = payload.sub.toLowerCase()
    const { claimCode } = await request.json()

    if (!claimCode) {
      return NextResponse.json({ error: "Claim code is required" }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: ownedTag } = await supabase
      .from("nfc_tags")
      .select("status")
      .eq("owner_address", finderAddress)
      .maybeSingle()

    if (ownedTag && ownedTag.status !== "hidden") {
      return NextResponse.json(
        { error: "You must mark your own tag as ready before finding other tags" },
        { status: 403 }
      )
    }

    const { data: tag, error: findError } = await supabase
      .from("nfc_tags")
      .select("*")
      .eq("claim_code", claimCode)
      .single()

    if (findError || !tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 })
    }

    if (tag.status !== "hidden") {
      return NextResponse.json({ error: "This tag is not in play" }, { status: 400 })
    }

    if (tag.owner_address === finderAddress) {
      return NextResponse.json({ error: "You cannot find your own tag" }, { status: 400 })
    }

    const { address: contractAddress } = await getActiveContract()

    const reward = tag.token_reward || "100"
    const rewardAmount = ethers.parseEther(reward)

    const claimed = await hasClaimedReward(finderAddress, "object", tag.chain_id, contractAddress)
    if (claimed) {
      return NextResponse.json({ error: "You have already found this tag" }, { status: 400 })
    }

    const signature = generateRewardSignature({
      contractAddress,
      address: finderAddress,
      rewardType: "object",
      rewardId: tag.chain_id,
      amount: rewardAmount,
    })

    const symbol = await getTokenSymbol()
    const message = `You found "${tag.name}" and earned ${reward} ${symbol}!`

    return NextResponse.json({
      success: true,
      signature,
      amount: rewardAmount.toString(),
      objectId: tag.chain_id,
      tag: {
        name: tag.name,
        token_reward: tag.token_reward,
      },
      message,
    })
  } catch (error) {
    console.error("Error in nfc-tags find:", error)
    return NextResponse.json({ error: "Failed to record find" }, { status: 500 })
  }
}
