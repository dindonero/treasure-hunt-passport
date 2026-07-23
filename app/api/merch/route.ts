import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getClaimedCounts } from "@/lib/merch-claims"

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: merch, error } = await supabase
      .from("merch")
      .select("*")
      .eq("is_active", true)

    if (error) {
      throw error
    }

    const claimed = await getClaimedCounts()

    // Sort client-side: price is stored as VARCHAR, so Supabase .order()
    // sorts lexicographically ("11337" < "2000"). Parse as numbers instead.
    const sorted = (merch || [])
      .map((m) => ({
        ...m,
        category: m.category || "access",
        focal: m.focal || "50% 50%",
        fit: !!m.fit,
        claimed: claimed.get(String(m.id)) || 0,
      }))
      .sort((a, b) => {
        const priceDiff = Number(a.price) - Number(b.price)
        if (priceDiff !== 0) return priceDiff
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

    return NextResponse.json({ merch: sorted }, {
      headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" },
    })
  } catch (error) {
    console.error("Error fetching merch:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
