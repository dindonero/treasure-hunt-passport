import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET: List all active social accounts
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: socialAccounts, error: accountsError } = await supabase
      .from("social_accounts")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true })

    if (accountsError) {
      console.error("Error fetching social accounts:", accountsError)
      return NextResponse.json({ error: "Failed to fetch social accounts" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      accounts: socialAccounts || [],
    }, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.error("Error in social-rewards GET:", error)
    return NextResponse.json({ error: "Failed to fetch social accounts" }, { status: 500 })
  }
}
