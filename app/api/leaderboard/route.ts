import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { resolveHandlesFromDB } from "@/lib/handle-resolver"

const VALID_CATEGORIES = ["mvp", "tokens", "found", "social"]
// 10s edge cache: at 4000 users this collapses ~99% of polls onto the CDN.
// Leaderboard tolerates 10s staleness — cron syncs at minute granularity anyway.
const CACHED = {
  headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" },
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category") || "mvp"

    if (category === "hidden") {
      return await getObjectsHiddenLeaderboard()
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 })
    }

    return await getIndividualLeaderboard(category)
  } catch (error) {
    console.error("Error fetching leaderboard:", error)
    return NextResponse.json({
      leaderboard: [],
      error: "Failed to fetch leaderboard data",
      success: false,
    })
  }
}

async function getIndividualLeaderboard(category: string) {
  const supabase = createAdminClient()

  const { data: scores } = await supabase
    .from("leaderboard_cache")
    .select("address, score")
    .eq("category", category)
    .order("score", { ascending: false })

  const rows = scores || []
  const addresses = rows.map((s) => s.address)
  const handles = addresses.length > 0 ? await resolveHandlesFromDB(addresses) : new Map<string, string>()

  const leaderboard = rows
    .map((s) => ({
      address: s.address,
      handle: handles.get(s.address.toLowerCase()) ?? null,
      points: Number(s.score),
      rank: 0,
    }))
    .filter((e) => e.points > 0)
    .map((entry, i) => ({ ...entry, rank: i + 1 }))

  return NextResponse.json(
    { leaderboard, success: true, category },
    CACHED,
  )
}

async function getObjectsHiddenLeaderboard() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("nfc_tags")
    .select("owner_address")
    .eq("status", "hidden")

  if (error) {
    console.error("Error fetching objects hidden:", error)
    return NextResponse.json({ leaderboard: [], success: false })
  }

  const counts: Record<string, number> = {}
  for (const item of data || []) {
    if (item.owner_address) {
      counts[item.owner_address] = (counts[item.owner_address] || 0) + 1
    }
  }

  const addresses = Object.keys(counts)
  const handles = await resolveHandlesFromDB(addresses)

  const leaderboard = Object.entries(counts)
    .map(([address, count]) => ({
      address,
      handle: handles.get(address.toLowerCase()) ?? null,
      points: count,
    }))
    .sort((a, b) => b.points - a.points)
    .map((entry, index) => ({ ...entry, rank: index + 1 }))

  return NextResponse.json({ leaderboard, success: true, category: "hidden" }, CACHED)
}
