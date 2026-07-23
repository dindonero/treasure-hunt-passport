import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
import { ISSUE_TYPES, reportTypeMeta, type ReportTypeId } from "@/lib/reports"

const VALID_IDS = new Set(ISSUE_TYPES.map((t) => t.id))

// Players submit a report from the Map screen Report flow. Authenticated to
// keep junk submissions down and to attribute reports to a wallet for the
// admin tab; falls back to "anon" if attribution fails for any reason.
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth.success) return auth.response

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { tagId, type, description, hasPhoto, photoUrl, proposedPos } = body || {}

  if (!type || typeof type !== "string" || !VALID_IDS.has(type as ReportTypeId)) {
    return NextResponse.json({ error: "Invalid report type" }, { status: 400 })
  }
  const meta = reportTypeMeta(type)

  const desc = typeof description === "string" ? description.trim().slice(0, 280) : ""
  if (meta.needs.includes("desc") && desc.length < 8) {
    return NextResponse.json({ error: "Description too short" }, { status: 400 })
  }

  let proposed_x: number | null = null
  let proposed_y: number | null = null
  if (meta.needs.includes("relocate")) {
    if (!proposedPos || typeof proposedPos.x !== "number" || typeof proposedPos.y !== "number") {
      return NextResponse.json({ error: "Relocate position required" }, { status: 400 })
    }
    proposed_x = Math.max(0, Math.min(100, proposedPos.x))
    proposed_y = Math.max(0, Math.min(100, proposedPos.y))
  }

  const supabase = await createClient()

  // Look up the tag to denormalize tag_name; tag_id is optional (a duplicate
  // report may not correspond to a registered tag).
  let tagName: string | null = null
  let resolvedTagId: number | null = null
  if (typeof tagId === "number" && Number.isFinite(tagId)) {
    const { data: tag } = await supabase
      .from("nfc_tags")
      .select("id, name")
      .eq("id", tagId)
      .maybeSingle()
    if (tag) {
      resolvedTagId = tag.id
      tagName = tag.name
    }
  }

  const { data, error } = await supabase
    .from("tag_reports")
    .insert({
      tag_id: resolvedTagId,
      tag_name: tagName,
      type,
      status: "open",
      priority: meta.defaultPriority,
      reporter_address: auth.payload.sub.toLowerCase(),
      description: desc || null,
      has_photo: !!hasPhoto,
      photo_url: typeof photoUrl === "string" ? photoUrl : null,
      proposed_x,
      proposed_y,
    })
    .select("id")
    .single()

  if (error) {
    console.error("[reports] insert error:", error)
    return NextResponse.json({ error: "Failed to create report" }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: data.id })
}
