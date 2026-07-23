import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAuthPayload } from "@/lib/auth"

// GET: returns { owns: boolean } — does the JWT-identified user already own
// any nfc_tag? Drives the "you already own a tag" gate on blank-tag claims.
// Per-user, no-store. Used in place of the user_already_owns_tag field that
// previously rode along on /api/nfc-tags/by-code (which is now edge-cached).
export async function GET(request: NextRequest) {
  const payload = await getAuthPayload(request)
  if (!payload) {
    return NextResponse.json({ owns: false }, { headers: { "Cache-Control": "no-store" } })
  }

  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from("nfc_tags")
      .select("id")
      .eq("owner_address", payload.sub)
      .limit(1)
      .maybeSingle()

    return NextResponse.json(
      { owns: !!data },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    console.error("[owns-any-tag] lookup failed:", err)
    return NextResponse.json({ owns: false }, { headers: { "Cache-Control": "no-store" } })
  }
}
