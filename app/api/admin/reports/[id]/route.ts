import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth"
import type { ReportStatus } from "@/lib/reports"

const VALID_STATUSES: ReportStatus[] = ["open", "progress", "resolved"]
const STORAGE_BUCKET = "images"
const STORAGE_PUBLIC_MARKER = `/storage/v1/object/public/${STORAGE_BUCKET}/`

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request)
  if (!auth.success) return auth.response

  const { id } = await params
  const numericId = Number(id)
  if (!Number.isFinite(numericId) || numericId <= 0) {
    return NextResponse.json({ error: "Invalid report id" }, { status: 400 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (typeof body.status === "string") {
    if (!VALID_STATUSES.includes(body.status as ReportStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }
    update.status = body.status
    if (body.status === "resolved") {
      update.resolved_at = new Date().toISOString()
      update.resolved_by = auth.payload.sub.toLowerCase()
    } else {
      update.resolved_at = null
      update.resolved_by = null
    }
  }
  if (typeof body.assignee === "string" || body.assignee === null) {
    update.assignee_address = body.assignee ? String(body.assignee).toLowerCase() : null
  }
  if (typeof body.priority === "string") {
    if (!["high", "med", "low"].includes(body.priority)) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 })
    }
    update.priority = body.priority
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase.from("tag_reports").update(update).eq("id", numericId)
  if (error) {
    console.error("[admin/reports/:id] update error:", error)
    return NextResponse.json({ error: "Failed to update report" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request)
  if (!auth.success) return auth.response

  const { id } = await params
  const numericId = Number(id)
  if (!Number.isFinite(numericId) || numericId <= 0) {
    return NextResponse.json({ error: "Invalid report id" }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: existing, error: fetchError } = await supabase
    .from("tag_reports")
    .select("id, photo_url")
    .eq("id", numericId)
    .maybeSingle()
  if (fetchError) {
    console.error("[admin/reports/:id] fetch-before-delete error:", fetchError)
    return NextResponse.json({ error: "Failed to look up report" }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 })
  }

  // Hard requirement: delete the storage object first. If that fails we
  // bail out and leave the row intact so the photo isn't orphaned.
  const photoUrl = existing.photo_url as string | null
  if (photoUrl) {
    const idx = photoUrl.indexOf(STORAGE_PUBLIC_MARKER)
    if (idx !== -1) {
      const filePath = photoUrl.slice(idx + STORAGE_PUBLIC_MARKER.length)
      if (filePath) {
        const { error: storageError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([filePath])
        if (storageError) {
          console.error("[admin/reports/:id] storage delete failed:", filePath, storageError)
          return NextResponse.json(
            { error: "Failed to delete report photo from storage; report not deleted" },
            { status: 500 },
          )
        }
      }
    }
    // External (non-Supabase) URLs aren't ours to delete; proceed.
  }

  const { error: deleteError } = await supabase
    .from("tag_reports")
    .delete()
    .eq("id", numericId)
  if (deleteError) {
    console.error("[admin/reports/:id] delete error:", deleteError)
    return NextResponse.json({ error: "Failed to delete report" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
