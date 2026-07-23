import { type NextRequest, NextResponse } from "next/server"
import { getAuthPayload } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

// GET: List user's owned NFC tags
export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload(request)
    if (!payload) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const walletAddress = payload.sub.toLowerCase()
    const supabase = await createClient()

    const { data: objects, error } = await supabase
      .from("nfc_tags")
      .select("*")
      .eq("owner_address", walletAddress)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching user tags:", error)
      return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 })
    }

    return NextResponse.json({ success: true, objects }, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.error("Error in user-objects GET:", error)
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 })
  }
}
