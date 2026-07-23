import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET: Public endpoint — returns only tag locations for the venue map.
// No auth required. No sensitive data (no hints, rewards).
export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("nfc_tags")
      .select("name, location_x, location_y")
      .eq("status", "hidden")
      .not("location_x", "is", null)
      .not("location_y", "is", null)

    if (error) {
      console.error("Error fetching map pins:", error)
      return NextResponse.json({ error: "Failed to fetch pins" }, { status: 500 })
    }

    const pins = (data || []).map((tag: any, index: number) => ({
      id: index,
      x: tag.location_x,
      y: tag.location_y,
      name: tag.name || undefined,
    }))

    return NextResponse.json({ success: true, pins }, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.error("Error in map-pins:", error)
    return NextResponse.json({ error: "Failed to fetch pins" }, { status: 500 })
  }
}
