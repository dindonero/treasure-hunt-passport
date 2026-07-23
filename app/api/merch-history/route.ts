import { NextResponse } from "next/server"
import { ethers } from "ethers"
import { createClient } from "@/lib/supabase/server"
import { resolveHandlesFromDB } from "@/lib/handle-resolver"
import { getActiveContract } from "@/lib/contracts/active-contract"

const EXPLORER_URL = (process.env.NEXT_PUBLIC_EXPLORER_URL || "").replace(/\/+$/, "")

// keccak256("MerchPurchased(address,uint256,uint256,uint256)")
const MERCH_PURCHASED_TOPIC = "0xe2ca4754cc6f1c18ae81a6dddac35d716a517b92c3f8a0d1100aca8e24d8fcd9"

export async function GET() {
  try {
    const { address: CONTRACT_ADDRESS, deployBlock } = await getActiveContract()
    if (!CONTRACT_ADDRESS || !EXPLORER_URL) {
      return NextResponse.json({ error: "Missing configuration" }, { status: 500 })
    }

    // Fetch MerchPurchased logs from Blockscout
    const apiUrl = `${EXPLORER_URL}/api?module=logs&action=getLogs&address=${CONTRACT_ADDRESS}&topic0=${MERCH_PURCHASED_TOPIC}&fromBlock=${deployBlock}&toBlock=latest`

    const response = await fetch(apiUrl, {
      headers: { accept: "application/json" },
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`Explorer API returned ${response.status}`)
    }

    const data = await response.json()
    const logs = data.result || []
    const decoder = ethers.AbiCoder.defaultAbiCoder()

    // Fetch merch items from Supabase for name/image mapping
    const supabase = await createClient()
    const { data: merchItems } = await supabase.from("merch").select("id, name, image")
    const merchMap = new Map<string, { name: string; image: string }>()
    for (const item of merchItems || []) {
      merchMap.set(String(item.id), { name: item.name, image: item.image })
    }

    // Parse logs
    const purchases: {
      buyer: string
      handle: string | null
      merchId: string
      merchName: string
      merchImage: string
      price: number
      timestamp: number
      txHash: string
    }[] = []

    for (const log of logs) {
      const buyer = ethers.getAddress("0x" + log.topics[1].slice(26)).toLowerCase()
      const decoded = decoder.decode(["uint256", "uint256", "uint256"], log.data)
      const merchId = decoded[0].toString()
      const price = Number(decoded[1]) / 1e18
      const timestamp = parseInt(log.timeStamp, 16)
      const txHash = log.transactionHash

      const merchInfo = merchMap.get(merchId)

      purchases.push({
        buyer,
        handle: null,
        merchId,
        merchName: merchInfo?.name || `Item #${merchId}`,
        merchImage: merchInfo?.image || "",
        price,
        timestamp,
        txHash,
      })
    }

    // Resolve handles
    const addresses = [...new Set(purchases.map((p) => p.buyer))]
    if (addresses.length > 0) {
      const handles = await resolveHandlesFromDB(addresses)
      for (const purchase of purchases) {
        purchase.handle = handles.get(purchase.buyer) ?? null
      }
    }

    // Sort most-recent-first
    purchases.sort((a, b) => b.timestamp - a.timestamp)

    return NextResponse.json({ purchases, success: true }, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.error("Error fetching merch history:", error)
    return NextResponse.json({ purchases: [], success: false })
  }
}
