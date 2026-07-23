import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.success) return auth.response

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("contract_deployments")
      .select("*")
      .order("deployed_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({ contracts: data })
  } catch (error) {
    console.error("[contracts] list error:", error)
    return NextResponse.json({ error: "Failed to fetch contracts" }, { status: 500 })
  }
}
