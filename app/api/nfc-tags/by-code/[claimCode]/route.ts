import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET: Get NFC tag by claim code (public, edge-cacheable).
// Per-user state — claim status, ownership conflict — is fetched separately
// by the client so this response can be shared across all viewers and cached
// at the edge. See:
//   - lib/client-onchain.ts (claim-status check via direct RPC)
//   - /api/auth/owns-any-tag (per-user "already owns a tag" check)
export const revalidate = 30

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ claimCode: string }> }
) {
  try {
    const { claimCode } = await params

    if (!claimCode) {
      return NextResponse.json({ error: "Claim code required" }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: tag, error } = await supabase
      .from("nfc_tags")
      .select("id, chain_id, name, hint, token_reward, status, owner_address, location_x, location_y, created_at")
      .eq("claim_code", claimCode)
      .single()

    if (error || !tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 })
    }

    return NextResponse.json(
      { success: true, tag },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
        },
      }
    )
  } catch (error) {
    console.error("Error in nfc-tags by-code GET:", error)
    return NextResponse.json({ error: "Failed to fetch tag" }, { status: 500 })
  }
}
