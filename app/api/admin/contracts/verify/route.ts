import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { verifyOnExplorer } from "@/lib/contracts/verify-on-explorer"

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.success) return auth.response

  try {
    const { address } = await request.json()
    if (!address) {
      return NextResponse.json({ error: "Contract address is required" }, { status: 400 })
    }

    const verified = await verifyOnExplorer(address)

    return NextResponse.json({ success: verified, address })
  } catch (error) {
    console.error("[verify] Error:", error)
    return NextResponse.json({ error: `Verification failed: ${error}` }, { status: 500 })
  }
}
