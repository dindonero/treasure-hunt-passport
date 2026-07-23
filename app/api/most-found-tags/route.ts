import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { resolveHandlesFromDB } from "@/lib/handle-resolver"

export async function GET() {
  try {
    const supabase = createAdminClient()

    // Read directly from nfc_tags.find_count (maintained by cron + real-time find)
    const { data: tags, error } = await supabase
      .from("nfc_tags")
      .select("id, name, token_reward, owner_address, find_count")
      .gt("find_count", 0)
      .order("find_count", { ascending: false })

    if (error) {
      console.error("Error fetching nfc_tags:", error)
      return NextResponse.json({ success: false, tags: [] })
    }

    if (!tags || tags.length === 0) {
      return NextResponse.json({ success: true, tags: [] })
    }

    // Resolve owner handles
    const ownerAddresses = tags
      .map((t) => t.owner_address)
      .filter(Boolean) as string[]
    const handles = await resolveHandlesFromDB(ownerAddresses)

    const result = tags.map((tag, index) => ({
      rank: index + 1,
      tag_id: tag.id,
      name: tag.name,
      token_reward: tag.token_reward,
      owner_address: tag.owner_address,
      owner_handle: tag.owner_address ? handles.get(tag.owner_address.toLowerCase()) ?? null : null,
      find_count: tag.find_count,
    }))

    return NextResponse.json({ success: true, tags: result }, {
      headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" },
    })
  } catch (error) {
    console.error("Error in most-found-tags:", error)
    return NextResponse.json({ success: false, tags: [] })
  }
}
