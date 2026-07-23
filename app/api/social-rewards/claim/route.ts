import { type NextRequest, NextResponse } from "next/server"
import { ethers } from "ethers"
import { getAuthPayload } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { generateRewardSignature, isSignerConfigured } from "@/lib/signature"
import { hasClaimedReward } from "@/lib/onchain"
import { getTokenSymbol } from "@/lib/contracts/token-metadata"
import { getActiveContract } from "@/lib/contracts/active-contract"
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    if (!isSignerConfigured()) {
      return NextResponse.json({ error: "Signer not configured" }, { status: 500 })
    }

    const payload = await getAuthPayload(request)
    if (!payload) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const walletAddress = payload.sub.toLowerCase()
    const { socialAccountId } = await request.json()

    if (!socialAccountId) {
      return NextResponse.json({ error: "Social account ID required" }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: socialAccount, error: accountError } = await supabase
      .from("social_accounts")
      .select("*")
      .eq("id", socialAccountId)
      .eq("is_active", true)
      .single()

    if (accountError || !socialAccount) {
      return NextResponse.json({ error: "Social account not found or inactive" }, { status: 404 })
    }

    const tokenAmount = ethers.parseEther(socialAccount.token_reward || "1")

    // Check if already claimed onchain (amount-independent claim key).
    const { address: contractAddress } = await getActiveContract()
    const alreadyClaimed = await hasClaimedReward(walletAddress, "social", socialAccountId.toString(), contractAddress)
    if (alreadyClaimed) {
      return NextResponse.json({ error: "Social reward already claimed" }, { status: 400 })
    }

    const signature = generateRewardSignature({
      contractAddress,
      address: walletAddress,
      rewardType: "social",
      rewardId: socialAccountId.toString(),
      amount: tokenAmount,
    })

    return NextResponse.json({
      success: true,
      signature,
      amount: tokenAmount.toString(),
      socialAccountId: socialAccountId.toString(),
      message: `Successfully claimed ${socialAccount.token_reward} ${await getTokenSymbol()}!`,
    })
  } catch (error) {
    console.error("Error in social-rewards claim:", error)
    return NextResponse.json({ error: "Failed to claim reward" }, { status: 500 })
  }
}
