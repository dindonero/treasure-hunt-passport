import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

interface HeatmapTag {
  id: number
  name: string | null
  x: number
  y: number
  find_count: number
}

export async function GET() {
  try {
    const supabase = createAdminClient()

    // All in-play tags (status='hidden' = ready to be found) that have a placed location.
    // We include zero-find tags so the "dead zones" view can flag them.
    const { data: tags, error } = await supabase
      .from("nfc_tags")
      .select("id, name, location_x, location_y, find_count")
      .eq("status", "hidden")
      .not("location_x", "is", null)
      .not("location_y", "is", null)

    if (error) {
      console.error("Error fetching heatmap tags:", error)
      return NextResponse.json({ success: false, tags: [], hunters: 0 })
    }

    const result: HeatmapTag[] = (tags ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      x: Number(t.location_x),
      y: Number(t.location_y),
      find_count: t.find_count ?? 0,
    }))

    // Distinct hunter count from on-chain-derived finds cache (used by leaderboard cron).
    const { count: hunters } = await supabase
      .from("treasure_hunt_users")
      .select("wallet_address", { count: "exact", head: true })

    return NextResponse.json(
      { success: true, tags: result, hunters: hunters ?? 0 },
      { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" } }
    )
  } catch (err) {
    console.error("Error in tag-heatmap:", err)
    return NextResponse.json({ success: false, tags: [], hunters: 0 })
  }
}
