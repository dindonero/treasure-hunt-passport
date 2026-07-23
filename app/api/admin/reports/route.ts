import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth"
import { resolveHandlesFromDB } from "@/lib/handle-resolver"
import {
  formatReportId,
  type ReportDTO,
  type ReportRow,
  type ReportStatus,
} from "@/lib/reports"

const VALID_STATUSES: ReportStatus[] = ["open", "progress", "resolved"]

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.success) return auth.response

  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get("status")

  const supabase = await createClient()

  // Counts are always over the full table so the filter tiles stay correct
  // regardless of which bucket is selected. The actual list respects the
  // status filter.
  const [{ data: allData, error: allError }, { data: filtData, error: filtError }] = await Promise.all([
    supabase.from("tag_reports").select("status"),
    statusParam && VALID_STATUSES.includes(statusParam as ReportStatus)
      ? supabase
          .from("tag_reports")
          .select("*")
          .eq("status", statusParam)
          .order("created_at", { ascending: false })
      : supabase.from("tag_reports").select("*").order("created_at", { ascending: false }),
  ])

  if (allError || filtError) {
    console.error("[admin/reports] fetch error:", allError || filtError)
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 })
  }

  const rows = (filtData as ReportRow[]) || []
  const addresses = rows.map((r) => r.reporter_address || "").filter(Boolean)
  const handleMap = await resolveHandlesFromDB(addresses)

  // Pull the tag's current map location for any report that still references
  // a known tag. Used by the admin "wrong_place" preview to show original
  // vs proposed pin side by side.
  const tagIds = Array.from(
    new Set(rows.map((r) => r.tag_id).filter((id): id is number => typeof id === "number")),
  )
  const tagPosMap = new Map<
    number,
    { x: number | null; y: number | null; claim_code: string | null }
  >()
  if (tagIds.length > 0) {
    const { data: tagRows } = await supabase
      .from("nfc_tags")
      .select("id, location_x, location_y, claim_code")
      .in("id", tagIds)
    for (const t of tagRows || []) {
      tagPosMap.set(t.id as number, {
        x: t.location_x == null ? null : Number(t.location_x),
        y: t.location_y == null ? null : Number(t.location_y),
        claim_code: (t.claim_code as string | null) ?? null,
      })
    }
  }

  const reports: ReportDTO[] = rows.map((r) => ({
    id: formatReportId(r.id),
    numericId: r.id,
    tagId: r.tag_id,
    tagClaimCode:
      r.tag_id != null ? tagPosMap.get(r.tag_id)?.claim_code ?? null : null,
    tagName: r.tag_name || "Unknown tag",
    type: r.type,
    status: r.status,
    priority: r.priority,
    reporter:
      (r.reporter_address && handleMap.get(r.reporter_address.toLowerCase())) ||
      (r.reporter_address
        ? `${r.reporter_address.slice(0, 6)}…${r.reporter_address.slice(-4)}`
        : "Unknown"),
    reporterAddress: r.reporter_address,
    description: r.description || "",
    hasPhoto: !!r.has_photo,
    photoUrl: r.photo_url,
    originalPos: (() => {
      if (r.tag_id == null) return null
      const t = tagPosMap.get(r.tag_id)
      if (!t || t.x == null || t.y == null) return null
      return { x: t.x, y: t.y }
    })(),
    proposedPos:
      r.proposed_x != null && r.proposed_y != null
        ? { x: Number(r.proposed_x), y: Number(r.proposed_y) }
        : null,
    assigneeAddress: r.assignee_address,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    resolvedBy: r.resolved_by,
  }))

  const allRows = (allData as Pick<ReportRow, "status">[]) || []
  const counts = {
    open: 0,
    progress: 0,
    resolved: 0,
    all: allRows.length,
  }
  for (const r of allRows) {
    if (r.status === "open" || r.status === "progress" || r.status === "resolved") {
      counts[r.status] += 1
    }
  }

  return NextResponse.json({ reports, counts })
}
