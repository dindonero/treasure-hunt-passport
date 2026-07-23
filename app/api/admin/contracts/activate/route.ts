import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { invalidateActiveContractCache } from "@/lib/contracts/active-contract"

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.success) return auth.response

  try {
    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: "Contract ID is required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Verify target exists and is not already active
    const { data: target, error: findError } = await supabase
      .from("contract_deployments")
      .select("id, address, is_active")
      .eq("id", id)
      .single()

    if (findError || !target) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 })
    }

    if (target.is_active) {
      return NextResponse.json({ error: "Contract is already active" }, { status: 400 })
    }

    // Execute atomic switch via Postgres RPC
    const { error: rpcError } = await supabase.rpc("switch_active_contract", {
      target_id: id,
    })

    if (rpcError) {
      console.error("[activate] RPC error:", rpcError)
      return NextResponse.json({ error: "Failed to switch contract" }, { status: 500 })
    }

    // Clear server-side cache
    invalidateActiveContractCache()

    return NextResponse.json({
      success: true,
      address: target.address,
      message: "Contract activated. Leaderboard and game state have been reset.",
    })
  } catch (error) {
    console.error("[activate] Error:", error)
    return NextResponse.json({ error: "Failed to activate contract" }, { status: 500 })
  }
}
