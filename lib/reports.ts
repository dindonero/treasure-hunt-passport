// lib/reports.ts — shared report types & catalogue (server + client)

export type ReportTypeId =
  | "not_scanning"
  | "missing"
  | "wrong_place"
  | "damaged"
  | "duplicate"
  | "other"

export type ReportStatus = "open" | "progress" | "resolved"
export type ReportPriority = "high" | "med" | "low"

export interface ReportType {
  id: ReportTypeId
  label: string
  sub: string
  icon: "nfc" | "box" | "loc" | "flame" | "copy" | "bell"
  color: "pink" | "cyan" | "orange" | "green"
  needs: Array<"photo" | "desc" | "relocate">
  defaultPriority: ReportPriority
}

export const ISSUE_TYPES: ReportType[] = [
  {
    id: "not_scanning",
    label: "Tag not scanning",
    sub: "NFC won’t read or app shows error",
    icon: "nfc",
    color: "orange",
    needs: ["photo", "desc"],
    defaultPriority: "high",
  },
  {
    id: "missing",
    label: "Tag is missing",
    sub: "No tag where the map says it should be",
    icon: "box",
    color: "pink",
    needs: ["desc"],
    defaultPriority: "high",
  },
  {
    id: "wrong_place",
    label: "Tag in the wrong place",
    sub: "Tag is somewhere else than the map shows",
    icon: "loc",
    color: "cyan",
    needs: ["relocate"],
    defaultPriority: "med",
  },
  {
    id: "damaged",
    label: "Tag damaged or vandalised",
    sub: "Sticker peeling, broken, defaced",
    icon: "flame",
    color: "pink",
    needs: ["photo", "desc"],
    defaultPriority: "high",
  },
  {
    id: "duplicate",
    label: "Duplicate / extra tag",
    sub: "Found a tag not in the registry",
    icon: "copy",
    color: "green",
    needs: ["photo", "desc"],
    defaultPriority: "low",
  },
  {
    id: "other",
    label: "Something else",
    sub: "Anything not covered above",
    icon: "bell",
    color: "cyan",
    needs: ["desc"],
    defaultPriority: "low",
  },
]

export function reportTypeMeta(id: string): ReportType {
  return ISSUE_TYPES.find((t) => t.id === id) || ISSUE_TYPES[ISSUE_TYPES.length - 1]
}

export function formatReportId(id: number): string {
  return `R-${id}`
}

export interface ReportRow {
  id: number
  tag_id: number | null
  tag_name: string | null
  type: ReportTypeId
  status: ReportStatus
  priority: ReportPriority
  reporter_address: string | null
  description: string | null
  has_photo: boolean
  photo_url: string | null
  proposed_x: number | null
  proposed_y: number | null
  assignee_address: string | null
  created_at: string
  resolved_at: string | null
  resolved_by: string | null
}

export interface ReportDTO {
  id: string // formatted "R-<n>"
  numericId: number
  tagId: number | null
  tagClaimCode: string | null
  tagName: string
  type: ReportTypeId
  status: ReportStatus
  priority: ReportPriority
  reporter: string
  reporterAddress: string | null
  description: string
  hasPhoto: boolean
  photoUrl: string | null
  // Original on-map location of the tag at admin-render time. Used by the
  // admin "wrong place" preview alongside the reporter's proposedPos.
  originalPos: { x: number; y: number } | null
  proposedPos: { x: number; y: number } | null
  assigneeAddress: string | null
  createdAt: string
  resolvedAt: string | null
  resolvedBy: string | null
}

/**
 * Render a coarse "Nm ago" relative time string for the admin list.
 * Server- and client-safe; the admin tab calls this on the response payload.
 */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ""
  const diffSec = Math.max(0, Math.round((now - t) / 1000))
  if (diffSec < 60) return `${diffSec}s ago`
  const m = Math.round(diffSec / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  return `${d}d ago`
}
