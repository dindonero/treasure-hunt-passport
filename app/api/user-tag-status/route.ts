import { type NextRequest, NextResponse } from "next/server"
import { getAuthPayload } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

// GET: Check if the authenticated user owns a tag and its status
export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload(request)
    if (!payload) {
      return NextResponse.json({ hasTag: false, tagStatus: null, tagClaimCode: null })
    }

    const walletAddress = payload.sub.toLowerCase()
    const supabase = await createClient()

    const { data: tag } = await supabase
      .from("nfc_tags")
      .select("status, claim_code")
      .eq("owner_address", walletAddress)
      .maybeSingle()

    if (!tag) {
      return NextResponse.json({ hasTag: false, tagStatus: null, tagClaimCode: null })
    }

    return NextResponse.json({
      hasTag: true,
      tagStatus: tag.status,
      tagClaimCode: tag.claim_code,
    })
  } catch (error) {
    console.error("Error in user-tag-status:", error)
    return NextResponse.json({ hasTag: false, tagStatus: null, tagClaimCode: null })
  }
}
