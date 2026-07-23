import { type NextRequest, NextResponse } from "next/server"
import { ethers } from "ethers"
import crypto from "crypto"
import { createClient } from "@/lib/supabase/server"
import { generateMerchSignature, isSignerConfigured } from "@/lib/signature"
import { requireAuth } from "@/lib/auth"
import { balanceOfAbi } from "@/lib/contracts/abi"
import { getActiveContract } from "@/lib/contracts/active-contract"
import { getClaimedCounts } from "@/lib/merch-claims"

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    if (!isSignerConfigured()) {
      return NextResponse.json({ error: "Signer not configured" }, { status: 500 })
    }

    // Require authenticated user — address comes from JWT, not request body
    const auth = await requireAuth(request)
    if (!auth.success) return auth.response
    const address = auth.payload.sub

    const body = await request.json()
    const { merchId } = body

    if (!merchId) {
      return NextResponse.json({ error: "Merch ID is required" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: merch, error: merchError } = await supabase
      .from("merch")
      .select("id, name, price, stock")
      .eq("id", merchId)
      .eq("is_active", true)
      .single()

    if (merchError || !merch) {
      return NextResponse.json({ error: "Merch item not found" }, { status: 404 })
    }

    // Stock guard — if the admin set a stock cap, refuse to sign once the
    // on-chain claim count has reached it. Must fail closed: if the explorer
    // is unreachable, getClaimedCounts() defaults to an empty Map for display
    // callers, but here that would let us oversell. throwOnFailure: true
    // surfaces the outage so we 503 instead of silently signing past the cap.
    if (typeof merch.stock === "number" && merch.stock > 0) {
      let counts: Map<string, number>
      try {
        counts = await getClaimedCounts({ throwOnFailure: true })
      } catch (err) {
        console.error("Stock check failed for merch", merchId, err)
        return NextResponse.json(
          { error: "Stock check temporarily unavailable, please retry" },
          { status: 503 },
        )
      }
      const claimed = counts.get(String(merch.id)) || 0
      if (claimed >= merch.stock) {
        return NextResponse.json({ error: "Sold out" }, { status: 409 })
      }
    }

    const priceWei = ethers.parseEther(merch.price)

    const { address: contractAddress } = await getActiveContract()

    // Server-side balance check using the active contract
    try {
      const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL)
      const contract = new ethers.Contract(contractAddress, balanceOfAbi, provider)
      const balance: bigint = await contract.balanceOf(address)
      if (balance < priceWei) {
        return NextResponse.json({ error: "Insufficient balance" }, { status: 400 })
      }
    } catch (err) {
      console.error("Balance check failed:", err)
      // Allow purchase to proceed — contract will reject if insufficient
    }

    // Generate a random nonce so the same user can buy the same item again
    const nonce = BigInt('0x' + crypto.randomUUID().replace(/-/g, '').slice(0, 16))

    const signature = generateMerchSignature({
      contractAddress,
      address,
      merchId,
      price: priceWei,
      nonce,
    })

    return NextResponse.json({
      signature,
      price: priceWei.toString(),
      nonce: nonce.toString(),
      success: true,
    })
  } catch (error) {
    console.error("Error in merch auth API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
